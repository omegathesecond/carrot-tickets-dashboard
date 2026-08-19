import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Plus, Calendar, MapPin, Trash2, CheckCircle, XCircle, Nfc,
  CalendarDays, Ticket as TicketIcon, DollarSign, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { type Event, EventFormData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  type Ticketing,
  DEFAULT_TICKETING,
  validateTicketingSelection,
  buildTicketingPayload,
  buildPricePayload,
  validateExternalPriceRange,
} from '@/lib/ticketing';
import { currencySymbol, type Currency } from '@/lib/currency';
import { formatCurrency } from '@/lib/chartColors';
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { GalleryManager } from '@/components/GalleryManager';
import { submitNewEvent } from '@/lib/createEvent';
import { composeEventDateTime } from '@/lib/eventForm';
import { formatEventDateTimeRange } from '@/lib/eventWhen';

// Buckets shown as the status filter tabs. Drafts are "pending" (awaiting
// approval to publish), published+upcoming are "approved", published events
// happening right now are "on going", and anything finished/cancelled lands
// in its own tab.
type Bucket = 'all' | 'pending' | 'approved' | 'ongoing' | 'cancelled' | 'past';

const BUCKET_TABS: { value: Bucket; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'ongoing', label: 'On going' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'past', label: 'Past Events' },
];

// Pure: `now` is passed in (never read from the clock inside) so every consumer
// classifies against the SAME instant. Reading Date.now() here caused the tab
// counts and the filtered grid — memoized separately, computed at different
// times — to disagree for an event sitting on a start/end boundary (e.g. one
// that starts while the page is open): counted as "approved", shown as "ongoing".
function classifyEvent(e: Event, now: number): Exclude<Bucket, 'all'> {
  if (e.status === 'cancelled') return 'cancelled';
  // Drafts and events submitted-but-not-yet-approved both sit under "Pending".
  if (e.status === 'draft' || e.status === 'pending_approval') return 'pending';
  const start = new Date(e.startTime || e.eventDate).getTime();
  const end = new Date(e.endTime || e.eventDate).getTime();
  if (e.status === 'completed' || (Number.isFinite(end) && end < now)) return 'past';
  if (Number.isFinite(start) && start <= now && now <= end) return 'ongoing';
  return 'approved';
}

export function EventsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [activeTab, setActiveTab] = useState<Bucket>('all');
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [ticketing, setTicketing] = useState<Ticketing>(DEFAULT_TICKETING);
  const [externalTicketUrl, setExternalTicketUrl] = useState('');
  const [ticketUrlError, setTicketUrlError] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [currency, setCurrency] = useState<Currency>('SZL');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!user?.isSuperAdmin;

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  const resetCreateForm = () => {
    setIsDialogOpen(false);
    setIsMultiDay(false);
    setTicketing(DEFAULT_TICKETING);
    setExternalTicketUrl('');
    setTicketUrlError(null);
    setPosterFile(null);
    setGalleryFiles([]);
    setCurrency('SZL');
    setPriceMin('');
    setPriceMax('');
    setPriceError(null);
  };

  const createMutation = useMutation({
    mutationFn: (vars: { data: EventFormData; poster: File | null; gallery: File[] }) =>
      submitNewEvent(vars.data, { poster: vars.poster, gallery: vars.gallery }),
    onSuccess: ({ uploadError }) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (uploadError) {
        toast.error(`Event created, but the images didn't upload: ${uploadError} Add them from the event page.`);
      } else {
        toast.success('Event created successfully');
      }
      resetCreateForm();
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create event'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.events.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete event'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      publish ? apiClient.events.publishEvent(id) : apiClient.events.unpublishEvent(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (updated?.status === 'pending_approval') {
        toast.success('Event submitted for approval');
      } else if (updated?.status === 'published') {
        toast.success('Event published');
      } else {
        toast.success('Event updated');
      }
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update event'),
  });

  const allEvents = useMemo(() => eventsData?.data ?? [], [eventsData]);

  // Classify every event ONCE against a single `now`. The tab counts and the
  // filtered grid are both derived from this one result, so they can never
  // disagree (previously each called Date.now() separately and a boundary event
  // could be counted "approved" yet hidden from the list).
  const classified = useMemo(() => {
    const now = Date.now();
    return allEvents.map((e) => ({ event: e, bucket: classifyEvent(e, now) }));
  }, [allEvents]);

  // Analytics roll-up across every event (shown for admins & organizers alike).
  const analytics = useMemo(() => {
    const ticketsSold = allEvents.reduce((s, e) => s + (e.totalTicketsSold || 0), 0);
    const revenue = allEvents.reduce((s, e) => s + (e.totalRevenue || 0), 0);
    const active = classified.filter((c) => c.bucket === 'approved' || c.bucket === 'ongoing').length;
    return { totalEvents: allEvents.length, ticketsSold, revenue, active };
  }, [allEvents, classified]);

  // Count per bucket for the tab labels, and the filtered list for the grid —
  // both read from the single `classified` pass above.
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: allEvents.length, pending: 0, approved: 0, ongoing: 0, cancelled: 0, past: 0 };
    for (const { bucket } of classified) c[bucket] += 1;
    return c;
  }, [allEvents, classified]);

  const filteredEvents = useMemo(
    () =>
      activeTab === 'all'
        ? allEvents
        : classified.filter((c) => c.bucket === activeTab).map((c) => c.event),
    [allEvents, classified, activeTab]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Defense-in-depth: the API also validates this, but reject here first so
    // the organizer gets an inline field error instead of a round-trip.
    const urlError = validateTicketingSelection(ticketing, externalTicketUrl);
    if (urlError) {
      setTicketUrlError(urlError);
      return;
    }
    setTicketUrlError(null);

    const rangeError = ticketing === 'external' ? validateExternalPriceRange(priceMin, priceMax) : null;
    if (rangeError) {
      setPriceError(rangeError);
      return;
    }
    setPriceError(null);

    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const venue = formData.get('venue') as string;

    // Compose eventDate/startTime/endTime from the raw single- or multi-day
    // inputs. Shared with the edit form so both send identical UTC-normalized
    // shapes (see composeEventDateTime for the timezone rationale).
    const { eventDate, startTime, endTime } = composeEventDateTime({
      isMultiDay,
      eventDate: formData.get('eventDate') as string,
      startTime: formData.get('startTime') as string,
      endTime: formData.get('endTime') as string,
      startDateTime: formData.get('startDateTime') as string,
      endDateTime: formData.get('endDateTime') as string,
    });

    // Capacity is intentionally NOT collected here — it's derived from the
    // ticket quantities you add later, so the event total always matches the
    // tickets that actually exist.
    const data: EventFormData = {
      name,
      description: description || undefined,
      venue,
      eventDate,
      startTime,
      endTime,
      isMultiDay,
      ticketTypes: [],
      ...buildTicketingPayload(ticketing, externalTicketUrl),
      ...buildPricePayload(ticketing, currency, priceMin, priceMax),
    };

    createMutation.mutate({ data, poster: posterFile, gallery: galleryFiles });
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const analyticsCards = [
    { label: 'Total Events', value: analytics.totalEvents.toLocaleString(), icon: CalendarDays },
    { label: 'Tickets Sold', value: analytics.ticketsSold.toLocaleString(), icon: TicketIcon },
    // Platform-wide, across every event (may mix E- and R-priced events) —
    // base currency, not one event's symbol.
    { label: 'Total Revenue', value: formatCurrency(analytics.revenue), icon: DollarSign },
    { label: 'Active Events', value: analytics.active.toLocaleString(), icon: Activity },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-slate-600">Manage your events and ticket configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetCreateForm())}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600">
              <Plus className="h-4 w-4 mr-2" /> Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Who sells the tickets?</Label>
                <Tabs value={ticketing} onValueChange={(v) => setTicketing(v as Ticketing)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="carrot">Carrot sells (recommended)</TabsTrigger>
                    <TabsTrigger value="external">I sell them myself</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="SZL">E (SZL) — Eswatini Lilangeni</option>
                  <option value="ZAR">R (ZAR) — South African Rand</option>
                </select>
                <p className="text-xs text-slate-500">
                  Prices for this event are shown with this currency's symbol ({currencySymbol(currency)}).
                </p>
              </div>

              {ticketing === 'external' && (
                <div className="space-y-2">
                  <Label htmlFor="externalTicketUrl">Ticket link (https://…)</Label>
                  <Input
                    id="externalTicketUrl"
                    type="url"
                    value={externalTicketUrl}
                    onChange={(e) => {
                      setExternalTicketUrl(e.target.value);
                      setTicketUrlError(null);
                    }}
                    placeholder="https://your-site.com/tickets"
                    required
                  />
                  {ticketUrlError && <p className="text-xs text-red-600">{ticketUrlError}</p>}
                  <p className="text-xs text-slate-500">
                    Buyers will be sent to this link. Carrot won't process the sale.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="priceMin">From</Label>
                      <Input id="priceMin" type="number" min="0" step="0.01" value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)} placeholder="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceMax">To</Label>
                      <Input id="priceMax" type="number" min="0" step="0.01" value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)} placeholder="250" />
                    </div>
                  </div>
                  {priceError && <p className="text-xs text-red-600">{priceError}</p>}
                  <p className="text-xs text-slate-500">
                    Shown on the card as a price range, e.g. {currencySymbol(currency)}100 – {currencySymbol(currency)}250. Optional.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name</Label>
                  <Input id="name" name="name" required placeholder="e.g., Summer Music Festival" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input id="venue" name="venue" required placeholder="e.g., National Stadium" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input id="description" name="description" placeholder="Brief description of the event" />
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Checkbox
                  id="isMultiDay"
                  checked={isMultiDay}
                  onCheckedChange={(checked) => setIsMultiDay(checked as boolean)}
                />
                <Label htmlFor="isMultiDay" className="cursor-pointer font-normal">
                  This is a multi-day event
                </Label>
              </div>

              {!isMultiDay ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">Event Date</Label>
                    <Input id="eventDate" name="eventDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input id="startTime" name="startTime" type="time" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input id="endTime" name="endTime" type="time" required />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDateTime">Start Date & Time</Label>
                    <Input id="startDateTime" name="startDateTime" type="datetime-local" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDateTime">End Date & Time</Label>
                    <Input id="endDateTime" name="endDateTime" type="datetime-local" required />
                  </div>
                </div>
              )}

              {ticketing === 'carrot' && (
                <p className="text-xs text-slate-500">
                  You'll set how many tickets are available when you add ticket types to this event.
                </p>
              )}

              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Poster & photos</p>
                  <p className="text-xs text-slate-500">Add a poster and a few event photos — events with images get far more views, and multiple photos animate on the card.</p>
                </div>
                <ImageUploadInput
                  label="Event poster"
                  onFileSelect={setPosterFile}
                  onRemove={() => setPosterFile(null)}
                />
                <GalleryManager
                  label="Event photos"
                  onFilesSelect={() => {}}
                  onRemove={() => {}}
                  onNewFilesChange={setGalleryFiles}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Event'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analytics summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">{c.label}</div>
                  <Icon className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status filter tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Bucket)}>
        <TabsList className="flex flex-wrap h-auto">
          {BUCKET_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <span className="ml-1.5 text-xs text-slate-400">{counts[t.value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No events in this category.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const isPublished = event.status === 'published';
            return (
              <Card key={event._id} className="hover:shadow-lg transition-shadow">
                <Link to={`/events/${event._id}`} className="block">
                  {(event.posterUrl || event.thumbnailUrl) && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                      <img
                        src={event.posterUrl || event.thumbnailUrl}
                        alt={event.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{event.name}</span>
                      {isPublished ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-slate-400" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* A cashless ask is only actionable by Carrot staff, so it
                        surfaces here for them rather than in the organizer's list. */}
                    {isAdmin && event.cashlessRequestedAt && !event.cashless && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700">
                        <Nfc className="h-3.5 w-3.5" />
                        Cashless requested
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-slate-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {event.venue}
                      </div>
                      <div className="flex items-center text-slate-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatEventDateTimeRange(event)}
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="text-xs text-slate-600">Tickets Sold</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {event.totalTicketsSold || 0} / {event.capacity || event.ticketTypes.reduce((sum, tt) => sum + tt.quantity, 0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Link>
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    {(() => {
                      const isPendingEvent = event.status === 'pending_approval';
                      // Pending event: organizers see a disabled marker; admins
                      // get an Approve action. Otherwise it's a normal
                      // publish/unpublish toggle.
                      if (isPendingEvent && !isAdmin) {
                        return (
                          <Button size="sm" variant="outline" className="flex-1" disabled>
                            Pending Approval
                          </Button>
                        );
                      }
                      if (isPendingEvent && isAdmin) {
                        return (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => publishMutation.mutate({ id: event._id, publish: true })}
                          >
                            Approve
                          </Button>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant={isPublished ? 'outline' : 'default'}
                          className="flex-1"
                          onClick={() => publishMutation.mutate({ id: event._id, publish: !isPublished })}
                        >
                          {isPublished ? 'Unpublish' : isAdmin ? 'Publish' : 'Submit for Approval'}
                        </Button>
                      );
                    })()}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(event)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this event?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" and its ticket configuration will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete event"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
      />
    </div>
  );
}

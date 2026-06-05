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
  Plus, Calendar, MapPin, Trash2, CheckCircle, XCircle,
  CalendarDays, Ticket as TicketIcon, DollarSign, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { type Event, EventFormData } from '@/types';

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

function classifyEvent(e: Event): Exclude<Bucket, 'all'> {
  const now = Date.now();
  if (e.status === 'cancelled') return 'cancelled';
  if (e.status === 'draft') return 'pending';
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
  const queryClient = useQueryClient();

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: EventFormData) => apiClient.events.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      setIsDialogOpen(false);
      setIsMultiDay(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update event'),
  });

  const allEvents = useMemo(() => eventsData?.data ?? [], [eventsData]);

  // Analytics roll-up across every event (shown for admins & organizers alike).
  const analytics = useMemo(() => {
    const ticketsSold = allEvents.reduce((s, e) => s + (e.totalTicketsSold || 0), 0);
    const revenue = allEvents.reduce((s, e) => s + (e.totalRevenue || 0), 0);
    const active = allEvents.filter((e) => {
      const b = classifyEvent(e);
      return b === 'approved' || b === 'ongoing';
    }).length;
    return { totalEvents: allEvents.length, ticketsSold, revenue, active };
  }, [allEvents]);

  // Count per bucket for the tab labels, and the filtered list for the grid.
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: allEvents.length, pending: 0, approved: 0, ongoing: 0, cancelled: 0, past: 0 };
    for (const e of allEvents) c[classifyEvent(e)] += 1;
    return c;
  }, [allEvents]);

  const filteredEvents = useMemo(
    () => (activeTab === 'all' ? allEvents : allEvents.filter((e) => classifyEvent(e) === activeTab)),
    [allEvents, activeTab]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const venue = formData.get('venue') as string;

    let eventDate: string;
    let startTime: string;
    let endTime: string;

    if (isMultiDay) {
      const startDateTime = formData.get('startDateTime') as string;
      const endDateTime = formData.get('endDateTime') as string;
      eventDate = startDateTime.split('T')[0];
      startTime = startDateTime;
      endTime = endDateTime;
    } else {
      const eventDateValue = formData.get('eventDate') as string;
      const startTimeValue = formData.get('startTime') as string;
      const endTimeValue = formData.get('endTime') as string;
      eventDate = eventDateValue;
      startTime = `${eventDateValue}T${startTimeValue}`;
      endTime = `${eventDateValue}T${endTimeValue}`;
    }

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
    };

    createMutation.mutate(data);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const analyticsCards = [
    { label: 'Total Events', value: analytics.totalEvents.toLocaleString(), icon: CalendarDays },
    { label: 'Tickets Sold', value: analytics.ticketsSold.toLocaleString(), icon: TicketIcon },
    { label: 'Total Revenue', value: `E ${analytics.revenue.toLocaleString()}`, icon: DollarSign },
    { label: 'Active Events', value: analytics.active.toLocaleString(), icon: Activity },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-slate-600">Manage your events and ticket configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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

              <p className="text-xs text-slate-500">
                You'll set how many tickets are available when you add ticket types to this event.
              </p>

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
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-slate-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {event.venue}
                      </div>
                      <div className="flex items-center text-slate-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {format(new Date(event.eventDate || event.startTime), 'PPp')}
                        {event.isMultiDay && ` - ${format(new Date(event.endTime), 'PPp')}`}
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
                    <Button
                      size="sm"
                      variant={isPublished ? 'outline' : 'default'}
                      className="flex-1"
                      onClick={() => publishMutation.mutate({ id: event._id, publish: !isPublished })}
                    >
                      {isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
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

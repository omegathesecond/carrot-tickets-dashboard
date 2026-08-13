import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { publicEventUrl } from '@/lib/eventUrl';
import {
  type Ticketing,
  DEFAULT_TICKETING,
  validateTicketingSelection,
  buildTicketingPayload,
  buildPricePayload,
  validateExternalPriceRange,
} from '@/lib/ticketing';
import { currencySymbol, formatMoney, type Currency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TicketTypeDialog, type TicketTypeSubmitData } from '@/components/TicketTypeDialog';
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { GalleryManager } from '@/components/GalleryManager';
import { EventAnalyticsTab } from '@/components/EventAnalyticsTab';
import { EventCreatorTab } from '@/components/EventCreatorTab';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChannelsManager } from '@/components/community/ChannelsManager';
import { AnnouncementComposer } from '@/components/community/AnnouncementComposer';
import { MembersModeration } from '@/components/community/MembersModeration';
import { useAuth } from '@/contexts/AuthContext';
import { canManageEvents } from '@/lib/permissions';
import { formatEventDateTimeRange } from '@/lib/eventWhen';
import { getSaleTicketType, getSaleTicketCodes } from '@/lib/sales';
import {
  ArrowLeft, Calendar, MapPin, Users, CheckCircle, Clock,
  Edit, Trash2, Eye, EyeOff, QrCode, Plus, TrendingUp, TrendingDown, Image, BarChart3, UserCircle,
  Share2, Link as LinkIcon, MessagesSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { TicketType, EventFormData } from '@/types';

export function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ticketing, setTicketing] = useState<Ticketing>(DEFAULT_TICKETING);
  const [externalTicketUrl, setExternalTicketUrl] = useState('');
  const [ticketUrlError, setTicketUrlError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('SZL');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);

  // Keshless admins approve events (publish them live) and can unpublish/delete
  // even after tickets sell. Organizers instead SUBMIT events for approval.
  const isAdmin = !!user?.isSuperAdmin;
  // Renaming a live event is ADMIN-ONLY on purpose: an organizer silently
  // swapping the name of an approved/sold event is a bait-and-switch fraud
  // vector. Enforced server-side too — the UI gate is not the guard. Organizers
  // must get the name right at creation (they're warned there) and ask Keshless
  // to correct genuine mistakes.
  const canRenameEvent = isAdmin;
  // Community management (channels/announcements/moderation) needs the same
  // create/edit-event capability as the rest of this page's editing affordances.
  const canManageCommunity = canManageEvents(user);

  // Inline rename of the event title in the header.
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiClient.events.getEvent(id!),
    enabled: !!id,
  });

  const { data: sales } = useQuery({
    queryKey: ['sales', id],
    queryFn: () => apiClient.sales.getSales({ eventId: id, limit: 10 }),
    enabled: !!id,
  });

  const { data: scans } = useQuery({
    queryKey: ['scans', id],
    queryFn: () => apiClient.scans.getScans({ eventId: id, limit: 10 }),
    enabled: !!id,
  });

  // Initialize the "who sells the tickets?" toggle from the loaded event —
  // absent `ticketing` on legacy events means 'carrot' (backward compatible).
  useEffect(() => {
    if (event) {
      setTicketing(event.ticketing ?? DEFAULT_TICKETING);
      setExternalTicketUrl(event.externalTicketUrl ?? '');
      setTicketUrlError(null);
      setCurrency(event.currency ?? 'SZL');
      setPriceMin(event.priceMin != null ? String(event.priceMin) : '');
      setPriceMax(event.priceMax != null ? String(event.priceMax) : '');
      setPriceError(null);
    }
  }, [event?._id, event?.ticketing, event?.externalTicketUrl, event?.currency, event?.priceMin, event?.priceMax]);

  const publishMutation = useMutation({
    mutationFn: (publish: boolean) =>
      publish ? apiClient.events.publishEvent(id!) : apiClient.events.unpublishEvent(id!),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      // Message reflects the state the event actually landed in, so an
      // organizer sees "submitted for approval" rather than a misleading
      // "published".
      if (updated?.status === 'pending_approval') {
        toast.success('Event submitted for approval — it goes live once Keshless approves it.');
      } else if (updated?.status === 'published') {
        toast.success('Event published');
      } else {
        toast.success('Event updated');
      }
    },
    // Never swallow a failed publish/unpublish — surface it.
    onError: (error: any) => toast.error(error.message || 'Failed to update event'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.events.deleteEvent(id!),
    onSuccess: () => {
      toast.success('Event deleted successfully');
      navigate('/events');
    },
    onError: (error: any) => toast.error(error.message),
  });

  // Inline rename — reuses the shared partial-update endpoint (admin-only,
  // enforced server-side), so the same cache invalidation and loud error
  // surfacing as every other event edit.
  const renameMutation = useMutation({
    mutationFn: (name: string) => apiClient.events.updateEvent(id!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event name updated');
      setIsEditingName(false);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update event name'),
  });

  const handleStartRename = () => {
    setNameDraft(event?.name ?? '');
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast.error('Event name cannot be empty');
      return;
    }
    // Nothing changed — just close the editor without a needless round-trip.
    if (trimmed === event?.name) {
      setIsEditingName(false);
      return;
    }
    renameMutation.mutate(trimmed);
  };

  const updateTicketingMutation = useMutation({
    mutationFn: (payload: Partial<EventFormData>) => apiClient.events.updateEvent(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Ticketing settings updated');
    },
    // Never swallow a failed save — surface it so the organizer knows the
    // toggle/link change did not take effect.
    onError: (error: any) => toast.error(error.message || 'Failed to update ticketing settings'),
  });

  const handleSaveTicketing = () => {
    const error = validateTicketingSelection(ticketing, externalTicketUrl);
    if (error) {
      setTicketUrlError(error);
      return;
    }
    setTicketUrlError(null);

    const rangeError = ticketing === 'external' ? validateExternalPriceRange(priceMin, priceMax) : null;
    if (rangeError) {
      setPriceError(rangeError);
      return;
    }
    setPriceError(null);

    updateTicketingMutation.mutate({
      ...buildTicketingPayload(ticketing, externalTicketUrl),
      ...buildPricePayload(ticketing, currency, priceMin, priceMax),
    });
  };

  const addTicketMutation = useMutation({
    mutationFn: (ticketData: TicketTypeSubmitData) =>
      apiClient.events.addTicketType(id!, ticketData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Ticket type added successfully');
      setTicketDialogOpen(false);
      setEditingTicket(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ ticketName, updates }: { ticketName: string; updates: any }) =>
      apiClient.events.updateTicketType(id!, ticketName, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Ticket type updated successfully');
      setTicketDialogOpen(false);
      setEditingTicket(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteTicketMutation = useMutation({
    mutationFn: (ticketName: string) => apiClient.events.deleteTicketType(id!, ticketName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Ticket type deleted successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const adjustQuantityMutation = useMutation({
    mutationFn: ({ ticketName, adjustment }: { ticketName: string; adjustment: number }) =>
      apiClient.events.adjustTicketQuantity(id!, ticketName, adjustment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Quantity adjusted successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const toggleSoldOutMutation = useMutation({
    mutationFn: ({ ticketName, isSoldOut }: { ticketName: string; isSoldOut: boolean }) =>
      apiClient.events.markTicketSoldOut(id!, ticketName, isSoldOut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Sold-out status updated');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const uploadPosterMutation = useMutation({
    mutationFn: (file: File) => apiClient.events.uploadPoster(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Poster uploaded successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const uploadThumbnailMutation = useMutation({
    mutationFn: (file: File) => apiClient.events.uploadThumbnail(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Thumbnail uploaded successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const uploadGalleryMutation = useMutation({
    mutationFn: (files: File[]) => apiClient.events.uploadGalleryImages(id!, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Gallery images uploaded successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMediaMutation = useMutation({
    mutationFn: ({ url, mediaType }: { url: string; mediaType: 'poster' | 'thumbnail' | 'gallery' | 'qrcode' }) =>
      apiClient.events.deleteMedia(id!, url, mediaType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('Media deleted successfully');
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (isLoading) {
    return <div className="p-8">Loading event details...</div>;
  }

  if (!event) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Event Not Found</h2>
          <p className="text-slate-600 mb-4">The event you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/events')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const isPublished = event.status === 'published';
  const isPending = event.status === 'pending_approval';
  const statusLabel =
    event.status === 'pending_approval' ? 'Waiting for Approval' : event.status;
  const statusVariant: 'default' | 'secondary' | 'destructive' =
    isPublished ? 'default' : isPending ? 'secondary' : 'secondary';
  const totalCapacity = event.capacity || event.ticketTypes.reduce((sum, tt) => sum + tt.quantity, 0);
  const soldPercentage = totalCapacity > 0 ? (event.totalTicketsSold / totalCapacity) * 100 : 0;

  // Public buyer-facing page: slugged URL, resolved by the trailing _id
  // (same URL the QR code encodes).
  const eventShareUrl = publicEventUrl(event);

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(eventShareUrl);
      toast.success('Event link copied to clipboard');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy link');
    }
  };

  const handleSharePublicLink = async () => {
    const shareText = `Check out ${event.name} at ${event.venue} — get your tickets here:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text: shareText, url: eventShareUrl });
      } catch (err: any) {
        // User dismissing the share sheet is not an error.
        if (err?.name !== 'AbortError') toast.error(err?.message || 'Failed to share link');
      }
    } else {
      // No native share sheet on this browser — copy instead.
      await handleCopyPublicLink();
    }
  };


  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/events')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={200}
                    autoFocus
                    disabled={renameMutation.isPending}
                    aria-label="Event name"
                    className="h-11 w-[24rem] max-w-full text-2xl font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                  />
                  <Button size="sm" onClick={handleSaveName} disabled={renameMutation.isPending}>
                    {renameMutation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingName(false)}
                    disabled={renameMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold">{event.name}</h1>
                  {canRenameEvent && event.status !== 'cancelled' && event.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-slate-900"
                      onClick={handleStartRename}
                      aria-label="Edit event name"
                      title="Edit event name (admin)"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Badge variant={statusVariant} className="capitalize">
                    {statusLabel}
                  </Badge>
                </>
              )}
            </div>
            <p className="text-slate-600 mt-1">Event ID: {event.eventId}</p>
            {isPending && (
              <p className="text-sm text-amber-700 mt-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {isAdmin
                  ? 'This event is awaiting your approval.'
                  : 'Submitted — waiting for Keshless to approve it before it goes live.'}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isPublished ? (
            // Pull a live event back to draft. Organizers are blocked once
            // tickets have sold; admins can override (handled server-side).
            <Button
              variant="outline"
              onClick={() => publishMutation.mutate(false)}
              disabled={publishMutation.isPending}
            >
              <EyeOff className="h-4 w-4 mr-2" /> Unpublish
            </Button>
          ) : isPending ? (
            isAdmin ? (
              // Admin approval — takes the event live.
              <Button
                onClick={() => publishMutation.mutate(true)}
                disabled={publishMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Approve &amp; Publish
              </Button>
            ) : (
              // Organizer can withdraw their submission back to draft.
              <Button
                variant="outline"
                onClick={() => publishMutation.mutate(false)}
                disabled={publishMutation.isPending}
              >
                <EyeOff className="h-4 w-4 mr-2" /> Withdraw
              </Button>
            )
          ) : (
            // Draft: admin publishes live, organizer submits for approval.
            <Button
              onClick={() => publishMutation.mutate(true)}
              disabled={publishMutation.isPending}
            >
              <Eye className="h-4 w-4 mr-2" />
              {isAdmin ? 'Publish' : 'Submit for Approval'}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full max-w-lg ${canManageCommunity ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="creator" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Creator
          </TabsTrigger>
          {canManageCommunity && (
            <TabsTrigger value="community" className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4" />
              Community
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event Information */}
            <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Event Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-600 mb-1">Venue</div>
                  <div className="flex items-center text-slate-900">
                    <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                    {event.venue}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Capacity</div>
                  <div className="flex items-center text-slate-900">
                    <Users className="h-4 w-4 mr-2 text-slate-400" />
                    {totalCapacity.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Date & Time</div>
                <div className="flex items-center text-slate-900">
                  <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                  <span>{formatEventDateTimeRange(event)}</span>
                </div>
              </div>

              {event.description && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Description</div>
                  <p className="text-slate-900">{event.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ticketing Card — who sells the tickets: Carrot (existing
              checkout + tier editor below) or the organizer, on their own
              site (Carrot won't process the sale; only a link is needed). */}
          <Card>
            <CardHeader>
              <CardTitle>Ticketing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Who sells the tickets?</Label>
                <Tabs value={ticketing} onValueChange={(v) => setTicketing(v as Ticketing)}>
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="carrot">Carrot sells (recommended)</TabsTrigger>
                    <TabsTrigger value="external">I sell them myself</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2 max-w-md">
                <Label htmlFor="edit-currency">Currency</Label>
                <select
                  id="edit-currency"
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
                <div className="space-y-2 max-w-md">
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
                  />
                  {ticketUrlError && <p className="text-xs text-red-600">{ticketUrlError}</p>}
                  <p className="text-xs text-slate-500">
                    Buyers will be sent to this link. Carrot won't process the sale.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-priceMin">From</Label>
                      <Input id="edit-priceMin" type="number" min="0" step="0.01" value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)} placeholder="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-priceMax">To</Label>
                      <Input id="edit-priceMax" type="number" min="0" step="0.01" value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)} placeholder="250" />
                    </div>
                  </div>
                  {priceError && <p className="text-xs text-red-600">{priceError}</p>}
                  <p className="text-xs text-slate-500">
                    Shown on the card as a price range, e.g. {currencySymbol(currency)}100 – {currencySymbol(currency)}250. Optional.
                  </p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleSaveTicketing}
                disabled={updateTicketingMutation.isPending}
              >
                {updateTicketingMutation.isPending ? 'Saving...' : 'Save Ticketing Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Ticket Types Card — Carrot's own tier editor. Not applicable
              when the organizer sells tickets externally: there's nothing
              for Carrot to inventory or check out. */}
          {ticketing === 'carrot' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ticket Configurations</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTicket(null);
                    setTicketDialogOpen(true);
                  }}
                  className="bg-gradient-to-r from-orange-600 to-amber-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ticket Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {event.ticketTypes && event.ticketTypes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.ticketTypes.map((ticket) => (
                      <TableRow key={ticket.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {ticket.name}
                            {ticket.isSoldOut && (
                              <Badge variant="destructive" className="text-xs">SOLD OUT</Badge>
                            )}
                          </div>
                          {ticket.description && (
                            <div className="text-xs text-slate-500 mt-1">{ticket.description}</div>
                          )}
                        </TableCell>
                        <TableCell>{formatMoney(ticket.price, event.currency ?? 'SZL', { space: true, decimals: 0 })}</TableCell>
                        <TableCell className="text-right">{ticket.quantity}</TableCell>
                        <TableCell className="text-right">{ticket.sold}</TableCell>
                        <TableCell className="text-right">
                          <span className={ticket.available === 0 ? 'text-red-600 font-semibold' : ''}>
                            {ticket.available}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => adjustQuantityMutation.mutate({ ticketName: ticket.name, adjustment: 10 })}
                              title="Add 10 tickets"
                            >
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (ticket.quantity - 10 >= ticket.sold) {
                                  adjustQuantityMutation.mutate({ ticketName: ticket.name, adjustment: -10 });
                                } else {
                                  toast.error('Cannot reduce below sold count');
                                }
                              }}
                              title="Remove 10 tickets"
                              disabled={ticket.quantity - 10 < ticket.sold}
                            >
                              <TrendingDown className="h-4 w-4 text-orange-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTicket(ticket);
                                setTicketDialogOpen(true);
                              }}
                              title="Edit ticket type"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (ticket.sold > 0) {
                                  toast.error('Cannot delete ticket type with sold tickets');
                                } else if (confirm(`Delete "${ticket.name}" ticket type?`)) {
                                  deleteTicketMutation.mutate(ticket.name);
                                }
                              }}
                              title="Delete ticket type"
                              disabled={ticket.sold > 0}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant={ticket.isSoldOut ? 'default' : 'outline'}
                              onClick={() =>
                                toggleSoldOutMutation.mutate({
                                  ticketName: ticket.name,
                                  isSoldOut: !ticket.isSoldOut,
                                })
                              }
                              title={ticket.isSoldOut ? 'Mark as available' : 'Mark as sold out'}
                            >
                              {ticket.isSoldOut ? 'Available' : 'Sold Out'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p className="mb-4">No ticket types configured yet</p>
                  <Button
                    onClick={() => {
                      setEditingTicket(null);
                      setTicketDialogOpen(true);
                    }}
                    className="bg-gradient-to-r from-orange-600 to-amber-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Ticket Type
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Media & Images Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Image className="h-5 w-5 mr-2" />
                Media & Images
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Poster */}
              <ImageUploadInput
                label="Event Poster"
                currentImageUrl={event.posterUrl}
                onFileSelect={(file) => uploadPosterMutation.mutate(file)}
                onRemove={() => event.posterUrl && deleteMediaMutation.mutate({ url: event.posterUrl, mediaType: 'poster' })}
                maxSize={5}
                disabled={uploadPosterMutation.isPending || deleteMediaMutation.isPending}
              />

              {/* Event Thumbnail */}
              <ImageUploadInput
                label="Event Thumbnail"
                currentImageUrl={event.thumbnailUrl}
                onFileSelect={(file) => uploadThumbnailMutation.mutate(file)}
                onRemove={() => event.thumbnailUrl && deleteMediaMutation.mutate({ url: event.thumbnailUrl, mediaType: 'thumbnail' })}
                maxSize={2}
                disabled={uploadThumbnailMutation.isPending || deleteMediaMutation.isPending}
              />

              {/* Gallery Images */}
              <GalleryManager
                label="Gallery Images"
                currentImages={event.galleryImages || []}
                onFilesSelect={(files) => uploadGalleryMutation.mutate(files)}
                onRemove={(url) => deleteMediaMutation.mutate({ url, mediaType: 'gallery' })}
                maxImages={10}
                maxSize={10}
                disabled={uploadGalleryMutation.isPending || deleteMediaMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Recent Sales */}
          {sales && sales.data && sales.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Sales</span>
                  <Link to="/sales-history" className="text-sm text-blue-600 hover:underline">
                    View All
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Ticket Type</TableHead>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.data.slice(0, 5).map((sale: any) => (
                      <TableRow key={sale._id}>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{getSaleTicketType(sale)}</TableCell>
                        <TableCell className="font-mono text-xs">{getSaleTicketCodes(sale)}</TableCell>
                        <TableCell className="text-right">{sale.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(sale.totalAmount, sale.currency ?? event.currency ?? 'SZL', { space: true, decimals: 0 })}
                        </TableCell>
                        <TableCell>{format(new Date(sale.createdAt), 'PP')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-slate-600 mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatMoney(event.totalRevenue, event.currency ?? 'SZL', { space: true, decimals: 0 })}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Tickets Sold</div>
                <div className="text-2xl font-bold text-slate-900">
                  {event.totalTicketsSold} / {totalCapacity}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-orange-600 to-amber-600 h-2 rounded-full"
                    style={{ width: `${soldPercentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-600 mt-1">{soldPercentage.toFixed(1)}% sold</div>
              </div>

              {scans && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Check-ins</div>
                  <div className="flex items-center text-xl font-bold text-slate-900">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    {scans.pagination?.total || 0}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="h-5 w-5 mr-2" />
                Event QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                <QRCodeSVG
                  value={eventShareUrl}
                  size={180}
                  level="H"
                />
              </div>
              <p className="text-xs text-slate-600 text-center mt-3">
                Scan to view event details
              </p>
              <div className="mt-3 w-full">
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 break-all">
                  {eventShareUrl}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="sm"
                    onClick={handleCopyPublicLink}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="sm"
                    onClick={handleSharePublicLink}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-slate-600">Created</div>
                <div className="text-slate-900">{format(new Date(event.createdAt), 'PPp')}</div>
              </div>
              {(event as any).publishedAt && (
                <div>
                  <div className="text-slate-600">Published</div>
                  <div className="text-slate-900">{format(new Date((event as any).publishedAt), 'PPp')}</div>
                </div>
              )}
              <div>
                <div className="text-slate-600">Last Updated</div>
                <div className="text-slate-900">{format(new Date(event.updatedAt), 'PPp')}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <EventAnalyticsTab eventId={id!} currency={event.currency ?? 'SZL'} />
        </TabsContent>

        {/* Creator Tab */}
        <TabsContent value="creator" className="mt-6">
          <EventCreatorTab eventId={id!} />
        </TabsContent>

        {/* Community Tab — channels, announcements, member moderation.
            "Recent messages" (per-channel delete/pin panel) is deferred to
            Task 8, when messages first render anywhere in the dashboard;
            the pin/unpin api.ts methods are already wired for it. */}
        {canManageCommunity && (
          <TabsContent value="community" className="mt-6 space-y-6">
            <AnnouncementComposer eventId={id!} />
            <ChannelsManager eventId={id!} />
            <MembersModeration eventId={id!} />
          </TabsContent>
        )}
      </Tabs>

      {/* Ticket Type Dialog */}
      <TicketTypeDialog
        open={ticketDialogOpen}
        onOpenChange={(open) => {
          setTicketDialogOpen(open);
          if (!open) setEditingTicket(null);
        }}
        onSubmit={(data) => {
          if (editingTicket) {
            // Update existing ticket
            updateTicketMutation.mutate({
              ticketName: editingTicket.name,
              updates: data,
            });
          } else {
            // Add new ticket
            addTicketMutation.mutate(data);
          }
        }}
        ticketType={editingTicket}
        isLoading={addTicketMutation.isPending || updateTicketMutation.isPending}
        isAdmin={isAdmin}
        currency={event.currency ?? 'SZL'}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this event?"
        description={`"${event.name}" and its ticket configuration will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete event"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate();
          setDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
}

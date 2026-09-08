import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { publicEventUrl } from '@/lib/eventUrl';
import { currencySymbol, formatMoney, type Currency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TicketTypeDialog, type TicketTypeSubmitData } from '@/components/TicketTypeDialog';
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { GalleryManager } from '@/components/GalleryManager';
import { EventAnalyticsTab } from '@/components/EventAnalyticsTab';
import { EventFinancialsTab } from '@/components/EventFinancialsTab';
import { EventCreatorTab } from '@/components/EventCreatorTab';
import { EventCashlessTab } from '@/components/EventCashlessTab';
import { EventMenuTab } from '@/components/EventMenuTab';
import { EventCashlessSetting } from '@/components/cashless/EventCashlessSetting';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChannelsManager } from '@/components/community/ChannelsManager';
import { AnnouncementComposer } from '@/components/community/AnnouncementComposer';
import { MembersModeration } from '@/components/community/MembersModeration';
import { useAuth } from '@/contexts/AuthContext';
import { canManageEvents, canEditEventInfo, canViewEventFinancials, canManageMenu } from '@/lib/permissions';
import {
  composeEventDateTime,
  eventToDateTimeInputs,
  type EventDateTimeFormValues,
} from '@/lib/eventForm';
import { formatEventStartsEnds } from '@/lib/eventWhen';
import { getSaleTicketType, getSaleTicketCodes } from '@/lib/sales';
import {
  ArrowLeft, Calendar, MapPin, Users, CheckCircle, Clock,
  Edit, Trash2, Eye, EyeOff, QrCode, Plus, TrendingUp, TrendingDown, Image, BarChart3, UserCircle,
  Share2, Link as LinkIcon, MessagesSquare, Coins, CreditCard, UtensilsCrossed, Copy, Type, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { TicketType, EventFormData } from '@/types';

/** Draft state for the editable Event Information card. */
type InfoDraft = { name: string; description: string; venue: string } & EventDateTimeFormValues;

export function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    // Switching the top-level tab drops any sub-tab the cashless pane set.
    if (v !== 'cashless') next.delete('sub');
    setSearchParams(next, { replace: true });
  };
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>('SZL');

  // Carrot admins approve events (publish them live) and can unpublish/delete
  // even after tickets sell. Organizers instead SUBMIT events for approval.
  const isAdmin = !!user?.isSuperAdmin;
  // Renaming a live event is ADMIN-ONLY on purpose: an organizer silently
  // swapping the name of an approved/sold event is a bait-and-switch fraud
  // vector. Enforced server-side too — the UI gate is not the guard. Organizers
  // must get the name right at creation (they're warned there) and ask Carrot
  // to correct genuine mistakes.
  const canRenameEvent = isAdmin;
  // Community management (channels/announcements/moderation) needs the same
  // create/edit-event capability as the rest of this page's editing affordances.
  const canManageCommunity = canManageEvents(user);
  // Money tab — VIEW_REVENUE, mirroring the server guard on the financials route.
  const canSeeFinancials = canViewEventFinancials(user);
  const showMenuTab = canManageMenu(user);

  // Inline rename of the event title in the header.
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Editing the "Event Information" card (name/venue/date/time/description).
  // Editable only before the event goes live (canEditEventInfo); the draft holds
  // the raw form values and is null while not editing.
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState<InfoDraft | null>(null);

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

  useEffect(() => {
    if (event) {
      setCurrency(event.currency ?? 'SZL');
    }
  }, [event?._id, event?.currency]);

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
        toast.success('Event submitted for approval — it goes live once Carrot approves it.');
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

  // Save the whole Event Information card (name/venue/date/time/description).
  // Reuses the shared partial-update endpoint; the server rejects core-info
  // edits once the event is published (canEditEventInfo mirrors that gate, so
  // the form only shows while the edit is actually allowed).
  const updateInfoMutation = useMutation({
    mutationFn: (payload: Partial<EventFormData>) => apiClient.events.updateEvent(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event information updated');
      setIsEditingInfo(false);
      setInfoDraft(null);
    },
    // Never swallow a failed save — surface it so the organizer knows the edit
    // did not take effect (e.g. a 403 if the event went live in another tab).
    onError: (error: any) => toast.error(error.message || 'Failed to update event information'),
  });

  const handleStartEditInfo = () => {
    if (!event) return;
    setInfoDraft({
      name: event.name ?? '',
      description: event.description ?? '',
      venue: event.venue ?? '',
      ...eventToDateTimeInputs(event),
    });
    setIsEditingInfo(true);
  };

  const handleCancelEditInfo = () => {
    setIsEditingInfo(false);
    setInfoDraft(null);
  };

  const setInfoField = <K extends keyof InfoDraft>(key: K, value: InfoDraft[K]) =>
    setInfoDraft((d) => (d ? { ...d, [key]: value } : d));

  const handleSaveInfo = () => {
    if (!infoDraft) return;
    const name = infoDraft.name.trim();
    const venue = infoDraft.venue.trim();
    if (!name) { toast.error('Event name cannot be empty'); return; }
    if (!venue) { toast.error('Venue cannot be empty'); return; }
    if (infoDraft.isMultiDay) {
      if (!infoDraft.startDateTime || !infoDraft.endDateTime) {
        toast.error('Start and end date & time are required');
        return;
      }
    } else if (!infoDraft.eventDate || !infoDraft.startTime || !infoDraft.endTime) {
      toast.error('Event date, start time and end time are required');
      return;
    }

    const { eventDate, startTime, endTime } = composeEventDateTime(infoDraft);
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      toast.error('End time must be after start time');
      return;
    }

    updateInfoMutation.mutate({
      name,
      description: infoDraft.description.trim() || undefined,
      venue,
      isMultiDay: infoDraft.isMultiDay,
      eventDate,
      startTime,
      endTime,
    });
  };

  const updateCurrencyMutation = useMutation({
    mutationFn: (payload: Partial<EventFormData>) => apiClient.events.updateEvent(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Currency updated');
    },
    // Never swallow a failed save — surface it so the organizer knows the
    // change did not take effect.
    onError: (error: any) => toast.error(error.message || 'Failed to update currency'),
  });

  const handleSaveCurrency = () => {
    updateCurrencyMutation.mutate({ currency });
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
  // Real tickets sold, wristband/tag batches excluded — falls back to the
  // persisted (inflated) counter only if the live figure isn't present yet.
  const ticketsSoldDisplay = event.salesSummary?.ticketsSold ?? event.totalTicketsSold;
  const soldPercentage = totalCapacity > 0 ? (ticketsSoldDisplay / totalCapacity) * 100 : 0;
  // Core "Event Information" is editable only before the event goes live (admins
  // may still fix a live event). Mirrors the server-side guard.
  const canEditInfo = canEditEventInfo(event, user);
  const { starts: eventStarts, ends: eventEnds } = formatEventStartsEnds(event);

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

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(event.eventId);
      toast.success('Event ID copied to clipboard');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy event ID');
    }
  };

  // Drives the nav grid below — a single source of truth for which tabs are
  // visible, so the two-column layout can center/span the last tile whenever
  // the visible count is odd, without hardcoding a grid-cols-N per combination.
  const NAV_TABS = [
    { key: 'overview', label: 'Overview', icon: Calendar, show: true },
    { key: 'financials', label: 'Financials', icon: Coins, show: canSeeFinancials },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, show: true },
    { key: 'creator', label: 'Creator', icon: UserCircle, show: true },
    { key: 'cashless', label: 'Cashless', icon: CreditCard, show: !!event.cashless },
    { key: 'menu', label: 'Menu', icon: UtensilsCrossed, show: showMenuTab },
    { key: 'community', label: 'Community', icon: MessagesSquare, show: canManageCommunity },
  ].filter((t) => t.show);
  const navTabIsOdd = NAV_TABS.length % 2 !== 0;
  const lastNavTabKey = NAV_TABS[NAV_TABS.length - 1]?.key;

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
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate('/events')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 space-y-3">
              {isEditingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={200}
                    autoFocus
                    disabled={renameMutation.isPending}
                    aria-label="Event name"
                    className="h-11 w-full sm:w-[24rem] max-w-full text-lg sm:text-2xl font-bold"
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
                  {/* Name row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-3xl font-bold break-words">{event.name}</h1>
                    {canRenameEvent && event.status !== 'cancelled' && event.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                        onClick={handleStartRename}
                        aria-label="Edit event name"
                        title="Edit event name (admin)"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Status + Event ID row, below the name */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Badge variant={statusVariant} className="capitalize">
                      {statusLabel}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                      Event ID: {event.eventId}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-500 hover:text-slate-900"
                        onClick={handleCopyEventId}
                        aria-label="Copy event ID"
                        title="Copy event ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                </>
              )}
              {isPending && (
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {isAdmin
                    ? 'This event is awaiting your approval.'
                    : 'Submitted — waiting for Carrot to approve it before it goes live.'}
                </p>
              )}

              {/* Actions — a separate row from the event info above, with its own spacing */}
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {isPublished ? (
                  // Pull a live event back to draft. Organizers are blocked once
                  // tickets have sold; admins can override (handled server-side).
                  <Button
                    variant="outline"
                    onClick={() => setUnpublishConfirmOpen(true)}
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
                      onClick={() => setUnpublishConfirmOpen(true)}
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
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={cn(
            // Mobile: a real two-column button grid, each tab its own equal-size
            // card so long labels (e.g. "Financials") never get squeezed into a
            // sliver column. The last tab centers/spans the row when the visible
            // count is odd, instead of leaving one lonely half-empty cell.
            'grid h-auto w-full grid-cols-2 gap-2 rounded-lg bg-transparent p-0',
            // Desktop/tablet: identical to the original single-row segmented control.
            'sm:flex sm:h-9 sm:w-auto sm:max-w-2xl sm:items-center sm:justify-center sm:gap-0 sm:rounded-lg sm:bg-muted sm:p-1'
          )}
        >
          {NAV_TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                'flex h-14 items-center justify-center gap-2 whitespace-normal rounded-lg border border-input bg-background px-3 py-2 text-center text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
                'sm:h-9 sm:flex-1 sm:whitespace-nowrap sm:rounded-md sm:border-0 sm:bg-transparent sm:px-3 sm:py-1',
                navTabIsOdd && key === lastNavTabKey && 'col-span-2 mx-auto w-1/2 sm:col-span-1 sm:mx-0 sm:w-auto'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event Information */}
            <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Event Information</CardTitle>
              {canEditInfo && !isEditingInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEditInfo}
                  aria-label="Edit event information"
                  className="shrink-0"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              )}
            </CardHeader>
            {isEditingInfo && infoDraft ? (
              <CardContent className="space-y-4">
                {/* Details lock once the event goes live — set expectations up front. */}
                <p className="text-xs text-amber-600">
                  You can edit these details until the event is published. Afterwards, ask Carrot to make changes.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Event Name</Label>
                  <Input
                    id="edit-name"
                    value={infoDraft.name}
                    onChange={(e) => setInfoField('name', e.target.value)}
                    placeholder="e.g., Summer Music Festival"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-venue">Venue</Label>
                  <Input
                    id="edit-venue"
                    value={infoDraft.venue}
                    onChange={(e) => setInfoField('venue', e.target.value)}
                    placeholder="e.g., National Stadium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (Optional)</Label>
                  <Input
                    id="edit-description"
                    value={infoDraft.description}
                    onChange={(e) => setInfoField('description', e.target.value)}
                    placeholder="Brief description of the event"
                  />
                </div>

                <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                  <Checkbox
                    id="edit-isMultiDay"
                    checked={infoDraft.isMultiDay}
                    onCheckedChange={(checked) => setInfoField('isMultiDay', checked as boolean)}
                  />
                  <Label htmlFor="edit-isMultiDay" className="cursor-pointer font-normal">
                    This is a multi-day event
                  </Label>
                </div>

                {!infoDraft.isMultiDay ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-eventDate">Event Date</Label>
                      <Input
                        id="edit-eventDate" type="date" value={infoDraft.eventDate}
                        onChange={(e) => setInfoField('eventDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-startTime">Start Time</Label>
                      <Input
                        id="edit-startTime" type="time" value={infoDraft.startTime}
                        onChange={(e) => setInfoField('startTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-endTime">End Time</Label>
                      <Input
                        id="edit-endTime" type="time" value={infoDraft.endTime}
                        onChange={(e) => setInfoField('endTime', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-startDateTime">Start Date & Time</Label>
                      <Input
                        id="edit-startDateTime" type="datetime-local" value={infoDraft.startDateTime}
                        onChange={(e) => setInfoField('startDateTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-endDateTime">End Date & Time</Label>
                      <Input
                        id="edit-endDateTime" type="datetime-local" value={infoDraft.endDateTime}
                        onChange={(e) => setInfoField('endDateTime', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveInfo} disabled={updateInfoMutation.isPending}>
                    {updateInfoMutation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditInfo} disabled={updateInfoMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-slate-100">
                {/* Event Name — full width */}
                <div className="pb-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Type className="h-3.5 w-3.5" />
                    Event Name
                  </div>
                  <div className="text-base font-semibold text-slate-900 break-words">{event.name}</div>
                </div>

                {/* Venue + Capacity — side by side on larger screens, stacked on mobile */}
                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      Venue
                    </div>
                    <div className="text-sm text-slate-900 break-words">{event.venue}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      Capacity
                    </div>
                    <div className="text-sm text-slate-900">{totalCapacity.toLocaleString()}</div>
                  </div>
                </div>

                {/* Date and Time — spelled-out Starts/Ends pair */}
                <div className="py-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Date and Time
                  </div>
                  <div className="space-y-0.5 text-sm text-slate-900">
                    <div className="flex items-start gap-1.5">
                      <Clock className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <span><span className="font-medium">Starts:</span> {eventStarts}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Clock className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <span><span className="font-medium">Ends:</span> {eventEnds}</span>
                    </div>
                  </div>
                </div>

                {/* Description — full width */}
                {event.description && (
                  <div className="pt-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <FileText className="h-3.5 w-3.5" />
                      Description
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{event.description}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Currency Card — Carrot Tickets is always the seller for every
              event (organizers are never asked to choose); this only sets
              the display currency for the ticket tiers below. */}
          <Card>
            <CardHeader>
              <CardTitle>Currency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <Button
                size="sm"
                onClick={handleSaveCurrency}
                disabled={updateCurrencyMutation.isPending}
              >
                {updateCurrencyMutation.isPending ? 'Saving...' : 'Save Currency'}
              </Button>
            </CardContent>
          </Card>

          {/* Cashless Card — admin-held switch, organizer request path. */}
          {event && <EventCashlessSetting event={event} isAdmin={isAdmin} />}

          {/* Ticket Types Card — Carrot's own tier editor. */}
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
                        <TableCell className="text-right">{ticket.realSold ?? ticket.sold}</TableCell>
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
                  {ticketsSoldDisplay} / {totalCapacity}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-orange-600 to-amber-600 h-2 rounded-full"
                    style={{ width: `${soldPercentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-600 mt-1">{soldPercentage.toFixed(1)}% sold</div>
              </div>

              {event.salesSummary && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Cash Sales</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatMoney(event.salesSummary.cashSales, event.currency ?? 'SZL', { space: true, decimals: 0 })}
                  </div>
                </div>
              )}

              {!!event.salesSummary?.tagsPrinted && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Tags Printed</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {event.salesSummary.tagsPrinted}
                  </div>
                </div>
              )}

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
        {canSeeFinancials && (
          <TabsContent value="financials" className="mt-6">
            <EventFinancialsTab eventId={id!} />
          </TabsContent>
        )}

        <TabsContent value="analytics" className="mt-6">
          <EventAnalyticsTab eventId={id!} currency={event.currency ?? 'SZL'} />
        </TabsContent>

        {/* Creator Tab */}
        <TabsContent value="creator" className="mt-6">
          <EventCreatorTab eventId={id!} />
        </TabsContent>

        {/* Cashless Tab — organizer's money report for a cashless event */}
        {event?.cashless && (
          <TabsContent value="cashless" className="mt-6">
            <EventCashlessTab eventId={id!} />
          </TabsContent>
        )}

        {/* Menu Tab — organiser's bar/vendor preorder catalogue + incoming orders */}
        {showMenuTab && (
          <TabsContent value="menu" className="mt-6">
            <EventMenuTab eventId={id!} />
          </TabsContent>
        )}

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

      {/* Unpublish/withdraw confirmation */}
      <ConfirmDialog
        open={unpublishConfirmOpen}
        onOpenChange={setUnpublishConfirmOpen}
        destructive={false}
        title={isPending ? 'Withdraw this submission?' : 'Unpublish this event?'}
        description={
          isPending
            ? `"${event.name}" will be withdrawn from approval and returned to draft.`
            : `"${event.name}" will be taken off public listings and stop selling new tickets. Tickets already sold remain valid.`
        }
        confirmLabel={isPending ? 'Withdraw' : 'Unpublish'}
        isLoading={publishMutation.isPending}
        onConfirm={() => {
          publishMutation.mutate(false);
          setUnpublishConfirmOpen(false);
        }}
      />
    </div>
  );
}

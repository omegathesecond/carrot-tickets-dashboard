import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TicketTypeDialog } from '@/components/TicketTypeDialog';
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { GalleryManager } from '@/components/GalleryManager';
import { EventAnalyticsTab } from '@/components/EventAnalyticsTab';
import { EventCreatorTab } from '@/components/EventCreatorTab';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Calendar, MapPin, Users, CheckCircle, Clock,
  Edit, Trash2, Eye, EyeOff, QrCode, Plus, TrendingUp, TrendingDown, Image, BarChart3, UserCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { TicketType } from '@/types';

export function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Keshless admins approve events (publish them live) and can unpublish/delete
  // even after tickets sell. Organizers instead SUBMIT events for approval.
  const isAdmin = !!user?.isSuperAdmin;

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

  const addTicketMutation = useMutation({
    mutationFn: (ticketData: { name: string; description?: string; price: number; quantity: number }) =>
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
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <Badge variant={statusVariant} className="capitalize">
                {statusLabel}
              </Badge>
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
        <TabsList className="grid w-full max-w-lg grid-cols-3">
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
                  {event.isMultiDay ? (
                    <span>
                      {format(new Date(event.eventDate || event.startTime), 'PPp')} -{' '}
                      {format(new Date(event.endTime), 'PPp')}
                    </span>
                  ) : (
                    <span>
                      {format(new Date(event.eventDate || event.startTime), 'PPP')} •{' '}
                      {format(new Date(event.startTime), 'p')} - {format(new Date(event.endTime), 'p')}
                    </span>
                  )}
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

          {/* Ticket Types Card */}
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
                        <TableCell>E {ticket.price.toLocaleString()}</TableCell>
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
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.data.slice(0, 5).map((sale: any) => (
                      <TableRow key={sale._id}>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{sale.ticketType?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right">{sale.quantity}</TableCell>
                        <TableCell className="text-right">E {sale.totalAmount.toLocaleString()}</TableCell>
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
                  E {event.totalRevenue.toLocaleString()}
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
                  value={`https://tickets.keshless.app/events/${event._id}`}
                  size={180}
                  level="H"
                />
              </div>
              <p className="text-xs text-slate-600 text-center mt-3">
                Scan to view event details
              </p>
              <Button variant="outline" className="mt-3 w-full" size="sm">
                Download QR Code
              </Button>
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
          <EventAnalyticsTab eventId={id!} />
        </TabsContent>

        {/* Creator Tab */}
        <TabsContent value="creator" className="mt-6">
          <EventCreatorTab eventId={id!} />
        </TabsContent>
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

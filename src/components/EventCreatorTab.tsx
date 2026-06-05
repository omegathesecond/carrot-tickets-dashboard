import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Building2, Mail, Phone, User, ShieldCheck, CalendarDays, Ticket, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

/**
 * "Creator" tab on the event detail page — shows the organizer who created
 * the event (contact + verification status) and a roll-up of every event they
 * own, so an admin can review their history and ticket/revenue totals.
 */
export function EventCreatorTab({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-creator', eventId],
    queryFn: () => apiClient.events.getEventCreator(eventId),
    enabled: !!eventId,
  });

  if (isLoading) return <div className="py-8 text-slate-500">Loading creator…</div>;
  if (error || !data) {
    return (
      <div className="py-8 text-slate-500">
        Couldn't load the creator details. {error instanceof Error ? error.message : ''}
      </div>
    );
  }

  const { creator, stats, events } = data;
  const verified = creator.verificationStatus === 'verified';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creator profile */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Event Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold text-slate-900">{creator.businessName}</div>
              <Badge variant={verified ? 'default' : 'secondary'} className="capitalize">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                {creator.verificationStatus || 'unknown'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {creator.primaryContact && (
                <div className="flex items-center text-slate-700">
                  <User className="h-4 w-4 mr-2 text-slate-400" /> {creator.primaryContact}
                </div>
              )}
              {creator.email && (
                <div className="flex items-center text-slate-700">
                  <Mail className="h-4 w-4 mr-2 text-slate-400" /> {creator.email}
                </div>
              )}
              {creator.phoneNumber && (
                <div className="flex items-center text-slate-700">
                  <Phone className="h-4 w-4 mr-2 text-slate-400" /> {creator.phoneNumber}
                </div>
              )}
              {creator.businessType && (
                <div className="flex items-center text-slate-700 capitalize">
                  <Building2 className="h-4 w-4 mr-2 text-slate-400" />
                  {creator.businessType.replace(/_/g, ' ')}
                </div>
              )}
              {creator.createdAt && (
                <div className="flex items-center text-slate-700">
                  <CalendarDays className="h-4 w-4 mr-2 text-slate-400" />
                  Joined {format(new Date(creator.createdAt), 'PP')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Creator stats */}
        <Card>
          <CardHeader>
            <CardTitle>Creator Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-600 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Events
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalEvents}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 flex items-center gap-1.5">
                <Ticket className="h-4 w-4" /> Tickets sold
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalTicketsSold}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Revenue
              </div>
              <div className="text-2xl font-bold text-slate-900">E {stats.totalRevenue.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Their events */}
      <Card>
        <CardHeader>
          <CardTitle>All events by this creator</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="font-medium">
                      <Link to={`/events/${e._id}`} className="hover:underline text-orange-700">
                        {e.name}
                      </Link>
                      <div className="text-xs text-slate-500">{e.venue}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{e.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(e.eventDate), 'PP')}</TableCell>
                    <TableCell className="text-right">
                      {e.totalTicketsSold} / {e.capacity}
                    </TableCell>
                    <TableCell className="text-right">E {e.totalRevenue.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-slate-500">No events yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

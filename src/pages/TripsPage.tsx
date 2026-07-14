import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Trip, TripFormData, TripStatus } from '@/types';

const TRIP_STATUSES: TripStatus[] = ['scheduled', 'boarding', 'departed', 'completed', 'cancelled'];

const STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: 'Scheduled',
  boarding: 'Boarding',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function routeLabel(trip: Trip): string {
  return typeof trip.routeId === 'object'
    ? `${trip.routeId.originCity} → ${trip.routeId.destinationCity}`
    : '';
}

function vehicleLabel(trip: Trip): string {
  return typeof trip.vehicleTypeId === 'object' ? trip.vehicleTypeId.name : '';
}

function formatDeparture(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TripsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const queryClient = useQueryClient();

  const { data: trips, isLoading } = useQuery({
    queryKey: ['transport', 'trips'],
    queryFn: () => apiClient.transport.listTrips(),
  });

  const { data: routes } = useQuery({
    queryKey: ['transport', 'routes'],
    queryFn: () => apiClient.transport.listRoutes(),
  });

  const { data: vehicleTypes } = useQuery({
    queryKey: ['transport', 'vehicleTypes'],
    queryFn: () => apiClient.transport.listVehicleTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: TripFormData) => apiClient.transport.createTrip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'trips'] });
      toast.success('Trip created');
      setIsDialogOpen(false);
      setRouteId('');
      setVehicleTypeId('');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create trip'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TripStatus }) =>
      apiClient.transport.updateTripStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'trips'] });
      toast.success('Trip status updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update trip status'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!routeId || !vehicleTypeId) return;
    const formData = new FormData(e.currentTarget);

    const departureTimeLocal = formData.get('departureTime') as string;
    const vehicleReg = ((formData.get('vehicleReg') as string) || '').trim();

    const data: TripFormData = {
      routeId,
      vehicleTypeId,
      departureTime: new Date(departureTimeLocal).toISOString(),
      ...(vehicleReg ? { vehicleReg } : {}),
    };

    createMutation.mutate(data);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const allTrips = trips ?? [];
  const allRoutes = routes ?? [];
  const allVehicleTypes = vehicleTypes ?? [];
  const isFormValid = !!routeId && !!vehicleTypeId;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bus Trips</h1>
          <p className="text-slate-600">Scheduled runs of your routes</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setRouteId('');
              setVehicleTypeId('');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600">
              <Plus className="h-4 w-4 mr-2" /> Schedule Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule Trip</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="routeId">Route</Label>
                <Select value={routeId} onValueChange={setRouteId}>
                  <SelectTrigger id="routeId">
                    <SelectValue placeholder="Select a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoutes.map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleTypeId">Vehicle Type</Label>
                <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
                  <SelectTrigger id="vehicleTypeId">
                    <SelectValue placeholder="Select a vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allVehicleTypes.map((vt) => (
                      <SelectItem key={vt._id} value={vt._id}>
                        {vt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="departureTime">Departure Time</Label>
                <Input id="departureTime" name="departureTime" type="datetime-local" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleReg">Vehicle Registration (optional)</Label>
                <Input id="vehicleReg" name="vehicleReg" placeholder="e.g., SD 123 AB" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || !isFormValid}>
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Trip'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                      No trips scheduled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  allTrips.map((trip) => (
                    <TableRow key={trip._id}>
                      <TableCell>{routeLabel(trip)}</TableCell>
                      <TableCell>{formatDeparture(trip.departureTime)}</TableCell>
                      <TableCell>{vehicleLabel(trip)}</TableCell>
                      <TableCell>
                        <Select
                          value={trip.status}
                          onValueChange={(v) =>
                            updateStatusMutation.mutate({ id: trip._id, status: v as TripStatus })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIP_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          sold {trip.soldCount} / {trip.totalSeats}
                        </div>
                        <div className="text-xs text-slate-500">reserved {trip.reservedCount}</div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

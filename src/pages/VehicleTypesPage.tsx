import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { VehicleType, VehicleTypeFormData, SeatScheme } from '@/types';

const SEAT_SCHEME_LABELS: Record<SeatScheme, string> = {
  sequential: 'Sequential',
  row_letter: 'Row-letter',
  passenger_count: 'General admission',
};

export function VehicleTypesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [seatScheme, setSeatScheme] = useState<SeatScheme>('sequential');
  const [deleteTarget, setDeleteTarget] = useState<VehicleType | null>(null);
  const queryClient = useQueryClient();

  const { data: vehicleTypes, isLoading } = useQuery({
    queryKey: ['transport', 'vehicleTypes'],
    queryFn: () => apiClient.transport.listVehicleTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: VehicleTypeFormData) => apiClient.transport.createVehicleType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'vehicleTypes'] });
      toast.success('Vehicle type created');
      setIsDialogOpen(false);
      setSeatScheme('sequential');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create vehicle type'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.transport.deleteVehicleType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'vehicleTypes'] });
      toast.success('Vehicle type deactivated');
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to deactivate vehicle type'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const totalSeats = Number(formData.get('totalSeats'));
    const registrationsRaw = (formData.get('registrations') as string) || '';
    const registrations = registrationsRaw
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    const data: VehicleTypeFormData = {
      name,
      totalSeats,
      seatScheme,
      registrations,
    };

    if (seatScheme === 'row_letter') {
      const rows = Number(formData.get('rows'));
      const seatsPerRow = Number(formData.get('seatsPerRow'));
      data.layoutJson = { rows, seatsPerRow };
    }

    createMutation.mutate(data);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const allVehicleTypes = vehicleTypes ?? [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vehicle Types</h1>
          <p className="text-slate-600">Define the seat layouts used by your buses</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setSeatScheme('sequential');
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600">
              <Plus className="h-4 w-4 mr-2" /> Add Vehicle Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Vehicle Type</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="e.g., 65-Seater Coach" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalSeats">Total Seats</Label>
                  <Input id="totalSeats" name="totalSeats" type="number" min={1} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seatScheme">Seat Scheme</Label>
                  <Select value={seatScheme} onValueChange={(v) => setSeatScheme(v as SeatScheme)}>
                    <SelectTrigger id="seatScheme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequential</SelectItem>
                      <SelectItem value="row_letter">Row-letter</SelectItem>
                      <SelectItem value="passenger_count">General admission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {seatScheme === 'row_letter' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rows">Rows</Label>
                    <Input id="rows" name="rows" type="number" min={1} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seatsPerRow">Seats per row</Label>
                    <Input id="seatsPerRow" name="seatsPerRow" type="number" min={1} required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="registrations">Registration plates (comma-separated, optional)</Label>
                <Input id="registrations" name="registrations" placeholder="SD 123 AB, SD 456 CD" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Add Vehicle Type'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allVehicleTypes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No vehicle types yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allVehicleTypes.map((vt) => (
            <Card key={vt._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{vt.name}</span>
                  <Truck className="h-5 w-5 text-slate-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-slate-600">{vt.totalSeats} seats</div>
                <div className="text-sm text-slate-600">{SEAT_SCHEME_LABELS[vt.seatScheme]}</div>
                {vt.registrations.length > 0 && (
                  <div className="text-xs text-slate-500">{vt.registrations.join(', ')}</div>
                )}
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(vt)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Deactivate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Deactivate this vehicle type?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will no longer be available when scheduling new trips.`
            : ''
        }
        confirmLabel="Deactivate"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
      />
    </div>
  );
}

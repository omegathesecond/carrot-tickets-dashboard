import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Trash2, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TransportRoute, RouteFormData } from '@/types';

export function TransportRoutesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TransportRoute | null>(null);
  const queryClient = useQueryClient();

  const { data: routes, isLoading } = useQuery({
    queryKey: ['transport', 'routes'],
    queryFn: () => apiClient.transport.listRoutes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: RouteFormData) => apiClient.transport.createRoute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      toast.success('Route created');
      setIsDialogOpen(false);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create route'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.transport.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      toast.success('Route deactivated');
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to deactivate route'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const originCity = formData.get('originCity') as string;
    const destinationCity = formData.get('destinationCity') as string;
    const farePerSeat = Number(formData.get('farePerSeat'));
    const stopsRaw = (formData.get('stops') as string) || '';
    const stops = stopsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const data: RouteFormData = {
      name,
      originCity,
      destinationCity,
      farePerSeat,
      ...(stops.length > 0 ? { stops } : {}),
    };

    createMutation.mutate(data);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const allRoutes = routes ?? [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bus Routes</h1>
          <p className="text-slate-600">Origin → destination fare templates for your trips</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-600 to-amber-600">
              <Plus className="h-4 w-4 mr-2" /> Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Bus Route</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Route Name</Label>
                <Input id="name" name="name" required placeholder="e.g., Manzini Express" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="originCity">Origin City</Label>
                  <Input id="originCity" name="originCity" required placeholder="e.g., Manzini" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinationCity">Destination City</Label>
                  <Input id="destinationCity" name="destinationCity" required placeholder="e.g., Mbabane" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="farePerSeat">Fare per Seat (E)</Label>
                <Input id="farePerSeat" name="farePerSeat" type="number" min={0} step="0.01" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stops">Stops (comma-separated, optional)</Label>
                <Input id="stops" name="stops" placeholder="Matsapha, Ngwenya" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Add Route'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allRoutes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No routes yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allRoutes.map((route) => (
            <Card key={route._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{route.name}</span>
                  <RouteIcon className="h-5 w-5 text-slate-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-slate-600">
                  {route.originCity} → {route.destinationCity}
                </div>
                <div className="text-sm font-semibold text-slate-900">E {route.farePerSeat}</div>
                {route.stops && route.stops.length > 0 && (
                  <div className="text-xs text-slate-500">{route.stops.join(', ')}</div>
                )}
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(route)}>
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
        title="Deactivate this route?"
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

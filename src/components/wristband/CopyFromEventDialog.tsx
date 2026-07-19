import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { WristbandDesignDoc } from '@/lib/wristband/design';
import type { Event } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

/**
 * Pick a saved design from ANOTHER event to copy into the current editor. Reads
 * the chosen source event's designs via the existing listDesigns endpoint and
 * hands the chosen design back through onPick — the caller does the retarget +
 * load. The source-event list excludes the current event. Query failures bubble
 * through TanStack Query; there is no silent fallback (empty list is a real
 * "no designs" state, distinct from an error, which surfaces below the picker).
 */
export function CopyFromEventDialog({ open, onOpenChange, events, currentEventId, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
  currentEventId: string;
  onPick: (design: WristbandDesignDoc) => void;
}) {
  const [sourceEventId, setSourceEventId] = useState('');
  const [designId, setDesignId] = useState('');

  const sourceEvents = events.filter((e) => e._id !== currentEventId);

  // Same query key shape as DesignManagerBar (['wristband-designs', eventId]),
  // so the source event's designs share the React Query cache.
  const { data: designs = [], isLoading, error } = useQuery({
    queryKey: ['wristband-designs', sourceEventId],
    queryFn: () => apiClient.wristbands.listDesigns(sourceEventId),
    enabled: open && !!sourceEventId,
  });

  const reset = () => { setSourceEventId(''); setDesignId(''); };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSourceEventChange = (id: string) => {
    setSourceEventId(id);
    setDesignId(''); // designs differ per event — drop the stale selection
  };

  const handleLoad = () => {
    const chosen = designs.find((d) => d._id === designId);
    if (chosen) {
      onPick(chosen);
      handleOpenChange(false);
    }
  };

  const designPlaceholder =
    !sourceEventId ? 'Pick an event first'
    : isLoading ? 'Loading designs…'
    : designs.length === 0 ? 'No saved designs in this event'
    : 'Select a design';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy design from another event</DialogTitle>
          <DialogDescription>
            Load a saved design from a different event into this editor. It comes in
            unsaved — review it, then Save to add it to this event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>From event</Label>
            <Select value={sourceEventId} onValueChange={handleSourceEventChange}>
              <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
              <SelectContent>
                {sourceEvents.map((e) => (
                  <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Design</Label>
            <Select
              value={designId}
              onValueChange={setDesignId}
              disabled={!sourceEventId || isLoading}
            >
              <SelectTrigger><SelectValue placeholder={designPlaceholder} /></SelectTrigger>
              <SelectContent>
                {designs.filter((d) => d._id).map((d) => (
                  <SelectItem key={d._id} value={d._id as string}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-xs text-destructive">
                Failed to load designs: {(error as Error).message}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleLoad} disabled={!designId}>Load into editor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

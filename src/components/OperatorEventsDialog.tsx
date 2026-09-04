import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventPicker, type PickableEvent } from '@/components/EventPicker';

interface OperatorEventsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Who is being reassigned, e.g. the operator's name. */
  personName: string;
  initialEventIds: string[];
  onSave: (eventIds: string[]) => void;
  isSaving?: boolean;
  /** Passed through to the picker; the reseller portal searches its own route. */
  searchEvents?: (search: string) => Promise<PickableEvent[]>;
}

/**
 * Reassign which events an operator may work. Shared by the gate-operator and
 * reseller-operator pages — the two actors differ in what they DO at an
 * event, not in how they are assigned to one. Cashiers do NOT use this: a
 * cashier is hired for exactly one immutable event, not a reassignable set.
 */
export function OperatorEventsDialog({
  open,
  onClose,
  personName,
  initialEventIds,
  onSave,
  isSaving,
  searchEvents,
}: OperatorEventsDialogProps) {
  const [eventIds, setEventIds] = useState<string[]>(initialEventIds);

  // Re-seed whenever the dialog is opened for a different person, so a second
  // open never shows the previous operator's assignment.
  //
  // Keyed on the joined ids rather than the array itself: callers naturally
  // write `operator.eventIds ?? []`, which allocates a fresh array on every
  // render — depending on that reference would re-run this effect constantly
  // and wipe out each selection the moment it was made.
  const seed = initialEventIds.join(',');
  useEffect(() => {
    if (open) setEventIds(seed ? seed.split(',') : []);
  }, [open, seed]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Events for {personName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assigned events</Label>
            <EventPicker
              value={eventIds}
              onChange={setEventIds}
              disabled={isSaving}
              {...(searchEvents ? { searchEvents } : {})}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => onSave(eventIds)}
              className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

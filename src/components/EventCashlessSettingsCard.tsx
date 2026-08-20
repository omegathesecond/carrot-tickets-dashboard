import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import type { Event } from '@/types';

/**
 * The two halves of the cashless switch, which are deliberately asymmetric:
 * an ADMIN grants it (it commits Carrot to settling real money), and an
 * ORGANIZER can only ask. The API enforces both — this card just stops the
 * organizer hunting for a control that would 403 them.
 */
export function EventCashlessSettingsCard({
  event,
  isAdmin,
}: {
  event: Event;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event._id] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const setCashless = useMutation({
    mutationFn: (cashless: boolean) => apiClient.events.updateEvent(event._id, { cashless }),
    onSuccess: (_res, cashless) => {
      invalidate();
      toast.success(cashless ? 'Cashless enabled for this event' : 'Cashless turned off');
    },
    // Never swallow it — the server refuses to turn cashless OFF once any
    // ledger entry exists, and that refusal is the whole reason to surface it.
    onError: (e: Error) => toast.error(e.message || 'Failed to change the cashless setting'),
  });

  const requestCashless = useMutation({
    mutationFn: () => apiClient.events.requestCashless(event._id, note.trim() || undefined),
    onSuccess: () => {
      invalidate();
      toast.success('Request sent — Carrot will be in touch');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to send the request'),
  });

  const requestedAt = event.cashlessRequestedAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashless</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Attendees carry funded NFC wristbands, stalls charge them, and cashiers top up and
          cash out at the desk.
        </p>

        {isAdmin ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="cashless-toggle" className="font-medium">
                {event.cashless ? 'Cashless is on' : 'Enable cashless'}
              </Label>
              <Switch
                id="cashless-toggle"
                checked={!!event.cashless}
                disabled={setCashless.isPending}
                onCheckedChange={(v) => setCashless.mutate(v)}
              />
            </div>

            {event.cashless && (
              <p className="text-xs text-amber-700">
                Turning this off is blocked once money has moved — funded wristbands would be
                stranded behind “Event is not cashless”.
              </p>
            )}

            {!event.cashless && requestedAt && (
              <p className="text-xs text-slate-500">
                The organizer requested this on {new Date(requestedAt).toLocaleDateString()}
                {event.cashlessRequestNote ? ` — “${event.cashlessRequestNote}”` : ''}
              </p>
            )}
          </div>
        ) : event.cashless ? (
          <p className="text-sm font-medium text-emerald-700">
            Cashless is on for this event.
          </p>
        ) : requestedAt ? (
          <p className="text-sm text-slate-600">
            Requested on {new Date(requestedAt).toLocaleDateString()}. Carrot will review it and
            switch this on for you.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cashless-note">Note (optional)</Label>
              <Textarea
                id="cashless-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything Carrot should know — expected crowd, number of bars…"
                rows={3}
              />
            </div>
            <Button
              size="sm"
              disabled={requestCashless.isPending}
              onClick={() => requestCashless.mutate()}
            >
              {requestCashless.isPending ? 'Sending…' : 'Request cashless'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

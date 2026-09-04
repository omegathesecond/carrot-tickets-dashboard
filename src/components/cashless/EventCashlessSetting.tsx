import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Nfc, Check, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Event } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
};

/**
 * The cashless switch. Deliberately asymmetric: an ADMIN toggles it, because
 * turning it on commits Carrot to bands, handhelds, a float and a settlement
 * run — the API 403s the field from anyone else. An ORGANIZER can only ask,
 * and sees the state of that ask. Switching it back OFF is refused by the API
 * (409) once any money has moved on the event, so that error is surfaced as
 * written rather than second-guessed here.
 */
export function EventCashlessSetting({ event, isAdmin }: { event: Event; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const requested = !!event.cashlessRequestedAt;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event', event._id] });

  const setCashless = useMutation({
    mutationFn: (next: boolean) => apiClient.events.setCashless(event._id, next),
    onSuccess: (_res, next) => {
      invalidate();
      toast.success(next ? 'Cashless enabled for this event' : 'Cashless turned off');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not change the cashless setting'),
  });

  const request = useMutation({
    mutationFn: () => apiClient.events.requestCashless(event._id, note.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setNote('');
      toast.success('Requested — Carrot will be in touch');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not send the request'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Nfc className="h-5 w-5 text-orange-600" />
          Cashless
          {event.cashless && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">On</Badge>}
          {!event.cashless && requested && (
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Requested</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Attendees carry funded NFC bands, stalls charge them by tap, and cashiers top up and cash
          out on the floor. Carrot supplies the bands and handhelds and settles the stalls afterwards.
        </p>

        {isAdmin ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="cashless-switch">Cashless for this event</Label>
              <p className="text-xs text-muted-foreground">
                {requested && !event.cashless
                  ? `The organizer asked on ${fmtDate(event.cashlessRequestedAt)}${event.cashlessRequestNote ? ` — "${event.cashlessRequestNote}"` : ''}`
                  : 'Only Carrot staff can change this.'}
              </p>
            </div>
            <Switch
              id="cashless-switch"
              checked={!!event.cashless}
              disabled={setCashless.isPending}
              onCheckedChange={(v) => setCashless.mutate(v)}
            />
          </div>
        ) : event.cashless ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> Cashless is on for this event.
          </p>
        ) : requested ? (
          <div className="rounded-lg border bg-slate-50 p-3 space-y-1">
            <p className="text-sm font-medium text-slate-700">
              Requested on {fmtDate(event.cashlessRequestedAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Carrot will confirm bands, handhelds and settlement with you before switching it on.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cashless-note">Anything Carrot should know? (optional)</Label>
            <Textarea
              id="cashless-note"
              value={note}
              maxLength={300}
              rows={2}
              placeholder="e.g. two bars, a food court, roughly 3 000 people"
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              onClick={() => request.mutate()}
              disabled={request.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {request.isPending ? 'Sending…' : 'Request cashless'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

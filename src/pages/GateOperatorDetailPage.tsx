import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Nfc, ScanLine, XCircle } from 'lucide-react';
import { apiClient, type OperatorScanRow } from '@/lib/api';
import { fmtR } from '@/lib/money';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

const fmtWhen = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** What the scanner said, in the organizer's words rather than the enum's. */
const RESULT_META: Record<string, { label: string; className: string }> = {
  success: { label: 'Admitted', className: 'bg-green-100 text-green-800' },
  already_scanned: { label: 'Already in', className: 'bg-amber-100 text-amber-800' },
  invalid_ticket: { label: 'Invalid ticket', className: 'bg-red-100 text-red-700' },
  wrong_event: { label: 'Wrong event', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled ticket', className: 'bg-red-100 text-red-700' },
};

/**
 * One gate operator's shift: how many people they scanned through, how many
 * they turned away and why, and the tags they registered. This is the answer to
 * "who actually worked the door" — a question an organizer could previously
 * only guess at from the total headcount.
 */
export function GateOperatorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['gate-operator-activity', id],
    queryFn: () => apiClient.gateOperators.activity(id),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => navigate('/gate-operators')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Gate Operators
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : error || !data ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Could not load this operator{(error as Error)?.message ? ` — ${(error as Error).message}` : ''}.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{data.operator.fullName}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  User ID <span className="font-mono text-slate-700">{data.operator.loginCode}</span>
                  {data.operator.phoneNumber ? ` · ${data.operator.phoneNumber}` : ''}
                </p>
              </div>
              <Badge variant={data.operator.isActive ? 'default' : 'secondary'}>
                {data.operator.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat icon={<ScanLine className="h-4 w-4" />} tone="text-slate-600" label="Scans" value={String(data.summary.scans)}
                hint={data.summary.lastScanAt ? `last ${fmtWhen(data.summary.lastScanAt)}` : 'no scans yet'} />
              <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone="text-green-600" label="Admitted" value={String(data.summary.admitted)}
                hint="let through the gate" />
              <Stat icon={<XCircle className="h-4 w-4" />} tone="text-orange-600" label="Turned away" value={String(data.summary.refused)}
                hint="duplicate, wrong event or void" />
              <Stat icon={<Nfc className="h-4 w-4" />} tone="text-blue-600" label="Tags registered" value={String(data.summary.tagsRegistered)}
                hint="bound to a ticket" />
            </div>

            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold mb-3">Per event</h2>
                {data.byEvent.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">This operator has not scanned anything yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Scans</TableHead>
                          <TableHead className="text-right">Admitted</TableHead>
                          <TableHead className="text-right">Turned away</TableHead>
                          <TableHead>Last scan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byEvent.map((e) => (
                          <TableRow key={e.eventId}>
                            <TableCell className="font-medium">{e.eventName}</TableCell>
                            <TableCell className="text-right">{e.scans}</TableCell>
                            <TableCell className="text-right text-green-700">{e.admitted}</TableCell>
                            <TableCell className="text-right text-orange-700">{e.refused}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(e.lastScanAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold mb-3">Recent scans</h2>
                {data.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nothing scanned yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recent.map((s: OperatorScanRow) => {
                          const meta = RESULT_META[s.result] ?? { label: s.result, className: 'bg-slate-100 text-slate-700' };
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(s.at)}</TableCell>
                              <TableCell>
                                <div className="font-medium">{s.holderName ?? 'Unknown holder'}</div>
                                <div className="font-mono text-xs text-muted-foreground">{s.ticketCode ?? '—'}</div>
                              </TableCell>
                              <TableCell>{s.eventName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {data.registrations.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-base font-semibold mb-3">Tags registered</h2>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tag ID</TableHead>
                          <TableHead>Holder</TableHead>
                          <TableHead>When</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.registrations.map((r) => (
                          <TableRow key={`${r.walletId}-${r.at}`}>
                            <TableCell className="font-mono text-xs">
                              <span className="inline-flex items-center gap-1.5">
                                <Nfc className="h-3.5 w-3.5 text-orange-600" />{r.bandUid}
                              </span>
                            </TableCell>
                            <TableCell>{r.holderName ?? 'Unknown'}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{fmtWhen(r.at)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtR(r.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, tone, label, value, hint }: {
  icon: React.ReactNode; tone: string; label: string; value: string; hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </CardContent>
    </Card>
  );
}

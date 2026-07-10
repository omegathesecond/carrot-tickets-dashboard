import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Flag, Eye, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient, type ReportAdminView, type ReportResolveAction, type ReportStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 25;
const NOTE_MAX_LENGTH = 500;

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function labelOf(who: { name: string | null; username: string | null } | null | undefined): string {
  return who?.name || who?.username || 'Unknown buyer';
}

/** The buyer an action would apply to: the report's own targetBuyer for a
 *  buyer report, or the reported message's sender. A message report has no
 *  offender when the message was organizer-authored (senderId is null) — the
 *  service itself throws 400 for that case, so we hide the buttons instead. */
function offenderIdOf(report: ReportAdminView): string | null {
  if (report.targetType === 'buyer') return report.targetBuyer?.id ?? null;
  return report.message?.senderId ?? null;
}

/**
 * Platform-wide social moderation queue (Plan 7 Task 7) — buyer-filed
 * reports against channel messages or other buyers. Mirrors the
 * community-tab pages' cursor-pagination + mutation-invalidates-list shape
 * (see MembersModeration.tsx). Gated by ModerateSocialRoute
 * (tickets:moderate_social) one layer up in App.tsx.
 */
export function ReportsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [selectedReport, setSelectedReport] = useState<ReportAdminView | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['reports', status],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.reports.list({ status, before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.id : undefined,
  });

  const reports = data?.pages.flat() ?? [];

  const closeDialog = () => {
    setSelectedReport(null);
    setNote('');
  };

  const resolveMutation = useMutation({
    mutationFn: ({ reportId, action, note: actionNote }: { reportId: string; action: ReportResolveAction; note?: string }) =>
      apiClient.reports.resolve(reportId, { action, note: actionNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report resolved');
      closeDialog();
    },
    onError: (error: unknown) => {
      // Surfaces the API's 409 "Report has already been resolved" (a second
      // admin got there first) alongside every other failure. Refresh the
      // list either way — the queue may be stale in exactly that case.
      toast.error(error instanceof Error ? error.message : 'Failed to resolve report');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const pendingAction = resolveMutation.isPending ? resolveMutation.variables?.action : null;

  const submitAction = (action: ReportResolveAction) => {
    if (!selectedReport) return;
    const trimmed = note.trim();
    resolveMutation.mutate({ reportId: selectedReport.id, action, note: trimmed || undefined });
  };

  const canDeleteMessage =
    !!selectedReport && selectedReport.targetType === 'message' && !!selectedReport.message && !selectedReport.message.deleted;
  const offenderId = selectedReport ? offenderIdOf(selectedReport) : null;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Buyer-filed reports against community messages and other buyers.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" /> Report queue
          </CardTitle>
          <Tabs value={status} onValueChange={(v) => setStatus(v as ReportStatus)}>
            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-slate-500">Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No {status} reports.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="font-medium">{labelOf(report.reporter)}</div>
                        {report.reporter.username && (
                          <div className="text-xs text-slate-500">@{report.reporter.username}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {report.targetType === 'message' && report.message ? (
                          <>
                            <p className="text-sm line-clamp-2">{report.message.body}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              #{report.message.channelName ?? 'channel'} · {report.message.eventName ?? 'event'}
                              {report.message.deleted && (
                                <Badge variant="destructive" className="text-[10px]">Deleted</Badge>
                              )}
                            </p>
                          </>
                        ) : report.targetType === 'buyer' && report.targetBuyer ? (
                          <>
                            <div className="text-sm font-medium">{labelOf(report.targetBuyer)}</div>
                            <div className="text-xs text-slate-500">Buyer report</div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">Target unavailable</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="text-sm line-clamp-2">{report.reason}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600" title={format(new Date(report.createdAt), 'PP p')}>
                          {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row detail dialog — full context + resolution actions. */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Report against {selectedReport?.targetType === 'message' ? 'a message' : 'a buyer'}
            </DialogTitle>
            <DialogDescription>
              Filed by {selectedReport ? labelOf(selectedReport.reporter) : ''}
              {selectedReport && ` · ${format(new Date(selectedReport.createdAt), 'PP p')}`}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div>
                <Label>Reason</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedReport.reason}</p>
              </div>

              {selectedReport.targetType === 'message' && selectedReport.message ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    #{selectedReport.message.channelName ?? 'channel'} · {selectedReport.message.eventName ?? 'event'}
                    {selectedReport.message.deleted && (
                      <Badge variant="destructive" className="text-[10px]">Deleted</Badge>
                    )}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selectedReport.message.body}</p>
                </div>
              ) : selectedReport.targetType === 'buyer' && selectedReport.targetBuyer ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium">{labelOf(selectedReport.targetBuyer)}</p>
                  {selectedReport.targetBuyer.username && (
                    <p className="text-xs text-slate-500">@{selectedReport.targetBuyer.username}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Target no longer available.</p>
              )}

              {selectedReport.status !== 'open' ? (
                <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-100 pt-3">
                  <p>
                    {selectedReport.status === 'dismissed' ? 'Dismissed' : 'Resolved'} by{' '}
                    {selectedReport.resolvedBy ?? '—'}
                    {selectedReport.resolvedAt && ` · ${format(new Date(selectedReport.resolvedAt), 'PP p')}`}
                  </p>
                  {selectedReport.resolutionNote && <p>Note: {selectedReport.resolutionNote}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="resolution-note">Note (optional)</Label>
                  <Textarea
                    id="resolution-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                    placeholder="Context for this decision…"
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                  />
                </div>
              )}
            </div>
          )}

          {selectedReport?.status === 'open' && (
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button variant="outline" onClick={closeDialog} disabled={resolveMutation.isPending}>
                Cancel
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => submitAction('dismiss')}
                  disabled={resolveMutation.isPending}
                >
                  {pendingAction === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
                </Button>
                {offenderId && (
                  <Button
                    variant="outline"
                    onClick={() => submitAction('unsuspend_buyer')}
                    disabled={resolveMutation.isPending}
                  >
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    {pendingAction === 'unsuspend_buyer' ? 'Unsuspending…' : 'Unsuspend buyer'}
                  </Button>
                )}
                {offenderId && (
                  <Button
                    variant="destructive"
                    onClick={() => submitAction('suspend_buyer')}
                    disabled={resolveMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1.5" />
                    {pendingAction === 'suspend_buyer' ? 'Suspending…' : 'Suspend buyer'}
                  </Button>
                )}
                {canDeleteMessage && (
                  <Button
                    variant="destructive"
                    onClick={() => submitAction('delete_message')}
                    disabled={resolveMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {pendingAction === 'delete_message' ? 'Deleting…' : 'Delete message'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

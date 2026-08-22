import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiClient, type WristbandBatch } from '@/lib/api';
import type { Event } from '@/types';
import type { CalibrationOffset, SheetTemplate } from '@/lib/wristband/templates';
import { hasVisibleQrElement } from '@/lib/wristband/design';
import type { EditorState } from '@/lib/wristband/editorState';
import { planPages, runPrintJob } from '@/lib/wristband/printJob';
import { openPdf } from '@/lib/wristband/pdf';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ProgressBar, RecentBatches } from './PrintDialogParts';

type Mode = 'noqr' | 'newbatch' | 'existing';
type Progress = { done: number; total: number };

const SUCCESS_TOAST = 'PDF ready — print at Actual size with photo quality settings';
const NO_QR_WARNING = 'This design has no visible QR element — add one in the editor before printing scannable wristbands.';

/**
 * Print flow — three ways to get ticketIds onto real bands (or none, for a
 * blank-stock preview), then one shared render+assemble+open pipeline.
 * Every failure surfaces via toast; a batch that was issued but failed to
 * render stays recoverable from "Recent batches" (never a silent orphan).
 */
export function PrintDialog({ open, onOpenChange, eventId, event, template, state, offset }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  event: Event | undefined;
  template: SheetTemplate;
  state: EditorState;
  /** The same offset the Sheet preview draws with — passed in rather than
   *  re-read here, so what was checked on screen is what gets printed. */
  offset: CalibrationOffset;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('noqr');
  const [progress, setProgress] = useState<Progress | null>(null);

  const [sheets, setSheets] = useState(1);
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setProgress(null);
  }, [open]);

  const batchesQuery = useQuery({
    queryKey: ['wristband-batches', eventId],
    queryFn: () => apiClient.wristbands.listBatches(eventId),
    enabled: open && !!eventId,
  });

  const ticketsQuery = useQuery({
    queryKey: ['wristband-tickets-search', eventId, search],
    queryFn: () => apiClient.wristbands.searchTickets(eventId, search),
    enabled: open && mode === 'existing' && !!eventId,
  });

  const busy = progress !== null;
  const qrReady = hasVisibleQrElement(state.elements);

  /** Plan → render every band → assemble. Throws; callers own the toasting
   *  so each mode can report failure in its own words (e.g. new-batch needs
   *  a distinct "already issued" message, not the generic one). */
  async function renderPdf(ticketIds: string[] | null, sheetCount = 0): Promise<Uint8Array> {
    const pages = planPages(ticketIds, sheetCount, template.bandsPerSheet);
    const total = pages.reduce((n, p) => n + p.length, 0);
    setProgress({ done: 0, total });
    try {
      return await runPrintJob({
        template, offset, background: state.background,
        elements: state.elements, pages,
        onProgress: (done, tot) => setProgress({ done, total: tot }),
      });
    } finally {
      setProgress(null);
    }
  }

  /** renderPdf + open + generic success/error toasts — the shared path for
   *  every mode except "new batch", which reports failure differently. */
  async function printAndOpen(ticketIds: string[] | null, sheetCount = 0): Promise<boolean> {
    try {
      const bytes = await renderPdf(ticketIds, sheetCount);
      openPdf(bytes);
      toast.success(SUCCESS_TOAST);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
      return false;
    }
  }

  async function handlePrintNoQr() {
    if (sheets < 1) { toast.error('Enter at least 1 sheet'); return; }
    await printAndOpen(null, sheets);
  }

  const issueMutation = useMutation({
    mutationFn: (vars: { eventId: string; ticketTypeId: string; quantity: number }) =>
      apiClient.wristbands.batchIssue(vars),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to issue batch'),
  });

  async function handleIssueAndPrint() {
    if (!qrReady) { toast.error(NO_QR_WARNING); return; }
    if (!ticketTypeId) { toast.error('Choose a ticket type'); return; }
    if (quantity < 1) { toast.error('Quantity must be at least 1'); return; }
    let ticketIds: string[];
    try {
      const result = await issueMutation.mutateAsync({ eventId, ticketTypeId, quantity });
      ticketIds = result.tickets.map((t) => t.ticketId);
    } catch {
      return; // batchIssue failed — onError already toasted; abort, no PDF
    }
    queryClient.invalidateQueries({ queryKey: ['wristband-batches', eventId] });
    try {
      const bytes = await renderPdf(ticketIds);
      openPdf(bytes);
      toast.success(SUCCESS_TOAST);
    } catch {
      toast.error('Batch issued but PDF failed — reprint it from Recent batches below');
    }
  }

  function handleReprintBatch(batch: WristbandBatch) {
    if (!qrReady) { toast.error(NO_QR_WARNING); return; }
    void printAndOpen(batch.tickets.map((t) => t.ticketId));
  }

  function toggleSelected(ticketId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId); else next.add(ticketId);
      return next;
    });
  }

  async function handlePrintSelected() {
    if (!qrReady) { toast.error(NO_QR_WARNING); return; }
    if (selectedIds.size === 0) { toast.error('Select at least one ticket'); return; }
    const ok = await printAndOpen([...selectedIds]);
    if (ok) setSelectedIds(new Set());
  }

  const selectedType = event?.ticketTypes.find((t) => t._id === ticketTypeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Print wristbands</DialogTitle>
          <DialogDescription>Choose how you want to select tickets to print.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="noqr">No QR</TabsTrigger>
            <TabsTrigger value="newbatch">New batch</TabsTrigger>
            <TabsTrigger value="existing">Existing tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="noqr" className="space-y-3">
            <Label>Number of sheets</Label>
            <Input type="number" min={1} value={sheets} onChange={(e) => setSheets(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">
              {template.bandsPerSheet} bands per sheet, no QR codes — good for blank-stock previews.
            </p>
            <DialogFooter>
              <Button disabled={busy} onClick={handlePrintNoQr}>
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Print
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="newbatch" className="space-y-4">
            <div className="space-y-2">
              <Label>Ticket type</Label>
              <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
                <SelectTrigger><SelectValue placeholder="Choose ticket type" /></SelectTrigger>
                <SelectContent>
                  {(event?.ticketTypes ?? []).map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name} ({t.available} left)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  {selectedType.available} of {selectedType.quantity} available
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            {!qrReady && (
              <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                {NO_QR_WARNING}
              </p>
            )}
            <Button disabled={busy || issueMutation.isPending || !qrReady} onClick={handleIssueAndPrint}>
              {(busy || issueMutation.isPending) && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Issue &amp; print
            </Button>

            <RecentBatches batches={batchesQuery.data ?? []} busy={busy} qrReady={qrReady} onReprint={handleReprintBatch} />
          </TabsContent>

          <TabsContent value="existing" className="space-y-3">
            <Input
              placeholder="Search by ticket code, name, or phone…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-56 space-y-1 overflow-auto">
              {(ticketsQuery.data ?? []).map((t) => (
                <label key={t.ticketId} className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm">
                  <Checkbox checked={selectedIds.has(t.ticketId)} onCheckedChange={() => toggleSelected(t.ticketId)} />
                  <span className="flex-1">
                    {t.ticketId} — {t.ticketType}{t.customerName ? ` — ${t.customerName}` : ''}
                  </span>
                  {t.status === 'checked_in' && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">already scanned</span>
                  )}
                </label>
              ))}
              {ticketsQuery.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">No matching tickets.</p>
              )}
            </div>
            {!qrReady && (
              <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                {NO_QR_WARNING}
              </p>
            )}
            <Button disabled={busy || selectedIds.size === 0 || !qrReady} onClick={handlePrintSelected}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Print{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
          </TabsContent>
        </Tabs>

        {progress && <ProgressBar done={progress.done} total={progress.total} />}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Package, Pencil, Bell, TrendingUp, Boxes, Coins, AlertTriangle } from 'lucide-react';
import {
  apiClient,
  PRODUCT_CATEGORIES,
  type StockProductRow,
  type NewProduct,
  type UpdateProduct,
  type StockStatus,
} from '@/lib/api';
import { fmtR, randToCents, centsToRand } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BarcodeField } from '@/components/BarcodeField';
import { ImageUploadField } from '@/components/ImageUploadField';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatCard } from '@/components/cashless/StatCard';
import { EventStockReport } from '@/components/EventStockReport';

type ProductForm = {
  name: string;
  category: string;
  priceRand: string;
  barcode: string;
  unitLabel: string;
  unitsPerPack: string;
  packLabel: string;
  imageUrl: string;
  active: boolean;
  merchantIds: string[];
};
const EMPTY_FORM: ProductForm = {
  name: '', category: 'beer', priceRand: '', barcode: '',
  unitLabel: 'unit', unitsPerPack: '', packLabel: '', imageUrl: '', active: true,
  merchantIds: [],
};

type OpForm = {
  merchantId: string;
  productId: string;
  fromMerchantId: string;
  toMerchantId: string;
  quantity: string;
  unit: 'unit' | 'pack';
  note: string;
};
const EMPTY_OP: OpForm = {
  merchantId: '', productId: '', fromMerchantId: '', toMerchantId: '',
  quantity: '', unit: 'unit', note: '',
};
const categoryLabel = (v: string) =>
  PRODUCT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/**
 * Cashless catalogue & stock management for ONE event (Slice 6 / parent §9).
 * Products and stock are event-scoped in the model — a Product carries an
 * eventId and a ProductStock row is per (stall x product) — so this panel takes
 * the event it lives under instead of asking the organizer to pick one. The API
 * enforces MANAGE_STOCK + event ownership on every call.
 */
export function EventCataloguePanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  // Which half of the page you're on rides in the URL, same as the ?tab/?sub
  // pair above it — a refresh or a shared link lands back on the same view
  // instead of bouncing to the default.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view = requestedView === 'catalogue' || requestedView === 'stock' ? requestedView : 'levels';
  const setView = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', v);
    setSearchParams(next, { replace: true });
  };

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['stock-products', eventId],
    queryFn: () => apiClient.stock.listProducts(eventId),
    enabled: !!eventId,
  });

  const {
    data: stalls = [],
    // `stalls.length` alone can't tell "this event genuinely has no stalls"
    // apart from "we haven't heard back yet / the fetch failed" — GET
    // /tickets/merchants is gated on MANAGE_ACCESS, which a MANAGER (who
    // still has MANAGE_STOCK and so sees this tab) does not hold, so this
    // query 403s for them every time. isSuccess is the only honest signal.
    isSuccess: stallsLoaded,
    isError: stallsErrored,
  } = useQuery({
    queryKey: ['merchants', eventId],
    queryFn: () => apiClient.merchants.list(eventId),
    enabled: !!eventId,
  });

  const {
    data: allocationData,
    isSuccess: allocationsLoaded,
    isError: allocationsErrored,
    error: allocationsError,
  } = useQuery({
    queryKey: ['event-stock-allocations', eventId],
    queryFn: () => apiClient.stock.getAllocations(eventId),
    enabled: !!eventId, // matches its three siblings above/below
  });
  const allocations = allocationData?.allocations ?? {};

  // react-query v5 dropped the per-query onError callback, so a failed
  // allocations fetch previously only showed up through its side effects —
  // the "Not on any stall" flag never lighting up, an edit unable to change
  // stall assignments. Surface it directly, the same way a mutation would.
  useEffect(() => {
    if (allocationsErrored) {
      toast.error(
        (allocationsError as Error)?.message ||
          'Could not load stall allocations — the "Not on any stall" flag and stall edits are unavailable until this loads.',
      );
    }
  }, [allocationsErrored, allocationsError]);

  const { data: board } = useQuery({
    queryKey: ['stock-board', eventId],
    queryFn: () => apiClient.events.getEventStockBoard(eventId),
    enabled: !!eventId,
  });

  // board.perBar grouped by stall, for the levels panel.
  const levelsByStall = useMemo(() => {
    const m = new Map<string, { name: string; rows: NonNullable<typeof board>['perBar'] }>();
    (board?.perBar ?? []).forEach((r) => {
      const g = m.get(r.merchantId) ?? { name: r.merchantName, rows: [] };
      g.rows.push(r);
      m.set(r.merchantId, g);
    });
    return [...m.entries()];
  }, [board]);

  /**
   * Event-wide roll-up for the stock tiles. Summed off byProduct rather than
   * perBar: byProduct already folds in products sold at a stall that never
   * carried a stock row, which perBar has no line for at all.
   */
  const totals = useMemo(() => {
    const rows = board?.byProduct ?? [];
    return {
      unitsSold: rows.reduce((n, r) => n + r.unitsSold, 0),
      revenue: rows.reduce((n, r) => n + r.revenue, 0),
      onHand: rows.reduce((n, r) => n + r.totalOnHand, 0),
      needsAttention: rows.filter((r) => r.status === 'low' || r.status === 'sold_out').length,
    };
  }, [board]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-products', eventId] });
    queryClient.invalidateQueries({ queryKey: ['stock-board', eventId] });
  };
  const invalidateAllocations = () =>
    queryClient.invalidateQueries({ queryKey: ['event-stock-allocations', eventId] });

  const saveProduct = useMutation({
    mutationFn: async (payload: { create?: NewProduct; update?: UpdateProduct; merchantIds: string[] }) => {
      const saved = editing
        ? await apiClient.stock.updateProduct(editing._id, payload.update!)
        : await apiClient.stock.createProduct(eventId, payload.create!);
      // A product must exist before it can be allocated, so this follows the
      // save rather than running alongside it. A failure here propagates — a
      // half-applied save must never report success.
      //
      // `stalls.length` alone can't distinguish "this event genuinely has no
      // stalls" (nothing to allocate to — skip silently) from "we never
      // learned the stall list, or never learned its current allocations"
      // (skipping is still correct, but `payload.merchantIds` — seeded from
      // that same unproven snapshot in openEdit — must NOT be sent to this
      // destructive PUT as authoritative desired state, and the save must
      // not be reported as a clean, fully-applied success).
      let allocationSkipped: 'stalls-unknown' | 'allocations-unknown' | false = false;
      if (!stallsLoaded) {
        allocationSkipped = 'stalls-unknown';
      } else if (stalls.length) {
        if (allocationsLoaded) {
          await apiClient.stock.setAllocations(eventId, {
            productId: saved._id,
            merchantIds: payload.merchantIds,
          });
        } else {
          allocationSkipped = 'allocations-unknown';
        }
      }
      return { saved, allocationSkipped };
    },
    onSuccess: ({ allocationSkipped }) => {
      invalidate();
      invalidateAllocations();
      if (allocationSkipped) {
        const verb = editing ? 'Product updated' : 'Product added';
        toast.error(
          allocationSkipped === 'stalls-unknown'
            ? `${verb}, but stalls could not be loaded — it has not been allocated to any stall. Reopen and save again once stalls load.`
            : `${verb}, but current stall allocations could not be confirmed — none were changed. Reopen and save again once they load.`,
        );
      } else {
        toast.success(editing ? 'Product updated' : 'Product added');
      }
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      // A 409 here (stock arrived at a stall mid-save) can land after part of
      // the write already applied — new allocations written, non-racing
      // delists applied — so refetch rather than assume nothing changed.
      invalidateAllocations();
      toast.error(e.message || 'Failed to save product');
    },
  });

  const allocateAll = useMutation({
    mutationFn: async () => {
      const merchantIds = stalls.map((s) => s._id);
      // Sequential, not Promise.all: the first failure stops the run and is
      // reported, rather than firing every request and surfacing one rejection
      // out of many with no idea which products actually landed.
      for (const p of products) {
        await apiClient.stock.setAllocations(eventId, { productId: p._id, merchantIds });
      }
    },
    onSuccess: () => {
      invalidateAllocations();
      toast.success('Every product is now on every stall');
    },
    onError: (e: Error) => {
      // A partial run may have already allocated some products before the
      // failure — refetch rather than leave the UI showing stale allocations.
      invalidateAllocations();
      toast.error(e.message || 'Failed to allocate to all stalls');
    },
  });

  // ---- stock operations ----
  const [op, setOp] = useState<null | 'receive' | 'transfer' | 'count' | 'threshold'>(null);
  const [opForm, setOpForm] = useState<OpForm>(EMPTY_OP);

  const receiveM = useMutation({
    mutationFn: () => apiClient.stock.receive(eventId, {
      merchantId: opForm.merchantId, productId: opForm.productId,
      quantity: Number(opForm.quantity), unit: opForm.unit,
      ...(opForm.note.trim() ? { note: opForm.note.trim() } : {}),
    }),
    onSuccess: (r) => { invalidate(); toast.success(`Received — on hand now ${r.onHand}`); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Receive failed'),
  });

  const transferM = useMutation({
    mutationFn: () => apiClient.stock.transfer(eventId, {
      productId: opForm.productId, fromMerchantId: opForm.fromMerchantId, toMerchantId: opForm.toMerchantId,
      qty: Number(opForm.quantity), ...(opForm.note.trim() ? { note: opForm.note.trim() } : {}),
    }),
    onSuccess: (r) => { invalidate(); toast.success(`Transferred — source now ${r.fromOnHand}`); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Not enough stock at the source stall'),
  });

  const countM = useMutation({
    mutationFn: () => apiClient.stock.recordCount(eventId, {
      merchantId: opForm.merchantId, productId: opForm.productId, countedOnHand: Number(opForm.quantity),
    }),
    onSuccess: (r) => {
      invalidate();
      const v = r.variance;
      toast.success(v === 0 ? 'Count matched' : `Variance ${v > 0 ? `+${v}` : v} (now ${r.onHand})`);
      setOp(null);
    },
    onError: (e: Error) => toast.error(e.message || 'Count failed'),
  });

  const thresholdM = useMutation({
    mutationFn: (clear: boolean) => apiClient.stock.setThreshold(eventId, {
      merchantId: opForm.merchantId, productId: opForm.productId,
      lowStockThreshold: clear ? null : Number(opForm.quantity),
    }),
    onSuccess: () => { invalidate(); toast.success('Low-stock alert updated'); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Failed to set threshold'),
  });

  const openOp = (kind: 'receive' | 'transfer' | 'count' | 'threshold') => {
    setOpForm({ ...EMPTY_OP, productId: products[0]?._id ?? '', merchantId: stalls[0]?._id ?? '', fromMerchantId: stalls[0]?._id ?? '', toMerchantId: stalls[1]?._id ?? '' });
    setOp(kind);
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (p: StockProductRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      priceRand: centsToRand(p.price),
      barcode: p.barcode ?? '',
      unitLabel: p.unitLabel ?? 'unit',
      unitsPerPack: p.unitsPerPack != null ? String(p.unitsPerPack) : '',
      packLabel: p.packLabel ?? '',
      imageUrl: p.imageUrl ?? '',
      active: p.active,
      merchantIds: allocations[p._id] ?? [],
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const cents = randToCents(form.priceRand);
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (cents == null) { toast.error('Enter a valid price'); return; }
    if (form.barcode.trim() && form.barcode.trim().length < 3) { toast.error('Barcode must be at least 3 characters'); return; }
    const hasPack = form.unitsPerPack.trim() !== '';
    const packN = hasPack ? Number(form.unitsPerPack) : null;
    if (packN != null && (!Number.isInteger(packN) || packN < 1)) { toast.error('Units per pack must be a whole number'); return; }
    const barcode = form.barcode.trim();
    const packLabel = form.packLabel.trim();
    const unitLabel = form.unitLabel.trim() || 'unit';
    const imageUrl = form.imageUrl.trim();

    if (editing) {
      // Edit: send null to CLEAR an optional field (omitting it would leave the
      // old value — a silent no-op behind a "saved" toast).
      saveProduct.mutate({
        update: {
          name: form.name.trim(),
          category: form.category,
          price: cents,
          barcode: barcode ? barcode : null,
          unitLabel,
          unitsPerPack: packN,
          packLabel: packLabel ? packLabel : null,
          imageUrl: imageUrl ? imageUrl : null,
          active: form.active,
        },
        merchantIds: form.merchantIds,
      });
    } else {
      // Create: the schema rejects null (imageUrl is Joi.string().uri(), and
      // '' fails that check too), so omit empty optionals entirely.
      saveProduct.mutate({
        create: {
          name: form.name.trim(),
          category: form.category,
          price: cents,
          ...(barcode ? { barcode } : {}),
          unitLabel,
          ...(packN != null ? { unitsPerPack: packN } : {}),
          ...(packLabel ? { packLabel } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        },
        merchantIds: form.merchantIds,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Package className="h-4 w-4 text-orange-600" />
        What this event's stalls sell — priced per unit, stocked per stall
      </div>

      {/* Two jobs share this page and they are read at different moments: during
          the event you want the shelf ("what sold, what's left, what it took"),
          before it you want the price list. Splitting them puts the running
          totals at the top of the view that cares about them instead of below a
          product table you have to scroll past. */}
      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList>
          <TabsTrigger value="levels">Stock levels</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Units sold" value={totals.unitsSold.toLocaleString('en-ZA')} hint="rung up on itemised charges" tone="blue" />
            <StatCard icon={<Coins className="h-4 w-4" />} label="Sales" value={fmtR(totals.revenue)} hint="what those units took" tone="green" />
            <StatCard icon={<Boxes className="h-4 w-4" />} label="On hand" value={totals.onHand.toLocaleString('en-ZA')} hint="units still on the shelf" tone="ink" />
            <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Needs attention" value={String(totals.needsAttention)} hint="products low or sold out" tone="orange" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Stock levels</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!products.length || !stalls.length} onClick={() => openOp('receive')}>Receive</Button>
                <Button size="sm" variant="outline" disabled={!products.length || stalls.length < 2} onClick={() => openOp('transfer')}>Transfer</Button>
                <Button size="sm" variant="outline" disabled={!products.length || !stalls.length} onClick={() => openOp('count')}>Count</Button>
              </div>
            </CardHeader>
            <CardContent>
              {levelsByStall.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No stock loaded yet. Use <span className="font-medium">Receive</span> to load a stall.</p>
              ) : (
                <div className="space-y-6">
                  {levelsByStall.map(([merchantId, g]) => (
                    <div key={merchantId}>
                      <div className="text-sm font-semibold mb-1">{g.name}</div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Sold</TableHead>
                              <TableHead className="text-right">In stock</TableHead>
                              <TableHead className="text-right">Sales</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.rows.map((r) => (
                              <TableRow key={r.productId} className="hover:bg-slate-50">
                                <TableCell className="font-medium">{r.productName}</TableCell>
                                <TableCell className="text-right tabular-nums">{r.unitsSold}</TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">{r.onHand}</TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">{fmtR(r.revenue)}</TableCell>
                                <TableCell><StatusPill status={r.status} /></TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Low-stock alert"
                                    onClick={() => { setOpForm({ ...EMPTY_OP, merchantId, productId: r.productId, quantity: r.lowStockThreshold != null ? String(r.lowStockThreshold) : '' }); setOp('threshold'); }}>
                                    <Bell className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogue" className="space-y-4">
          <div className="flex justify-end gap-2">
            {stalls.length > 0 && (
              <Button
                variant="outline"
                disabled={allocateAll.isPending}
                onClick={() => allocateAll.mutate()}
              >
                {allocateAll.isPending ? 'Allocating…' : 'Allocate to all stalls'}
              </Button>
            )}
            <Button onClick={openAdd} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-1" /> Add product
            </Button>
          </div>

          {isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Loading products…</CardContent></Card>
          ) : products.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No products yet. Add your first one.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p._id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {p.name}
                          {allocationsLoaded && (allocations[p._id]?.length ?? 0) === 0 && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                              Not on any stall
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{categoryLabel(p.category)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtR(p.price)}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{p.barcode ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.unitsPerPack ? `${p.unitsPerPack} / ${p.packLabel ?? 'pack'}` : '—'}</TableCell>
                        <TableCell>
                          {p.active
                            ? <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                            : <Badge variant="secondary" className="bg-gray-100 text-gray-700">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <EventStockReport eventId={eventId} />
        </TabsContent>
      </Tabs>
      <StockOpDialogs
        op={op} setOp={setOp} form={opForm} setForm={setOpForm}
        products={products} stalls={stalls}
        receiveM={receiveM} transferM={transferM} countM={countM} thresholdM={thresholdM}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Castle Lite 330ml" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Price (R per unit)</Label>
                <Input inputMode="decimal" value={form.priceRand} onChange={(e) => setForm({ ...form, priceRand: e.target.value })} placeholder="25.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Sold at</Label>
              {!stallsLoaded ? (
                <p className={stallsErrored ? 'text-xs text-red-600' : 'text-xs text-muted-foreground'}>
                  {stallsErrored
                    ? 'Stalls could not be loaded — this event may already have stalls, so this is not necessarily a setup problem. This product will not be assigned to a stall until it is saved again once stalls load.'
                    : 'Loading stalls…'}
                </p>
              ) : stalls.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Create a stall first on the Stalls tab — a product with no stall
                  does not appear on any handheld.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  {stalls.map((s) => (
                    <div key={s._id} className="flex items-center gap-2">
                      <Checkbox
                        id={`stall-${s._id}`}
                        checked={form.merchantIds.includes(s._id)}
                        onCheckedChange={(on) =>
                          setForm((f) => ({
                            ...f,
                            merchantIds: on
                              ? [...new Set([...f.merchantIds, s._id])]
                              : f.merchantIds.filter((id) => id !== s._id),
                          }))
                        }
                      />
                      <Label htmlFor={`stall-${s._id}`} className="font-normal">{s.name}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Barcode <span className="text-muted-foreground text-xs">(optional, EAN/UPC)</span></Label>
              <BarcodeField
                value={form.barcode}
                onChange={(barcode) => setForm((f) => ({ ...f, barcode }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <ImageUploadField
                value={form.imageUrl}
                onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
                onUpload={(file) => apiClient.events.uploadProductImage(eventId, file)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Unit label</Label>
                <Input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} placeholder="unit" />
              </div>
              <div className="space-y-1">
                <Label>Units / pack</Label>
                <Input inputMode="numeric" value={form.unitsPerPack} onChange={(e) => setForm({ ...form, unitsPerPack: e.target.value })} placeholder="24" />
              </div>
              <div className="space-y-1">
                <Label>Pack label</Label>
                <Input value={form.packLabel} onChange={(e) => setForm({ ...form, packLabel: e.target.value })} placeholder="case" />
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between pt-1">
                <Label>Active (sold at the POS)</Label>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saveProduct.isPending} className="bg-orange-600 hover:bg-orange-700">
                {saveProduct.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- shared bits ----
const STATUS_META: Record<StockStatus, { label: string; className: string }> = {
  in_stock: { label: 'In stock', className: 'bg-slate-100 text-slate-700' },
  low: { label: 'Low', className: 'bg-amber-100 text-amber-800' },
  sold_out: { label: 'Sold out', className: 'bg-red-100 text-red-700' },
};
function StatusPill({ status }: { status: StockStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.in_stock;
  return <Badge variant="secondary" className={m.className}>{m.label}</Badge>;
}

type Mut = { mutate: () => void; isPending: boolean };
type MutBool = { mutate: (clear: boolean) => void; isPending: boolean };

/** The four per-stall stock operations, one Dialog shown at a time driven by `op`. */
function StockOpDialogs({
  op, setOp, form, setForm, products, stalls, receiveM, transferM, countM, thresholdM,
}: {
  op: null | 'receive' | 'transfer' | 'count' | 'threshold';
  setOp: (v: null) => void;
  form: OpForm;
  setForm: (f: OpForm) => void;
  products: StockProductRow[];
  stalls: { _id: string; name: string }[];
  receiveM: Mut; transferM: Mut; countM: Mut; thresholdM: MutBool;
}) {
  const productSelect = (
    <div className="space-y-1">
      <Label>Product</Label>
      <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
        <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
        <SelectContent>{products.map((p) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const stallSelect = (label: string, value: string, key: 'merchantId' | 'fromMerchantId' | 'toMerchantId') => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => setForm({ ...form, [key]: v })}>
        <SelectTrigger><SelectValue placeholder="Select a stall" /></SelectTrigger>
        <SelectContent>{stalls.map((b) => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const qtyInput = (label: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input inputMode="numeric" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
    </div>
  );
  const noteInput = (
    <div className="space-y-1">
      <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
      <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
    </div>
  );
  const qtyValid = Number.isInteger(Number(form.quantity)) && Number(form.quantity) >= 1;
  // A count of 0 is legitimate (stall sold out), so it can't reuse qtyValid's >= 1.
  const countValid = form.quantity.trim() !== '' && Number.isInteger(Number(form.quantity)) && Number(form.quantity) >= 0;

  return (
    <Dialog open={op !== null} onOpenChange={(o) => { if (!o) setOp(null); }}>
      <DialogContent>
        {op === 'receive' && (
          <>
            <DialogHeader><DialogTitle>Receive stock</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {stallSelect('Stall', form.merchantId, 'merchantId')}
              {productSelect}
              <div className="grid grid-cols-2 gap-3">
                {qtyInput('Quantity')}
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v as 'unit' | 'pack' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="unit">Units</SelectItem><SelectItem value="pack">Packs</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {noteInput}
              <OpActions onCancel={() => setOp(null)} onConfirm={() => receiveM.mutate()} pending={receiveM.isPending} disabled={!form.merchantId || !form.productId || !qtyValid} label="Receive" />
            </div>
          </>
        )}
        {op === 'transfer' && (
          <>
            <DialogHeader><DialogTitle>Transfer stock</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {productSelect}
              <div className="grid grid-cols-2 gap-3">
                {stallSelect('From stall', form.fromMerchantId, 'fromMerchantId')}
                {stallSelect('To stall', form.toMerchantId, 'toMerchantId')}
              </div>
              {qtyInput('Quantity (units)')}
              {noteInput}
              <OpActions onCancel={() => setOp(null)} onConfirm={() => transferM.mutate()} pending={transferM.isPending}
                disabled={!form.productId || !form.fromMerchantId || !form.toMerchantId || form.fromMerchantId === form.toMerchantId || !qtyValid} label="Transfer" />
              {form.fromMerchantId === form.toMerchantId && form.fromMerchantId !== '' && (
                <p className="text-xs text-red-600">Pick two different stalls.</p>
              )}
            </div>
          </>
        )}
        {op === 'count' && (
          <>
            <DialogHeader><DialogTitle>Physical count</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {stallSelect('Stall', form.merchantId, 'merchantId')}
              {productSelect}
              {qtyInput('Counted on hand')}
              <OpActions onCancel={() => setOp(null)} onConfirm={() => countM.mutate()} pending={countM.isPending}
                disabled={!form.merchantId || !form.productId || !countValid} label="Submit count" />
            </div>
          </>
        )}
        {op === 'threshold' && (
          <>
            <DialogHeader><DialogTitle>Low-stock alert</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Alert the organiser when this stall drops to or below the level below. Clear it to switch the alert off.</p>
              {qtyInput('Alert at (units)')}
              <div className="flex justify-between gap-2 pt-1">
                <Button variant="ghost" onClick={() => thresholdM.mutate(true)} disabled={thresholdM.isPending}>Clear alert</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOp(null)}>Cancel</Button>
                  <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => thresholdM.mutate(false)} disabled={thresholdM.isPending || !qtyValid}>Save</Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OpActions({ onCancel, onConfirm, pending, disabled, label }: {
  onCancel: () => void; onConfirm: () => void; pending: boolean; disabled: boolean; label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button className="bg-orange-600 hover:bg-orange-700" onClick={onConfirm} disabled={pending || disabled}>
        {pending ? 'Working…' : label}
      </Button>
    </div>
  );
}

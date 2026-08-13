import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Package, Pencil, Bell } from 'lucide-react';
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

type ProductForm = {
  name: string;
  category: string;
  priceRand: string;
  barcode: string;
  unitLabel: string;
  unitsPerPack: string;
  packLabel: string;
  active: boolean;
};
const EMPTY_FORM: ProductForm = {
  name: '', category: 'beer', priceRand: '', barcode: '',
  unitLabel: 'unit', unitsPerPack: '', packLabel: '', active: true,
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
 * Cashless Catalogue & Stock management (Slice 6 / parent §9). An event picker
 * (cashless events) drives the product catalogue + per-bar stock operations for
 * that event. Mirrors VendorsPage's pattern; the API enforces MANAGE_STOCK +
 * event ownership on every call.
 */
export function StockCataloguePage() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const { data: eventsData } = useQuery({
    queryKey: ['events', 'for-catalogue'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });
  const cashlessEvents = useMemo(
    () => (eventsData?.data ?? []).filter((e) => e.cashless),
    [eventsData],
  );
  const selectedEventId = eventId || cashlessEvents[0]?._id || '';

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['stock-products', selectedEventId],
    queryFn: () => apiClient.stock.listProducts(selectedEventId),
    enabled: !!selectedEventId,
  });

  const { data: bars = [] } = useQuery({
    queryKey: ['merchants', selectedEventId],
    queryFn: () => apiClient.merchants.list(selectedEventId),
    enabled: !!selectedEventId,
  });

  const { data: board } = useQuery({
    queryKey: ['stock-board', selectedEventId],
    queryFn: () => apiClient.events.getEventStockBoard(selectedEventId),
    enabled: !!selectedEventId,
  });

  // board.perBar grouped by bar, for the levels panel.
  const levelsByBar = useMemo(() => {
    const m = new Map<string, { name: string; rows: NonNullable<typeof board>['perBar'] }>();
    (board?.perBar ?? []).forEach((r) => {
      const g = m.get(r.merchantId) ?? { name: r.merchantName, rows: [] };
      g.rows.push(r);
      m.set(r.merchantId, g);
    });
    return [...m.entries()];
  }, [board]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-products', selectedEventId] });
    queryClient.invalidateQueries({ queryKey: ['stock-board', selectedEventId] });
  };

  const saveProduct = useMutation({
    mutationFn: (payload: { create?: NewProduct; update?: UpdateProduct }) =>
      payload.update
        ? apiClient.stock.updateProduct(editing!._id, payload.update)
        : apiClient.stock.createProduct(selectedEventId, payload.create!),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Product updated' : 'Product added');
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save product'),
  });

  // ---- stock operations ----
  const [op, setOp] = useState<null | 'receive' | 'transfer' | 'count' | 'threshold'>(null);
  const [opForm, setOpForm] = useState<OpForm>(EMPTY_OP);

  const receiveM = useMutation({
    mutationFn: () => apiClient.stock.receive(selectedEventId, {
      merchantId: opForm.merchantId, productId: opForm.productId,
      quantity: Number(opForm.quantity), unit: opForm.unit,
      ...(opForm.note.trim() ? { note: opForm.note.trim() } : {}),
    }),
    onSuccess: (r) => { invalidate(); toast.success(`Received — on hand now ${r.onHand}`); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Receive failed'),
  });

  const transferM = useMutation({
    mutationFn: () => apiClient.stock.transfer(selectedEventId, {
      productId: opForm.productId, fromMerchantId: opForm.fromMerchantId, toMerchantId: opForm.toMerchantId,
      qty: Number(opForm.quantity), ...(opForm.note.trim() ? { note: opForm.note.trim() } : {}),
    }),
    onSuccess: (r) => { invalidate(); toast.success(`Transferred — source now ${r.fromOnHand}`); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Not enough stock at the source bar'),
  });

  const countM = useMutation({
    mutationFn: () => apiClient.stock.recordCount(selectedEventId, {
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
    mutationFn: (clear: boolean) => apiClient.stock.setThreshold(selectedEventId, {
      merchantId: opForm.merchantId, productId: opForm.productId,
      lowStockThreshold: clear ? null : Number(opForm.quantity),
    }),
    onSuccess: () => { invalidate(); toast.success('Low-stock alert updated'); setOp(null); },
    onError: (e: Error) => toast.error(e.message || 'Failed to set threshold'),
  });

  const openOp = (kind: 'receive' | 'transfer' | 'count' | 'threshold') => {
    setOpForm({ ...EMPTY_OP, productId: products[0]?._id ?? '', merchantId: bars[0]?._id ?? '', fromMerchantId: bars[0]?._id ?? '', toMerchantId: bars[1]?._id ?? '' });
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
      active: p.active,
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
          active: form.active,
        },
      });
    } else {
      // Create: the schema rejects null, so omit empty optionals.
      saveProduct.mutate({
        create: {
          name: form.name.trim(),
          category: form.category,
          price: cents,
          ...(barcode ? { barcode } : {}),
          unitLabel,
          ...(packN != null ? { unitsPerPack: packN } : {}),
          ...(packLabel ? { packLabel } : {}),
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-600" />
          <h1 className="text-xl font-bold">Catalogue</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEventId} onValueChange={setEventId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a cashless event" /></SelectTrigger>
            <SelectContent>
              {cashlessEvents.map((e) => (
                <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAdd} disabled={!selectedEventId} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-1" /> Add product
          </Button>
        </div>
      </div>

      {!selectedEventId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Create a cashless event first, then add its products here.</CardContent></Card>
      ) : isLoading ? (
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
                    <TableCell className="font-medium">{p.name}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedEventId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Stock levels</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!products.length || !bars.length} onClick={() => openOp('receive')}>Receive</Button>
              <Button size="sm" variant="outline" disabled={!products.length || bars.length < 2} onClick={() => openOp('transfer')}>Transfer</Button>
              <Button size="sm" variant="outline" disabled={!products.length || !bars.length} onClick={() => openOp('count')}>Count</Button>
            </div>
          </CardHeader>
          <CardContent>
            {levelsByBar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No stock loaded yet. Use <span className="font-medium">Receive</span> to load a bar.</p>
            ) : (
              <div className="space-y-4">
                {levelsByBar.map(([merchantId, g]) => (
                  <div key={merchantId}>
                    <div className="text-sm font-semibold mb-1">{g.name}</div>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                      {g.rows.map((r) => (
                        <div key={r.productId} className="flex items-center justify-between text-sm border-b border-slate-100 py-1">
                          <span className="truncate">{r.productName}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums">{r.onHand}</span>
                            <StatusPill status={r.status} />
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Low-stock alert"
                              onClick={() => { setOpForm({ ...EMPTY_OP, merchantId, productId: r.productId, quantity: r.lowStockThreshold != null ? String(r.lowStockThreshold) : '' }); setOp('threshold'); }}>
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <StockOpDialogs
        op={op} setOp={setOp} form={opForm} setForm={setOpForm}
        products={products} bars={bars}
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
              <Label>Barcode <span className="text-muted-foreground text-xs">(optional, EAN/UPC)</span></Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="6001240100015" />
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

/** The four per-bar stock operations, one Dialog shown at a time driven by `op`. */
function StockOpDialogs({
  op, setOp, form, setForm, products, bars, receiveM, transferM, countM, thresholdM,
}: {
  op: null | 'receive' | 'transfer' | 'count' | 'threshold';
  setOp: (v: null) => void;
  form: OpForm;
  setForm: (f: OpForm) => void;
  products: StockProductRow[];
  bars: { _id: string; name: string }[];
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
  const barSelect = (label: string, value: string, key: 'merchantId' | 'fromMerchantId' | 'toMerchantId') => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => setForm({ ...form, [key]: v })}>
        <SelectTrigger><SelectValue placeholder="Select a bar" /></SelectTrigger>
        <SelectContent>{bars.map((b) => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
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
  // A count of 0 is legitimate (bar sold out), so it can't reuse qtyValid's >= 1.
  const countValid = form.quantity.trim() !== '' && Number.isInteger(Number(form.quantity)) && Number(form.quantity) >= 0;

  return (
    <Dialog open={op !== null} onOpenChange={(o) => { if (!o) setOp(null); }}>
      <DialogContent>
        {op === 'receive' && (
          <>
            <DialogHeader><DialogTitle>Receive stock</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {barSelect('Bar', form.merchantId, 'merchantId')}
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
                {barSelect('From bar', form.fromMerchantId, 'fromMerchantId')}
                {barSelect('To bar', form.toMerchantId, 'toMerchantId')}
              </div>
              {qtyInput('Quantity (units)')}
              {noteInput}
              <OpActions onCancel={() => setOp(null)} onConfirm={() => transferM.mutate()} pending={transferM.isPending}
                disabled={!form.productId || !form.fromMerchantId || !form.toMerchantId || form.fromMerchantId === form.toMerchantId || !qtyValid} label="Transfer" />
              {form.fromMerchantId === form.toMerchantId && form.fromMerchantId !== '' && (
                <p className="text-xs text-red-600">Pick two different bars.</p>
              )}
            </div>
          </>
        )}
        {op === 'count' && (
          <>
            <DialogHeader><DialogTitle>Physical count</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {barSelect('Bar', form.merchantId, 'merchantId')}
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
              <p className="text-sm text-muted-foreground">Alert the organiser when this bar drops to or below the level below. Clear it to switch the alert off.</p>
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

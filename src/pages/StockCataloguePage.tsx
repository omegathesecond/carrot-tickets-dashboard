import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Package, Pencil } from 'lucide-react';
import {
  apiClient,
  PRODUCT_CATEGORIES,
  type StockProductRow,
  type NewProduct,
} from '@/lib/api';
import { fmtR, randToCents, centsToRand } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-products', selectedEventId] });
    queryClient.invalidateQueries({ queryKey: ['stock-board', selectedEventId] });
  };

  const saveProduct = useMutation({
    mutationFn: (payload: NewProduct & { active?: boolean }) =>
      editing
        ? apiClient.stock.updateProduct(editing._id, payload)
        : apiClient.stock.createProduct(selectedEventId, payload),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Product updated' : 'Product added');
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save product'),
  });

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
    const packN = form.unitsPerPack.trim() ? Number(form.unitsPerPack) : undefined;
    if (packN != null && (!Number.isInteger(packN) || packN < 1)) { toast.error('Units per pack must be a whole number'); return; }

    const payload: NewProduct & { active?: boolean } = {
      name: form.name.trim(),
      category: form.category,
      price: cents,
      ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
      ...(form.unitLabel.trim() ? { unitLabel: form.unitLabel.trim() } : {}),
      ...(packN != null ? { unitsPerPack: packN } : {}),
      ...(form.packLabel.trim() ? { packLabel: form.packLabel.trim() } : {}),
      ...(editing ? { active: form.active } : {}),
    };
    saveProduct.mutate(payload);
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

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, UtensilsCrossed, Pencil, ClipboardList } from 'lucide-react';
import {
  apiClient,
  MENU_SECTIONS,
  MENU_ORDER_FULFILLMENT_LABELS,
  type MenuItemRow,
  type NewMenuItem,
  type UpdateMenuItem,
  type MenuSection,
  type MenuOrderRow,
  type MenuOrderFulfillmentStatus,
} from '@/lib/api';
import { fmtR, randToCents, centsToRand } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type ItemForm = {
  section: MenuSection;
  vendorName: string;
  category: string;
  name: string;
  description: string;
  priceRand: string;
  active: boolean;
};
const EMPTY_ITEM_FORM: ItemForm = {
  section: 'bar', vendorName: '', category: '', name: '', description: '', priceRand: '', active: true,
};

const sectionLabel = (v: MenuSection) => MENU_SECTIONS.find((s) => s.value === v)?.label ?? v;

/**
 * Event Menu management (bar + vendor preorder catalogue) — the organiser
 * side of the public event page's "Menu" tab. Items are event-scoped (a
 * MenuItem carries an eventId), so this panel takes the event it lives under.
 * The API enforces MANAGE_MENU + event ownership on every call.
 */
export function EventMenuTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRow | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_ITEM_FORM);

  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('menuView') === 'orders' ? 'orders' : 'items';
  const setView = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('menuView', v);
    setSearchParams(next, { replace: true });
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items', eventId],
    queryFn: () => apiClient.menu.listItems(eventId),
    enabled: !!eventId,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['menu-orders', eventId],
    queryFn: () => apiClient.menu.listOrders(eventId),
    enabled: !!eventId && view === 'orders',
  });

  const grouped = useMemo(() => {
    const bySection = new Map<MenuSection, Map<string, MenuItemRow[]>>();
    for (const item of items) {
      const sectionMap = bySection.get(item.section) ?? new Map<string, MenuItemRow[]>();
      const cat = sectionMap.get(item.category) ?? [];
      cat.push(item);
      sectionMap.set(item.category, cat);
      bySection.set(item.section, sectionMap);
    }
    return bySection;
  }, [items]);

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['menu-items', eventId] });

  const saveItem = useMutation({
    mutationFn: (payload: { create?: NewMenuItem; update?: UpdateMenuItem }) =>
      payload.update
        ? apiClient.menu.updateItem(editing!._id, payload.update)
        : apiClient.menu.createItem(eventId, payload.create!),
    onSuccess: () => {
      invalidateItems();
      toast.success(editing ? 'Menu item updated' : 'Menu item added');
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save menu item'),
  });

  const fulfillmentM = useMutation({
    mutationFn: (p: { orderId: string; status: MenuOrderFulfillmentStatus }) =>
      apiClient.menu.updateOrderFulfillment(p.orderId, p.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-orders', eventId] });
      toast.success('Order updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update order'),
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_ITEM_FORM); setDialogOpen(true); };
  const openEdit = (item: MenuItemRow) => {
    setEditing(item);
    setForm({
      section: item.section,
      vendorName: item.vendorName ?? '',
      category: item.category,
      name: item.name,
      description: item.description ?? '',
      priceRand: centsToRand(item.price),
      active: item.active,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const cents = randToCents(form.priceRand);
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.category.trim()) { toast.error('Category is required'); return; }
    if (cents == null) { toast.error('Enter a valid price'); return; }
    const vendorName = form.vendorName.trim();
    const description = form.description.trim();

    if (editing) {
      saveItem.mutate({
        update: {
          section: form.section,
          vendorName: form.section === 'vendor' ? (vendorName ? vendorName : null) : null,
          category: form.category.trim(),
          name: form.name.trim(),
          description: description ? description : null,
          price: cents,
          active: form.active,
        },
      });
    } else {
      saveItem.mutate({
        create: {
          section: form.section,
          ...(form.section === 'vendor' && vendorName ? { vendorName } : {}),
          category: form.category.trim(),
          name: form.name.trim(),
          ...(description ? { description } : {}),
          price: cents,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UtensilsCrossed className="h-4 w-4 text-orange-600" />
        The bar &amp; vendor menu attendees can preorder from the event page
      </div>

      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Menu</TabsTrigger>
          <TabsTrigger value="orders">Preorders{orders.length ? ` (${orders.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAdd} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-1" /> Add menu item
            </Button>
          </div>

          {isLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Loading menu…</CardContent></Card>
          ) : items.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No menu items yet. Add your first one.</CardContent></Card>
          ) : (
            <div className="space-y-6">
              {(['bar', 'vendor'] as MenuSection[]).map((section) => {
                const sectionMap = grouped.get(section);
                if (!sectionMap || sectionMap.size === 0) return null;
                return (
                  <div key={section}>
                    <h3 className="text-sm font-semibold mb-2">{sectionLabel(section)}</h3>
                    <div className="space-y-4">
                      {[...sectionMap.entries()].map(([category, rows]) => (
                        <Card key={category}>
                          <CardContent className="pt-6 overflow-x-auto">
                            <div className="text-sm font-medium text-muted-foreground mb-2">{category}</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  {section === 'vendor' && <TableHead>Vendor</TableHead>}
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-10" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((item) => (
                                  <TableRow key={item._id} className="hover:bg-slate-50">
                                    <TableCell className="font-medium">
                                      {item.name}
                                      {item.description && (
                                        <div className="text-xs text-muted-foreground font-normal">{item.description}</div>
                                      )}
                                    </TableCell>
                                    {section === 'vendor' && (
                                      <TableCell className="text-muted-foreground">{item.vendorName || '—'}</TableCell>
                                    )}
                                    <TableCell className="text-right font-semibold">{fmtR(item.price)}</TableCell>
                                    <TableCell>
                                      {item.active
                                        ? <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                                        : <Badge variant="secondary" className="bg-gray-100 text-gray-700">Inactive</Badge>}
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {ordersLoading ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Loading preorders…</CardContent></Card>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
              No preorders yet.
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Charged</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: MenuOrderRow) => (
                      <TableRow key={order._id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                        <TableCell>
                          <div className="font-medium">{order.buyerName || 'Guest'}</div>
                          {order.buyerPhone && <div className="text-xs text-muted-foreground">{order.buyerPhone}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.items.map((li) => `${li.quantity}× ${li.name}`).join(', ')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmtR(order.amountCharged)}</TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.fulfillmentStatus}
                            onValueChange={(v) => fulfillmentM.mutate({ orderId: order._id, status: v as MenuOrderFulfillmentStatus })}
                            disabled={order.paymentStatus !== 'completed'}
                          >
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(MENU_ORDER_FULFILLMENT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit menu item' : 'Add menu item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Menu</Label>
                <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v as MenuSection })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MENU_SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Price (R)</Label>
                <Input inputMode="decimal" value={form.priceRand} onChange={(e) => setForm({ ...form, priceRand: e.target.value })} placeholder="25.00" />
              </div>
            </div>
            {form.section === 'vendor' && (
              <div className="space-y-1">
                <Label>Vendor / stall name</Label>
                <Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Mama's Kitchen" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Cold Drinks" />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Stoney Ginger Beer 300ml" />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            {editing && (
              <div className="flex items-center justify-between pt-1">
                <Label>Active (shown on the event page)</Label>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saveItem.isPending} className="bg-orange-600 hover:bg-orange-700">
                {saveItem.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PAYMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', className: 'bg-slate-100 text-slate-700' },
};
function PaymentStatusBadge({ status }: { status: string }) {
  const m = PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.pending;
  return <Badge variant="secondary" className={m.className}>{m.label}</Badge>;
}

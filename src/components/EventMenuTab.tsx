import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, UtensilsCrossed, Pencil, ClipboardList, Trash2, PackagePlus } from 'lucide-react';
import {
  apiClient,
  MENU_SECTIONS,
  MENU_ORDER_FULFILLMENT_LABELS,
  PRODUCT_CATEGORIES,
  type MenuItemRow,
  type NewMenuItem,
  type UpdateMenuItem,
  type MenuSection,
  type MenuOrderRow,
  type MenuOrderFulfillmentStatus,
  type StockProductRow,
} from '@/lib/api';
import { fmtR, randToCents, centsToRand } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImageUploadField } from '@/components/ImageUploadField';

type ItemForm = {
  section: MenuSection;
  vendorName: string;
  category: string;
  name: string;
  description: string;
  priceRand: string;
  imageUrl: string;
  active: boolean;
};
const EMPTY_ITEM_FORM: ItemForm = {
  section: 'bar', vendorName: '', category: '', name: '', description: '', priceRand: '', imageUrl: '', active: true,
};

const sectionLabel = (v: MenuSection) => MENU_SECTIONS.find((s) => s.value === v)?.label ?? v;
const productCategoryLabel = (v: string) => PRODUCT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/**
 * Sentinel for the picker's "create one" row. Only the picker's own
 * onValueChange is guarded against it (an option can't collide with a value
 * the user picked) — the free-text input it reveals is not, so `submit()`
 * separately rejects a typed category that equals this sentinel.
 */
const NEW_CATEGORY = '__new__';

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
  const [deleting, setDeleting] = useState<MenuItemRow | null>(null);
  // True while the organizer is naming a category that does not exist yet.
  const [newCategory, setNewCategory] = useState(false);

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

  // Best-effort — a MANAGE_MENU-only role may lack MANAGE_ACCESS/MANAGE_STOCK,
  // in which case these 403 and the vendor picker / catalogue import just fall
  // back to manual entry instead of breaking the tab.
  const { data: merchants = [] } = useQuery({
    queryKey: ['merchants', eventId],
    queryFn: () => apiClient.merchants.list(eventId),
    enabled: !!eventId,
    retry: false,
  });
  const { data: catalogueProducts = [] } = useQuery({
    queryKey: ['stock-products', eventId],
    queryFn: () => apiClient.stock.listProducts(eventId),
    enabled: !!eventId,
    retry: false,
  });

  // Existing vendor names / categories already used on this menu, so the next
  // item can pick one instead of retyping it (merged with cashless stalls for
  // the vendor picker).
  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    merchants.forEach((m) => set.add(m.name));
    items.forEach((i) => { if (i.vendorName) set.add(i.vendorName); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [merchants, items]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.category) set.add(i.category); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

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

  const toggleActiveM = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => apiClient.menu.updateItem(p.id, { active: p.active }),
    onSuccess: (_data, vars) => {
      invalidateItems();
      toast.success(vars.active ? 'Marked as available' : 'Marked as sold out');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update item'),
  });

  const deleteItemM = useMutation({
    mutationFn: (id: string) => apiClient.menu.deleteItem(id),
    onSuccess: () => {
      invalidateItems();
      toast.success('Menu item deleted');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete menu item'),
  });

  // ---- Add from catalogue (avoids re-typing name/price for stock that's
  // already loaded in the cashless Catalogue) ----
  const [importOpen, setImportOpen] = useState(false);
  const [importSection, setImportSection] = useState<MenuSection>('vendor');
  const [importVendorName, setImportVendorName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const openImport = () => {
    setImportSection('vendor');
    setImportVendorName('');
    setSelectedProductIds(new Set());
    setImportOpen(true);
  };
  const toggleProductSelected = (id: string, checked: boolean) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const importItemsM = useMutation({
    mutationFn: async (p: { productIds: string[]; section: MenuSection; vendorName: string }) => {
      const vendorName = p.vendorName.trim();
      const chosen = catalogueProducts.filter((prod) => p.productIds.includes(prod._id));
      await Promise.all(chosen.map((prod) => apiClient.menu.createItem(eventId, {
        section: p.section,
        ...(p.section === 'vendor' && vendorName ? { vendorName } : {}),
        category: productCategoryLabel(prod.category),
        name: prod.name,
        price: prod.price,
        ...(prod.imageUrl ? { imageUrl: prod.imageUrl } : {}),
      })));
      return chosen.length;
    },
    onSuccess: (count) => {
      invalidateItems();
      toast.success(`Added ${count} item${count === 1 ? '' : 's'} from the catalogue`);
      setImportOpen(false);
      setSelectedProductIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add items from the catalogue'),
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_ITEM_FORM); setNewCategory(false); setDialogOpen(true); };
  const openEdit = (item: MenuItemRow) => {
    setEditing(item);
    setForm({
      section: item.section,
      vendorName: item.vendorName ?? '',
      category: item.category,
      name: item.name,
      description: item.description ?? '',
      priceRand: centsToRand(item.price),
      imageUrl: item.imageUrl ?? '',
      active: item.active,
    });
    // The category options are derived from the items on this menu, so the
    // item's own category will normally be among them — but a race or a
    // just-deleted last item in that category could leave it absent. Start
    // in create mode so the existing value is shown, not silently dropped.
    setNewCategory(!categoryOptions.includes(item.category));
    setDialogOpen(true);
  };

  const submit = () => {
    const cents = randToCents(form.priceRand);
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.category.trim()) { toast.error('Category is required'); return; }
    // The sentinel only guards the picker's own "+ New category…" row — the
    // free-text input reachable from it has no such check, so an organizer
    // could otherwise type the sentinel itself and make that category
    // permanently unselectable (it would collide with the picker's own row).
    if (form.category.trim() === NEW_CATEGORY) {
      toast.error('That category name is reserved — please choose another');
      return;
    }
    if (cents == null) { toast.error('Enter a valid price'); return; }
    const vendorName = form.vendorName.trim();
    const description = form.description.trim();
    const imageUrl = form.imageUrl.trim();

    if (editing) {
      saveItem.mutate({
        update: {
          section: form.section,
          vendorName: form.section === 'vendor' ? (vendorName ? vendorName : null) : null,
          category: form.category.trim(),
          name: form.name.trim(),
          description: description ? description : null,
          price: cents,
          imageUrl: imageUrl ? imageUrl : null,
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
          ...(imageUrl ? { imageUrl } : {}),
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
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={openImport}
              disabled={!catalogueProducts.length}
              title={!catalogueProducts.length ? 'No cashless catalogue products yet' : undefined}
            >
              <PackagePlus className="h-4 w-4 mr-1" /> Add from catalogue
            </Button>
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
                                  <TableHead className="w-14" />
                                  <TableHead>Item</TableHead>
                                  {section === 'vendor' && <TableHead>Vendor</TableHead>}
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-28" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((item) => (
                                  <TableRow key={item._id} className="hover:bg-slate-50">
                                    <TableCell>
                                      {item.imageUrl ? (
                                        <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                          <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </TableCell>
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
                                        : <Badge variant="secondary" className="bg-gray-100 text-gray-700">Sold out</Badge>}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-end gap-1">
                                        <Switch
                                          checked={item.active}
                                          onCheckedChange={(v) => toggleActiveM.mutate({ id: item._id, active: v })}
                                          aria-label={item.active ? 'Mark as sold out' : 'Mark as available'}
                                          title={item.active ? 'Mark as sold out' : 'Mark as available'}
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleting(item)} title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                      </div>
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
                            <SelectTrigger className="h-8 w-36" aria-label="Status"><SelectValue /></SelectTrigger>
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
            <div className="space-y-1">
              <Label>Menu</Label>
              <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v as MenuSection })}>
                {/* Every SelectTrigger in this file gets an aria-label matching
                    its visible <Label> (or column header, for the order-status
                    one below): role="combobox" doesn't take its accessible
                    name from visible content the way a plain <button> would,
                    and none of these sibling <Label>s are programmatically
                    associated (no htmlFor/id) — so without it, the control has
                    no accessible name at all. */}
                <SelectTrigger aria-label="Menu"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MENU_SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.section === 'vendor' && (
              <div className="space-y-1">
                <Label>Vendor / stall name</Label>
                <Input
                  list="menu-vendor-options"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  placeholder="Mama's Kitchen"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Category</Label>
              {newCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Cold Drinks"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setNewCategory(false); setForm({ ...form, category: '' }); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    if (v === NEW_CATEGORY) { setNewCategory(true); setForm({ ...form, category: '' }); return; }
                    setForm({ ...form, category: v });
                  }}
                >
                  <SelectTrigger aria-label="Category"><SelectValue placeholder="Pick a category" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value={NEW_CATEGORY}>+ New category…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Stoney Ginger Beer 300ml" />
            </div>
            <div className="space-y-1">
              <Label>Price (R)</Label>
              <Input inputMode="decimal" value={form.priceRand} onChange={(e) => setForm({ ...form, priceRand: e.target.value })} placeholder="25.00" />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <ImageUploadField
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
                onUpload={(file) => apiClient.events.uploadMenuItemImage(eventId, file)}
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between pt-1">
                <Label>{form.active ? 'Available' : 'Sold out'} <span className="text-muted-foreground text-xs">(shown on the event page)</span></Label>
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

      {/* Vendor name suggestions — plain <input list> so the field stays
          type-anything but shows what's already in use, no combobox needed.
          Category has its own picker (a Select above) instead: unlike vendor
          names, a datalist there was invisible and easy to typo-duplicate. */}
      <datalist id="menu-vendor-options">
        {vendorOptions.map((v) => <option key={v} value={v} />)}
      </datalist>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete menu item?"
        description={deleting ? `"${deleting.name}" will be removed from the event page. This can't be undone.` : undefined}
        confirmLabel="Delete"
        isLoading={deleteItemM.isPending}
        onConfirm={() => deleting && deleteItemM.mutate(deleting._id)}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add items from catalogue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pull items straight from the cashless catalogue instead of loading the same stock twice — pick all of it or just the ones you want on the online menu.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Add to</Label>
                <Select value={importSection} onValueChange={(v) => setImportSection(v as MenuSection)}>
                  <SelectTrigger aria-label="Add to"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MENU_SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {importSection === 'vendor' && (
                <div className="space-y-1">
                  <Label>Vendor / stall name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    list="menu-vendor-options"
                    value={importVendorName}
                    onChange={(e) => setImportVendorName(e.target.value)}
                    placeholder="Mama's Kitchen"
                  />
                </div>
              )}
            </div>
            {catalogueProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No catalogue products yet — add them under Cashless → Catalogue first.</p>
            ) : (
              <div className="border rounded-md">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Checkbox
                    checked={selectedProductIds.size === catalogueProducts.length}
                    onCheckedChange={(v) => setSelectedProductIds(v ? new Set(catalogueProducts.map((p) => p._id)) : new Set())}
                  />
                  <span className="text-sm font-medium">Select all ({catalogueProducts.length})</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y">
                  {catalogueProducts.map((p: StockProductRow) => (
                    <label key={p._id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <Checkbox
                        checked={selectedProductIds.has(p._id)}
                        onCheckedChange={(v) => toggleProductSelected(p._id, v === true)}
                      />
                      <span className="flex-1">
                        {p.name}
                        <span className="text-muted-foreground"> · {productCategoryLabel(p.category)}</span>
                      </span>
                      <span className="text-muted-foreground font-medium">{fmtR(p.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button
                onClick={() => importItemsM.mutate({ productIds: [...selectedProductIds], section: importSection, vendorName: importVendorName })}
                disabled={importItemsM.isPending || selectedProductIds.size === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {importItemsM.isPending ? 'Adding…' : `Add ${selectedProductIds.size || ''} item${selectedProductIds.size === 1 ? '' : 's'}`}
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

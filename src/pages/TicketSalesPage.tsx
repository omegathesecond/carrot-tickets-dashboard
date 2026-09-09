import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneInput } from '@/components/PhoneInput';
import { TicketSuccessDialog } from '@/components/TicketSuccessDialog';
import { toast } from 'sonner';
import type { SellTicketsRequest } from '@/types';
import { formatMoney } from '@/lib/currency';

export function TicketSalesPage() {
  const [formData, setFormData] = useState<Partial<SellTicketsRequest>>({
    paymentMethod: 'cash',
  });
  // tier id -> quantity. Box-office staff regularly ring up several tiers for
  // one customer; making that one sale means one payment and one receipt.
  const [cart, setCart] = useState<Record<string, number>>({});
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: eventsData } = useQuery({
    queryKey: ['publishedEvents'],
    queryFn: () => apiClient.events.getEvents({ status: 'published', limit: 100 }),
  });

  // Payment methods come from the same config the rest of the app uses, so
  // they stay consistent (e.g. Keshless Wallet only shows if it's enabled).
  const { data: paymentSettings } = useQuery({
    queryKey: ['paymentMethodSettings'],
    queryFn: () => apiClient.settings.getPaymentMethods(),
  });

  // The organizer sell endpoint supports cash + Keshless Wallet; show whichever
  // are enabled in settings.
  const methods: { value: 'cash' | 'keshless_wallet'; label: string }[] = [
    ...(paymentSettings?.cashEnabled !== false ? [{ value: 'cash' as const, label: 'Cash' }] : []),
    ...(paymentSettings?.keshlessWalletEnabled ? [{ value: 'keshless_wallet' as const, label: 'Keshless Wallet' }] : []),
  ];

  // Keep the selected method valid as settings load.
  useEffect(() => {
    if (methods.length && !methods.some((m) => m.value === formData.paymentMethod)) {
      setFormData((f) => ({ ...f, paymentMethod: methods[0].value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSettings]);

  const selectedEvent = eventsData?.data?.find(e => e._id === formData.eventId);
  const tiers = selectedEvent?.ticketTypes ?? [];
  const cartLines = tiers
    .filter((t) => (cart[t._id!] ?? 0) > 0)
    .map((t) => ({ ticketTypeId: t._id!, quantity: cart[t._id!]!, tier: t }));
  const cartQuantity = cartLines.reduce((sum, l) => sum + l.quantity, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.tier.price * l.quantity, 0);

  const setTierQty = (tierId: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty > 0) next[tierId] = qty; else delete next[tierId];
      return next;
    });

  const sellMutation = useMutation({
    mutationFn: (data: SellTicketsRequest) => apiClient.sales.sellTickets(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });

      // Prepare data for the success dialog
      const dialogData = {
        eventName: selectedEvent?.name || '',
        // A basket has several tiers; name them all rather than just one.
        ticketTypeName: cartLines.map((l) => `${l.quantity} × ${l.tier.name}`).join(', '),
        customerName: formData.customerName || '',
        customerPhone: formData.customerPhone || '',
        quantity: cartQuantity,
        totalAmount: cartTotal,
        currency: selectedEvent?.currency ?? 'SZL',
        ticketIds: response.data?.tickets?.map((t: any) => t.ticketId || t._id) || [],
      };

      setSaleData(dialogData);
      setSuccessDialogOpen(true);
      setFormData({ paymentMethod: 'cash' });
      setCart({});
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventId || !formData.customerName || !formData.customerPhone) {
      toast.error('Please fill all required fields');
      return;
    }
    if (cartQuantity === 0) {
      toast.error('Add at least one ticket');
      return;
    }
    sellMutation.mutate({
      ...formData,
      items: cartLines.map((l) => ({ ticketTypeId: l.ticketTypeId, quantity: l.quantity })),
    } as SellTicketsRequest);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sell Tickets</h1>
        <p className="text-slate-600">Process ticket sales for your events</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Form</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Select Event</Label>
                <SearchableSelect
                  value={formData.eventId}
                  onValueChange={(v) => { setFormData({ ...formData, eventId: v }); setCart({}); }}
                  options={(eventsData?.data || []).map((event) => ({
                    value: event._id,
                    label: `${event.name} - ${event.venue}`,
                  }))}
                  placeholder="Choose an event"
                  searchPlaceholder="Search events…"
                  emptyText="No events found"
                />
              </div>

              {selectedEvent && (
                <div className="space-y-2">
                  <Label>Tickets</Label>
                  {/* A quantity per tier, so one customer buying General AND
                      VIP is one sale — one payment, one receipt — instead of
                      two transactions. A sold-out tier offers no input. */}
                  <div className="rounded-md border divide-y">
                    {tiers.map((tt) => {
                      const soldOut = tt.isSoldOut || (tt.available ?? 0) <= 0;
                      const qty = cart[tt._id!] ?? 0;
                      return (
                        <div key={tt._id} className="flex items-center gap-3 p-3" data-testid={`sell-tier-${tt._id}`}>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{tt.name}</div>
                            <div className="text-sm text-slate-500">
                              {formatMoney(tt.price, selectedEvent.currency ?? 'SZL', { space: true, decimals: 0 })}
                              {soldOut ? ' · Sold out' : ` · ${tt.available} left`}
                            </div>
                          </div>
                          {qty > 0 && (
                            <div className="text-sm text-slate-600 shrink-0" data-testid="sell-tier-subtotal">
                              {formatMoney(tt.price * qty, selectedEvent.currency ?? 'SZL', { space: true, decimals: 0 })}
                            </div>
                          )}
                          <Input
                            type="number"
                            min="0"
                            max={Math.min(100, tt.available ?? 0)}
                            disabled={soldOut}
                            aria-label={`Quantity for ${tt.name}`}
                            className="w-20 shrink-0"
                            value={qty || ''}
                            placeholder="0"
                            onChange={(e) => setTierQty(tt._id!, Math.max(0, Number(e.target.value) || 0))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <Label>Customer Name</Label>
                  <Input
                    placeholder="Full name"
                    value={formData.customerName || ''}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    required
                  />
                </div>
                <PhoneInput
                  label="Customer Phone"
                  value={formData.customerPhone || ''}
                  onChange={(value) => setFormData({ ...formData, customerPhone: value })}
                  placeholder="78422613"
                  required
                />
              </div>

              <Tabs value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v as any })}>
                <TabsList className={`grid w-full ${methods.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {methods.map((m) => (
                    <TabsTrigger key={m.value} value={m.value}>{m.label}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="keshless_wallet" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Card Number</Label>
                    <Input
                      placeholder="Enter wallet card number"
                      value={formData.walletCardNumber || ''}
                      onChange={(e) => setFormData({ ...formData, walletCardNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PIN</Label>
                    <Input
                      type="password"
                      placeholder="Enter PIN"
                      value={formData.walletPin || ''}
                      onChange={(e) => setFormData({ ...formData, walletPin: e.target.value })}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600"
                disabled={sellMutation.isPending}
                size="lg"
              >
                {sellMutation.isPending ? 'Processing...' : `Sell Tickets`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEvent && cartQuantity > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Event</div>
                  <div className="font-medium">{selectedEvent.name}</div>
                </div>
                {/* A row per tier — a single "Ticket Type" line would show
                    only one of them once a basket can hold several. */}
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Tickets</div>
                  {cartLines.map((l) => (
                    <div key={l.ticketTypeId} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{l.quantity} × {l.tier.name}</span>
                      <span className="font-medium shrink-0">
                        {formatMoney(l.tier.price * l.quantity, selectedEvent.currency ?? 'SZL', { space: true, decimals: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Quantity</div>
                  <div className="font-medium" data-testid="summary-quantity">{cartQuantity}</div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold">Total</div>
                    <div className="text-2xl font-bold text-orange-600" data-testid="summary-total">
                      {formatMoney(cartTotal, selectedEvent.currency ?? 'SZL', { space: true, decimals: 0 })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-8">
                Select an event and add tickets to see the summary
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      {saleData && (
        <TicketSuccessDialog
          open={successDialogOpen}
          onOpenChange={setSuccessDialogOpen}
          saleData={saleData}
        />
      )}
    </div>
  );
}

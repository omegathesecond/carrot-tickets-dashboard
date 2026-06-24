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

export function TicketSalesPage() {
  const [formData, setFormData] = useState<Partial<SellTicketsRequest>>({
    paymentMethod: 'cash',
    quantity: 1,
  });
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
  const selectedTicketType = selectedEvent?.ticketTypes.find(
    t => t._id === formData.ticketTypeId
  );

  const sellMutation = useMutation({
    mutationFn: (data: SellTicketsRequest) => apiClient.sales.sellTickets(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });

      // Prepare data for the success dialog
      const dialogData = {
        eventName: selectedEvent?.name || '',
        ticketTypeName: selectedTicketType?.name || '',
        customerName: formData.customerName || '',
        customerPhone: formData.customerPhone || '',
        quantity: formData.quantity || 1,
        totalAmount: (selectedTicketType?.price || 0) * (formData.quantity || 1),
        ticketIds: response.data?.tickets?.map((t: any) => t.ticketId || t._id) || [],
      };

      setSaleData(dialogData);
      setSuccessDialogOpen(true);
      setFormData({ paymentMethod: 'cash', quantity: 1 });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventId || !formData.ticketTypeId || !formData.customerName || !formData.customerPhone) {
      toast.error('Please fill all required fields');
      return;
    }
    sellMutation.mutate(formData as SellTicketsRequest);
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
                  onValueChange={(v) => setFormData({ ...formData, eventId: v, ticketTypeId: undefined })}
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
                  <Label>Ticket Type</Label>
                  <Select value={formData.ticketTypeId} onValueChange={(v) => setFormData({ ...formData, ticketTypeId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose ticket type" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedEvent.ticketTypes?.map((tt) => (
                        <SelectItem key={tt._id} value={tt._id!}>
                          {tt.name} - E {tt.price.toLocaleString()} ({tt.available} left)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
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
            {selectedEvent && formData.ticketTypeId ? (
              <>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Event</div>
                  <div className="font-medium">{selectedEvent.name}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Ticket Type</div>
                  <div className="font-medium">
                    {selectedTicketType?.name}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Price per Ticket</div>
                  <div className="font-medium">
                    E {(selectedTicketType?.price || 0).toLocaleString()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Quantity</div>
                  <div className="font-medium">{formData.quantity}</div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold">Total</div>
                    <div className="text-2xl font-bold text-orange-600">
                      E {((selectedTicketType?.price || 0) * (formData.quantity || 1)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-8">
                Select event and ticket type to see summary
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

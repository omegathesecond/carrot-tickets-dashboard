import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import {
  resellerApi,
  type ResellerEvent,
  type ResellerTicketType,
  type ResellerPaymentMethods,
} from '@/lib/resellerApi';
import { TicketSuccessDialog } from '@/components/TicketSuccessDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SaleData = {
  eventName: string;
  ticketTypeName: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  ticketIds: string[];
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  keshless_wallet: 'Keshless Wallet',
};

export function ResellerPosPage() {
  const { operator, logout } = useResellerAuth();

  const [eventId, setEventId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [momoPhone, setMomoPhone] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitingForMomo, setWaitingForMomo] = useState(false);
  const [successData, setSuccessData] = useState<SaleData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: events = [] } = useQuery<ResellerEvent[]>({
    queryKey: ['reseller-events'],
    queryFn: () => resellerApi.getEvents(),
  });

  const { data: ticketTypes = [] } = useQuery<ResellerTicketType[]>({
    queryKey: ['reseller-event-tickets', eventId],
    queryFn: () => resellerApi.getEventTickets(eventId),
    enabled: !!eventId,
  });

  const { data: paymentMethods } = useQuery<ResellerPaymentMethods>({
    queryKey: ['reseller-payment-methods'],
    queryFn: () => resellerApi.getPaymentMethods(),
  });

  const stopPolling = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const resetForm = () => {
    setEventId('');
    setTicketTypeId('');
    setQuantity(1);
    setPaymentMethod('');
    setCustomerName('');
    setCustomerPhone('');
    setMomoPhone('');
    setWaitingForMomo(false);
    setIsSubmitting(false);
  };

  const selectedEvent = events.find((e) => e.id === eventId);
  const selectedTicketType = ticketTypes.find((t) => t.id === ticketTypeId);

  const enabledPaymentMethods = paymentMethods
    ? (Object.entries(paymentMethods) as [string, boolean | undefined][]).filter(([, v]) => v === true).map(([k]) => k)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventId || !ticketTypeId || !customerName || !customerPhone) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        eventId,
        ticketTypeId,
        quantity,
        paymentMethod,
        customerName,
        customerPhone,
        ...(paymentMethod === 'mtn_momo' && momoPhone ? { momoPhone } : {}),
      };

      const response = await resellerApi.createSale(payload);

      if (paymentMethod !== 'mtn_momo') {
        // Cash or keshless_wallet — should be completed immediately
        if (response.status === 'completed') {
          const ticketIds =
            response.tickets?.map((t) => t.ticketId) || response.ticketIds || [];
          const sale: SaleData = {
            eventName: selectedEvent?.name ?? eventId,
            ticketTypeName: selectedTicketType?.name ?? ticketTypeId,
            customerName,
            customerPhone,
            quantity,
            totalAmount: (selectedTicketType?.price ?? 0) * quantity,
            ticketIds,
          };
          setSuccessData(sale);
          setDialogOpen(true);
          resetForm();
        } else {
          toast.error('Sale did not complete. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // MTN MoMo path
      if (!response.referenceId) {
        throw new Error('No referenceId returned from MoMo sale');
      }

      const referenceId = response.referenceId;
      const expiresAt = response.expiresAt;
      const pollStart = Date.now();
      const MAX_POLL_MS = 120_000;

      setIsSubmitting(false);
      setWaitingForMomo(true);

      stopPolling();
      intervalRef.current = setInterval(async () => {
        try {
          // Check timeout
          const timedOutByDuration = Date.now() - pollStart >= MAX_POLL_MS;
          const timedOutByExpiry = expiresAt ? new Date() > new Date(expiresAt) : false;

          if (timedOutByDuration || timedOutByExpiry) {
            stopPolling();
            toast.error('Payment timed out. Please try again.');
            resetForm();
            return;
          }

          const result = await resellerApi.finalizeSale(referenceId);

          if (result.status === 'completed') {
            stopPolling();
            const ticketIds =
              result.tickets?.map((t) => t.ticketId) || result.ticketIds || [];
            if (ticketIds.length > 0) {
              const sale: SaleData = {
                eventName: selectedEvent?.name ?? eventId,
                ticketTypeName: selectedTicketType?.name ?? ticketTypeId,
                customerName,
                customerPhone,
                quantity,
                totalAmount: (selectedTicketType?.price ?? 0) * quantity,
                ticketIds,
              };
              setSuccessData(sale);
              setDialogOpen(true);
            } else {
              toast.success('Payment complete — ticket sent by SMS');
            }
            resetForm();
          } else if (result.status === 'failed') {
            stopPolling();
            toast.error('Payment failed or was declined. Please try again.');
            resetForm();
          }
          // status === 'pending' → keep polling
        } catch (err: any) {
          stopPolling();
          toast.error(err.message || 'Error checking payment status');
          resetForm();
        }
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sale');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/carrot_tickets_icon.png" alt="Carrot Tickets" className="h-8 w-8" />
          <div>
            <span className="font-semibold text-slate-900">Reseller POS</span>
            {operator?.fullName && (
              <span className="ml-2 text-sm text-slate-500">— {operator.fullName}</span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-slate-600 hover:text-red-600 hover:border-red-300"
        >
          Logout
        </Button>
      </header>

      {/* Main */}
      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* POS Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Sell Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {waitingForMomo ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                  <p className="text-slate-700 font-medium text-center">
                    Waiting for buyer to approve payment on their phone…
                  </p>
                  <p className="text-sm text-slate-500">This may take up to 2 minutes.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Event */}
                  <div className="space-y-2">
                    <Label htmlFor="event">Event *</Label>
                    <Select
                      value={eventId}
                      onValueChange={(val) => {
                        setEventId(val);
                        setTicketTypeId('');
                      }}
                    >
                      <SelectTrigger id="event">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((ev) => (
                          <SelectItem key={ev.id} value={ev.id}>
                            {ev.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ticket Type */}
                  <div className="space-y-2">
                    <Label htmlFor="ticketType">Ticket Type *</Label>
                    <Select
                      value={ticketTypeId}
                      onValueChange={setTicketTypeId}
                      disabled={!eventId}
                    >
                      <SelectTrigger id="ticketType">
                        <SelectValue placeholder={eventId ? 'Select ticket type' : 'Select an event first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketTypes.map((tt) => (
                          <SelectItem key={tt.id} value={tt.id}>
                            {tt.name} — E {tt.price.toLocaleString()} ({tt.available} left)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={10}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label>Payment Method *</Label>
                    <div className="flex flex-wrap gap-2">
                      {enabledPaymentMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            paymentMethod === method
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {PAYMENT_METHOD_LABELS[method] ?? method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer Name */}
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <Input
                      id="customerName"
                      placeholder="Full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Customer Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Customer Phone *</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      placeholder="+268..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* MoMo Phone (conditional) */}
                  {paymentMethod === 'mtn_momo' && (
                    <div className="space-y-2">
                      <Label htmlFor="momoPhone">MoMo Phone Number *</Label>
                      <Input
                        id="momoPhone"
                        type="tel"
                        placeholder="Phone number registered with MTN MoMo"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 h-12 text-base font-semibold"
                    disabled={isSubmitting || !paymentMethod}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      'Sell Tickets'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Event</span>
                <span className="font-medium text-slate-900 text-right max-w-[60%]">
                  {selectedEvent?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket Type</span>
                <span className="font-medium text-slate-900">
                  {selectedTicketType?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit Price</span>
                <span className="font-medium text-slate-900">
                  {selectedTicketType ? `E ${selectedTicketType.price.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity</span>
                <span className="font-medium text-slate-900">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment</span>
                <span className="font-medium text-slate-900">
                  {paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod : '—'}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="font-bold text-orange-600 text-lg">
                  {selectedTicketType
                    ? `E ${(selectedTicketType.price * quantity).toLocaleString()}`
                    : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {successData && (
        <TicketSuccessDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSuccessData(null);
          }}
          saleData={successData}
        />
      )}
    </div>
  );
}

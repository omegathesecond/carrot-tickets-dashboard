import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Check,
  Minus,
  Plus,
  Calendar,
  MapPin,
  Ticket,
  Users,
  LogOut,
  Search,
  Building2,
} from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import type { SaleData } from '@/lib/saleData';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  keshless_wallet: 'Keshless Wallet',
};

const formatEventDate = (date?: string) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [eventSearch, setEventSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitingForMomo, setWaitingForMomo] = useState(false);
  const [successData, setSuccessData] = useState<SaleData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: events = [], error: eventsError } = useQuery<ResellerEvent[]>({
    queryKey: ['reseller-events'],
    queryFn: () => resellerApi.getEvents(),
  });

  const { data: ticketTypes = [], error: ticketTypesError } = useQuery<ResellerTicketType[]>({
    queryKey: ['reseller-event-tickets', eventId],
    queryFn: () => resellerApi.getEventTickets(eventId),
    enabled: !!eventId,
  });

  const { data: paymentMethods, error: paymentMethodsError } = useQuery<ResellerPaymentMethods>({
    queryKey: ['reseller-payment-methods'],
    queryFn: () => resellerApi.getPaymentMethods(),
  });

  useEffect(() => {
    if (eventsError) toast.error((eventsError as Error).message || 'Failed to load events');
  }, [eventsError]);

  useEffect(() => {
    if (ticketTypesError) toast.error((ticketTypesError as Error).message || 'Failed to load ticket types');
  }, [ticketTypesError]);

  useEffect(() => {
    if (paymentMethodsError) toast.error((paymentMethodsError as Error).message || 'Failed to load payment methods');
  }, [paymentMethodsError]);

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

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.venue ?? '').toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  const enabledPaymentMethods = paymentMethods
    ? (Object.entries(paymentMethods) as [string, boolean | undefined][]).filter(([, v]) => v === true).map(([k]) => k)
    : [];

  const total = selectedTicketType ? selectedTicketType.price * quantity : 0;
  const canSubmit =
    !!eventId &&
    !!ticketTypeId &&
    !!paymentMethod &&
    !!customerName &&
    !!customerPhone &&
    (paymentMethod !== 'mtn_momo' || !!momoPhone) &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventId || !ticketTypeId || !customerName || !customerPhone) {
      toast.error('Please fill all required fields');
      return;
    }

    if (paymentMethod === 'mtn_momo' && !momoPhone) {
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
            saleId: response.saleId,
            eventName: selectedEvent?.name ?? eventId,
            eventDate: selectedEvent?.date,
            venue: selectedEvent?.venue,
            ticketTypeName: selectedTicketType?.name ?? ticketTypeId,
            unitPrice: selectedTicketType?.price ?? 0,
            customerName,
            customerPhone,
            quantity,
            totalAmount: (selectedTicketType?.price ?? 0) * quantity,
            paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod,
            operatorName: operator?.fullName ?? '',
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
                saleId: result.saleId ?? '',
                eventName: selectedEvent?.name ?? eventId,
                eventDate: selectedEvent?.date,
                venue: selectedEvent?.venue,
                ticketTypeName: selectedTicketType?.name ?? ticketTypeId,
                unitPrice: selectedTicketType?.price ?? 0,
                customerName,
                customerPhone,
                quantity,
                totalAmount: (selectedTicketType?.price ?? 0) * quantity,
                paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod,
                operatorName: operator?.fullName ?? '',
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

  const isManager = !!operator && ['reseller_admin', 'reseller_hub_manager'].includes(operator.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-orange-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/carrot_tickets_icon.png" alt="Carrot Tickets" className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 leading-tight truncate">Sell Tickets</p>
              {operator?.fullName && (
                <p className="text-xs text-slate-500 leading-tight truncate">{operator.fullName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isManager && (
              <>
                <Link
                  to="/reseller/hubs"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Hubs</span>
                </Link>
                <Link
                  to="/reseller/operators"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Operators</span>
                </Link>
              </>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-32 lg:pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {waitingForMomo ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-orange-200/60 animate-ping" />
                  <Loader2 className="h-12 w-12 animate-spin text-orange-500 relative" />
                </div>
                <p className="text-slate-800 font-semibold text-center px-4">
                  Waiting for the buyer to approve on their phone…
                </p>
                <p className="text-sm text-slate-500">This can take up to 2 minutes.</p>
                <Button variant="outline" onClick={resetForm} className="mt-2">
                  Cancel sale
                </Button>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1 — Event */}
              <section className="space-y-3">
                <StepLabel index={1} icon={<Calendar className="h-4 w-4" />} title="Choose event" />
                {events.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-slate-500">
                      No published events available right now.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        type="search"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Search events by name or venue"
                        className="h-11 pl-9"
                        aria-label="Search events"
                      />
                    </div>
                    {filteredEvents.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-6 text-center text-sm text-slate-400">
                          No events match “{eventSearch.trim()}”.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[22rem] overflow-y-auto pr-1">
                        {filteredEvents.map((ev) => {
                          const active = !!eventId && ev.id === eventId;
                          const dateLabel = formatEventDate(ev.date);
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => {
                                setEventId(ev.id);
                                setTicketTypeId('');
                              }}
                              className={`group relative flex gap-3 text-left rounded-xl border-2 p-2.5 transition-all ${
                                active
                                  ? 'border-orange-500 bg-orange-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-orange-300'
                              }`}
                            >
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-orange-100">
                                {ev.thumbnailUrl ? (
                                  <img
                                    src={ev.thumbnailUrl}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-orange-400">
                                    <Ticket className="h-6 w-6" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 pr-6 leading-snug line-clamp-2">
                                  {ev.name}
                                </p>
                                <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                                  {ev.venue && (
                                    <p className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{ev.venue}</span>
                                    </p>
                                  )}
                                  {dateLabel && (
                                    <p className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3 shrink-0" /> {dateLabel}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {active && (
                                <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Step 2 — Ticket type */}
              <section className="space-y-3">
                <StepLabel
                  index={2}
                  icon={<Ticket className="h-4 w-4" />}
                  title="Choose ticket type"
                  muted={!eventId}
                />
                {!eventId ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-sm text-slate-400">
                      Select an event first.
                    </CardContent>
                  </Card>
                ) : ticketTypes.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-slate-500">
                      No ticket types for this event.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2.5">
                    {ticketTypes.map((tt) => {
                      const active = tt.id === ticketTypeId;
                      const soldOut = tt.available <= 0;
                      return (
                        <button
                          key={tt.id}
                          type="button"
                          disabled={soldOut}
                          onClick={() => setTicketTypeId(tt.id)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                            soldOut
                              ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                              : active
                                ? 'border-orange-500 bg-orange-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-orange-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 leading-snug">{tt.name}</p>
                            <p className={`text-xs mt-0.5 ${soldOut ? 'text-red-500' : 'text-slate-500'}`}>
                              {soldOut ? 'Sold out' : `${tt.available} left`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-slate-900">E {tt.price.toLocaleString()}</span>
                            {active && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Step 3 — Quantity */}
              <section className="space-y-3">
                <StepLabel index={3} icon={<Plus className="h-4 w-4" />} title="Quantity" />
                <div className="flex items-center gap-4">
                  <div className="flex items-center rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="w-14 text-center text-lg font-bold text-slate-900 tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      disabled={quantity >= 10}
                      className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Up to 10 tickets per sale.</p>
                </div>
              </section>

              {/* Step 4 — Payment method */}
              <section className="space-y-3">
                <StepLabel index={4} icon={<Check className="h-4 w-4" />} title="Payment method" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {enabledPaymentMethods.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-400">No payment methods enabled.</p>
                  ) : (
                    enabledPaymentMethods.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-all ${
                          paymentMethod === method
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300'
                        }`}
                      >
                        {PAYMENT_METHOD_LABELS[method] ?? method}
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* Step 5 — Customer */}
              <section className="space-y-3">
                <StepLabel index={5} icon={<Users className="h-4 w-4" />} title="Customer details" />
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Full name</Label>
                      <Input
                        id="customerName"
                        placeholder="Full name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone number</Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+268…"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-12"
                        required
                      />
                    </div>
                    {paymentMethod === 'mtn_momo' && (
                      <div className="space-y-2">
                        <Label htmlFor="momoPhone">MoMo phone number</Label>
                        <Input
                          id="momoPhone"
                          type="tel"
                          inputMode="tel"
                          placeholder="Number registered with MTN MoMo"
                          value={momoPhone}
                          onChange={(e) => setMomoPhone(e.target.value)}
                          className="h-12"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Desktop submit lives in the summary sidebar; this keeps Enter-to-submit working. */}
              <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
          )}
        </div>

        {/* Desktop order summary */}
        {!waitingForMomo && (
          <div className="hidden lg:block">
            <Card className="sticky top-20">
              <CardContent className="pt-6 space-y-3 text-sm">
                <p className="font-semibold text-slate-900">Order summary</p>
                <SummaryRow label="Event" value={selectedEvent?.name} />
                <SummaryRow label="Ticket" value={selectedTicketType?.name} />
                <SummaryRow
                  label="Unit price"
                  value={selectedTicketType ? `E ${selectedTicketType.price.toLocaleString()}` : undefined}
                />
                <SummaryRow label="Quantity" value={String(quantity)} />
                <SummaryRow
                  label="Payment"
                  value={paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod : undefined}
                />
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className="font-bold text-orange-600 text-xl tabular-nums">
                    {selectedTicketType ? `E ${total.toLocaleString()}` : '—'}
                  </span>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                    </span>
                  ) : (
                    'Sell tickets'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile sticky action bar — the signature, thumb-reachable total + sell */}
      {!waitingForMomo && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-orange-100 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 leading-tight">Total</p>
              <p className="text-xl font-bold text-orange-600 tabular-nums leading-tight">
                {selectedTicketType ? `E ${total.toLocaleString()}` : 'E 0'}
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </span>
              ) : (
                'Sell tickets'
              )}
            </Button>
          </div>
        </div>
      )}

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

function StepLabel({
  index,
  icon,
  title,
  muted,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
          muted ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-700'
        }`}
      >
        {index}
      </span>
      <span className={`inline-flex items-center gap-1.5 font-semibold ${muted ? 'text-slate-400' : 'text-slate-900'}`}>
        {icon}
        {title}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right truncate max-w-[60%]">{value || '—'}</span>
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
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
  Search,
  ArrowLeft,
  Banknote,
  Smartphone,
  Wallet,
  type LucideIcon,
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

const PAYMENT_META: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  cash: { label: 'Cash', icon: Banknote, tint: 'bg-green-50 text-green-600' },
  mtn_momo: { label: 'MTN MoMo', icon: Smartphone, tint: 'bg-amber-50 text-amber-600' },
  keshless_wallet: { label: 'Keshless Wallet', icon: Wallet, tint: 'bg-blue-50 text-blue-600' },
};
const paymentLabel = (m: string) => PAYMENT_META[m]?.label ?? m;

// One conversational step at a time — mirrors the native POS app's wizard.
const STEP_TITLES = ['Event', 'Tickets', 'Payment', 'Customer'] as const;

const formatEventDate = (date?: string) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export function ResellerPosPage() {
  const { operator } = useResellerAuth();

  const [eventId, setEventId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [momoPhone, setMomoPhone] = useState('');
  const [eventSearch, setEventSearch] = useState('');

  const [step, setStep] = useState(0); // 0 Event · 1 Tickets · 2 Payment · 3 Customer
  const [forward, setForward] = useState(true); // slide direction
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
    setEventSearch('');
    setWaitingForMomo(false);
    setIsSubmitting(false);
    setForward(true);
    setStep(0);
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

  // Step 0 advances on event tap; 1 needs a ticket; 2 needs a method; 3 submits.
  const canAdvance = step === 1 ? !!ticketTypeId : step === 2 ? !!paymentMethod : false;
  const isLast = step === STEP_TITLES.length - 1;

  const pickEvent = (ev: ResellerEvent) => {
    setEventId(ev.id);
    setTicketTypeId('');
    setForward(true);
    setStep(1);
  };
  const next = () => {
    if (!canAdvance) return;
    setForward(true);
    setStep((s) => s + 1);
  };
  const back = () => {
    if (step === 0) return;
    setForward(false);
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

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
            paymentMethod: paymentLabel(paymentMethod),
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
                paymentMethod: paymentLabel(paymentMethod),
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

  // ── MoMo waiting takes over the whole panel ──────────────────────────────
  if (waitingForMomo) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card className="border-orange-100 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-orange-200/60" />
              <Loader2 className="relative h-12 w-12 animate-spin text-orange-500" />
            </div>
            <p className="px-4 text-center font-semibold text-slate-800">
              Waiting for the buyer to approve on their phone…
            </p>
            <p className="text-sm text-slate-500">This can take up to 2 minutes.</p>
            <Button variant="outline" onClick={resetForm} className="mt-2">
              Cancel sale
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 py-4 sm:py-6 lg:max-w-3xl">
      {/* Title + back */}
      <div className="mb-4 flex items-center gap-2">
        {step > 0 && (
          <button
            onClick={back}
            className="-ml-1.5 rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight text-slate-900">Sell Tickets</h1>
          {operator?.fullName && (
            <p className="truncate text-xs text-slate-500">{operator.fullName}</p>
          )}
        </div>
      </div>

      {/* Card panel — gives the wizard a proper surface on the web */}
      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-6">
        {/* Progress header */}
        <div className="mb-5">
          <div className="flex gap-1.5">
            {STEP_TITLES.map((t, i) => (
              <div
                key={t}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-orange-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Step {step + 1} of {STEP_TITLES.length}
            </span>
            <span className="text-sm font-bold text-slate-900">{STEP_TITLES[step]}</span>
          </div>
        </div>

        {/* Step content — keyed so each step animates in */}
        <div
          key={step}
          className={`animate-in fade-in duration-200 ${forward ? 'slide-in-from-right-6' : 'slide-in-from-left-6'}`}
        >
          {/* Context banner of choices so far (steps 1-3) */}
          {step > 0 && selectedEvent && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-orange-100">
                {selectedEvent.thumbnailUrl ? (
                  <img
                    src={selectedEvent.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-orange-400">
                    <Ticket className="h-5 w-5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{selectedEvent.name}</p>
                {formatEventDate(selectedEvent.date) && (
                  <p className="text-xs text-slate-500">{formatEventDate(selectedEvent.date)}</p>
                )}
                {(selectedTicketType || (step >= 2 && paymentMethod)) && (
                  <p className="truncate text-xs text-slate-700">
                    {[
                      selectedTicketType ? `${selectedTicketType.name} ×${quantity}` : null,
                      step >= 2 && paymentMethod ? paymentLabel(paymentMethod) : null,
                    ].filter(Boolean).join('  •  ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 0: Event ── */}
          {step === 0 && (
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center text-sm text-slate-500">
                  No published events available right now.
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                    <div className="rounded-xl border border-dashed py-8 text-center text-sm text-slate-400">
                      No events match “{eventSearch.trim()}”.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filteredEvents.map((ev) => {
                        const dateLabel = formatEventDate(ev.date);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => pickEvent(ev)}
                            className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
                          >
                            <div className="aspect-[16/9] w-full overflow-hidden bg-orange-100">
                              {ev.thumbnailUrl ? (
                                <img
                                  src={ev.thumbnailUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-orange-300">
                                  <Ticket className="h-9 w-9" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 p-3">
                              <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{ev.name}</p>
                              <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
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
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 1: Tickets (type + quantity) ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <p className="font-semibold text-slate-900">Ticket type</p>
                {ticketTypes.length === 0 ? (
                  <div className="rounded-xl border py-8 text-center text-sm text-slate-500">
                    Loading ticket types…
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {ticketTypes.map((tt) => {
                      const active = tt.id === ticketTypeId;
                      const soldOut = tt.available <= 0;
                      return (
                        <button
                          key={tt.id}
                          type="button"
                          disabled={soldOut}
                          onClick={() => setTicketTypeId(tt.id)}
                          className={`flex items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                            soldOut
                              ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                              : active
                                ? 'border-orange-500 bg-orange-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-orange-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold leading-snug text-slate-900">{tt.name}</p>
                            <p className={`mt-0.5 text-xs ${soldOut ? 'text-red-500' : 'text-slate-500'}`}>
                              {soldOut ? 'Sold out' : `${tt.available} left`}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
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
              </div>

              <div className="space-y-2.5">
                <p className="font-semibold text-slate-900">Quantity</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-12 w-12 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="w-14 text-center text-lg font-bold tabular-nums text-slate-900">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      disabled={quantity >= 10}
                      className="flex h-12 w-12 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Up to 10 tickets per sale.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 2 && (
            <div className="space-y-2.5">
              <p className="font-semibold text-slate-900">Payment method</p>
              {enabledPaymentMethods.length === 0 ? (
                <p className="text-sm text-slate-400">No payment methods enabled.</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {enabledPaymentMethods.map((method) => {
                    const meta = PAYMENT_META[method];
                    const Icon = meta?.icon ?? Wallet;
                    const active = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-5 text-center transition-all ${
                          active
                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-orange-300'
                        }`}
                      >
                        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${meta?.tint ?? 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{paymentLabel(method)}</span>
                        {active && (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Customer ── */}
          {step === 3 && (
            <div className="mx-auto max-w-md space-y-4">
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
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar — Total + Next/Sell. Step 0 advances on event tap. */}
      {step > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-orange-100 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4 sm:shadow-sm">
          <div className="flex items-center gap-3">
            {selectedTicketType && (
              <div className="min-w-0">
                <p className="text-xs leading-tight text-slate-500">Total</p>
                <p className="text-xl font-bold leading-tight tabular-nums text-orange-600">
                  E {total.toLocaleString()}
                </p>
              </div>
            )}
            <Button
              onClick={isLast ? () => handleSubmit() : next}
              disabled={isLast ? !canSubmit : !canAdvance}
              className="h-12 flex-1 bg-gradient-to-r from-orange-600 to-amber-600 text-base font-semibold hover:from-orange-700 hover:to-amber-700 sm:flex-none sm:px-10"
            >
              {isLast ? (
                isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </span>
                ) : (
                  'Sell tickets'
                )
              ) : (
                'Next'
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

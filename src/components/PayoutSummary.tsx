import { BANK_FIELDS } from '@/lib/payoutBank';
import type {
  PayoutBank,
  PayoutBreakdown,
  EventPayoutRequest,
} from '@/types/eventPayout';
import { formatMoney } from '@/lib/currency';

export function BankSummary({ bank }: { bank: PayoutBank }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {BANK_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="font-medium break-all">{bank[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PayoutSummary({
  breakdown: b,
  currency,
}: {
  breakdown: PayoutBreakdown;
  currency: 'SZL' | 'ZAR';
}) {
  const rows: [string, number][] = [
    ['Confirmed ticket sales', b.gross],
    ['Refunds deducted', -b.refunds],
    ['Platform fees', -b.platformFees],
    ['Reseller commissions', -b.resellerCommission],
    ['Absorbed booking fees', -b.absorbedFees],
    ['Organizer proceeds after refunds', b.organizerProceeds],
    ['Already held by organizer', -b.vendorHeld],
    ['Reseller funds awaiting remittance', -b.unremitted],
    ['Fees owed on organizer-held sales', -b.vendorFees],
    ['Adjustments', b.adjustments],
    ['Previous payouts', -b.previouslyPaid],
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        {b.sales} confirmed transactions. Refunds reduce proceeds; recorded fees
        remain deducted.
      </p>
      <dl className="divide-y divide-slate-100">
        {rows.map(([label, amount]) => (
          <div className="flex justify-between gap-4 py-2 text-sm" key={label}>
            <dt>{label}</dt>
            <dd className="tabular-nums whitespace-nowrap">
              {formatMoney(amount, currency, { decimals: 2 })}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-3 font-semibold">
          <dt>Available balance</dt>
          <dd className="tabular-nums">
            {formatMoney(b.availableBalance, currency, { decimals: 2 })}
          </dd>
        </div>
      </dl>
    </div>
  );
}
export function PayoutHistory({ request }: { request: EventPayoutRequest }) {
  return (
    <ol className="space-y-2 text-sm">
      {request.history.map((h, i) => (
        <li key={i} className="border-l-2 border-orange-200 pl-3">
          <span className="font-medium capitalize">{h.status}</span> ·{' '}
          {new Date(h.at).toLocaleString()}
          {h.note && (
            <p className="text-slate-600 whitespace-pre-wrap">{h.note}</p>
          )}
        </li>
      ))}
      {request.paidAt && (
        <li>
          Payment: {new Date(request.paidAt).toLocaleString()} ·{' '}
          {request.paymentReference}
        </li>
      )}
    </ol>
  );
}

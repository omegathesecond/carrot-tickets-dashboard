import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrganizersListResponse, OrganizerVenueTrading, OrganizerVerificationStatus } from '@/types';
import { humanize, type OrganizerTab } from './organizerModel';

const STATUS_FILTERS: { value: '' | OrganizerVerificationStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const VENUE_TRADING_FILTERS: { value: '' | OrganizerVenueTrading; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'on', label: 'On' },
  { value: 'none', label: 'Not on yet' },
  { value: 'suspended', label: 'Suspended' },
];

const SELECT_CLASS =
  'flex h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface OrganizerFiltersProps {
  tab: OrganizerTab;
  status: '' | OrganizerVerificationStatus;
  onStatusChange: (status: '' | OrganizerVerificationStatus) => void;
  /** Absent until the first list response lands — the buttons show no count until then. */
  statusCounts?: OrganizersListResponse['statusCounts'];
  /** The sum of statusCounts, which the page already has — the All button's count. */
  statusTotal?: number;
  venueTrading: '' | OrganizerVenueTrading;
  onVenueTradingChange: (value: '' | OrganizerVenueTrading) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  serviceCategories: string[];
  searchInput: string;
  onSearchInputChange: (value: string) => void;
}

/** Every filter the open tab offers. The page sends each one to the server. */
export function OrganizerFilters(p: OrganizerFiltersProps) {
  const countOf = (value: '' | OrganizerVerificationStatus) =>
    value === '' ? p.statusTotal : p.statusCounts && (p.statusCounts[value] ?? 0);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => {
          const n = countOf(f.value);
          return (
            <Button
              key={f.label}
              size="sm"
              variant={p.status === f.value ? 'default' : 'outline'}
              onClick={() => p.onStatusChange(f.value)}
            >
              {n === undefined ? f.label : `${f.label} (${n.toLocaleString()})`}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {p.tab === 'venues' && (
          <div className="flex items-center gap-2">
            <label htmlFor="organizer-venue-trading" className="whitespace-nowrap text-sm text-slate-500">Venue trading</label>
            <select
              id="organizer-venue-trading"
              className={SELECT_CLASS}
              value={p.venueTrading}
              onChange={(e) => p.onVenueTradingChange(e.target.value as '' | OrganizerVenueTrading)}
            >
              {VENUE_TRADING_FILTERS.map((f) => (
                <option key={f.label} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        )}
        {p.tab === 'services' && (
          <div className="flex items-center gap-2">
            <label htmlFor="organizer-category" className="whitespace-nowrap text-sm text-slate-500">Category</label>
            <select
              id="organizer-category"
              className={SELECT_CLASS}
              value={p.category}
              onChange={(e) => p.onCategoryChange(e.target.value)}
            >
              <option value="">All</option>
              {p.serviceCategories.map((c) => (
                <option key={c} value={c}>{humanize(c)}</option>
              ))}
            </select>
          </div>
        )}
        <Input
          placeholder="Search name, email or phone…"
          value={p.searchInput}
          onChange={(e) => p.onSearchInputChange(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
    </div>
  );
}

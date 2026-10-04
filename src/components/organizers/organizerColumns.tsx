import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/chartColors';
import type { Organizer, OrganizerType, OrganizerVerificationStatus } from '@/types';
import { OrganizerActionsMenu, type OrganizerRowActions } from './OrganizerActionsMenu';
import { formatDate, humanize, type OrganizerTab } from './organizerModel';
import { VenueTradingCell } from './VenueTradingCell';

const STATUS_BADGE: Record<OrganizerVerificationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-slate-200 text-slate-700 border-slate-300',
};

const TYPE_LABEL: Record<OrganizerType, string> = {
  events: 'Event organizer',
  venues: 'Venue',
  services: 'Business',
  transport: 'Bus operator',
};

const TYPE_BADGE: Record<OrganizerType, string> = {
  events: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  venues: 'bg-sky-100 text-sky-800 border-sky-200',
  services: 'bg-purple-100 text-purple-800 border-purple-200',
  transport: 'bg-blue-100 text-blue-800 border-blue-200',
};

export interface OrganizerColumn {
  header: string;
  /** Header text is kept for screen readers only (the actions column). */
  hideHeader?: boolean;
  align?: 'right';
  /** The header is a sort control: 'name' (A–Z) or 'joined' (newest / oldest). */
  sort?: 'name' | 'joined';
  cell: (organizer: Organizer, actions: OrganizerRowActions) => ReactNode;
}

type ColumnId =
  | 'business' | 'type' | 'category' | 'contact' | 'joined' | 'events' | 'tickets' | 'revenue'
  | 'venueTrading' | 'status' | 'actions';

const COLUMNS: Record<ColumnId, OrganizerColumn> = {
  business: {
    header: 'Business',
    sort: 'name',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{o.businessName}</span>
        {o.type === 'events' && o.operatorType === 'both' && (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 px-1.5 py-0 text-[10px]">
            Bus
          </Badge>
        )}
      </div>
    ),
  },
  type: {
    header: 'Type',
    cell: (o) => (
      <Badge variant="outline" className={TYPE_BADGE[o.type]}>
        {TYPE_LABEL[o.type]}
      </Badge>
    ),
  },
  category: {
    header: 'Category',
    cell: (o) => (o.serviceCategory ? humanize(o.serviceCategory) : '—'),
  },
  contact: {
    header: 'Contact',
    cell: (o) => (
      <>
        <div className="text-sm">{o.primaryContact || '—'}</div>
        <div className="text-xs text-slate-500">{o.email || o.phoneNumber || '—'}</div>
      </>
    ),
  },
  joined: { header: 'Joined', sort: 'joined', cell: (o) => formatDate(o.createdAt) },
  events: { header: 'Events', align: 'right', cell: (o) => o.eventCount },
  tickets: { header: 'Tickets', align: 'right', cell: (o) => o.ticketsSold },
  revenue: { header: 'Revenue', align: 'right', cell: (o) => formatCurrency(o.revenue) },
  venueTrading: {
    header: 'Venue trading',
    cell: (o, actions) => <VenueTradingCell organizer={o} actions={actions} />,
  },
  status: {
    header: 'Status',
    cell: (o) => (
      <>
        <Badge variant="outline" className={`capitalize ${STATUS_BADGE[o.verificationStatus]}`}>
          {o.verificationStatus}
        </Badge>
        {o.rejectionReason && (
          <div className="text-xs text-slate-500 mt-1 max-w-[180px] truncate" title={o.rejectionReason}>
            {o.rejectionReason}
          </div>
        )}
      </>
    ),
  },
  actions: {
    header: 'Actions',
    hideHeader: true,
    cell: (o, actions) => <OrganizerActionsMenu organizer={o} actions={actions} />,
  },
};

// Which columns each tab shows — the one place a tab's table shape is decided.
const TAB_COLUMNS: Record<OrganizerTab, ColumnId[]> = {
  all: ['business', 'type', 'contact', 'joined', 'status', 'actions'],
  events: ['business', 'contact', 'joined', 'events', 'tickets', 'revenue', 'status', 'actions'],
  venues: ['business', 'contact', 'joined', 'venueTrading', 'status', 'actions'],
  services: ['business', 'category', 'contact', 'joined', 'status', 'actions'],
  transport: ['business', 'contact', 'joined', 'status', 'actions'],
};

export const columnsFor = (tab: OrganizerTab): OrganizerColumn[] => TAB_COLUMNS[tab].map((id) => COLUMNS[id]);

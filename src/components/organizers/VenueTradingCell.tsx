import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Organizer } from '@/types';
import type { OrganizerRowActions } from './OrganizerActionsMenu';
import { canSwitchOnVenue, formatDate } from './organizerModel';

/** Venues tab: whether venue trading is on, plus the one-click switch-on for an account that has none yet. */
export function VenueTradingCell({ organizer: o, actions }: { organizer: Organizer; actions: OrganizerRowActions }) {
  const v = o.venue;
  if (!v) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Not on yet</span>
        {canSwitchOnVenue(o) && (
          <Button size="sm" variant="outline" onClick={() => actions.onSwitchOnVenue(o)}>
            Switch on
          </Button>
        )}
      </div>
    );
  }
  const on = v.status === 'active';
  return (
    <div>
      <Badge
        variant="outline"
        className={on ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-slate-100 text-slate-700 border-slate-200'}
      >
        {on ? 'On' : 'Suspended'}
      </Badge>
      <div className="mt-1 text-sm">{v.name}</div>
      <div className="text-xs text-slate-500">
        {v.currency}{on ? ` · since ${formatDate(v.activatedAt)}` : ''}
      </div>
    </div>
  );
}

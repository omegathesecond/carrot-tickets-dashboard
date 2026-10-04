import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Organizer, OrganizerVerificationStatus, VenueStatus } from '@/types';
import { canSwitchOnVenue } from './organizerModel';

// What a row can do. The page owns the mutations and dialogs; the table and
// its cells only call these.
export interface OrganizerRowActions {
  busy: boolean;
  onVerification: (organizer: Organizer, status: OrganizerVerificationStatus) => void;
  onVenueStatus: (venueId: string, status: VenueStatus) => void;
  onSwitchOnVenue: (organizer: Organizer) => void;
}

export function OrganizerActionsMenu({ organizer: o, actions }: { organizer: Organizer; actions: OrganizerRowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={actions.busy}>
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {o.verificationStatus !== 'verified' && (
          <DropdownMenuItem onClick={() => actions.onVerification(o, 'verified')}>
            Verify
          </DropdownMenuItem>
        )}
        {o.verificationStatus !== 'pending' && (
          <DropdownMenuItem onClick={() => actions.onVerification(o, 'pending')}>
            Move to pending
          </DropdownMenuItem>
        )}
        {o.verificationStatus !== 'rejected' && (
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => actions.onVerification(o, 'rejected')}
          >
            Reject
          </DropdownMenuItem>
        )}
        {o.verificationStatus !== 'suspended' && (
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => actions.onVerification(o, 'suspended')}
          >
            Suspend
          </DropdownMenuItem>
        )}
        {o.venue ? (
          <>
            <DropdownMenuSeparator />
            {o.venue.status === 'active' ? (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => actions.onVenueStatus(o.venue!.id, 'suspended')}
              >
                Suspend venue trading
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => actions.onVenueStatus(o.venue!.id, 'active')}>
                Reactivate venue trading
              </DropdownMenuItem>
            )}
          </>
        ) : (
          canSwitchOnVenue(o) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onSwitchOnVenue(o)}>Switch on venue trading</DropdownMenuItem>
            </>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

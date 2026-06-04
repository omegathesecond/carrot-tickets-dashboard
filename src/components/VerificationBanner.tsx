import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * Shown to organizers whose account isn't verified yet. A pending organizer
 * can build draft events but the API blocks publishing until an admin
 * approves them — this banner sets that expectation up front so a failed
 * publish isn't a surprise.
 */
export function VerificationBanner() {
  const { user } = useAuth();

  // Only vendors carry a verification status; sub-users / verified accounts
  // see nothing.
  if (!user || user.verificationStatus === undefined) return null;
  if (user.verificationStatus === 'verified' || user.isVerified) return null;

  const rejected = user.verificationStatus === 'rejected' || user.verificationStatus === 'suspended';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 text-sm border-b ${
        rejected
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}
    >
      {rejected ? (
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      ) : (
        <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
      )}
      <div>
        {rejected ? (
          <p>
            <span className="font-semibold">Account {user.verificationStatus}.</span>{' '}
            Publishing is disabled. Please contact Keshless support to resolve this.
          </p>
        ) : (
          <p>
            <span className="font-semibold">Account pending approval.</span>{' '}
            You can create and edit events now. Publishing (going live and selling
            tickets) unlocks once your organizer account is verified.
          </p>
        )}
      </div>
    </div>
  );
}

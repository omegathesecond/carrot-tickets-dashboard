import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

const HIGHLIGHT_EVENT = 'keshless:highlight-verification-banner';

/**
 * Call this from anywhere (e.g. when a pending organizer clicks Publish) to
 * draw their eye to the verification banner — it scrolls into view and flashes
 * a ring, explaining WHY publishing didn't happen instead of silently failing.
 */
export function highlightVerificationBanner() {
  window.dispatchEvent(new CustomEvent(HIGHLIGHT_EVENT));
}

/**
 * Shown to organizers whose account isn't verified yet. A pending organizer
 * can build draft events but the API blocks publishing until an admin
 * approves them — this banner sets that expectation up front so a failed
 * publish isn't a surprise.
 */
export function VerificationBanner() {
  const { user } = useAuth();
  const [highlighted, setHighlighted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHighlight = () => {
      setHighlighted(true);
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlighted(false), 2500);
      return () => clearTimeout(timer);
    };
    window.addEventListener(HIGHLIGHT_EVENT, onHighlight);
    return () => window.removeEventListener(HIGHLIGHT_EVENT, onHighlight);
  }, []);

  // Only vendors carry a verification status; sub-users / verified accounts
  // see nothing.
  if (!user || user.verificationStatus === undefined) return null;
  if (user.verificationStatus === 'verified' || user.isVerified) return null;

  const rejected = user.verificationStatus === 'rejected' || user.verificationStatus === 'suspended';

  return (
    <div
      ref={ref}
      className={`flex items-start gap-3 px-4 py-3 text-sm border-b transition-all duration-300 ${
        rejected
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      } ${highlighted ? 'ring-2 ring-offset-2 ring-amber-500 animate-pulse shadow-lg' : ''}`}
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
            Publishing is disabled. Please contact {BRAND_NAME} support to resolve this.
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

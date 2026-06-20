import { ArrowLeft } from 'lucide-react';
import { LANDING_URL } from '@/lib/constants';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Top bar for the unauthenticated auth pages (login / signup). Gives
 * organizers a way back to the public Carrot Tickets landing page — those
 * pages otherwise had no navigation at all.
 */
export function AuthHeader() {
  return (
    <header className="absolute top-0 inset-x-0 z-10">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <a href={LANDING_URL} className="flex items-center gap-2 group">
          <img src="/carrot_tickets_icon.png" alt={BRAND_NAME} className="h-9 w-9" />
          <span className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
            {BRAND_NAME}
          </span>
        </a>
        <a
          href={LANDING_URL}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing page
        </a>
      </div>
    </header>
  );
}

import { ArrowLeft, Ticket } from 'lucide-react';
import { LANDING_URL } from '@/lib/constants';

/**
 * Top bar for the unauthenticated auth pages (login / signup). Gives
 * organizers a way back to the public Keshless Tickets landing page — those
 * pages otherwise had no navigation at all.
 */
export function AuthHeader() {
  return (
    <header className="absolute top-0 inset-x-0 z-10">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <a href={LANDING_URL} className="flex items-center gap-2 group">
          <div className="h-9 w-9 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
            <Ticket className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
            Keshless Tickets
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

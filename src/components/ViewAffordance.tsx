import { ChevronRight } from 'lucide-react';

/**
 * "There is more behind this card" — said out loud.
 *
 * The people cards used to hint at their detail page with a pale chevron in the
 * corner, and organizers reported not knowing the cards opened at all. This is
 * the same affordance with a label on it, shared by every card that leads
 * somewhere (cashiers, stalls, gate operators, register accounts) so they stay
 * consistent.
 *
 * Renders a real button so it is reachable by keyboard. With no `onClick` it
 * deliberately does NOT stop propagation: the click bubbles to the enclosing
 * card, which already knows where it goes — one destination, not two that can
 * drift apart.
 */
export function ViewAffordance({
  label = 'View',
  onClick,
}: {
  label?: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className="w-full flex items-center justify-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition group-hover:bg-orange-100 group-hover:border-orange-300"
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

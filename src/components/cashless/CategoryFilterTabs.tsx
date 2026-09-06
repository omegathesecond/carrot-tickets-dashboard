import { useMemo } from 'react';
import { PRODUCT_CATEGORIES } from '@/lib/api';

/**
 * The "no category filter" tab. A sentinel rather than null so the selected
 * value is always a string and callers need no special case when comparing.
 */
export const ALL_CATEGORIES = '__all__';

/**
 * Build the tab list from whatever is actually on the page.
 *
 * Derived from the rows rather than listing PRODUCT_CATEGORIES whole: a tab
 * for a category this event sells nothing in is a dead end, and the counts are
 * what let an organizer see the shape of a list without tapping through it.
 * Ordered by the canonical PRODUCT_CATEGORIES so the tabs do not reshuffle as
 * rows are added.
 *
 * A row whose category is no longer in PRODUCT_CATEGORIES (renamed since it
 * was created) still gets its own tab under its raw value — otherwise it would
 * be reachable only under All, which is how a product quietly goes missing.
 */
export function useCategoryTabs(categories: string[]) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    const known = PRODUCT_CATEGORIES
      .filter((c) => counts.has(c.value))
      .map((c) => ({ value: c.value, label: c.label, count: counts.get(c.value)! }));
    const extra = [...counts.entries()]
      .filter(([v]) => !PRODUCT_CATEGORIES.some((c) => c.value === v))
      .map(([value, count]) => ({ value, label: value, count }));
    return [...known, ...extra];
  }, [categories]);
}

export interface CategoryTab {
  value: string;
  label: string;
  count: number;
}

/**
 * A row of category pills, shared by the Catalogue and the Stock levels view.
 *
 * One component rather than two copies: they are the same control over the
 * same taxonomy, and the second copy is where the two would drift — a new
 * category rule, or a change to how an unknown value is handled, would have to
 * be remembered twice.
 */
export function CategoryFilterTabs({
  tabs,
  selected,
  onSelect,
  totalCount,
  label = 'Filter by category',
}: {
  tabs: CategoryTab[];
  selected: string;
  onSelect: (value: string) => void;
  totalCount: number;
  /** Distinguishes the two instances for a screen reader (and for tests). */
  label?: string;
}) {
  if (tabs.length === 0) return null;
  const all: CategoryTab = { value: ALL_CATEGORIES, label: 'All', count: totalCount };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {[all, ...tabs].map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={selected === c.value}
          onClick={() => onSelect(c.value)}
          className={
            selected === c.value
              ? 'rounded-full bg-orange-600 px-3 py-1.5 text-sm font-medium text-white'
              : 'rounded-full border px-3 py-1.5 text-sm text-muted-foreground hover:bg-slate-50'
          }
        >
          {c.label}
          <span className="ml-1.5 opacity-70">{c.count}</span>
        </button>
      ))}
    </div>
  );
}

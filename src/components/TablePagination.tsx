import { Button } from '@/components/ui/button';

interface TablePaginationProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  /** Total matching rows across all pages — not the current page's length. */
  total: number;
  /** Singular noun for a row, e.g. "sale". Pluralised with a trailing "s". */
  itemLabel: string;
  onPageChange: (page: number) => void;
  /** Disables both steps while a fetch is in flight. */
  busy?: boolean;
  /** Pass BOTH to render the rows-per-page control; omit for a fixed size. */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

/**
 * The pagination footer under a table: "Page 2 of 5 · 113 sales" plus
 * Previous/Next, and an optional rows-per-page control.
 *
 * ## Why this takes primitives and not a `pagination` object
 *
 * The codebase has THREE incompatible pagination shapes, and a component typed
 * against any one of them is silently wrong for the other two:
 *
 *  - `PaginatedResponse<T>` (sales, and most list endpoints) → `pages`
 *  - `UsersListResponse` / `OrganizersListResponse` / `FeesResponse` → `totalPages`
 *  - the reseller sales response → `pages` PLUS `hasNext` / `hasPrev`
 *
 * Reading the wrong field yields `undefined`, which renders as "Page 1 of
 * undefined" next to a Next button that stays enabled forever — and TypeScript
 * cannot catch it at the call site, because each caller's own response type is
 * internally consistent. Making every caller map its own shape to these three
 * numbers puts that conversion where the type information actually is.
 *
 * A missing `totalPages` therefore renders NOTHING rather than a broken
 * control: if a caller ever wires up the wrong field, the footer disappears
 * (obvious in review) instead of quietly lying about how much data there is.
 */
export function TablePagination({
  page, totalPages, total, itemLabel, onPageChange, busy,
  pageSize, onPageSizeChange, pageSizeOptions = [25, 50, 100],
}: TablePaginationProps) {
  const sizeControl = pageSize !== undefined && onPageSizeChange !== undefined;
  if (!totalPages || total <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-500">
      <span>
        Page {page} of {totalPages} · {total.toLocaleString()} {itemLabel}
        {total === 1 ? '' : 's'}
      </span>

      <div className="flex items-center gap-2">
        {sizeControl && (
          <>
            {/* Native select, deliberately: this repo's tests run on fireEvent
                with no user-event and no Radix pointer shims, so the Radix
                Select used for the page's filters could not be driven in a
                test. A rows-per-page control that ships untested is worse than
                one that looks slightly plainer. */}
            <label htmlFor="table-page-size" className="sr-only">Rows per page</label>
            <select
              id="table-page-size"
              aria-label="Rows per page"
              value={pageSize}
              disabled={busy}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 disabled:opacity-50"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="hidden sm:inline">per page</span>
          </>
        )}
        <Button variant="outline" size="sm" disabled={page <= 1 || busy}
          onClick={() => onPageChange(Math.max(1, page - 1))}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages || busy}
          onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

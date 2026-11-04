import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Organizer, OrganizerSort } from '@/types';
import type { OrganizerRowActions } from './OrganizerActionsMenu';
import { columnsFor, type OrganizerColumn } from './organizerColumns';
import type { OrganizerTab } from './organizerModel';

type AriaSort = 'ascending' | 'descending' | 'none';

// A–Z and oldest-first read ascending; newest-first reads descending.
function ariaSortOf(column: NonNullable<OrganizerColumn['sort']>, sort: OrganizerSort): AriaSort {
  if (column === 'name') return sort === 'name' ? 'ascending' : 'none';
  return sort === 'oldest' ? 'ascending' : sort === 'newest' ? 'descending' : 'none';
}

// Business always sorts A–Z; Joined flips between newest and oldest (from the
// name sort it starts at newest).
const nextSort = (column: NonNullable<OrganizerColumn['sort']>, sort: OrganizerSort): OrganizerSort =>
  column === 'name' ? 'name' : sort === 'newest' ? 'oldest' : 'newest';

const SORT_ICON: Record<AriaSort, typeof ArrowUp> = { ascending: ArrowUp, descending: ArrowDown, none: ArrowUpDown };

function SortHeader({ column, sort, onSortChange }: {
  column: OrganizerColumn;
  sort: OrganizerSort;
  onSortChange: (sort: OrganizerSort) => void;
}) {
  const key = column.sort!;
  const Icon = SORT_ICON[ariaSortOf(key, sort)];
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-slate-900"
      onClick={() => onSortChange(nextSort(key, sort))}
    >
      {column.header}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

interface OrganizersTableProps {
  tab: OrganizerTab;
  organizers: Organizer[];
  loading: boolean;
  emptyMessage: string;
  sort: OrganizerSort;
  onSortChange: (sort: OrganizerSort) => void;
  actions: OrganizerRowActions;
}

/** One table for every tab — the tab only decides which columns it shows. */
export function OrganizersTable({ tab, organizers, loading, emptyMessage, sort, onSortChange, actions }: OrganizersTableProps) {
  const columns = columnsFor(tab);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.header}
                className={c.align === 'right' ? 'text-right' : c.hideHeader ? 'w-24' : undefined}
                aria-sort={c.sort ? ariaSortOf(c.sort, sort) : undefined}
              >
                {c.sort ? (
                  <SortHeader column={c} sort={sort} onSortChange={onSortChange} />
                ) : c.hideHeader ? (
                  <span className="sr-only">{c.header}</span>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-slate-500 py-8">Loading…</TableCell>
            </TableRow>
          ) : organizers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-slate-500 py-8">{emptyMessage}</TableCell>
            </TableRow>
          ) : (
            organizers.map((o) => (
              <TableRow key={o.id}>
                {columns.map((c) => (
                  <TableCell key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>
                    {c.cell(o, actions)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

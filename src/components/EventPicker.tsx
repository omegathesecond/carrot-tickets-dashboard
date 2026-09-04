import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretSortIcon, CheckIcon, MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

/** The shape the picker needs — both event APIs are reduced to this. */
export interface PickableEvent {
  id: string;
  name: string;
  venue?: string;
}

interface EventPickerProps {
  /** Selected event ids. EMPTY means every event — never "none". */
  value: string[];
  onChange: (eventIds: string[]) => void;
  /**
   * How to search events. Defaults to the organizer dashboard's own API; the
   * reseller portal passes its own, since it authenticates with a different
   * token against a different route.
   */
  searchEvents?: (search: string) => Promise<PickableEvent[]>;
  /**
   * Platform staff creating an operator FOR an organizer: restrict the search
   * to that organizer, so they cannot pick an event the server will reject.
   * Ignored by the API for non-super-admins, who are already scoped.
   */
  vendorId?: string;
  disabled?: boolean;
  /**
   * Compact "add" mode: the trigger always shows this label, and the picker
   * renders NO selection chips or helper text — for callers that draw their
   * own list of what is selected (the reseller Events tab does).
   */
  placeholder?: string;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

/** Default fetcher: the dashboard's own event list, already scoped to the caller. */
function searchTicketsEvents(vendorId?: string) {
  return async (search: string): Promise<PickableEvent[]> => {
    const result = await apiClient.events.getEvents({
      limit: 20,
      ...(search ? { search } : {}),
      ...(vendorId ? { vendorId } : {}),
    });
    return (result.data ?? []).map((event) => ({ id: event._id, name: event.name, venue: event.venue }));
  };
}

/**
 * Multi-select event picker with server-side search by name.
 *
 * Deliberately NOT built on SearchableSelect: that one filters an
 * already-fetched array, so an organizer with more events than one page could
 * type a name and be told there are no results. This queries the API instead,
 * which scopes results to the caller's own events for free.
 *
 * An empty selection means "every event", which is what an operator with no
 * assignment can already work — so the empty state reads as All events rather
 * than as an unfilled required field.
 */
export function EventPicker({
  value,
  onChange,
  searchEvents,
  vendorId,
  disabled,
  placeholder,
  className,
}: EventPickerProps) {
  const fetchEvents = React.useMemo(
    () => searchEvents ?? searchTicketsEvents(vendorId),
    [searchEvents, vendorId],
  );
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // Names of events the user has picked, remembered across searches — a chosen
  // event usually falls out of the next query's results, and a chip reading
  // "Unknown event" would look like data loss.
  const [names, setNames] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['event-picker', vendorId ?? '', debounced],
    queryFn: () => fetchEvents(debounced),
    enabled: open,
  });

  const options = React.useMemo(() => data ?? [], [data]);

  // Learn names as they stream in, so previously-picked events keep their label.
  React.useEffect(() => {
    if (!options.length) return;
    setNames((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const event of options) {
        if (next[event.id] !== event.name) { next[event.id] = event.name; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [options]);

  const toggle = (eventId: string) => {
    onChange(value.includes(eventId) ? value.filter((id) => id !== eventId) : [...value, eventId]);
  };

  const labelFor = (eventId: string) => names[eventId] ?? 'Selected event';

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={cn('line-clamp-1 text-left', (placeholder || value.length === 0) && 'text-muted-foreground')}>
              {placeholder
                ? placeholder
                : value.length === 0
                  ? 'All events'
                  : value.length === 1
                    ? labelFor(value[0]!)
                    : `${value.length} events`}
            </span>
            <CaretSortIcon className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
          <div className="flex items-center border-b px-3">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events by name…"
              className="flex h-9 w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No events found</div>
            ) : (
              options.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  role="option"
                  aria-selected={value.includes(event.id)}
                  onClick={() => toggle(event.id)}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  {value.includes(event.id) && <CheckIcon className="absolute left-2 h-4 w-4" />}
                  <span className="line-clamp-1">
                    {event.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">{event.venue}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {!placeholder && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((eventId) => (
            <Badge key={eventId} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="max-w-[14rem] truncate">{labelFor(eventId)}</span>
              <button
                type="button"
                aria-label={`Remove ${labelFor(eventId)}`}
                onClick={() => toggle(eventId)}
                disabled={disabled}
                className="rounded-sm opacity-60 hover:opacity-100 disabled:cursor-not-allowed"
              >
                <Cross2Icon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {!placeholder && (
        <p className="text-xs text-muted-foreground">
          {value.length === 0
            ? 'Works every event. Pick one or more to restrict them.'
            : 'Can only work the events listed above.'}
        </p>
      )}
    </div>
  );
}

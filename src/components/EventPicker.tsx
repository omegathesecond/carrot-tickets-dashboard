import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretSortIcon, CheckIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** The shape the picker needs — an event list is reduced to this. */
export interface PickableEvent {
  id: string;
  name: string;
  venue?: string;
}

interface EventPickerProps {
  /** Already-selected event ids. Shown ticked; clicking one removes it. */
  value: string[];
  onChange: (eventIds: string[]) => void;
  /**
   * How to search events. Defaults to the dashboard's own event list, which
   * the API already scopes to the caller.
   */
  searchEvents?: (search: string) => Promise<PickableEvent[]>;
  disabled?: boolean;
  /** Trigger label when nothing is selected. */
  placeholder?: string;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

/** Default fetcher: the dashboard's own event list, already scoped to the caller. */
async function searchTicketsEvents(search: string): Promise<PickableEvent[]> {
  const result = await apiClient.events.getEvents({
    limit: 20,
    status: 'published',
    ...(search ? { search } : {}),
  });
  return (result.data ?? []).map((event) => ({ id: event._id, name: event.name, venue: event.venue }));
}

/**
 * Multi-select event picker with server-side search by name.
 *
 * Deliberately NOT built on SearchableSelect: that one filters an
 * already-fetched array, so once there are more events than fit in one page,
 * typing a real event's name would report no results. This queries the API on
 * every keystroke (debounced) instead.
 */
export function EventPicker({
  value,
  onChange,
  searchEvents,
  disabled,
  placeholder = 'Search events to assign…',
  className,
}: EventPickerProps) {
  const fetchEvents = searchEvents ?? searchTicketsEvents;
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['event-picker', debounced],
    queryFn: () => fetchEvents(debounced),
    enabled: open,
  });

  const options = data ?? [];

  const toggle = (eventId: string) => {
    onChange(value.includes(eventId) ? value.filter((id) => id !== eventId) : [...value, eventId]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="line-clamp-1 text-left text-muted-foreground">{placeholder}</span>
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
                  {event.venue && <span className="ml-1.5 text-xs text-muted-foreground">{event.venue}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

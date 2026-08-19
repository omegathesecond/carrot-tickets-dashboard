// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OperatorEventsDialog } from '@/components/OperatorEventsDialog';
import type { PickableEvent } from '@/components/EventPicker';

// No global setup file registers RTL's auto-cleanup, so each test unmounts its
// own tree — otherwise later queries match leftovers from earlier renders.
afterEach(cleanup);

const EVENTS: PickableEvent[] = [
  { id: 'e1', name: 'Bushfire', venue: 'Malkerns' },
  { id: 'e2', name: 'MTN Bushfire After Party', venue: 'Mbabane' },
];

function renderDialog(props: Partial<React.ComponentProps<typeof OperatorEventsDialog>> = {}) {
  const searchEvents = vi.fn(async (search: string) =>
    EVENTS.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
  );
  const onSave = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <OperatorEventsDialog
        open
        onClose={() => {}}
        personName="Sipho"
        initialEventIds={[]}
        onSave={onSave}
        searchEvents={searchEvents}
        {...props}
      />
    </QueryClientProvider>
  );

  return { searchEvents, onSave };
}

/** Open the popover and return the option rows (chips share their label). */
const openPicker = async () => {
  fireEvent.click(screen.getByRole('combobox'));
  return waitFor(() => screen.getAllByRole('option'));
};

const option = (name: string) =>
  screen.getAllByRole('option').find((el) => el.textContent?.startsWith(name))!;

it('shows an unassigned operator as working every event', () => {
  renderDialog();
  expect(screen.getByRole('combobox').textContent).toContain('All events');
});

it('saves the events the user picks', async () => {
  const { onSave } = renderDialog();

  await openPicker();
  fireEvent.click(option('Bushfire'));
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(['e1']));
});

it('keeps an existing assignment when it is not changed', async () => {
  const { onSave } = renderDialog({ initialEventIds: ['e1'] });

  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(['e1']));
});

it('clears back to all-events when the last chip is removed', async () => {
  const { onSave } = renderDialog({ initialEventIds: ['e1'] });

  await openPicker();
  fireEvent.click(option('Bushfire')); // deselect
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith([]));
});

describe('the selection survives re-renders', () => {
  // Callers write `operator.eventIds ?? []`, which allocates a new array every
  // render. When the re-seed effect depended on that reference it re-ran
  // constantly and wiped each pick the instant it was made.
  it('does not reset when the caller passes a fresh array identity each render', async () => {
    const searchEvents = vi.fn(async () => EVENTS);
    const onSave = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const view = (
      <QueryClientProvider client={client}>
        <OperatorEventsDialog
          open
          onClose={() => {}}
          personName="Sipho"
          initialEventIds={[]}
          onSave={onSave}
          searchEvents={searchEvents}
        />
      </QueryClientProvider>
    );

    const { rerender } = render(view);

    await openPicker();
    fireEvent.click(option('Bushfire'));

    // A fresh `initialEventIds={[]}` on every re-render must not clear the pick.
    rerender(view);
    rerender(view);

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['e1']));
  });
});

it('searches the server rather than filtering a fixed list', async () => {
  const { searchEvents } = renderDialog();

  await openPicker();
  fireEvent.change(screen.getByPlaceholderText('Search events by name…'), {
    target: { value: 'After Party' },
  });

  await waitFor(() => expect(searchEvents).toHaveBeenCalledWith('After Party'));
});

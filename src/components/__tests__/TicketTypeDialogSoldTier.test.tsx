// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketTypeDialog } from '@/components/TicketTypeDialog';

afterEach(cleanup);

/**
 * Editing a tier that has already sold: the dialog locks name and price, so it
 * must not SEND them either. The API refuses a rename/reprice on a sold tier
 * for a non-admin, and it judges that on the payload it receives — so shipping
 * a disabled field's unchanged value turned every quantity bump into a refusal.
 *
 * A super-admin is the exception the API already makes for deleteEvent and
 * unpublishEvent: they may correct a name or price after sales, so the dialog
 * leaves those fields open for them.
 */
const SOLD_TIER = {
  _id: 't1',
  name: 'General',
  price: 150,
  quantity: 100,
  sold: 40,
  available: 60,
};

const FRESH_TIER = { ...SOLD_TIER, _id: 't2', name: 'VIP', sold: 0, available: 100 };

const renderDialog = (props: Partial<React.ComponentProps<typeof TicketTypeDialog>> = {}) => {
  const onSubmit = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TicketTypeDialog
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        ticketType={SOLD_TIER}
        {...props}
      />
    </QueryClientProvider>
  );
  return onSubmit;
};

const setQuantity = (value: string) =>
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value } });

const save = () => fireEvent.click(screen.getByRole('button', { name: /update ticket type/i }));

// This repo wires no jest-dom matchers (vitest.config.ts has no setupFiles),
// so read the native property rather than reaching for `toBeDisabled`.
const isDisabled = (label: string | RegExp) =>
  (screen.getByLabelText(label) as HTMLInputElement).disabled;

describe('TicketTypeDialog — a tier that has already sold', () => {
  it('leaves the locked name and price out of the payload', () => {
    const onSubmit = renderDialog();

    setQuantity('1000');
    save();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.quantity).toBe(1000);
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('price');
  });

  it('accepts a quantity typed straight in, rather than stepped', () => {
    const onSubmit = renderDialog();

    setQuantity('1000');
    save();

    expect(onSubmit.mock.calls[0]![0].quantity).toBe(1000);
  });

  it('sends name and price for a tier that has sold nothing', () => {
    const onSubmit = renderDialog({ ticketType: FRESH_TIER });

    setQuantity('250');
    save();

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      name: 'VIP',
      price: 150,
      quantity: 250,
    });
  });

  it('lets a super-admin change the name and price of a sold tier', () => {
    const onSubmit = renderDialog({ isAdmin: true });

    expect(isDisabled('Ticket Type Name')).toBe(false);
    expect(isDisabled(/^Price/)).toBe(false);

    fireEvent.change(screen.getByLabelText('Ticket Type Name'), { target: { value: 'Early Bird' } });
    fireEvent.change(screen.getByLabelText(/^Price/), { target: { value: '250' } });
    save();

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ name: 'Early Bird', price: 250 });
  });

  it('keeps the name and price locked for a non-admin on a sold tier', () => {
    renderDialog();

    expect(isDisabled('Ticket Type Name')).toBe(true);
    expect(isDisabled(/^Price/)).toBe(true);
  });
});

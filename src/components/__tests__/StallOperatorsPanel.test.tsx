// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StallOperatorsPanel } from '@/components/StallOperatorsPanel';

// jsdom has no ResizeObserver. Radix's Switch only needs one for the hidden
// "bubble" input it renders to keep native <form> submission in sync — which
// only happens when a Switch sits inside a <form> (true here for the
// add-someone dialog's grants switch, once Task 3 nests OperatorGrantsField
// in that form). Harmless no-op in a real browser; jsdom just never shipped it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: {
      merchantOperators: {
        list: (...a: unknown[]) => list(...a),
        create: (...a: unknown[]) => create(...a),
        update: (...a: unknown[]) => update(...a),
        resetPin: vi.fn(),
      },
    },
  };
});

const renderPanel = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <StallOperatorsPanel merchantId="m1" stallName="Sandwich Stall" />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  list.mockResolvedValue({
    operators: [
      { _id: 'op1', fullName: 'Nomsa Shongwe', merchantId: 'm1', eventId: 'e1',
        loginCode: '123456', isActive: true, grants: [], createdAt: '2026-09-05T00:00:00.000Z' },
    ],
  });
  create.mockResolvedValue({
    operator: { _id: 'op2', fullName: 'Sipho Mabuza' }, loginCode: '654321', pin: '111111',
  });
  update.mockResolvedValue({ operator: { _id: 'op1', grants: ['manage_stock'] } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('StallOperatorsPanel grants', () => {
  it('offers the stock switch on an existing operator and saves it on toggle', async () => {
    renderPanel();
    // The list has one operator and the dialog is closed, so this is the
    // only "stock" switch on the page.
    const sw = await screen.findByRole('switch', { name: /stock/i });
    fireEvent.click(sw);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('op1', { grants: ['manage_stock'] }),
    );
  });

  it('does not offer the register-desk grant to stall staff', async () => {
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    expect(screen.queryByRole('switch', { name: /works the register desk/i })).toBeNull();
  });

  it('sends grants when adding someone with the switch on', async () => {
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    // "Add person" is also the row switch's dialog trigger AND (once open) the
    // dialog's own submit button label, so once the dialog is open every
    // query below is scoped to it via `within(dialog)` to stay unambiguous.
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: 'Sipho Mabuza' } });
    fireEvent.click(within(dialog).getByRole('switch', { name: /stock/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /add|create|save/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('m1', expect.objectContaining({ grants: ['manage_stock'] })),
    );
  });

  it('does not disable other operators while one operator\'s grant save is in flight', async () => {
    // Guards against a global `setGrants.isPending` flag disabling the
    // switch on every row instead of just the one being saved — this panel
    // manages several people per stall, so one person's save must not freeze
    // everyone else's switch.
    list.mockResolvedValue({
      operators: [
        { _id: 'op1', fullName: 'Nomsa Shongwe', merchantId: 'm1', eventId: 'e1',
          loginCode: '123456', isActive: true, grants: [], createdAt: '2026-09-05T00:00:00.000Z' },
        { _id: 'op2', fullName: 'Thabo Dlamini', merchantId: 'm1', eventId: 'e1',
          loginCode: '654321', isActive: true, grants: [], createdAt: '2026-09-05T00:00:00.000Z' },
      ],
    });
    let resolveUpdate: (value: { operator: { _id: string; grants: string[] } }) => void = () => {};
    update.mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve; }));

    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    await screen.findByText('Thabo Dlamini');

    const switches = screen.getAllByRole('switch', { name: /stock/i });
    expect(switches).toHaveLength(2);

    fireEvent.click(switches[0]);
    await waitFor(() => expect(switches[0]).toHaveProperty('disabled', true));
    expect(switches[1]).toHaveProperty('disabled', false);

    resolveUpdate({ operator: { _id: 'op1', grants: ['manage_stock'] } });
    await waitFor(() => expect(switches[0]).toHaveProperty('disabled', false));
  });

  it('does not send grants when toggling active status', async () => {
    // Guards the API's `if ('grants' in req.body)` contract from the client
    // side: this panel has no rename action for an existing operator, so the
    // real-world stand-in for "an unrelated field changes" is the
    // deactivate/reactivate toggle — it must never smuggle grants along with
    // isActive, or a status change would silently wipe the operator's grants.
    renderPanel();
    await screen.findByText('Nomsa Shongwe');
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('op1', { isActive: false }));
    expect(update).not.toHaveBeenCalledWith('op1', expect.objectContaining({ grants: expect.anything() }));
  });
});

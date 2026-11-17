// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CashiersPanel } from '@/components/CashiersPanel';
import { WaitersPanel } from '@/components/WaitersPanel';

const mocks = vi.hoisted(() => ({
  cashierList: vi.fn(), waiterList: vi.fn(), cashierReveal: vi.fn(), waiterReveal: vi.fn(),
  download: vi.fn(), render: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ apiClient: {
  cashiers: { list: mocks.cashierList, revealPin: mocks.cashierReveal },
  waiters: { list: mocks.waiterList, revealPin: mocks.waiterReveal },
} }));
vi.mock('@/components/EventTablesPanel', () => ({ EventTablesPanel: () => null }));
vi.mock('@/components/OperatorGrantsField', () => ({ OperatorGrantsField: () => null }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock('@/lib/operatorLoginCards', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/operatorLoginCards')>(),
  downloadLoginCards: mocks.download,
  renderLoginCard: mocks.render,
}));
// Radix opens dropdowns on pointer down; jsdom needs the pointer event fields.
vi.stubGlobal('PointerEvent', MouseEvent);
const person = { _id: 'staff-1', fullName: 'Nomsa Shongwe', phoneNumber: '+26878422613', loginCode: 'ABC123', isActive: true, grants: [] };
const inactive = { ...person, _id: 'staff-2', fullName: 'Inactive staff', loginCode: 'DEF456', isActive: false };

beforeEach(() => {
  vi.clearAllMocks();
  for (const list of [mocks.cashierList, mocks.waiterList]) list.mockResolvedValue([person, inactive]);
  for (const reveal of [mocks.cashierReveal, mocks.waiterReveal]) reveal.mockResolvedValue({ loginCode: person.loginCode, pin: '123456' });
  mocks.download.mockResolvedValue(undefined);
  mocks.render.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
});
afterEach(cleanup);

function mount(role: 'Cashiers' | 'Waiters', admin = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>
    {role === 'Cashiers'
      ? <CashiersPanel eventId="event-1" eventName="Phakama" canDelete={admin} />
      : <WaitersPanel eventId="event-1" eventName="Phakama" canDelete={admin} />}
  </MemoryRouter></QueryClientProvider>);
  if (role === 'Waiters') fireEvent.mouseDown(screen.getByRole('tab', { name: 'Waiters' }), { button: 0 });
  return client;
}

for (const role of ['Cashiers', 'Waiters'] as const) describe(`${role} login downloads`, () => {
  const list = role === 'Cashiers' ? mocks.cashierList : mocks.waiterList;
  const reveal = role === 'Cashiers' ? mocks.cashierReveal : mocks.waiterReveal;
  const otherReveal = role === 'Cashiers' ? mocks.waiterReveal : mocks.cashierReveal;

  it.each([
    ['Separate named images (.zip)', 'images'],
    ['Separate named PDFs (.zip)', 'pdfs'],
    ['Print pack — all logins in one PDF', 'print'],
  ])('exports %s using only the active staff and correct PIN endpoint', async (label, format) => {
    mount(role);
    await screen.findByText(person.fullName);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Download all logins' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: label }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith([
      { operatorName: person.fullName, phoneNumber: person.phoneNumber, stallName: `Phakama — ${role}`, loginCode: person.loginCode, pin: '123456' },
    ], format, `Phakama — ${role}`));
    expect(list).toHaveBeenCalledWith('event-1');
    expect(reveal).toHaveBeenCalledExactlyOnceWith('staff-1');
    expect(otherReveal).not.toHaveBeenCalled();
  });

  it('opens an individual named card with image and PDF buttons', async () => {
    mount(role);
    await screen.findByText(person.fullName);
    fireEvent.click(screen.getAllByRole('button', { name: 'Login card' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Download image' })).toHaveProperty('disabled', false));
    expect(within(dialog).getByRole('button', { name: 'Download PDF' })).toBeTruthy();
    expect(within(dialog).getByText(`Phakama — ${role}`)).toBeTruthy();
    expect(reveal).toHaveBeenCalledExactlyOnceWith('staff-1');
    expect(otherReveal).not.toHaveBeenCalled();
  });

  it('surfaces PIN lookup errors and produces no incomplete pack', async () => {
    reveal.mockRejectedValue(new Error('PIN unavailable'));
    mount(role);
    await screen.findByText(person.fullName);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Download all logins' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Separate named images (.zip)' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('PIN unavailable')));
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('disables the bulk button when there are no active staff', async () => {
    list.mockResolvedValue([inactive]);
    mount(role);
    await screen.findByText(inactive.fullName);
    expect(screen.getByRole('button', { name: 'Download all logins' })).toHaveProperty('disabled', true);
  });

  it('keeps saved-PIN download tools restricted to Super Admin', async () => {
    mount(role, false);
    await screen.findByText(person.fullName);
    expect(screen.queryByRole('button', { name: 'Download all logins' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Login card' })).toBeNull();
    expect(reveal).not.toHaveBeenCalled();
  });
});

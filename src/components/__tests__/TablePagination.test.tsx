// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TablePagination } from '@/components/TablePagination';

/**
 * This component takes PRIMITIVES rather than a `pagination` object on purpose.
 * The codebase has three incompatible pagination shapes — PaginatedResponse<T>
 * carries `pages`, the Users/Organizers/Fees list responses carry `totalPages`,
 * and the reseller sales response carries `pages` PLUS hasNext/hasPrev. A
 * component typed against any one of them renders "Page 1 of undefined" for the
 * others, and nothing at the call site would catch it.
 */
function setup(props: Partial<React.ComponentProps<typeof TablePagination>> = {}) {
  const onPageChange = vi.fn();
  const view = render(
    <TablePagination page={2} totalPages={5} total={113} itemLabel="sale"
      onPageChange={onPageChange} {...props} />,
  );
  return { onPageChange, ...view };
}

// This repo sets no vitest `globals` and has no setup file, so RTL's auto
// cleanup never registers — without this, each render stacks on the last and
// getByRole finds two "Next" buttons.
afterEach(cleanup);

const prev = () => screen.getByRole('button', { name: /previous/i });
const next = () => screen.getByRole('button', { name: /next/i });

describe('TablePagination', () => {
  it('summarises position and total', () => {
    setup();
    expect(screen.getByText(/Page 2 of 5 · 113 sales/)).toBeTruthy();
  });

  it('singularises the item label for a single result', () => {
    setup({ page: 1, totalPages: 1, total: 1 });
    expect(screen.getByText(/· 1 sale$/)).toBeTruthy();
  });

  it('groups thousands in the total', () => {
    setup({ total: 12345 });
    expect(screen.getByText(/12,345 sales/)).toBeTruthy();
  });

  it('steps forward and back by one page', () => {
    const { onPageChange } = setup();

    fireEvent.click(next());
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(prev());
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Previous on the first page', () => {
    setup({ page: 1 });
    expect((prev() as HTMLButtonElement).disabled).toBe(true);
    expect((next() as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables Next on the last page', () => {
    setup({ page: 5 });
    expect((prev() as HTMLButtonElement).disabled).toBe(false);
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables both buttons while a fetch is in flight', () => {
    setup({ busy: true });
    expect((prev() as HTMLButtonElement).disabled).toBe(true);
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  // Guards the exact bug the primitives API exists to prevent: a caller reading
  // `pages` where the response has `totalPages` (or vice versa) passes
  // undefined. Rendering "of undefined" beside an enabled Next is worse than
  // rendering nothing at all.
  it('renders nothing when totalPages is missing', () => {
    const { container } = setup({ totalPages: undefined as unknown as number });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when there is nothing to page through', () => {
    const { container } = setup({ page: 1, totalPages: 0, total: 0 });
    expect(container.innerHTML).toBe('');
  });

  // A single page of results still shows the count — organizers rely on it to
  // read the filtered total — but with both buttons inert.
  it('keeps the summary on a single page of results', () => {
    setup({ page: 1, totalPages: 1, total: 7 });
    expect(screen.getByText(/Page 1 of 1 · 7 sales/)).toBeTruthy();
    expect((prev() as HTMLButtonElement).disabled).toBe(true);
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no page-size control unless the caller handles one', () => {
    setup();
    expect(screen.queryByLabelText(/rows per page/i)).toBeNull();
  });

  it('reports the chosen page size when a caller opts in', () => {
    const onPageSizeChange = vi.fn();
    setup({ pageSize: 25, onPageSizeChange, pageSizeOptions: [25, 50, 100] });

    const select = screen.getByLabelText(/rows per page/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['25', '50', '100']);
    expect(select.value).toBe('25');

    fireEvent.change(select, { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  // The size control is the one thing that stays usable with a single page of
  // results — that is how you get from 25 rows to 100 in the first place.
  it('shows the page-size control even when there is only one page', () => {
    setup({ page: 1, totalPages: 1, total: 3, pageSize: 25, onPageSizeChange: vi.fn() });
    expect(screen.getByLabelText(/rows per page/i)).toBeTruthy();
  });
});

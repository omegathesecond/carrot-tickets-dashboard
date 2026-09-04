// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ViewAffordance } from '@/components/ViewAffordance';

afterEach(cleanup);

describe('ViewAffordance', () => {
  it('lets the click reach the card it sits in, so both open the same place', () => {
    const cardClick = vi.fn();
    render(
      <div onClick={cardClick}>
        <ViewAffordance />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /View/ }));

    expect(cardClick).toHaveBeenCalledTimes(1);
  });

  it('keeps its own handler to itself when given one', () => {
    const cardClick = vi.fn();
    const ownClick = vi.fn();
    render(
      <div onClick={cardClick}>
        <ViewAffordance onClick={ownClick} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /View/ }));

    expect(ownClick).toHaveBeenCalledTimes(1);
    expect(cardClick).not.toHaveBeenCalled();
  });

  it('says what it opens', () => {
    render(<ViewAffordance label="View activity" />);
    expect(screen.getByRole('button', { name: /View activity/ })).toBeDefined();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PhoneInput } from '@/components/PhoneInput';

// Radix's Select needs pointer APIs jsdom does not implement. Stubbing them
// lets the listbox open from the keyboard, which is a real operator path.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto['scrollIntoView'] = vi.fn();
  proto['hasPointerCapture'] = vi.fn();
  proto['releasePointerCapture'] = vi.fn();
  proto['setPointerCapture'] = vi.fn();
});

afterEach(cleanup);

function Harness({ onValue, initial = '' }: { onValue: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <PhoneInput
      compact
      value={v}
      onChange={(x) => { setV(x); onValue(x); }}
      inputAriaLabel="number"
      countryAriaLabel="country"
    />
  );
}

const pickCountry = async (name: RegExp) => {
  fireEvent.keyDown(screen.getByLabelText('country'), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name }));
};

describe('PhoneInput', () => {
  // The whole point of the picker: an operator serving a South African
  // customer must be able to say so. Without it, 0821234567 was stored as
  // +268821234567, routed to the Eswatini SMS gateway, and reported as sent.
  it('composes the chosen country dial code with the local number', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(screen.getByLabelText('number'), { target: { value: '821234567' } });
    expect(onValue).toHaveBeenLastCalledWith('+268821234567');

    await pickCountry(/South Africa/i);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith('+27821234567'));
  });

  it('re-composes an already-typed number when the country changes', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} initial="+26876111111" />);
    await pickCountry(/Botswana/i);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith('+26776111111'));
  });

  // A bare '+268' is truthy, so it sails past every `if (!phone)` guard.
  it('emits empty — never a bare dial code — when the number is cleared', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('number'), { target: { value: '76111111' } });
    fireEvent.change(screen.getByLabelText('number'), { target: { value: '' } });
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('keeps the chosen country when the number is cleared', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('number'), { target: { value: '821234567' } });
    await pickCountry(/South Africa/i);
    await waitFor(() => expect(screen.getByLabelText('country').textContent).toContain('+27'));

    fireEvent.change(screen.getByLabelText('number'), { target: { value: '' } });
    expect(screen.getByLabelText('country').textContent).toContain('+27');

    fireEvent.change(screen.getByLabelText('number'), { target: { value: '821234567' } });
    expect(onValue).toHaveBeenLastCalledWith('+27821234567');
  });

  // Operators paste numbers out of WhatsApp. Prefixing the default code again
  // would produce '+268+27…'.
  it('takes a pasted international number as complete', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('number'), { target: { value: '+27821234567' } });

    expect(onValue).toHaveBeenLastCalledWith('+27821234567');
    await waitFor(() => expect(screen.getByLabelText('country').textContent).toContain('+27'));
    expect((screen.getByLabelText('number') as HTMLInputElement).value).toBe('821234567');
  });
});

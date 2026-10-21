import { vi } from 'vitest';
import * as phoneInput from '@/components/PhoneInput';

/** Keep row-limit tests about list boundaries, without mounting 100 Radix
 * country pickers. PhoneInput.test.tsx covers the real country's selection
 * and number composition; ordinary page/dialog tests still use it too. */
export function stubPhoneInput() {
  return vi.spyOn(phoneInput, 'PhoneInput').mockImplementation((props) => (
    <input
      type="tel"
      aria-label={props.inputAriaLabel ?? props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    />
  ));
}

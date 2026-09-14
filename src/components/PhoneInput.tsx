import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SADC_COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  /** Visible field label. Omitted in `compact` rows, which label via aria only. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  /**
   * Inline variant for a per-ticket row: no visible <Label>, a narrower
   * country trigger showing just flag + dial code, and no vertical spacing.
   */
  compact?: boolean;
  /** Accessible name for the number field — required when there is no label. */
  inputAriaLabel?: string;
  /** Accessible name for the country dropdown. */
  countryAriaLabel?: string;
  className?: string;
}

/**
 * Country dial code + local number, composing one `+<code><number>` string.
 *
 * INVARIANT: emits '' — never a bare dial code — when the local part is empty.
 * A bare '+268' is truthy, so it sails past every `if (!phone)` guard and then
 * fails validation server-side (or worse, gets stored). Emitting empty keeps
 * those guards working.
 *
 * A value typed or pasted with a leading '+' is taken as a COMPLETE
 * international number: the dropdown re-derives itself from it rather than
 * prefixing the default dial code again. Without this, an operator pasting a
 * South African +27… number would ship +268+27… (or, before this field
 * existed anywhere but the buyer row, a plain 082… silently localised to
 * +268082… — routed to the Eswatini SMS gateway and never delivered).
 */
export function PhoneInput({
  label,
  value,
  onChange,
  placeholder = '78422613',
  disabled = false,
  error,
  required = false,
  compact = false,
  inputAriaLabel,
  countryAriaLabel,
  className,
}: PhoneInputProps) {
  // Parse existing value to extract country code and number
  const parsePhone = (phone: string) => {
    if (!phone) return { countryCode: DEFAULT_COUNTRY.code, number: '' };

    // Find matching country code
    const country = SADC_COUNTRIES.find(c => phone.startsWith(c.code));
    if (country) {
      const number = phone.slice(country.code.length).trim();
      return { countryCode: country.code, number };
    }

    // Default to Eswatini if no match
    return { countryCode: DEFAULT_COUNTRY.code, number: phone };
  };

  const { countryCode: initialCode, number: initialNumber } = parsePhone(value);
  const [countryCode, setCountryCode] = useState(initialCode);
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);

  // Update internal state when value prop changes. An empty value only clears
  // the number — re-deriving the country there would silently snap a chosen
  // +27 back to the default the moment the operator backspaces the number.
  useEffect(() => {
    if (!value) {
      setPhoneNumber('');
      return;
    }
    const { countryCode: newCode, number: newNumber } = parsePhone(value);
    setCountryCode(newCode);
    setPhoneNumber(newNumber);
  }, [value]);

  // Notify parent of changes
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    onChange(phoneNumber ? `${newCode}${phoneNumber}` : '');
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    setPhoneNumber(newNumber);
    // Already international — pass it through untouched; the effect above
    // re-derives the dropdown from it.
    if (newNumber.trim().startsWith('+')) {
      onChange(newNumber.trim());
      return;
    }
    onChange(newNumber ? `${countryCode}${newNumber}` : '');
  };

  const selected = SADC_COUNTRIES.find((c) => c.code === countryCode);

  const field = (
    <div className={cn('flex gap-2 min-w-0', className)}>
      <Select value={countryCode} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger
          aria-label={countryAriaLabel ?? (label ? `${label} country code` : 'Country code')}
          className={compact ? 'w-[92px] shrink-0 px-2' : 'w-[112px] shrink-0'}
        >
          {compact ? (
            <SelectValue>
              <span className="flex items-center gap-1">
                <span>{selected?.flag}</span>
                <span>{countryCode}</span>
              </span>
            </SelectValue>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {SADC_COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <span className="text-slate-500 text-xs">{country.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        aria-label={inputAriaLabel}
        value={phoneNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0"
      />
    </div>
  );

  if (compact) {
    return (
      <div className="min-w-0">
        {field}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </Label>
      )}
      {field}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

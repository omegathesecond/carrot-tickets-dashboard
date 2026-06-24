import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SADC_COUNTRIES, DEFAULT_COUNTRY } from '@/lib/constants';

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function PhoneInput({
  label,
  value,
  onChange,
  placeholder = '78422613',
  disabled = false,
  error,
  required = false,
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

  // Update internal state when value prop changes
  useEffect(() => {
    const { countryCode: newCode, number: newNumber } = parsePhone(value);
    setCountryCode(newCode);
    setPhoneNumber(newNumber);
  }, [value]);

  // Notify parent of changes
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    onChange(phoneNumber ? `${newCode}${phoneNumber}` : newCode);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    setPhoneNumber(newNumber);
    onChange(newNumber ? `${countryCode}${newNumber}` : countryCode);
  };

  return (
    <div className="space-y-2 min-w-0">
      <Label>
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </Label>
      <div className="flex gap-2 min-w-0">
        <Select value={countryCode} onValueChange={handleCountryChange} disabled={disabled}>
          <SelectTrigger className="w-[112px] shrink-0">
            <SelectValue />
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
          value={phoneNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

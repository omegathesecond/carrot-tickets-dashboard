import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COUNTRIES, DEFAULT_COUNTRY, PRIORITY_COUNT, flagOf, countryFromE164, type Country } from '@/lib/countries';

interface PhoneFieldProps {
  id: string;
  value: string;
  onChange: (e164: string) => void;
  required?: boolean;
  placeholder?: string;
}

/**
 * Country picker + local number, composing a full E.164 value upward.
 *
 * INVARIANT: emits '' — never a bare dial code — when the local part is empty.
 * BuyerAuthPanel guards with `if (!phone.trim())`; a bare '+268' would sail past
 * every guard, POST "+268" to the API, and render "We texted a 6-digit code to
 * +268" back to the user. Emitting empty keeps those guards working untouched.
 */
export function PhoneField({ id, value, onChange, required, placeholder = '7612 3456' }: PhoneFieldProps) {
  const parsed = countryFromE164(value);
  const [country, setCountry] = useState<Country>(parsed ?? DEFAULT_COUNTRY);
  const [local, setLocal] = useState(() => (parsed ? value.slice(parsed.dialCode.length) : ''));
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function emit(c: Country, digits: string) {
    onChange(digits ? `${c.dialCode}${digits}` : '');
  }

  function onLocalChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 15);
    setLocal(digits);
    emit(country, digits);
  }

  function pick(c: Country) {
    setCountry(c);
    setOpen(false);
    setFilter('');
    emit(c, local);
  }

  const f = filter.trim().toLowerCase();
  const shown = f
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(f) || c.dialCode.includes(f.replace(/^\+/, '')))
    : COUNTRIES;

  return (
    <div
      ref={boxRef}
      className="relative"
      // Mirrors NavSearch.tsx's Escape-to-close — attached here (not on a
      // single input) because the panel below has up to ~194 focusable option
      // buttons; a keydown on any of them still bubbles to this wrapper.
      // Without it, autoFocus lands in the filter box with no keyboard way to
      // dismiss the panel short of tabbing all the way past every option.
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Select country"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent transition-colors"
        >
          <span aria-hidden>{flagOf(country.iso2)}</span>
          <span className="font-mono">{country.dialCode}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        <Input
          id={id}
          aria-label="Phone number"
          inputMode="tel"
          placeholder={placeholder}
          value={local}
          onChange={(e) => onLocalChange(e.target.value)}
          required={required}
          className="flex-1 font-mono"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-background shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search country…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {shown.map((c, i) => (
              <li key={c.iso2}>
                {/* Divider closes the region-first block, but only in the
                    unfiltered list — mid-search a rule is just noise. */}
                {!f && i === PRIORITY_COUNT && <div className="my-1 border-t border-border" />}
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso2 === country.iso2}
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span aria-hidden>{flagOf(c.iso2)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.dialCode}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">No country matches "{filter}".</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

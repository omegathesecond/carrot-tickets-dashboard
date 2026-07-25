import { it, expect } from 'vitest';
import { currencySymbol } from '@/lib/currency';

it("maps ZAR to 'R'", () => expect(currencySymbol('ZAR')).toBe('R'));
it("maps SZL to 'E'", () => expect(currencySymbol('SZL')).toBe('E'));
it("defaults undefined to 'E'", () => expect(currencySymbol(undefined)).toBe('E'));

import { describe, it, expect } from 'vitest';
import { getOperatorContext, operatorLabel, operatorHomePath } from '@/lib/operatorContext';

describe('operatorContext', () => {
  it('defaults to events when unset', () => {
    expect(getOperatorContext(null)).toBe('events');
    expect(getOperatorContext({} as any)).toBe('events');
  });
  it('reads operatorType', () => {
    expect(getOperatorContext({ operatorType: 'transport' } as any)).toBe('transport');
  });
  it('labels each context', () => {
    expect(operatorLabel('events')).toBe('Event Organizer');
    expect(operatorLabel('transport')).toBe('Bus Ticket Operator');
    expect(operatorLabel('both')).toBe('Events & Bus');
  });
  it('routes transport home to bus trips, others to /', () => {
    expect(operatorHomePath('transport')).toBe('/transport/trips');
    expect(operatorHomePath('events')).toBe('/');
    expect(operatorHomePath('both')).toBe('/');
  });
});

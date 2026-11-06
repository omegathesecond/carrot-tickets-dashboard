// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventLocationPicker } from '../EventLocationPicker';
import { emptyLocation, parseEventLocation } from '@/lib/eventLocation';
function Form() {
  const [value, setValue] = useState(emptyLocation);
  return <EventLocationPicker value={value} onChange={setValue} />;
}
describe('organizer selected event location', () => {
  it('requires a complete valid coordinate pair without inventing missing values', () => {
    expect(parseEventLocation(emptyLocation)).toBeNull();
    expect(() => parseEventLocation({ lat: '0', lng: '' })).toThrow();
    expect(() => parseEventLocation({ lat: '91', lng: '0' })).toThrow();
    expect(parseEventLocation({ lat: '0', lng: '0' })).toEqual({ lat: 0, lng: 0 });
  });
  it('previews only an explicitly selected valid point', () => {
    render(<Form />);
    expect(screen.getByText('Event location unavailable.')).toBeTruthy();
    expect(screen.queryByTitle('Selected event location')).toBeNull();
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-26.3' } });
    expect(screen.queryByTitle('Selected event location')).toBeNull();
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '31.1' } });
    expect(screen.getByTitle('Selected event location').getAttribute('src')).toContain('q=-26.3,31.1');
  });
});

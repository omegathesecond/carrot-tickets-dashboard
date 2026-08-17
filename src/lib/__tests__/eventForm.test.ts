import { describe, it, expect } from 'vitest';
import { composeEventDateTime, eventToDateTimeInputs } from '@/lib/eventForm';

/**
 * composeEventDateTime turns the raw form inputs (single-day date + times, or a
 * multi-day datetime pair) into the { eventDate, startTime, endTime } payload
 * the API expects. Shared by the create form and the edit form so both produce
 * identical shapes.
 *
 * startTime/endTime are the naive local wall-clock inputs converted to real UTC
 * instants (ISO strings). Sending the naive string instead let the UTC server
 * parse it AS UTC and store every time 2 hours off (Eswatini is UTC+2). eventDate
 * stays a date-only marker. We assert equality against the SAME local→UTC
 * conversion so the test is timezone-independent while still pinning field
 * assembly (which raw fields feed which output) and the UTC conversion itself.
 */
describe('composeEventDateTime', () => {
  it('composes single-day fields into a date marker + UTC datetime instants', () => {
    expect(
      composeEventDateTime({
        isMultiDay: false,
        eventDate: '2030-06-15',
        startTime: '18:00',
        endTime: '22:30',
      })
    ).toEqual({
      eventDate: '2030-06-15',
      startTime: new Date('2030-06-15T18:00').toISOString(),
      endTime: new Date('2030-06-15T22:30').toISOString(),
    });
  });

  it('composes multi-day fields, deriving eventDate from the start datetime', () => {
    expect(
      composeEventDateTime({
        isMultiDay: true,
        startDateTime: '2030-06-15T18:00',
        endDateTime: '2030-06-17T02:00',
      })
    ).toEqual({
      eventDate: '2030-06-15',
      startTime: new Date('2030-06-15T18:00').toISOString(),
      endTime: new Date('2030-06-17T02:00').toISOString(),
    });
  });

  it('emits canonical UTC ISO strings (round-trip stable)', () => {
    const { startTime } = composeEventDateTime({
      isMultiDay: false, eventDate: '2030-06-15', startTime: '18:00', endTime: '22:30',
    });
    expect(new Date(startTime).toISOString()).toBe(startTime);
  });
});

/**
 * eventToDateTimeInputs is the reverse of composeEventDateTime — it pre-fills the
 * edit form from an event's stored UTC instants. The invariant that matters: a
 * round trip preserves the instants, so opening the editor and saving without
 * touching the dates is a no-op. Asserting the round trip (rather than exact
 * local strings) keeps the test timezone-independent.
 */
describe('eventToDateTimeInputs (round-trips with composeEventDateTime)', () => {
  const sameInstant = (a: string, b: string) =>
    expect(new Date(a).getTime()).toBe(new Date(b).getTime());

  it('round-trips a single-day event', () => {
    const event = {
      isMultiDay: false,
      eventDate: '2030-06-15T00:00:00.000Z',
      startTime: '2030-06-15T16:00:00.000Z', // 18:00 in UTC+2
      endTime: '2030-06-15T20:30:00.000Z',
    };
    const inputs = eventToDateTimeInputs(event);
    expect(inputs.isMultiDay).toBe(false);
    const composed = composeEventDateTime(inputs);
    sameInstant(composed.startTime, event.startTime);
    sameInstant(composed.endTime, event.endTime);
  });

  it('round-trips a multi-day event', () => {
    const event = {
      isMultiDay: true,
      eventDate: '2030-06-15T00:00:00.000Z',
      startTime: '2030-06-15T16:00:00.000Z',
      endTime: '2030-06-17T00:00:00.000Z',
    };
    const inputs = eventToDateTimeInputs(event);
    expect(inputs.isMultiDay).toBe(true);
    const composed = composeEventDateTime(inputs);
    sameInstant(composed.startTime, event.startTime);
    sameInstant(composed.endTime, event.endTime);
  });
});

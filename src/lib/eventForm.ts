/**
 * Shared date/time composition for the event create + edit forms.
 *
 * The API stores three fields — `eventDate` (date-only marker), `startTime` and
 * `endTime` (datetime strings). The forms collect either a single-day date +
 * start/end times, or a multi-day start/end datetime pair. Keeping this in one
 * place means create and edit always produce identical payload shapes.
 */
export interface EventDateTimeInputs {
  isMultiDay: boolean;
  /** single-day: 'YYYY-MM-DD' */
  eventDate?: string;
  /** single-day: 'HH:mm' */
  startTime?: string;
  /** single-day: 'HH:mm' */
  endTime?: string;
  /** multi-day: 'YYYY-MM-DDTHH:mm' */
  startDateTime?: string;
  /** multi-day: 'YYYY-MM-DDTHH:mm' */
  endDateTime?: string;
}

export interface ComposedEventDateTime {
  eventDate: string;
  startTime: string;
  endTime: string;
}

/**
 * The date/time inputs give a NAIVE local wall-clock string (no timezone).
 * `new Date('…T18:00')` parses it in the browser's local zone (Eswatini, UTC+2)
 * and toISOString() encodes the correct UTC instant. Sending the naive string
 * instead let the UTC server parse it AS UTC, storing every time 2 hours off.
 */
const toUtcInstant = (naive: string): string => new Date(naive).toISOString();

/** Fully-populated form values for the edit form's date/time inputs. */
export interface EventDateTimeFormValues {
  isMultiDay: boolean;
  eventDate: string;      // 'YYYY-MM-DD' (single-day date input)
  startTime: string;      // 'HH:mm' (single-day time input)
  endTime: string;        // 'HH:mm'
  startDateTime: string;  // 'YYYY-MM-DDTHH:mm' (multi-day datetime input)
  endDateTime: string;    // 'YYYY-MM-DDTHH:mm'
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local wall-clock 'HH:mm' for a stored UTC instant. */
const localHm = (iso: string): string => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Local 'YYYY-MM-DDTHH:mm' for a stored UTC instant (for datetime-local). */
const localDateTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${localHm(iso)}`;
};

/**
 * Reverse of composeEventDateTime: pre-fill the edit form from a stored event.
 * startTime/endTime are UTC instants → convert back to the organizer's local
 * wall-clock so the inputs show what they originally typed. eventDate is a
 * date-only UTC marker → take its date portion verbatim (never local-format it,
 * which could shift the day; see the timezone note above).
 */
export function eventToDateTimeInputs(event: {
  eventDate: string;
  startTime: string;
  endTime: string;
  isMultiDay?: boolean;
}): EventDateTimeFormValues {
  const isMultiDay = !!event.isMultiDay;
  return {
    isMultiDay,
    eventDate: (event.eventDate ?? '').slice(0, 10),
    startTime: localHm(event.startTime),
    endTime: localHm(event.endTime),
    startDateTime: localDateTime(event.startTime),
    endDateTime: localDateTime(event.endTime),
  };
}

export function composeEventDateTime(input: EventDateTimeInputs): ComposedEventDateTime {
  if (input.isMultiDay) {
    const startDateTime = input.startDateTime ?? '';
    const endDateTime = input.endDateTime ?? '';
    return {
      // eventDate stays a date-only marker (first token of the start datetime).
      eventDate: startDateTime.split('T')[0],
      startTime: toUtcInstant(startDateTime),
      endTime: toUtcInstant(endDateTime),
    };
  }
  const eventDate = input.eventDate ?? '';
  return {
    eventDate,
    startTime: toUtcInstant(`${eventDate}T${input.startTime ?? ''}`),
    endTime: toUtcInstant(`${eventDate}T${input.endTime ?? ''}`),
  };
}

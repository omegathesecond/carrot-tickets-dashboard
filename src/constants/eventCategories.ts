// Mirrors api/src/constants/eventCategories.ts — stable ids the backend
// stores and filters on; labels are display-only and may be re-worded
// without touching stored data.
export const EVENT_CATEGORIES = [
  { id: 'events', label: 'Events' },
  { id: 'travel-tours', label: 'Travel & Tours' },
  { id: 'transport', label: 'Transport' },
  { id: 'sports', label: 'Sports' },
  { id: 'religion', label: 'Religion' },
  { id: 'cinema-theatre', label: 'Cinema & Theatre' },
  { id: 'education', label: 'Education' },
  { id: 'business', label: 'Business' },
  { id: 'food-hospitality', label: 'Food & Hospitality' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'health-wellness', label: 'Health & Wellness' },
  { id: 'parking', label: 'Parking' },
  { id: 'memberships', label: 'Memberships' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'competitions', label: 'Competitions' },
  { id: 'packages', label: 'Packages' },
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number]['id'];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = Object.fromEntries(
  EVENT_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<EventCategory, string>;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Wristbands — design + print photo-quality Tyvek wristbands (10-up sheets)
 * for an event. Platform-staff-only (see WristbandsRoute).
 */
export function WristbandsPage() {
  const [eventId, setEventId] = useState<string>('');

  const { data: eventsPage, error } = useQuery({
    queryKey: ['wristbands-events'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  if (error) {
    return <div className="p-6 text-destructive">Failed to load events: {(error as Error).message}</div>;
  }

  const events = eventsPage?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wristbands</h1>
          <p className="text-muted-foreground">Design and print Tyvek wristbands on the office printer.</p>
        </div>
        <div className="w-72">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {eventId
        ? <div data-slot="wristband-editor" /> /* Task 16 mounts the editor here */
        : <div className="text-muted-foreground py-24 text-center">Pick an event to start designing.</div>}
    </div>
  );
}

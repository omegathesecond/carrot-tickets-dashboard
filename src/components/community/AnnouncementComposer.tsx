import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const MAX_LENGTH = 2000;

/**
 * Posts an organizer announcement into the event's #announcements channel
 * (POST /api/tickets/events/:eventId/announcements). The API broadcasts it
 * to every channel member in real time and fans out a push notification —
 * this composer only needs to fire the request and report success/failure.
 */
export function AnnouncementComposer({ eventId }: { eventId: string }) {
  const [text, setText] = useState('');

  const postAnnouncement = useMutation({
    mutationFn: (body: string) => apiClient.community.postAnnouncement(eventId, body),
    onSuccess: () => {
      toast.success('Announcement posted to #announcements');
      setText('');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to post announcement'),
  });

  const trimmed = text.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= MAX_LENGTH;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Post Announcement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Let ticket holders know about a gate change, lineup update, or anything else…"
          rows={4}
          maxLength={MAX_LENGTH}
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${trimmed.length > MAX_LENGTH ? 'text-red-600' : 'text-slate-500'}`}>
            {text.length} / {MAX_LENGTH}
          </span>
          <Button
            onClick={() => isValid && postAnnouncement.mutate(trimmed)}
            disabled={!isValid || postAnnouncement.isPending}
            className="bg-gradient-to-r from-orange-600 to-amber-600"
          >
            {postAnnouncement.isPending ? 'Posting…' : 'Post announcement'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

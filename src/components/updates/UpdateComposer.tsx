import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Film, Image as ImageIcon, Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';

const MAX_CAPTION_LENGTH = 500;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

const NO_EVENT_VALUE = '__none__';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a video update's transcode to finish by polling the public read
 * endpoint every POLL_INTERVAL_MS, up to MAX_POLL_ATTEMPTS times. Resolves on
 * 'ready', throws on 'failed' or if it never settles (fail loud, no silent
 * success).
 */
async function pollUntilReady(updateId: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const { media } = await apiClient.updates.getPublic(updateId);
    if (media.status === 'ready') return;
    if (media.status === 'failed') {
      throw new Error(media.error || 'Video processing failed');
    }
  }
  throw new Error('Video is still processing — check back later');
}

interface ComposerState {
  file: File | null;
  previewUrl: string | null;
  caption: string;
  eventId: string;
}

const initialState: ComposerState = {
  file: null,
  previewUrl: null,
  caption: '',
  eventId: NO_EVENT_VALUE,
};

/**
 * Lets an organizer post a short video/image "update" to the public Discover
 * feed: init (presign) -> raw PUT to R2 -> finalize -> (video only) poll
 * getPublic until the transcode settles. Mirrors AnnouncementComposer's
 * Card + useMutation + sonner shape.
 */
export function UpdateComposer() {
  const [state, setState] = useState<ComposerState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: eventsData } = useQuery({
    queryKey: ['publishedEvents'],
    queryFn: () => apiClient.events.getEvents({ status: 'published', limit: 100 }),
  });

  const eventOptions = [
    { value: NO_EVENT_VALUE, label: 'General update (no event)' },
    ...(eventsData?.data || []).map((event) => ({ value: event._id, label: event.name })),
  ];

  const resetForm = () => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    setState(initialState);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const postUpdate = useMutation({
    mutationFn: async () => {
      const { file, caption, eventId } = state;
      if (!file) {
        throw new Error('Choose a video or image first');
      }

      const kind: 'video' | 'image' = file.type.startsWith('video/') ? 'video' : 'image';

      if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
        throw new Error('Video must be under 100MB');
      }

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const contentType = file.type;

      const { updateId, uploadUrl } = await apiClient.updates.init({
        kind,
        caption: caption.trim(),
        eventId: eventId === NO_EVENT_VALUE ? undefined : eventId,
        ext,
        contentType,
      });

      await apiClient.updates.uploadToR2(uploadUrl, file);

      const finalized = await apiClient.updates.finalize(updateId);

      if (kind === 'video' && finalized.media.status !== 'ready') {
        if (finalized.media.status === 'failed') {
          throw new Error(finalized.media.error || 'Video processing failed');
        }
        await pollUntilReady(updateId);
      }
    },
    onMutate: () => setError(null),
    onSuccess: () => {
      toast.success('Update posted');
      resetForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to post update';
      setError(message);
      toast.error(message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);

    if (!file) {
      setState((s) => ({ ...s, file: null, previewUrl: null }));
      return;
    }

    const isImage = file.type.startsWith('image/');
    setState((s) => ({
      ...s,
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    }));
  };

  const trimmedCaption = state.caption.trim();
  const captionValid = trimmedCaption.length > 0 && state.caption.length <= MAX_CAPTION_LENGTH;
  const canSubmit = !!state.file && captionValid && !postUpdate.isPending;
  const kind = state.file?.type.startsWith('video/') ? 'video' : state.file ? 'image' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" /> Post an update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Media</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            disabled={postUpdate.isPending}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {state.file && (
            <div className="flex items-center gap-3 rounded-md border border-slate-200 p-2">
              {kind === 'image' && state.previewUrl ? (
                <img
                  src={state.previewUrl}
                  alt="Selected preview"
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-slate-500">
                  <Film className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-slate-800">{state.file.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  {kind === 'image' ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <Film className="h-3 w-3" />
                  )}
                  {kind === 'image' ? 'Image selected' : 'Video selected'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Caption</label>
          <Textarea
            value={state.caption}
            onChange={(e) =>
              setState((s) => ({ ...s, caption: e.target.value.slice(0, MAX_CAPTION_LENGTH) }))
            }
            placeholder="What's happening? Give ticket holders a reason to check the feed…"
            rows={4}
            maxLength={MAX_CAPTION_LENGTH}
            disabled={postUpdate.isPending}
          />
          <div className="flex justify-end">
            <span
              className={`text-xs ${
                state.caption.length > MAX_CAPTION_LENGTH ? 'text-red-600' : 'text-slate-500'
              }`}
            >
              {state.caption.length} / {MAX_CAPTION_LENGTH}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Event (optional)</label>
          <SearchableSelect
            value={state.eventId}
            onValueChange={(eventId) => setState((s) => ({ ...s, eventId }))}
            options={eventOptions}
            placeholder="General update (no event)"
            searchPlaceholder="Search events…"
            disabled={postUpdate.isPending}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <Button
            onClick={() => postUpdate.mutate()}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-orange-600 to-amber-600"
          >
            {postUpdate.isPending
              ? kind === 'video'
                ? 'Processing…'
                : 'Posting…'
              : 'Post update'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

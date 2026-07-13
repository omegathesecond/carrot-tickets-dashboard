import { UpdateComposer } from '@/components/updates/UpdateComposer';

/**
 * Organizer composer for the public Discover feed — post a short video/image
 * "update", optionally attached to a published event. v1 is composer-only;
 * a management/history view can follow once organizers ask for it.
 */
export function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Post an update</h1>
        <p className="text-sm text-slate-500">
          Share a short video or image with ticket holders on the Discover feed.
        </p>
      </div>
      <div className="max-w-2xl">
        <UpdateComposer />
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Choose an image, hand the file to the caller's uploader, and report the URL
 * it returns. Deliberately ignorant of endpoints: the menu form and the
 * catalogue form pass different uploaders.
 *
 * A failed upload leaves `value` alone. An organizer replacing the photo on a
 * saved item must not lose the photo that is already live because the new one
 * was too large.
 */
export function ImageUploadField({
  value,
  onChange,
  onUpload,
}: {
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await onUpload(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && <img src={value} alt="Selected image" className="h-16 w-16 rounded-md object-cover" />}
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
        </Button>
        {value && !busy && (
          <Button type="button" variant="ghost" onClick={() => { setError(null); onChange(''); }}>
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          data-testid="image-upload-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

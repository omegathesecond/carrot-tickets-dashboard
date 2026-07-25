import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryManagerProps {
  label: string;
  currentImages?: string[];
  onFilesSelect: (files: File[]) => void;
  onRemove: (imageUrl: string) => void;
  // Optional: fires with the full current set of not-yet-uploaded Files after
  // every add and every remove. Used by the create-event modal, where media
  // is deferred (no eventId exists yet to upload against). Existing callers
  // that don't pass it see no behavior change.
  onNewFilesChange?: (files: File[]) => void;
  maxImages?: number;
  maxSize?: number; // in MB per image
  disabled?: boolean;
  className?: string;
}

export function GalleryManager({
  label,
  currentImages = [],
  onFilesSelect,
  onRemove,
  onNewFilesChange,
  maxImages = 10,
  maxSize = 10,
  disabled = false,
  className,
}: GalleryManagerProps) {
  const [previews, setPreviews] = useState<{ url: string; isNew: boolean; file?: File }[]>(
    currentImages.map(url => ({ url, isNew: false }))
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onNewFilesChange?.(previews.filter(p => p.isNew && p.file).map(p => p.file as File));
    // Intentionally omit onNewFilesChange from deps: callers pass an inline
    // function; re-emitting only when the preview set actually changes is
    // what we want (and avoids a fire loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    // Check max images limit
    if (previews.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const newPreviews: { url: string; isNew: boolean; file?: File }[] = [];

    for (const file of files) {
      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        setError(`File size must be less than ${maxSize}MB`);
        continue;
      }

      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Invalid file type. Only JPEG, PNG, and WEBP allowed');
        continue;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push({ url: reader.result as string, isNew: true, file });
        if (newPreviews.length === validFiles.length) {
          setPreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    }

    if (validFiles.length > 0) {
      setError(null);
      onFilesSelect(validFiles);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Removes by index rather than by url: two distinct picked files can
  // legitimately produce the same data-URI preview (identical bytes), so
  // matching on url alone could remove more than one entry.
  const handleRemove = (index: number, imageUrl: string, isNew: boolean) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
    if (!isNew) {
      onRemove(imageUrl);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const canAddMore = previews.length < maxImages;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-900">{label}</label>
        <span className="text-xs text-slate-500">
          {previews.length} / {maxImages} images
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {previews.map((preview, index) => (
          <div
            key={`${preview.url}-${index}`}
            className="relative group aspect-square"
          >
            <div className="relative w-full h-full bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200">
              <img
                src={preview.url}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(index, preview.url, preview.isNew)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {canAddMore && (
          <div
            onClick={handleClick}
            className={cn(
              'aspect-square bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors cursor-pointer flex flex-col items-center justify-center',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 text-center px-2">
              Add images
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || !canAddMore}
        multiple
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <p className="text-xs text-slate-500">
        Upload up to {maxImages} images. Max {maxSize}MB each. Supports JPEG, PNG, WEBP.
      </p>
    </div>
  );
}

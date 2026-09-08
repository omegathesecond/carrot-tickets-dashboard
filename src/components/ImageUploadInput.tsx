import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadInputProps {
  label: string;
  currentImageUrl?: string;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  accept?: string;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

export function ImageUploadInput({
  label,
  currentImageUrl,
  onFileSelect,
  onRemove,
  accept = 'image/jpeg,image/png,image/webp',
  maxSize = 5,
  disabled = false,
  className,
}: ImageUploadInputProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (accept && !accept.split(',').some(type => file.type === type.trim())) {
      setError('Invalid file type');
      return;
    }

    setError(null);
    // Upload the original file as-is — no cropping, resizing or re-encoding.
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onFileSelect(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-slate-900">{label}</label>

      {preview ? (
        <div className="relative group">
          <div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleClick}
                  disabled={disabled}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Change
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={disabled}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={cn(
            'relative w-full h-48 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <ImageIcon className="h-12 w-12 mb-3 text-slate-400" />
            <p className="text-sm font-medium">Click to upload {label.toLowerCase()}</p>
            <p className="text-xs mt-1">Max size: {maxSize}MB</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A barcode input that can also be filled by the camera.
 *
 * The text input is always present and always the source of truth — a laptop
 * with no webcam, or any page not on HTTPS (browsers gate getUserMedia on a
 * secure context), sees exactly the field that existed before this component.
 * Scanning and photo decoding only ever WRITE into it; no failure path clears
 * what the organizer typed.
 *
 * The installed @zxing/browser (0.2.1) has no `reset()` on the reader —
 * `decodeFromVideoDevice` resolves to an `IScannerControls` object whose
 * `stop()` is what ends the scan loop and releases the camera.
 */
export function BarcodeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const hasCamera =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const reader = () => (readerRef.current ??= new BrowserMultiFormatReader());

  // A camera left running after the component unmounts is a lit LED and a
  // battery drain the organizer cannot explain, so stop it on the way out.
  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  const accept = (text: string) => {
    setMessage(null);
    setScanning(false);
    controlsRef.current?.stop();
    controlsRef.current = null;
    onChange(text);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const url = URL.createObjectURL(file);
    try {
      const result = await reader().decodeFromImageElement(url);
      accept(result.getText());
    } catch {
      // Distinguishing "no barcode in this photo" from a broken component is
      // the whole point — a silent no-op here reads as the button not working.
      setMessage('No barcode found in that image. Try again, or type it.');
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startScan = async () => {
    setMessage(null);
    setScanning(true);
    try {
      const controls = await reader().decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => { if (result) accept(result.getText()); },
      );
      controlsRef.current = controls;
    } catch (err: any) {
      setScanning(false);
      setMessage(
        err?.name === 'NotAllowedError'
          ? 'Camera blocked. Allow camera access, or use a photo.'
          : 'Could not start the camera. Use a photo, or type the barcode.',
      );
    }
  };

  const stopScan = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { setMessage(null); onChange(e.target.value); }}
          placeholder="6001240100015"
        />
        {hasCamera && (
          <Button type="button" variant="outline" onClick={scanning ? stopScan : startScan}>
            {scanning ? 'Stop' : 'Scan'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          Photo
        </Button>
        <input
          ref={fileRef}
          data-testid="barcode-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>

      {scanning && (
        <video ref={videoRef} className="w-full rounded-md border" muted playsInline />
      )}

      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}

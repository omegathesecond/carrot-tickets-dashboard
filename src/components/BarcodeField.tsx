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
  // decodeFromVideoDevice awaits the native permission prompt, which can sit
  // open indefinitely. A single "cancelled" boolean isn't enough: Scan, Stop,
  // Scan again would clear it for the *second* attempt while the *first*
  // attempt's prompt is still pending, so a late grant from the first would
  // get wrongly adopted. Each call to startScan claims the next generation
  // number instead, so only the attempt that is still current when its
  // promise resolves gets to keep the stream — every superseded one stops
  // its own controls and is otherwise ignored.
  const scanGenerationRef = useRef(0);

  const hasCamera =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const reader = () => (readerRef.current ??= new BrowserMultiFormatReader());

  // A camera left running after the component unmounts is a lit LED and a
  // battery drain the organizer cannot explain, so stop it on the way out.
  useEffect(() => () => {
    scanGenerationRef.current++;
    controlsRef.current?.stop();
  }, []);

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
      // decodeFromImageElement treats a string argument as a DOM element id
      // (document.getElementById), not a URL — decodeFromImageUrl is the one
      // that actually builds an <img>, sets its src, and waits for it to load.
      const result = await reader().decodeFromImageUrl(url);
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
    const generation = ++scanGenerationRef.current;
    try {
      const controls = await reader().decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => { if (result) accept(result.getText()); },
      );
      if (scanGenerationRef.current !== generation) {
        // Stop was clicked, the field unmounted, or a newer scan attempt has
        // since started while this one's permission prompt was still open.
        // Whoever holds the current generation owns controlsRef; this stream
        // belongs to a superseded attempt and must be killed the instant it
        // exists, or nothing is left to stop it.
        controls.stop();
        return;
      }
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
    scanGenerationRef.current++;
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

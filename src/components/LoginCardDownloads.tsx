import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { buildLoginCardsPdf, loginCardFilename, renderLoginCard, type LoginCard } from '@/lib/operatorLoginCards';
import { saveBlob } from '@/lib/ticketDownloads';

export function LoginCardDownloads({ card }: { card: LoginCard }) {
  const [prepared, setPrepared] = useState<{ file: File; fingerprint: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { operatorName, stallName, phoneNumber, loginCode, pin } = card;
  const fingerprint = JSON.stringify([operatorName, stallName, phoneNumber, loginCode, pin]);
  const image = prepared?.fingerprint === fingerprint ? prepared.file : null;
  const canShare = !!image && typeof navigator.share === 'function' && navigator.canShare?.({ files: [image] }) === true;
  useEffect(() => {
    let active = true; setPrepared(null); setError(''); setConfirmed(false);
    renderLoginCard({ operatorName, stallName, phoneNumber, loginCode, pin }).then(blob => {
      if (active) setPrepared({ fingerprint, file: new File([blob], loginCardFilename({ operatorName, stallName, phoneNumber, loginCode, pin }, 'png'), { type: 'image/png' }) });
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not prepare the login card.'); });
    return () => { active = false; };
  }, [operatorName, stallName, phoneNumber, loginCode, pin, attempt, fingerprint]);
  const savePdf = async () => {
    if (!image) return; setBusy(true);
    try { saveBlob(await buildLoginCardsPdf([image]), loginCardFilename(card, 'pdf')); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the PDF.'); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!image || !confirmed) return;
    if (!navigator.share || !navigator.canShare?.({ files: [image] })) { toast.error('This browser cannot share files. Download the image and send it to the named person.'); return; }
    setSharing(true);
    try { await navigator.share({ files: [image], title: `${operatorName} — ${stallName}`, text: `Login card for ${operatorName} at ${stallName}.` }); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error(e instanceof Error ? e.message : 'Could not share this login card.'); }
    finally { setSharing(false); }
  };
  return <div className="space-y-3 border-t pt-4">
    <p className="text-xs text-muted-foreground break-all">File: {loginCardFilename(card, 'png')}</p>
    {error ? <div role="alert" className="space-y-2"><p className="text-sm text-red-600">{error}</p><Button size="sm" variant="outline" onClick={() => setAttempt(v => v + 1)}>Retry image</Button></div> : !image ? <p className="text-sm text-muted-foreground">Preparing login image…</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={!image} onClick={() => image && saveBlob(image, image.name)}>Download image</Button>
      <Button variant="outline" size="sm" disabled={!image || busy} onClick={savePdf}>Download PDF</Button>
    </div>
    {canShare ? <><label className="flex items-start gap-2 text-sm">
      <Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />
      <span>I’m sending this to <strong>{operatorName}</strong>{phoneNumber ? ` (${phoneNumber})` : ''} at <strong>{stallName}</strong>.</span>
    </label>
    <Button size="sm" disabled={!image || !confirmed || sharing} onClick={share}>{sharing ? 'Sharing…' : 'Share this person’s image'}</Button></> : image ? <p className="text-sm text-muted-foreground">Download the named image, then attach it to {operatorName}’s chat. This browser does not support direct file sharing.</p> : null}
  </div>;
}

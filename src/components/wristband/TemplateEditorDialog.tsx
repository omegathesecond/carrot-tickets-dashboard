import { useState } from 'react';
import { toast } from 'sonner';
import { bandPitchMm, saveCustomTemplate, type SheetTemplate } from '@/lib/wristband/templates';
import { pitchFromSpanMm } from '@/lib/wristband/layout';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from './ElementFields';

type FormState = Omit<SheetTemplate, 'key'>;

const BLANK: FormState = {
  name: '', pageWidthMm: 250, pageHeightMm: 190, bandWidthMm: 250, bandHeightMm: 19,
  marginTopMm: 0, marginLeftMm: 0, gapYMm: 0, bandsPerSheet: 10, tabZoneMm: 30, pitchMm: 19,
};

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `custom-${base || 'template'}`;
}

/**
 * The stack spans (n-1) PITCHES plus one band height — pitch is what carries a
 * band down the sheet, so validating against bandHeight+gap would pass exactly
 * the templates that print band 1 perfectly and band 10 off the paper.
 */
function fitError(f: FormState): string | null {
  const pitch = bandPitchMm(f as SheetTemplate);
  if (pitch <= 0) {
    return 'Band spacing must be greater than zero, or every band prints on top of the last.';
  }
  if (f.bandHeightMm > pitch) {
    return `Bands are ${f.bandHeightMm}mm tall but spaced ${pitch}mm apart — each would overlap the next die-cut.`;
  }
  const stackHeight = f.marginTopMm + (f.bandsPerSheet - 1) * pitch + f.bandHeightMm;
  if (stackHeight > f.pageHeightMm) {
    return `Bands don't fit vertically: ${stackHeight.toFixed(1)}mm needed, sheet is only ${f.pageHeightMm}mm tall.`;
  }
  if (f.marginLeftMm + f.bandWidthMm > f.pageWidthMm) {
    return `Bands don't fit horizontally: ${(f.marginLeftMm + f.bandWidthMm).toFixed(1)}mm needed, sheet is only ${f.pageWidthMm}mm wide.`;
  }
  if (f.tabZoneMm >= f.bandWidthMm) {
    return `The ${f.tabZoneMm}mm tab zone covers the whole ${f.bandWidthMm}mm band — nothing would be printable.`;
  }
  return null;
}

export function TemplateEditorDialog({ open, onOpenChange, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (t: SheetTemplate) => void;
}) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [spanInput, setSpanInput] = useState('');

  const span = Number(spanInput);
  const derivedPitch =
    spanInput.trim() !== '' && Number.isFinite(span) && span > 0 && form.bandsPerSheet > 1
      ? pitchFromSpanMm(span, form.bandsPerSheet)
      : null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const fit = fitError(form);
    if (fit) {
      setError(fit);
      return;
    }
    const template: SheetTemplate = { ...form, key: slugify(form.name) };
    saveCustomTemplate(template);
    toast.success(`Saved "${template.name}"`);
    onSaved(template);
    setForm(BLANK);
    setSpanInput('');
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setForm(BLANK); setSpanInput(''); setError(null); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New sheet template</DialogTitle>
          <DialogDescription>All dimensions are millimetres.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
          </div>
          <Field label="Page width (mm)">
            <Input type="number" value={form.pageWidthMm} onChange={(e) => set('pageWidthMm', Number(e.target.value))} />
          </Field>
          <Field label="Page height (mm)">
            <Input type="number" value={form.pageHeightMm} onChange={(e) => set('pageHeightMm', Number(e.target.value))} />
          </Field>
          <Field label="Band width (mm)">
            <Input type="number" value={form.bandWidthMm} onChange={(e) => set('bandWidthMm', Number(e.target.value))} />
          </Field>
          <Field label="Band height (mm)">
            <Input type="number" value={form.bandHeightMm} onChange={(e) => set('bandHeightMm', Number(e.target.value))} />
          </Field>
          <Field label="Margin top (mm)">
            <Input type="number" value={form.marginTopMm} onChange={(e) => set('marginTopMm', Number(e.target.value))} />
          </Field>
          <Field label="Margin left (mm)">
            <Input type="number" value={form.marginLeftMm} onChange={(e) => set('marginLeftMm', Number(e.target.value))} />
          </Field>
          <Field label="Band spacing / pitch (mm)">
            <Input
              type="number" step={0.05} value={form.pitchMm ?? form.bandHeightMm + form.gapYMm}
              onChange={(e) => set('pitchMm', Number(e.target.value))}
            />
          </Field>
          <Field label="Bands per sheet">
            <Input
              type="number" min={1} value={form.bandsPerSheet}
              onChange={(e) => set('bandsPerSheet', Number(e.target.value))}
            />
          </Field>
          <Field label="Tab keep-out zone (mm)">
            <Input type="number" value={form.tabZoneMm} onChange={(e) => set('tabZoneMm', Number(e.target.value))} />
          </Field>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <Field label={`Or measure band 1 top \u2192 band ${form.bandsPerSheet} top (mm)`}>
            <Input
              className="bg-white" type="number" step={0.5} value={spanInput}
              placeholder={(bandPitchMm(form as SheetTemplate) * (form.bandsPerSheet - 1)).toFixed(1)}
              onChange={(e) => setSpanInput(e.target.value)}
            />
          </Field>
          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-600">
            {derivedPitch === null
              ? 'Measuring across every band divides your ruler error by ' + (form.bandsPerSheet - 1) + '.'
              : `That is ${derivedPitch.toFixed(2)}mm per band.`}
          </p>
          {derivedPitch !== null && (
            <Button
              type="button" size="sm" variant="secondary" className="mt-2"
              onClick={() => { set('pitchMm', Number(derivedPitch.toFixed(2))); setSpanInput(''); }}
            >
              Use as spacing
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

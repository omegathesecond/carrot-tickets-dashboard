import { useState } from 'react';
import { toast } from 'sonner';
import { saveCustomTemplate, type SheetTemplate } from '@/lib/wristband/templates';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from './ElementFields';

type FormState = Omit<SheetTemplate, 'key'>;

const BLANK: FormState = {
  name: '', pageWidthMm: 210, pageHeightMm: 297, bandWidthMm: 254, bandHeightMm: 25.4,
  marginTopMm: 10, marginLeftMm: 10, gapYMm: 1, bandsPerSheet: 10, tabZoneMm: 20,
};

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `custom-${base || 'template'}`;
}

/**
 * Fit check mirrors Task 7's DEFAULT_TEMPLATES test: the bands must stack
 * inside the page height, and one band's width must fit inside the page
 * width, both accounting for margins/gaps. Invalid → inline error, no save.
 */
function fitError(f: FormState): string | null {
  const stackHeight = f.marginTopMm + f.bandsPerSheet * f.bandHeightMm + (f.bandsPerSheet - 1) * f.gapYMm;
  if (stackHeight > f.pageHeightMm) {
    return `Bands don't fit vertically: ${stackHeight.toFixed(1)}mm needed, page is only ${f.pageHeightMm}mm tall.`;
  }
  if (f.marginLeftMm + f.bandWidthMm > f.pageWidthMm) {
    return `Bands don't fit horizontally: ${(f.marginLeftMm + f.bandWidthMm).toFixed(1)}mm needed, page is only ${f.pageWidthMm}mm wide.`;
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
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setForm(BLANK); setError(null); } }}>
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
          <Field label="Gap between bands (mm)">
            <Input type="number" value={form.gapYMm} onChange={(e) => set('gapYMm', Number(e.target.value))} />
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

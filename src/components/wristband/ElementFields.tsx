import type { ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  imageEffectiveDpi, LOW_DPI_THRESHOLD, FONT_FAMILIES, qrDarkColor, QR_LIGHT_COLOR,
  type WristbandElement, type TextElement, type ImageElement, type ShapeElement, type QrElement,
} from '@/lib/wristband/design';
import { qrScanVerdict, type QrScanVerdict } from '@/lib/wristband/ink';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

/** Per-type property fields for ElementInspector — split out to keep that
 *  file under the ~250-line budget. */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function TextFields({ el, update }: { el: TextElement; update: (p: Partial<WristbandElement>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Text">
        <Textarea value={el.text} onChange={(e) => update({ text: e.target.value })} rows={3} />
      </Field>
      <Field label="Font">
        <Select value={el.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (mm)">
          <Input
            type="number" step={0.5} value={el.fontSizeMm}
            onChange={(e) => update({ fontSizeMm: Number(e.target.value) })}
          />
        </Field>
        <Field label="Color">
          <Input type="color" value={el.fill} onChange={(e) => update({ fill: e.target.value })} />
        </Field>
      </div>
      <Field label="Style">
        <Select
          value={el.fontStyle}
          onValueChange={(v) => update({ fontStyle: v as TextElement['fontStyle'] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
            <SelectItem value="italic">Italic</SelectItem>
            <SelectItem value="bold italic">Bold italic</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Align">
        <Select value={el.align} onValueChange={(v) => update({ align: v as TextElement['align'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Width (mm)">
        <Input type="number" value={el.width} onChange={(e) => update({ width: Number(e.target.value) })} />
      </Field>
    </div>
  );
}

export function ImageFields({ el, update }: { el: ImageElement; update: (p: Partial<WristbandElement>) => void }) {
  const dpi = imageEffectiveDpi(el);
  const lowDpi = dpi < LOW_DPI_THRESHOLD;
  const ratio = el.naturalWidth / el.naturalHeight;

  return (
    <div className="space-y-3">
      {lowDpi && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>⚠ {Math.round(dpi)} DPI — below 300 DPI, may print soft</span>
        </div>
      )}
      {!lowDpi && <p className="text-xs text-muted-foreground">{Math.round(dpi)} DPI at current size</p>}

      <div className="space-y-2 rounded-md border p-2">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={!!el.tint}
            onCheckedChange={(v) => update({ tint: v === true ? '#1d4ed8' : null })}
          />
          <span className="text-xs font-medium">Print in one color</span>
        </label>
        {el.tint && (
          <>
            <Input
              type="color" value={el.tint}
              onChange={(e) => update({ tint: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Redraws the artwork in this color, using how dark each part is to decide how much ink
              to lay down. White areas drop out rather than filling in, so a logo on white and the
              same logo on transparency both come out as just the mark.
            </p>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <Input
            type="number" value={el.width}
            onChange={(e) => {
              const width = Number(e.target.value);
              update({ width, height: width / ratio });
            }}
          />
        </Field>
        <Field label="Height (mm)">
          <Input
            type="number" value={el.height}
            onChange={(e) => {
              const height = Number(e.target.value);
              update({ height, width: height * ratio });
            }}
          />
        </Field>
      </div>
    </div>
  );
}

export function ShapeFields({ el, update }: { el: ShapeElement; update: (p: Partial<WristbandElement>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Shape">
        <Select value={el.shape} onValueChange={(v) => update({ shape: v as ShapeElement['shape'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rect">Rectangle</SelectItem>
            <SelectItem value="ellipse">Ellipse</SelectItem>
            <SelectItem value="line">Line</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fill">
          <Input type="color" value={el.fill} onChange={(e) => update({ fill: e.target.value })} />
        </Field>
        <Field label="Stroke">
          <Input
            type="color" value={el.stroke || '#000000'}
            onChange={(e) => update({ stroke: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stroke width (mm)">
          <Input
            type="number" step={0.1} value={el.strokeWidthMm}
            onChange={(e) => update({ strokeWidthMm: Number(e.target.value) })}
          />
        </Field>
        {el.shape === 'rect' && (
          <Field label="Corner radius (mm)">
            <Input
              type="number" step={0.5} value={el.cornerRadiusMm}
              onChange={(e) => update({ cornerRadiusMm: Number(e.target.value) })}
            />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <Input type="number" value={el.width} onChange={(e) => update({ width: Number(e.target.value) })} />
        </Field>
        <Field label="Height (mm)">
          <Input type="number" value={el.height} onChange={(e) => update({ height: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
}

export function QrFields({ el, update }: { el: QrElement; update: (p: Partial<WristbandElement>) => void }) {
  const ink = qrDarkColor(el);
  const verdict = qrScanVerdict(ink, QR_LIGHT_COLOR);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (mm)">
          <Input
            type="number" step={0.5} value={el.sizeMm}
            onChange={(e) => update({ sizeMm: Number(e.target.value) })}
          />
        </Field>
        <Field label="Code color">
          <Input type="color" value={ink} onChange={(e) => update({ darkColor: e.target.value })} />
        </Field>
      </div>

      <ScanVerdict verdict={verdict} />

      <p className="text-xs text-muted-foreground">
        The QR placeholder is replaced with each ticket's real code at print time. The code stays on
        a white background so scanners have a quiet zone to lock on to.
      </p>
    </div>
  );
}

/**
 * Contrast readout for the chosen QR colour. Shown always, not only on
 * failure: the ratio is the thing worth watching while dragging a colour
 * picker, and a silent green state teaches what "enough" looks like.
 */
function ScanVerdict({ verdict }: { verdict: QrScanVerdict }) {
  const tone = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    marginal: 'border-amber-300 bg-amber-50 text-amber-900',
    unscannable: 'border-rose-300 bg-rose-50 text-rose-900',
  }[verdict.level];
  const Icon = verdict.level === 'ok' ? Check : AlertTriangle;

  return (
    <div className={`flex items-start gap-1.5 rounded-md border p-2 text-xs ${tone}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-mono tabular-nums">{verdict.ratio.toFixed(1)}:1</span> contrast
        {verdict.message ? ` — ${verdict.message}` : ' — scans well.'}
      </span>
    </div>
  );
}

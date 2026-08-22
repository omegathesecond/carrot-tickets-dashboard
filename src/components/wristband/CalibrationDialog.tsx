import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  bandPitchMm, saveCalibration, type CalibrationOffset, type SheetTemplate,
} from '@/lib/wristband/templates';
import { pitchFromSpanMm } from '@/lib/wristband/layout';
import { buildCalibrationPdf, openPdf } from '@/lib/wristband/pdf';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Per-printer alignment. dx/dy slide every band together; pitch changes the
 * distance between them.
 *
 * The pitch control is the one that matters when later bands drift: a spacing
 * error is multiplied by the band index, so dx/dy can only ever line up the
 * first band while the rest walk off the sheet.
 */
export function CalibrationDialog({ open, onOpenChange, template, offset, onChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: SheetTemplate;
  offset: CalibrationOffset;
  onChange: (offset: CalibrationOffset) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [measuredSpan, setMeasuredSpan] = useState('');

  useEffect(() => {
    if (!open) setMeasuredSpan('');
  }, [open]);

  /** Steppers ARE the saved value — persist on every change, no save button. */
  function update(patch: Partial<CalibrationOffset>) {
    const next = { ...offset, ...patch };
    saveCalibration(template.key, next);
    onChange(next);
  }

  const templatePitch = bandPitchMm(template);
  const currentPitch = templatePitch + offset.dPitchMm;
  const expectedSpan = currentPitch * (template.bandsPerSheet - 1);

  const span = Number(measuredSpan);
  const spanUsable = measuredSpan.trim() !== '' && Number.isFinite(span) && span > 0;
  const impliedPitch = spanUsable ? pitchFromSpanMm(span, template.bandsPerSheet) : null;
  const impliedNudge = impliedPitch === null ? null : impliedPitch - templatePitch;

  async function handlePrintCalibrationPage() {
    setPrinting(true);
    try {
      openPdf(await buildCalibrationPdf(template, offset));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate calibration page');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calibrate printer</DialogTitle>
          <DialogDescription>
            Print the calibration page, hold it against a “{template.name}” sheet on a window, then
            line the outlines up with the die-cuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Across (mm)</Label>
            <Input
              type="number" step={0.1} value={offset.dxMm}
              onChange={(e) => update({ dxMm: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">+ moves right</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Down (mm)</Label>
            <Input
              type="number" step={0.1} value={offset.dyMm}
              onChange={(e) => update({ dyMm: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">+ moves down</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Spacing (mm)</Label>
            <Input
              type="number" step={0.05} value={offset.dPitchMm}
              onChange={(e) => update({ dPitchMm: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">per band</p>
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <Label className="text-xs">
            Measured band 1 top → band {template.bandsPerSheet} top on the real sheet (mm)
          </Label>
          <Input
            className="mt-1 bg-white" type="number" step={0.5} placeholder={expectedSpan.toFixed(1)}
            value={measuredSpan} onChange={(e) => setMeasuredSpan(e.target.value)}
          />
          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-600">
            This template spans {expectedSpan.toFixed(1)}mm at {currentPitch.toFixed(2)}mm per band.
          </p>
          {impliedPitch !== null && impliedNudge !== null && (
            <>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-900">
                Your sheet needs {impliedPitch.toFixed(2)}mm per band
                {' '}({impliedNudge >= 0 ? '+' : ''}{impliedNudge.toFixed(2)}mm from the template).
              </p>
              <Button
                size="sm" variant="secondary" className="mt-2"
                disabled={Math.abs(impliedNudge - offset.dPitchMm) < 0.005}
                onClick={() => {
                  update({ dPitchMm: Number(impliedNudge.toFixed(2)) });
                  toast.success(`Spacing set to ${impliedPitch.toFixed(2)}mm per band`);
                }}
              >
                Use this spacing
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          If the 100mm bar on the printed page does not measure 100mm, the printer is scaling the
          page. Fix that in the print dialog — set Actual size, not “fit to page” — rather than
          compensating here, because scaling shrinks the QR codes too.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost" size="sm"
            disabled={offset.dxMm === 0 && offset.dyMm === 0 && offset.dPitchMm === 0}
            onClick={() => update({ dxMm: 0, dyMm: 0, dPitchMm: 0 })}
          >
            Reset
          </Button>
          <Button disabled={printing} onClick={handlePrintCalibrationPage}>
            {printing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Print calibration page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

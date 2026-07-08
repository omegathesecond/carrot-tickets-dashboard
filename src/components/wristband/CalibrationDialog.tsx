import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { loadCalibration, saveCalibration, type SheetTemplate } from '@/lib/wristband/templates';
import { buildCalibrationPdf, openPdf } from '@/lib/wristband/pdf';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Per-printer dx/dy nudge (mm) so band outlines line up with the real
 * die-cuts. Persists per template key via saveCalibration on every change —
 * there's no separate "save" step, the steppers ARE the saved value.
 */
export function CalibrationDialog({ open, onOpenChange, template }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: SheetTemplate;
}) {
  const [dxMm, setDxMm] = useState(0);
  const [dyMm, setDyMm] = useState(0);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const offset = loadCalibration(template.key);
    setDxMm(offset.dxMm);
    setDyMm(offset.dyMm);
  }, [open, template.key]);

  function updateDx(value: number) {
    setDxMm(value);
    saveCalibration(template.key, { dxMm: value, dyMm });
  }

  function updateDy(value: number) {
    setDyMm(value);
    saveCalibration(template.key, { dxMm, dyMm: value });
  }

  async function handlePrintCalibrationPage() {
    setPrinting(true);
    try {
      const bytes = await buildCalibrationPdf(template, { dxMm, dyMm });
      openPdf(bytes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate calibration page');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Calibrate printer</DialogTitle>
          <DialogDescription>
            Print the calibration page, hold it against a Tyvek sheet on a window, then nudge dx/dy until the
            outlines sit on "{template.name}"'s die-cuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>dx — mm, +right</Label>
            <Input type="number" step={0.1} value={dxMm} onChange={(e) => updateDx(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>dy — mm, +down</Label>
            <Input type="number" step={0.1} value={dyMm} onChange={(e) => updateDy(Number(e.target.value))} />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={printing} onClick={handlePrintCalibrationPage}>
            {printing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Print calibration page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

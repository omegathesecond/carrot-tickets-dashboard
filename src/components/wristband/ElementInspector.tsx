import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Type, Image as ImageIcon, Square, QrCode, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { SheetTemplate } from '@/lib/wristband/templates';
import type { EditorState, EditorAction } from '@/lib/wristband/editorState';
import {
  createTextElement, createShapeElement, createQrElement, createImageElement,
  type WristbandElement,
} from '@/lib/wristband/design';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, TextFields, ImageFields, ShapeFields, QrFields } from './ElementFields';

/**
 * Right-hand properties column — Add buttons + background when nothing is
 * selected, per-type fields + common transform fields when an element is.
 */
export function ElementInspector({ state, dispatch, template, eventId }: {
  state: EditorState; dispatch: (a: EditorAction) => void; template: SheetTemplate; eventId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const el = state.elements.find((e) => e.id === state.selectedId) ?? null;
  const hasQr = state.elements.some((e) => e.type === 'qr');

  const update = (patch: Partial<WristbandElement>) => {
    if (!el) return;
    dispatch({ type: 'update', id: el.id, patch });
  };

  const addImageFromUrl = async (url: string) => {
    const natural = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
    dispatch({
      type: 'add',
      element: createImageElement(url, natural.width, natural.height, template.bandHeightMm),
    });
  };

  const handleAddImageFile = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await apiClient.wristbands.uploadArtwork(eventId, file);
      await addImageFromUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload artwork');
    } finally {
      setUploading(false);
    }
  };

  // Carrot brand stamps served from the dashboard's own /brand/ folder —
  // stable relative URLs, so saved designs survive redeploys.
  const handleAddBrand = async (asset: 'carrot-mark.png' | 'carrot-lockup-domain.png') => {
    try {
      await addImageFromUrl(`/brand/${asset}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load brand asset');
    }
  };

  // The Add section stays visible regardless of selection — adding an element
  // auto-selects it, and users add several in a row (text, then QR, then art).
  const addSection = (
    <div>
      <h3 className="text-sm font-semibold">Add element</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline" size="sm"
          onClick={() => dispatch({ type: 'add', element: createTextElement() })}
        >
          <Type className="mr-1.5 h-4 w-4" /> Text
        </Button>
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="mr-1.5 h-4 w-4" /> Image
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => dispatch({ type: 'add', element: createShapeElement() })}
        >
          <Square className="mr-1.5 h-4 w-4" /> Shape
        </Button>
        <Button
          variant="outline" size="sm" disabled={hasQr}
          title={hasQr ? 'Only one QR code per design' : undefined}
          onClick={() => dispatch({ type: 'add', element: createQrElement() })}
        >
          <QrCode className="mr-1.5 h-4 w-4" /> QR
        </Button>
      </div>
      <input
        ref={fileInputRef} type="file" className="hidden"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleAddImageFile(file);
        }}
      />
      <h3 className="mt-3 text-sm font-semibold">Brand</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => void handleAddBrand('carrot-mark.png')}>
          <img src="/brand/carrot-mark.png" alt="" className="mr-1.5 h-4 w-auto" /> Logo
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleAddBrand('carrot-lockup-domain.png')}>
          <img src="/brand/carrot-mark.png" alt="" className="mr-1.5 h-4 w-auto" /> Logo + name
        </Button>
      </div>
    </div>
  );

  if (!el) {
    return (
      <div className="w-72 shrink-0 space-y-4 border-l p-4">
        {addSection}
        <Field label="Background color">
          <Input
            type="color" value={state.background}
            onChange={(e) => dispatch({ type: 'setBackground', color: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 space-y-4 border-l p-4">
      {addSection}

      <div className="flex items-center justify-between border-t pt-3">
        <h3 className="text-sm font-semibold capitalize">{el.type} properties</h3>
        <Button
          variant="ghost" size="icon"
          onClick={() => dispatch({ type: 'remove', id: el.id })}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {el.type === 'text' && <TextFields el={el} update={update} />}
      {el.type === 'image' && <ImageFields el={el} update={update} />}
      {el.type === 'shape' && <ShapeFields el={el} update={update} />}
      {el.type === 'qr' && <QrFields el={el} update={update} />}

      <div className="grid grid-cols-2 gap-2 border-t pt-3">
        <Field label="X (mm)">
          <Input type="number" value={el.x} onChange={(e) => update({ x: Number(e.target.value) })} />
        </Field>
        <Field label="Y (mm)">
          <Input type="number" value={el.y} onChange={(e) => update({ y: Number(e.target.value) })} />
        </Field>
        <Field label="Rotation (°)">
          <Input type="number" value={el.rotation} onChange={(e) => update({ rotation: Number(e.target.value) })} />
        </Field>
        <Field label="Opacity">
          <Input
            type="number" min={0} max={1} step={0.05} value={el.opacity}
            onChange={(e) => update({ opacity: Number(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}

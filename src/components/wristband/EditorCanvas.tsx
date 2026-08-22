import { useEffect, useRef } from 'react';
import {
  Stage, Layer, Rect, Text as KText, Image as KImage, Ellipse, Line, Transformer, Group,
} from 'react-konva';
import type Konva from 'konva';
import type { SheetTemplate } from '@/lib/wristband/templates';
import type { EditorState, EditorAction } from '@/lib/wristband/editorState';
import type {
  WristbandElement, ImageElement, ShapeElement, TextElement, QrElement,
} from '@/lib/wristband/design';
import { qrDarkColor } from '@/lib/wristband/design';
import { elementNodeAttrs } from '@/lib/wristband/renderBand';
import { findNodeById } from '@/lib/wristband/findNode';
import { useImage } from './useImage';

const BASE_PX_PER_MM = 4;

/** Attrs shared by every element's outer Konva node (position/selection/drag/transform). */
type CommonAttrs = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  draggable: boolean;
  onClick: () => void;
  onTap: () => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
};

/**
 * react-konva editor canvas — band-sized Stage at `pxPerMm = 4 * zoom`.
 * Renders each element via elementNodeAttrs() (the same mm→px conversion
 * used by the print pipeline) so what's on screen matches what prints.
 */
export function EditorCanvas({ template, state, dispatch, zoom }: {
  template: SheetTemplate; state: EditorState; dispatch: (a: EditorAction) => void; zoom: number;
}) {
  const pxPerMm = BASE_PX_PER_MM * zoom;
  const w = template.bandWidthMm * pxPerMm;
  const h = template.bandHeightMm * pxPerMm;
  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Attach the transformer to the selected node.
  useEffect(() => {
    const tr = trRef.current, stage = stageRef.current;
    if (!tr || !stage) return;
    const node = state.selectedId ? findNodeById(stage, state.selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [state.selectedId, state.elements]);

  const select = (id: string | null) => dispatch({ type: 'select', id });

  // Ellipses are center-positioned/center-pivoted, matching the print
  // renderer (renderBand.ts) exactly — node x/y is the CENTER, so drag/
  // transform handlers convert back to the model's top-left mm convention.
  const isEllipse = (el: WristbandElement): el is ShapeElement =>
    el.type === 'shape' && (el as ShapeElement).shape === 'ellipse';

  const onDragEnd = (el: WristbandElement) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const halfX = isEllipse(el) ? el.width / 2 : 0;
    const halfY = isEllipse(el) ? el.height / 2 : 0;
    dispatch({
      type: 'update', id: el.id,
      patch: { x: e.target.x() / pxPerMm - halfX, y: e.target.y() / pxPerMm - halfY },
    });
  };

  const onTransformEnd = (el: WristbandElement) => (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    const patch: Record<string, number> = {
      x: node.x() / pxPerMm, y: node.y() / pxPerMm, rotation: node.rotation(),
    };
    if (el.type === 'text') {
      patch.width = (el as TextElement).width * scaleX;
      patch.fontSizeMm = (el as TextElement).fontSizeMm * scaleY;
    } else if (el.type === 'qr') {
      patch.sizeMm = (el as QrElement).sizeMm * Math.max(scaleX, scaleY);
    } else {
      patch.width = (el as ImageElement | ShapeElement).width * scaleX;
      patch.height = (el as ImageElement | ShapeElement).height * scaleY;
      if (isEllipse(el)) {
        // node.x/y is the (possibly moved) center — model x/y is the
        // top-left of the NEW bounding box.
        patch.x = node.x() / pxPerMm - patch.width / 2;
        patch.y = node.y() / pxPerMm - patch.height / 2;
      }
    }
    dispatch({ type: 'update', id: el.id, patch: patch as Partial<WristbandElement> });
  };

  const commonFor = (el: WristbandElement, attrs: Record<string, unknown>): CommonAttrs => ({
    id: attrs.id as string,
    x: attrs.x as number,
    y: attrs.y as number,
    rotation: attrs.rotation as number,
    opacity: attrs.opacity as number,
    visible: attrs.visible as boolean,
    draggable: !el.locked,
    onClick: () => select(el.id),
    onTap: () => select(el.id),
    onDragEnd: onDragEnd(el),
    onTransformEnd: onTransformEnd(el),
  });

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) select(null);
  };

  const tabLineX = (template.bandWidthMm - template.tabZoneMm) * pxPerMm;
  const selectedLocked = !!state.elements.find((e) => e.id === state.selectedId)?.locked;

  return (
    <div className="flex items-center justify-center overflow-auto rounded-lg bg-slate-100 p-6">
      <Stage ref={stageRef} width={w} height={h} onMouseDown={onStageMouseDown} className="shadow-md">
        <Layer>
          {/* Band background — clicking it (not an element) deselects. */}
          <Rect
            x={0} y={0} width={w} height={h}
            fill={state.background}
            onClick={() => select(null)}
            onTap={() => select(null)}
          />

          {state.elements.map((el) => {
            const attrs = elementNodeAttrs(el, pxPerMm);
            const common = commonFor(el, attrs);
            if (el.type === 'text') {
              const t = el as TextElement;
              return (
                <KText
                  key={el.id}
                  {...common}
                  text={t.text}
                  fontFamily={t.fontFamily}
                  fontSize={attrs.fontSize as number}
                  fill={t.fill}
                  fontStyle={t.fontStyle}
                  align={t.align}
                  width={attrs.width as number}
                />
              );
            }
            if (el.type === 'image') {
              return <ImageNode key={el.id} el={el as ImageElement} common={common} attrs={attrs} />;
            }
            if (el.type === 'shape') {
              return <ShapeNode key={el.id} el={el as ShapeElement} common={common} attrs={attrs} />;
            }
            return <QrNode key={el.id} el={el as QrElement} common={common} attrs={attrs} />;
          })}

          {/* Guides — non-interactive. */}
          <Rect
            x={0} y={0} width={w} height={h}
            stroke="#dc2626" strokeWidth={1} dash={[5, 4]}
            listening={false}
          />
          <Line
            points={[tabLineX, 0, tabLineX, h]}
            stroke="#94a3b8" strokeWidth={1} dash={[5, 4]}
            listening={false}
          />

          <Transformer
            ref={trRef}
            rotateEnabled={!selectedLocked}
            resizeEnabled={!selectedLocked}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => (
              Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox
            )}
          />
        </Layer>
      </Stage>
    </div>
  );
}

function ImageNode({ el, common, attrs }: {
  el: ImageElement; common: CommonAttrs; attrs: Record<string, unknown>;
}) {
  const image = useImage(el.url, el.tint);
  return <KImage {...common} image={image} width={attrs.width as number} height={attrs.height as number} />;
}

/** Rect/line pivot on their top-left corner (mm x/y), like text/image.
 *  Ellipse mirrors the print renderer instead: positioned AND pivoted at its
 *  center; the drag/transform handlers convert back to top-left mm. */
function ShapeNode({ el, common, attrs }: {
  el: ShapeElement; common: CommonAttrs; attrs: Record<string, unknown>;
}) {
  const width = attrs.width as number;
  const height = attrs.height as number;
  const fill = attrs.fill as string | undefined;
  const stroke = attrs.stroke as string | undefined;
  const strokeWidth = attrs.strokeWidth as number;

  if (el.shape === 'rect') {
    return (
      <Rect
        {...common}
        width={width} height={height}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        cornerRadius={attrs.cornerRadius as number}
      />
    );
  }
  if (el.shape === 'ellipse') {
    // Center-positioned, center-pivoted — the exact convention the print
    // renderer uses (renderBand.ts: x = attrs.x + w/2, y = attrs.y + h/2),
    // so rotation produces identical geometry on screen and in print.
    // onDragEnd/onTransformEnd convert the center back to top-left mm.
    return (
      <Ellipse
        {...common}
        x={common.x + width / 2}
        y={common.y + height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <Line
      {...common}
      points={[0, 0, width, 0]}
      stroke={stroke || fill || '#000000'}
      strokeWidth={Math.max(1, strokeWidth)}
    />
  );
}

/** QR is a placeholder in the editor — a dashed box + "QR" label; the real
 *  code is generated per-ticket at print time (renderBand.ts). */
function QrNode({ el, common, attrs }: {
  el: QrElement; common: CommonAttrs; attrs: Record<string, unknown>;
}) {
  const size = attrs.width as number;
  const ink = qrDarkColor(el);
  return (
    <Group {...common}>
      <Rect width={size} height={size} fill="#ffffff" stroke={ink} strokeWidth={1} dash={[5, 4]} />
      <KText
        text="QR" width={size} height={size}
        align="center" verticalAlign="middle"
        fontSize={Math.max(10, size * 0.22)} fill={ink}
      />
    </Group>
  );
}

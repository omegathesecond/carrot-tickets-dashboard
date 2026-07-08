import { Stage, Layer, Rect, Text as KText, Image as KImage, Ellipse, Line, Group } from 'react-konva';
import type { SheetTemplate } from '@/lib/wristband/templates';
import type { EditorState } from '@/lib/wristband/editorState';
import type { ImageElement, ShapeElement, TextElement, WristbandElement } from '@/lib/wristband/design';
import { elementNodeAttrs } from '@/lib/wristband/renderBand';
import { useImage } from './useImage';

/** CSS px per mm for the whole preview — page and band Stages share this one
 *  scale so a band's on-page position lines up exactly with its Stage size. */
const PX_PER_MM = 0.8;

type CommonAttrs = { x: number; y: number; rotation: number; opacity: number };

/**
 * Read-only full-sheet preview — a page-shaped div holding one small,
 * non-interactive react-konva Stage per band (bandsPerSheet of them), each
 * repeating the current design. Band positions mirror layout.ts's
 * bandRectsPt math (top-down here, since this is CSS not PDF space).
 */
export function SheetPreview({ template, state }: { template: SheetTemplate; state: EditorState }) {
  const pageWidthPx = template.pageWidthMm * PX_PER_MM;
  const pageHeightPx = template.pageHeightMm * PX_PER_MM;
  const bandWidthPx = template.bandWidthMm * PX_PER_MM;
  const bandHeightPx = template.bandHeightMm * PX_PER_MM;
  const visibleElements = state.elements.filter((el) => el.visible);

  return (
    <div className="flex justify-center overflow-auto rounded-lg bg-slate-100 p-6">
      <div className="relative border bg-white shadow" style={{ width: pageWidthPx, height: pageHeightPx }}>
        {Array.from({ length: template.bandsPerSheet }, (_, i) => {
          const topMm = template.marginTopMm + i * (template.bandHeightMm + template.gapYMm);
          return (
            <div
              key={i}
              className="absolute border border-dashed border-slate-300"
              style={{
                left: template.marginLeftMm * PX_PER_MM,
                top: topMm * PX_PER_MM,
                width: bandWidthPx,
                height: bandHeightPx,
              }}
            >
              <Stage width={bandWidthPx} height={bandHeightPx} listening={false}>
                <Layer listening={false}>
                  <Rect x={0} y={0} width={bandWidthPx} height={bandHeightPx} fill={state.background} />
                  {visibleElements.map((el) => (
                    <StaticElement key={el.id} el={el} />
                  ))}
                </Layer>
              </Stage>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaticElement({ el }: { el: WristbandElement }) {
  const attrs = elementNodeAttrs(el, PX_PER_MM);
  const common: CommonAttrs = {
    x: attrs.x as number, y: attrs.y as number,
    rotation: attrs.rotation as number, opacity: attrs.opacity as number,
  };

  if (el.type === 'text') {
    const t = el as TextElement;
    return (
      <KText
        {...common}
        text={t.text} fontFamily={t.fontFamily} fontSize={attrs.fontSize as number}
        fill={t.fill} fontStyle={t.fontStyle} align={t.align} width={attrs.width as number}
      />
    );
  }
  if (el.type === 'image') {
    return <StaticImage el={el as ImageElement} common={common} attrs={attrs} />;
  }
  if (el.type === 'shape') {
    return <StaticShape el={el as ShapeElement} common={common} attrs={attrs} />;
  }
  // QR is a placeholder here too — same convention as the editor canvas: the
  // real code is generated per-ticket at print time, not at design time.
  const size = attrs.width as number;
  return (
    <Group {...common}>
      <Rect width={size} height={size} fill="#f8fafc" stroke="#64748b" strokeWidth={1} dash={[5, 4]} />
      <KText
        text="QR" width={size} height={size} align="center" verticalAlign="middle"
        fontSize={Math.max(6, size * 0.22)} fill="#64748b"
      />
    </Group>
  );
}

function StaticImage({ el, common, attrs }: {
  el: ImageElement; common: CommonAttrs; attrs: Record<string, unknown>;
}) {
  const image = useImage(el.url);
  return <KImage {...common} image={image} width={attrs.width as number} height={attrs.height as number} />;
}

function StaticShape({ el, common, attrs }: {
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
        {...common} width={width} height={height} fill={fill} stroke={stroke}
        strokeWidth={strokeWidth} cornerRadius={attrs.cornerRadius as number}
      />
    );
  }
  if (el.shape === 'ellipse') {
    // Center-positioned/center-pivoted, matching the print renderer and the
    // editor canvas exactly.
    return (
      <Ellipse
        {...common}
        x={common.x + width / 2} y={common.y + height / 2}
        radiusX={width / 2} radiusY={height / 2}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <Line
      {...common} points={[0, 0, width, 0]}
      stroke={stroke || fill || '#000000'} strokeWidth={Math.max(1, strokeWidth)}
    />
  );
}

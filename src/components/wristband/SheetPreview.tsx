import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text as KText, Image as KImage, Ellipse, Line, Group } from 'react-konva';
import { AlertTriangle, XCircle } from 'lucide-react';
import { TYPICAL_PRINTER_MARGIN_MM, type CalibrationOffset, type SheetTemplate } from '@/lib/wristband/templates';
import { bandTopsMm } from '@/lib/wristband/layout';
import { sheetChecks, sheetMeasurements } from '@/lib/wristband/sheetChecks';
import type { EditorState } from '@/lib/wristband/editorState';
import type { ImageElement, ShapeElement, TextElement, WristbandElement } from '@/lib/wristband/design';
import { elementNodeAttrs } from '@/lib/wristband/renderBand';
import { useImage } from './useImage';

/** CSS px per mm at browser-nominal 96dpi — "100%" is close to life size on a
 *  typical display, but only the printed calibration page is authoritative. */
const CSS_PX_PER_MM = 96 / 25.4;
const ZOOM_LABELS = ['Fit', '75%', '100%'] as const;

const RULER_PX = 22;
/** Gutter between the mm ruler and the sheet, holding the band numbers. */
const INDEX_PX = 18;
const LEFT_GUTTER = RULER_PX + INDEX_PX;

type CommonAttrs = { x: number; y: number; rotation: number; opacity: number };

/**
 * Full-sheet proof: the design repeated across every band, drawn on a
 * to-scale sheet with mm rulers, the tab keep-out marked, and the numbers you
 * can check with a ruler against the real Tyvek.
 *
 * The rulers and the measurements panel are the point. Band rectangles alone
 * cannot reveal a template that describes the wrong stock — they are drawn
 * from that same template, so they always look right. Real numbers you can
 * hold a ruler against are what close that gap.
 */
export function SheetPreview({ template, state, offset }: {
  template: SheetTemplate;
  state: EditorState;
  offset: CalibrationOffset;
}) {
  const [zoom, setZoom] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fitPxPerMm, setFitPxPerMm] = useState(1.5);

  // "Fit" means fit — measure the scroll area rather than guessing a constant,
  // so the sheet stays as large as the panel allows on any window size.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const usable = el.clientWidth - LEFT_GUTTER - 32; // 32 = container padding
      if (usable > 0) setFitPxPerMm(usable / template.pageWidthMm);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [template.pageWidthMm]);

  const pxPerMm = zoom === 0 ? fitPxPerMm : CSS_PX_PER_MM * (zoom === 1 ? 0.75 : 1);

  const tops = useMemo(() => bandTopsMm(template, offset), [template, offset]);
  const measurements = useMemo(() => sheetMeasurements(template, offset), [template, offset]);
  const checks = useMemo(() => sheetChecks(template, offset), [template, offset]);
  const visibleElements = state.elements.filter((el) => el.visible);

  const pageWidthPx = template.pageWidthMm * pxPerMm;
  const pageHeightPx = template.pageHeightMm * pxPerMm;
  const bandWidthPx = template.bandWidthMm * pxPerMm;
  const bandHeightPx = template.bandHeightMm * pxPerMm;
  const lastBandBottomPx = (tops[tops.length - 1] + template.bandHeightMm) * pxPerMm;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border">
          {ZOOM_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setZoom(i)}
              className={`px-2.5 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
                i === zoom ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {template.pageWidthMm} × {template.pageHeightMm}mm sheet · {template.bandsPerSheet} bands ·{' '}
          {measurements.pitchMm.toFixed(2)}mm pitch
        </p>
      </div>

      <div ref={scrollRef} className="overflow-auto rounded-lg bg-slate-100 p-4">
        <div
          className="relative"
          style={{
            width: pageWidthPx + LEFT_GUTTER,
            // Bands that run off the sheet must stay inside the scroll area,
            // where they read as "past the paper" instead of overlapping the
            // panels below.
            height: RULER_PX + Math.max(pageHeightPx, lastBandBottomPx),
          }}
        >
          <Ruler axis="x" lengthMm={template.pageWidthMm} pxPerMm={pxPerMm} />
          <Ruler axis="y" lengthMm={template.pageHeightMm} pxPerMm={pxPerMm} />

          {tops.map((topMm, i) => (
            <span
              key={`n${i}`}
              className="absolute text-right font-mono text-[9px] tabular-nums leading-none text-slate-500"
              style={{
                left: RULER_PX,
                width: INDEX_PX - 4,
                top: RULER_PX + (topMm + template.bandHeightMm / 2) * pxPerMm - 4,
              }}
            >
              {i + 1}
            </span>
          ))}

          <div
            className="absolute bg-white shadow-sm ring-1 ring-slate-300"
            style={{ left: LEFT_GUTTER, top: RULER_PX, width: pageWidthPx, height: pageHeightPx }}
          />

          {/* What most printers physically cannot reach. */}
          <div
            className="pointer-events-none absolute border border-dashed border-rose-300"
            style={{
              left: LEFT_GUTTER + TYPICAL_PRINTER_MARGIN_MM * pxPerMm,
              top: RULER_PX + TYPICAL_PRINTER_MARGIN_MM * pxPerMm,
              width: Math.max(0, pageWidthPx - 2 * TYPICAL_PRINTER_MARGIN_MM * pxPerMm),
              height: Math.max(0, pageHeightPx - 2 * TYPICAL_PRINTER_MARGIN_MM * pxPerMm),
            }}
          />

          {tops.map((topMm, i) => {
            const offSheet = topMm + template.bandHeightMm > template.pageHeightMm + 0.05;
            return (
              <div
                key={i}
                className={`absolute outline outline-1 ${
                  offSheet ? 'opacity-60 outline-rose-500' : 'outline-slate-400'
                }`}
                style={{
                  left: LEFT_GUTTER + (template.marginLeftMm + offset.dxMm) * pxPerMm,
                  top: RULER_PX + topMm * pxPerMm,
                  width: bandWidthPx,
                  height: bandHeightPx,
                }}
              >
                <Stage width={bandWidthPx} height={bandHeightPx} listening={false}>
                  <Layer listening={false}>
                    <Rect x={0} y={0} width={bandWidthPx} height={bandHeightPx} fill={state.background} />
                    {visibleElements.map((el) => (
                      <StaticElement key={el.id} el={el} pxPerMm={pxPerMm} />
                    ))}
                  </Layer>
                </Stage>

                {/* Glued end — artwork here disappears under the tab. */}
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 border-l border-slate-400"
                  style={{
                    width: template.tabZoneMm * pxPerMm,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(100,116,139,.28) 0 2px, transparent 2px 6px)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MeasurementsPanel template={template} m={measurements} tops={tops} />
        <ChecksPanel checks={checks} />
      </div>
    </div>
  );
}

/** mm ruler along the top or left edge of the sheet. */
function Ruler({ axis, lengthMm, pxPerMm }: { axis: 'x' | 'y'; lengthMm: number; pxPerMm: number }) {
  const horizontal = axis === 'x';
  const ticks: number[] = [];
  for (let mm = 0; mm <= lengthMm; mm += 5) ticks.push(mm);

  return (
    <div
      className="absolute select-none border-slate-300 bg-slate-50"
      style={
        horizontal
          ? { left: LEFT_GUTTER, top: 0, width: lengthMm * pxPerMm, height: RULER_PX, borderBottomWidth: 1 }
          : { left: 0, top: RULER_PX, width: RULER_PX, height: lengthMm * pxPerMm, borderRightWidth: 1 }
      }
    >
      {ticks.map((mm) => {
        const major = mm % 10 === 0;
        const labelled = mm % 50 === 0;
        const pos = mm * pxPerMm;
        return (
          <div key={mm}>
            <div
              className={major ? 'absolute bg-slate-400' : 'absolute bg-slate-300'}
              style={
                horizontal
                  ? { left: pos, bottom: 0, width: 1, height: major ? 7 : 4 }
                  : { top: pos, right: 0, height: 1, width: major ? 7 : 4 }
              }
            />
            {labelled && (
              <span
                className="absolute font-mono text-[8px] tabular-nums leading-none text-slate-500"
                style={horizontal ? { left: pos + 2, top: 2 } : { top: pos + 2, left: 2 }}
              >
                {mm}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The ruler check. Every row is a distance on the physical sheet, so a
 * mismatch here is a template that does not describe the stock in the tray.
 */
function MeasurementsPanel({ template, m, tops }: {
  template: SheetTemplate;
  m: ReturnType<typeof sheetMeasurements>;
  tops: number[];
}) {
  const rows: Array<[string, string]> = [
    ['Sheet', `${m.sheetWidthMm} × ${m.sheetHeightMm} mm`],
    ['Band height', `${m.bandHeightMm} mm`],
    ['Band spacing (pitch)', `${m.pitchMm.toFixed(2)} mm`],
    [`Band 1 top → band ${template.bandsPerSheet} top`, `${m.spanMm.toFixed(1)} mm`],
    ['Last band → sheet bottom', `${m.bottomSlackMm.toFixed(1)} mm`],
    ['Printable band length', `${m.printableWidthMm} mm (${template.tabZoneMm}mm tab)`],
  ];

  return (
    <div className="rounded-lg border p-3">
      <h4 className="text-sm font-semibold">Check against your sheet</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Measure these on the real Tyvek before printing. Measure the band 1 → band{' '}
        {template.bandsPerSheet} span rather than a single gap — it divides your ruler error by{' '}
        {template.bandsPerSheet - 1}.
      </p>
      <dl className="mt-2.5 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-dashed py-1 last:border-0">
            <dt className="text-xs text-slate-600">{label}</dt>
            <dd className="font-mono text-xs tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-600">Every band top</summary>
        <p className="mt-1 font-mono text-[11px] leading-relaxed tabular-nums text-slate-600">
          {tops.map((t, i) => `${i + 1}: ${t.toFixed(1)}`).join('   ')}
        </p>
      </details>
    </div>
  );
}

function ChecksPanel({ checks }: { checks: ReturnType<typeof sheetChecks> }) {
  if (checks.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <h4 className="text-sm font-semibold text-emerald-900">Layout fits the sheet</h4>
        <p className="mt-0.5 text-xs text-emerald-800">
          Print at Actual size — any “fit to page” or “scale to fit” setting stretches the spacing and
          every band after the first lands progressively further off.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {checks.map((c, i) => {
        const isError = c.level === 'error';
        const Icon = isError ? XCircle : AlertTriangle;
        return (
          <div
            key={i}
            className={`flex gap-2 rounded-lg border p-2.5 ${
              isError ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? 'text-rose-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-xs font-medium ${isError ? 'text-rose-900' : 'text-amber-900'}`}>{c.message}</p>
              <p className={`text-xs ${isError ? 'text-rose-800' : 'text-amber-800'}`}>{c.fix}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StaticElement({ el, pxPerMm }: { el: WristbandElement; pxPerMm: number }) {
  const attrs = elementNodeAttrs(el, pxPerMm);
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

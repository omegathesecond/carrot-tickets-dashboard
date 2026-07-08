import {
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Trash2,
  Type, Image as ImageIcon, Square, Circle, Minus, QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { EditorState, EditorAction } from '@/lib/wristband/editorState';
import type { WristbandElement } from '@/lib/wristband/design';

const SHAPE_NAMES: Record<string, string> = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line' };

function rowIcon(el: WristbandElement) {
  switch (el.type) {
    case 'text': return <Type className="h-4 w-4 shrink-0" />;
    case 'image': return <ImageIcon className="h-4 w-4 shrink-0" />;
    case 'qr': return <QrCode className="h-4 w-4 shrink-0" />;
    case 'shape':
      if (el.shape === 'ellipse') return <Circle className="h-4 w-4 shrink-0" />;
      if (el.shape === 'line') return <Minus className="h-4 w-4 shrink-0" />;
      return <Square className="h-4 w-4 shrink-0" />;
  }
}

function rowLabel(el: WristbandElement): string {
  switch (el.type) {
    case 'text': return el.text.trim() || 'Text';
    case 'image': return 'Image';
    case 'qr': return 'QR code';
    case 'shape': return SHAPE_NAMES[el.shape] ?? el.shape;
  }
}

/**
 * Layer stack, top-most element first (reverse of state.elements, whose
 * later entries draw on top). Up/down chevrons dispatch `reorder` in terms
 * of z-order, not list index — 'up' always means "further towards the top
 * of this display", which is 'up' in the reducer too.
 */
export function LayersPanel({ state, dispatch }: {
  state: EditorState; dispatch: (a: EditorAction) => void;
}) {
  const topFirst = [...state.elements].reverse();

  return (
    <div className="w-64 shrink-0 border-r p-2">
      <h3 className="mb-2 px-2 text-sm font-semibold">Layers</h3>
      {topFirst.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">No elements yet.</p>
      )}
      <ul className="space-y-1">
        {topFirst.map((el, i) => {
          const isTop = i === 0;
          const isBottom = i === topFirst.length - 1;
          const selected = el.id === state.selectedId;
          return (
            <li
              key={el.id}
              onClick={() => dispatch({ type: 'select', id: el.id })}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                selected && 'bg-accent'
              )}
            >
              {rowIcon(el)}
              <span className="flex-1 truncate">{rowLabel(el)}</span>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'update', id: el.id, patch: { visible: !el.visible } });
                }}
              >
                {el.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'update', id: el.id, patch: { locked: !el.locked } });
                }}
              >
                {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6" disabled={isTop}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'reorder', id: el.id, direction: 'up' });
                }}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6" disabled={isBottom}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'reorder', id: el.id, direction: 'down' });
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'remove', id: el.id });
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

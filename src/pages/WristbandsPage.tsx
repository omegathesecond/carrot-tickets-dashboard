import { useEffect, useReducer, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Undo2, Redo2, Printer } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { editorReducer, initialEditorState } from '@/lib/wristband/editorState';
import { allTemplates, DEFAULT_TEMPLATES, type SheetTemplate } from '@/lib/wristband/templates';
import type { WristbandDesignDoc } from '@/lib/wristband/design';
import { EditorCanvas } from '@/components/wristband/EditorCanvas';
import { ElementInspector } from '@/components/wristband/ElementInspector';
import { LayersPanel } from '@/components/wristband/LayersPanel';
import { SheetPreview } from '@/components/wristband/SheetPreview';
import { DesignManagerBar } from '@/components/wristband/DesignManagerBar';

// Picked by KEY, not array index — DEFAULT_TEMPLATES has been reordered
// before and will likely be again.
const DEFAULT_TEMPLATE =
  DEFAULT_TEMPLATES.find((t) => t.key === 'tyvek-10up-25mm-11x11') ?? DEFAULT_TEMPLATES[0];

/**
 * Wristbands — design + print photo-quality Tyvek wristbands (10-up sheets)
 * for an event. Platform-staff-only (see WristbandsRoute).
 */
export function WristbandsPage() {
  const [eventId, setEventId] = useState('');
  const [template, setTemplate] = useState<SheetTemplate>(DEFAULT_TEMPLATE);
  const [zoom, setZoom] = useState(1.5);
  const [current, setCurrent] = useState<WristbandDesignDoc | null>(null);
  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const [printOpen, setPrintOpen] = useState(false);
  // state.past.length recorded at the moment of the last save/load — the
  // Save button's dirty dot lights up once history has advanced past this.
  const [savedAt, setSavedAt] = useState(0);

  const { data: eventsPage, error } = useQuery({
    queryKey: ['wristbands-events'],
    queryFn: () => apiClient.events.getEvents({ limit: 100 }),
  });

  const buildDoc = (): Omit<WristbandDesignDoc, '_id'> => ({
    eventId,
    name: current?.name ?? 'Untitled',
    sheetTemplate: template,
    designJson: { background: state.background, elements: state.elements },
  });

  const onLoad = (d: WristbandDesignDoc) => {
    setCurrent(d);
    setTemplate(d.sheetTemplate);
    dispatch({ type: 'load', background: d.designJson.background, elements: d.designJson.elements });
    setSavedAt(0); // 'load' always resets history to []
  };

  const onSaved = (d: WristbandDesignDoc) => {
    setCurrent(d);
    setSavedAt(state.past.length);
  };

  // Designs are per-event — switching events must not carry over the
  // previous event's working design.
  const handleEventChange = (id: string) => {
    setEventId(id);
    setCurrent(null);
    dispatch({ type: 'load', background: '#ffffff', elements: [] });
    setSavedAt(0);
  };

  // Delete removes the selection; Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo —
  // skipped whenever focus is in a form control so typing isn't hijacked.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' && state.selectedId) {
        e.preventDefault();
        dispatch({ type: 'remove', id: state.selectedId });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch(e.shiftKey ? { type: 'redo' } : { type: 'undo' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selectedId]);

  if (error) {
    return <div className="p-6 text-destructive">Failed to load events: {(error as Error).message}</div>;
  }

  const events = eventsPage?.data ?? [];
  const templates = allTemplates();
  const dirty = state.past.length !== savedAt;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wristbands</h1>
          <p className="text-muted-foreground">Design and print Tyvek wristbands on the office printer.</p>
        </div>
        <div className="w-72">
          <Select value={eventId} onValueChange={handleEventChange}>
            <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!eventId ? (
        <div className="text-muted-foreground py-24 text-center">Pick an event to start designing.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <DesignManagerBar
              eventId={eventId} current={current} onLoad={onLoad} onSaved={onSaved}
              dirty={dirty} buildDoc={buildDoc}
            />

            <div className="w-56">
              <Select
                value={template.key}
                onValueChange={(key) => {
                  const t = templates.find((x) => x.key === key);
                  if (t) setTemplate(t);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sheet template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <input
                type="range" min={0.5} max={3} step={0.1} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-32 cursor-pointer accent-primary"
              />
              <span className="w-10 text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" title="Undo" disabled={state.past.length === 0}
                onClick={() => dispatch({ type: 'undo' })}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="icon" title="Redo" disabled={state.future.length === 0}
                onClick={() => dispatch({ type: 'redo' })}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            <span className="ml-auto" title="Print — coming in the next step">
              <Button variant="outline" disabled>
                <Printer className="mr-1.5 h-4 w-4" /> Print…
              </Button>
            </span>
          </div>

          <Tabs defaultValue="design" className="flex-1">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="sheet">Sheet</TabsTrigger>
            </TabsList>
            <TabsContent value="design">
              <div className="flex overflow-hidden rounded-lg border">
                <LayersPanel state={state} dispatch={dispatch} />
                <div className="flex-1 overflow-auto">
                  <EditorCanvas template={template} state={state} dispatch={dispatch} zoom={zoom} />
                </div>
                <ElementInspector state={state} dispatch={dispatch} template={template} eventId={eventId} />
              </div>
            </TabsContent>
            <TabsContent value="sheet">
              <SheetPreview template={template} state={state} />
            </TabsContent>
          </Tabs>

          {/* Placeholder mount point — Task 17 wires the real print flow onto
              printOpen/setPrintOpen and enables the button above. */}
          <Dialog open={printOpen} onOpenChange={setPrintOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Print sheet</DialogTitle>
                <DialogDescription>Coming in the next step.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

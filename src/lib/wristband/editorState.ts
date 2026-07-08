import type { WristbandElement } from './design';

/**
 * Pure editor state + reducer (React-free so it unit-tests in node).
 * History: every mutating action snapshots {background, elements} into `past`
 * (capped) and clears `future`. Selection is not history.
 */
export type Snapshot = { background: string; elements: WristbandElement[] };

export interface EditorState {
  background: string;
  elements: WristbandElement[];
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
}

export type EditorAction =
  | { type: 'add'; element: WristbandElement }
  | { type: 'update'; id: string; patch: Partial<WristbandElement> }
  | { type: 'remove'; id: string }
  | { type: 'reorder'; id: string; direction: 'up' | 'down' }
  | { type: 'select'; id: string | null }
  | { type: 'setBackground'; color: string }
  | { type: 'load'; background: string; elements: WristbandElement[] }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_CAP = 100;

export function initialEditorState(): EditorState {
  return { background: '#ffffff', elements: [], selectedId: null, past: [], future: [] };
}

const snap = (s: EditorState): Snapshot => ({ background: s.background, elements: s.elements });

function withHistory(s: EditorState, next: Partial<EditorState>): EditorState {
  return {
    ...s,
    ...next,
    past: [...s.past.slice(-(HISTORY_CAP - 1)), snap(s)],
    future: [],
  };
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case 'add':
      return withHistory(s, { elements: [...s.elements, a.element], selectedId: a.element.id });

    case 'update': {
      const el = s.elements.find((e) => e.id === a.id);
      if (!el) return s;
      const keys = Object.keys(a.patch);
      const onlyLockVisibility = keys.every((k) => k === 'locked' || k === 'visible');
      if (el.locked && !onlyLockVisibility) return s;
      return withHistory(s, {
        elements: s.elements.map((e) => (e.id === a.id ? ({ ...e, ...a.patch } as WristbandElement) : e)),
      });
    }

    case 'remove':
      if (!s.elements.some((e) => e.id === a.id)) return s;
      return withHistory(s, {
        elements: s.elements.filter((e) => e.id !== a.id),
        selectedId: s.selectedId === a.id ? null : s.selectedId,
      });

    case 'reorder': {
      const i = s.elements.findIndex((e) => e.id === a.id);
      const j = a.direction === 'up' ? i + 1 : i - 1; // later in array = drawn on top
      if (i < 0 || j < 0 || j >= s.elements.length) return s;
      const elements = [...s.elements];
      [elements[i], elements[j]] = [elements[j], elements[i]];
      return withHistory(s, { elements });
    }

    case 'select':
      return { ...s, selectedId: a.id };

    case 'setBackground':
      return withHistory(s, { background: a.color });

    case 'load':
      return { background: a.background, elements: a.elements, selectedId: null, past: [], future: [] };

    case 'undo': {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { ...s, ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future] };
    }

    case 'redo': {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, ...next, past: [...s.past, snap(s)], future: s.future.slice(1) };
    }
  }
}

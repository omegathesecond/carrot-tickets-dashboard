import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState } from '../editorState';
import { createTextElement } from '../design';

const withText = () => {
  const el = createTextElement({ text: 'A' });
  const s = editorReducer(initialEditorState(), { type: 'add', element: el });
  return { s, el };
};

describe('editorReducer', () => {
  it('add + update + remove', () => {
    const { s, el } = withText();
    expect(s.elements).toHaveLength(1);

    const s2 = editorReducer(s, { type: 'update', id: el.id, patch: { text: 'B' } as any });
    expect((s2.elements[0] as any).text).toBe('B');

    const s3 = editorReducer(s2, { type: 'remove', id: el.id });
    expect(s3.elements).toHaveLength(0);
    expect(s3.selectedId).toBeNull();
  });

  it('locked elements ignore geometry updates but allow unlock', () => {
    const { s, el } = withText();
    const locked = editorReducer(s, { type: 'update', id: el.id, patch: { locked: true } });
    const moved = editorReducer(locked, { type: 'update', id: el.id, patch: { x: 99 } });
    expect(moved.elements[0].x).not.toBe(99);
    const unlocked = editorReducer(moved, { type: 'update', id: el.id, patch: { locked: false } });
    expect(unlocked.elements[0].locked).toBe(false);
  });

  it('reorder moves an element up/down and clamps at ends', () => {
    const a = createTextElement({ text: 'a' });
    const b = createTextElement({ text: 'b' });
    let s = editorReducer(initialEditorState(), { type: 'add', element: a });
    s = editorReducer(s, { type: 'add', element: b });
    const up = editorReducer(s, { type: 'reorder', id: a.id, direction: 'up' });
    expect(up.elements.map((e) => e.id)).toEqual([b.id, a.id]);
    const clamped = editorReducer(up, { type: 'reorder', id: a.id, direction: 'up' });
    expect(clamped.elements.map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it('undo/redo round-trips and select does not pollute history', () => {
    const { s, el } = withText();
    const s2 = editorReducer(s, { type: 'select', id: el.id });
    const s3 = editorReducer(s2, { type: 'update', id: el.id, patch: { x: 50 } });
    const undone = editorReducer(s3, { type: 'undo' });
    expect(undone.elements[0].x).toBe(el.x);
    const redone = editorReducer(undone, { type: 'redo' });
    expect(redone.elements[0].x).toBe(50);
    // Undo past the add returns to empty; further undo is a no-op.
    const empty = editorReducer(editorReducer(undone, { type: 'undo' }), { type: 'undo' });
    expect(empty.elements).toHaveLength(0);
  });

  it('load resets history', () => {
    const { s } = withText();
    const loaded = editorReducer(s, { type: 'load', background: '#000', elements: [] });
    expect(loaded.past).toHaveLength(0);
    expect(editorReducer(loaded, { type: 'undo' })).toEqual(loaded);
  });
});

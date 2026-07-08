import { describe, expect, it } from 'vitest';
import Konva from 'konva';
import { findNodeById } from '../findNode';

// Regression: element ids come from crypto.randomUUID() and start with a
// digit ~62% of the time. The editor once looked nodes up via
// stage.findOne('#' + CSS.escape(id)) — CSS.escape turns a leading digit
// into a '\33 …' escape sequence that Konva's plain string comparison never
// matches, so the Transformer silently detached for those elements.
describe('findNodeById', () => {
  const build = (id: string) => {
    const group = new Konva.Group();
    const rect = new Konva.Rect({ id });
    group.add(rect);
    return { group, rect };
  };

  it('finds nodes whose id starts with a digit (UUID-style)', () => {
    const id = '3f9adead-1111-4222-8333-abcdef012345';
    const { group, rect } = build(id);
    expect(findNodeById(group, id)).toBe(rect);
  });

  it('finds nodes whose id starts with a letter', () => {
    const id = 'f3adbeef-1111-4222-8333-abcdef012345';
    const { group, rect } = build(id);
    expect(findNodeById(group, id)).toBe(rect);
  });

  it('returns undefined for an unknown id', () => {
    const { group } = build('3f9adead-1111-4222-8333-abcdef012345');
    expect(findNodeById(group, 'nope')).toBeUndefined();
  });
});

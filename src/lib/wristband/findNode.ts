import type Konva from 'konva';

/**
 * Konva node lookup by exact id. Never feed Konva's '#id' selector a
 * CSS.escape'd id: crypto.randomUUID() ids often start with a digit, and the
 * escaped form ('\33 f9a…') fails Konva's plain string comparison — the
 * predicate form matches exactly with no selector parsing at all.
 */
export function findNodeById(
  container: Konva.Container,
  id: string
): Konva.Node | undefined {
  return container.findOne((n: Konva.Node) => n.id() === id);
}

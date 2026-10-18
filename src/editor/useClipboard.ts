import { useCallback, useRef } from 'react';
import { newId } from '../model/document';
import type { FlowEdge, ShapeNode } from '../model/types';

interface Clip {
  nodes: ShapeNode[];
  edges: FlowEdge[];
}

const OFFSET = 40;

/**
 * Kopyala / yapıştır: seçili şekiller ve yalnızca bu şekiller arasındaki oklar kopyalanır.
 * Yapıştırılanlar yeni kimlik alır, biraz kaydırılır ve seçili hale gelir.
 */
export function useClipboard(
  getNodes: () => ShapeNode[],
  getEdges: () => FlowEdge[],
  setNodes: (fn: (ns: ShapeNode[]) => ShapeNode[]) => void,
  setEdges: (fn: (es: FlowEdge[]) => FlowEdge[]) => void,
) {
  const clip = useRef<Clip | null>(null);
  const pasteCount = useRef(0);

  const copy = useCallback((): number => {
    const nodes = getNodes().filter((n) => n.selected);
    if (!nodes.length) return 0;
    const ids = new Set(nodes.map((n) => n.id));
    const edges = getEdges().filter((e) => ids.has(e.source) && ids.has(e.target));
    clip.current = JSON.parse(JSON.stringify({ nodes, edges })) as Clip;
    pasteCount.current = 0;
    return nodes.length;
  }, [getNodes, getEdges]);

  const paste = useCallback((): number => {
    const c = clip.current;
    if (!c) return 0;
    pasteCount.current += 1;
    const shift = OFFSET * pasteCount.current;
    const idMap = new Map(c.nodes.map((n) => [n.id, newId('n')]));
    const nodes: ShapeNode[] = c.nodes.map((n) => ({
      ...JSON.parse(JSON.stringify(n)),
      id: idMap.get(n.id)!,
      position: { x: n.position.x + shift, y: n.position.y + shift },
      selected: true,
      dragging: false,
    }));
    const edges: FlowEdge[] = c.edges.map((e) => ({
      ...JSON.parse(JSON.stringify(e)),
      id: newId('e'),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }));
    setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...nodes]);
    setEdges((es) => [...es.map((e) => (e.selected ? { ...e, selected: false } : e)), ...edges]);
    return nodes.length;
  }, [setNodes, setEdges]);

  return { copy, paste, hasClip: () => clip.current !== null };
}

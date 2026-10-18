import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowEdge, ShapeNode, VsmMapData } from '../model/types';

/** Geri alınabilir bir durum: şekiller, oklar, harita verileri ve ad. Seçim ve görünüm dahil değildir. */
export interface Snapshot {
  nodes: ShapeNode[];
  edges: FlowEdge[];
  vsmMap: VsmMapData;
  name: string;
}

const LIMIT = 100;
const GROUP_MS = 350;

/** Karşılaştırma için içerik imzası (seçim, sürükleme ve ölçüm bilgisi hariç). */
function signature(s: Snapshot): string {
  return JSON.stringify({
    n: s.nodes.map((n) => [n.id, n.type, n.position.x, n.position.y, n.width, n.height, n.data]),
    e: s.edges.map((e) => [e.id, e.source, e.target, e.sourceHandle, e.targetHandle, e.label, e.type]),
    m: s.vsmMap,
    a: s.name,
  });
}

const clean = (s: Snapshot): Snapshot => ({
  ...s,
  nodes: s.nodes.map((n) => ({ ...n, selected: false, dragging: false })),
  edges: s.edges.map((e) => ({ ...e, selected: false })),
});

/** Yazı alanındayken kısayolları tarayıcıya bırak (yazının kendi geri alması çalışsın). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * Geri al / ileri al. Art arda gelen değişiklikler (ör. sürükleme) kısa bir süre içinde tek adımda toplanır.
 * `resetKey` değişince (belge açma, harita değiştirme) geçmiş temizlenir.
 */
export function useHistory(current: Snapshot, apply: (s: Snapshot) => void, resetKey: number) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const baseline = useRef<Snapshot>(current);
  const baselineSig = useRef(signature(current));
  const currentRef = useRef(current);
  currentRef.current = current;
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  // Belge değişince geçmişi sıfırla.
  useEffect(() => {
    past.current = [];
    future.current = [];
    baseline.current = currentRef.current;
    baselineSig.current = signature(currentRef.current);
    bump();
  }, [resetKey]);

  /** Bekleyen değişikliği geçmişe işler. */
  const commit = useCallback(() => {
    const sig = signature(currentRef.current);
    if (sig === baselineSig.current) return;
    past.current = [...past.current.slice(-(LIMIT - 1)), baseline.current];
    future.current = [];
    baseline.current = currentRef.current;
    baselineSig.current = sig;
    bump();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(commit, GROUP_MS);
    return () => window.clearTimeout(t);
  }, [current.nodes, current.edges, current.vsmMap, current.name, commit]);

  const restore = (s: Snapshot) => {
    baseline.current = s;
    baselineSig.current = signature(s);
    apply(clean(s));
    bump();
  };

  const undo = useCallback(() => {
    commit();
    const prev = past.current[past.current.length - 1];
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, baseline.current];
    restore(prev);
  }, [commit]);

  const redo = useCallback(() => {
    commit();
    const next = future.current[future.current.length - 1];
    if (!next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, baseline.current];
    restore(next);
  }, [commit]);

  return {
    undo,
    redo,
    canUndo: past.current.length > 0 || signature(current) !== baselineSig.current,
    canRedo: future.current.length > 0,
  };
}

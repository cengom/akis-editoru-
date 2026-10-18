import { SHAPES, zIndexFor } from './shapes';
import { EDGE_KIND_SPECS } from './edges';
import { cloneVsm, cloneVsmMap, emptyVsm, emptyVsmMap, parseVsm, parseVsmMap } from './vsm';
import {
  APP_ID,
  EDGE_KINDS,
  HANDLE_SIDES,
  SCHEMA_VERSION,
  SHAPE_KINDS,
  SUPPORTED_SCHEMA_VERSIONS,
  type DiagramDocument,
  type EdgeKind,
  type FlowEdge,
  type HandleSide,
  type ShapeData,
  type ShapeKind,
  type ShapeNode,
  type StoredEdge,
  type StoredNode,
  type Viewport,
  type VsmMapData,
} from './types';

export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  nodes: 2000,
  edges: 5000,
  name: 200,
  title: 200,
  description: 5000,
  label: 200,
  id: 100,
  coordinate: 1_000_000,
  size: 10_000,
};

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;


/* ---------- Tuval <-> kayıt formatı dönüşümü ---------- */

export function asHandle(value: string | null | undefined): HandleSide | null {
  return HANDLE_SIDES.includes(value as HandleSide) ? (value as HandleSide) : null;
}

export function asEdgeKind(value: string | undefined): EdgeKind {
  return EDGE_KINDS.includes(value as EdgeKind) ? (value as EdgeKind) : 'flow';
}

export function toDocument(
  name: string,
  nodes: ShapeNode[],
  edges: FlowEdge[],
  viewport: Viewport,
  vsmMap: VsmMapData,
): DiagramDocument {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    name,
    savedAt: new Date().toISOString(),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    vsmMap: cloneVsmMap(vsmMap),
    nodes: nodes.map((n): StoredNode => {
      const kind = n.type as ShapeKind;
      return {
        id: n.id,
        kind,
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? n.measured?.width ?? SHAPES[kind].width,
        height: n.height ?? n.measured?.height ?? SHAPES[kind].height,
        data: copyData(kind, n.data),
      };
    }),
    edges: edges.map(
      (e): StoredEdge => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: asHandle(e.sourceHandle),
        targetHandle: asHandle(e.targetHandle),
        label: typeof e.label === 'string' ? e.label : '',
        kind: asEdgeKind(e.type),
      }),
    ),
  };
}

/** Şekil verisinin bağımsız kopyası. VSM verisi yalnızca proseslerde tutulur. */
function copyData(kind: ShapeKind, data: ShapeData): ShapeData {
  const base: ShapeData = { title: data.title, description: data.description, color: data.color };
  if (kind === 'process') base.vsm = data.vsm ? cloneVsm(data.vsm) : emptyVsm();
  return base;
}

export function makeNode(stored: StoredNode): ShapeNode {
  return {
    id: stored.id,
    type: stored.kind,
    position: { x: stored.x, y: stored.y },
    width: stored.width,
    height: stored.height,
    zIndex: zIndexFor(stored.kind),
    data: copyData(stored.kind, stored.data),
  };
}

export function makeEdge(stored: StoredEdge): FlowEdge {
  return {
    id: stored.id,
    source: stored.source,
    target: stored.target,
    sourceHandle: stored.sourceHandle,
    targetHandle: stored.targetHandle,
    label: stored.label,
    ...edgeKindProps(stored.kind),
    zIndex: 1,
  };
}

/** Bağlantı türüne göre React Flow kenar tipi ve ok ucu. Tür değişince de kullanılır. */
export function edgeKindProps(kind: EdgeKind): Pick<FlowEdge, 'type' | 'markerEnd'> {
  return { type: kind, markerEnd: EDGE_KIND_SPECS[kind].marker };
}

export function fromDocument(doc: DiagramDocument): { nodes: ShapeNode[]; edges: FlowEdge[] } {
  return { nodes: doc.nodes.map(makeNode), edges: doc.edges.map(makeEdge) };
}

/* ---------- Doğrulama ---------- */

export type ParseResult = { ok: true; doc: DiagramDocument } | { ok: false; errors: string[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown, limit: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit;
}

function isStr(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max;
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= LIMITS.id;
}

function isHandle(v: unknown): v is HandleSide | null {
  return v === null || HANDLE_SIDES.includes(v as HandleSide);
}

/**
 * Bilinmeyen bir değerin geçerli bir DiagramDocument olup olmadığını denetler.
 * Hiçbir şeyi değiştirmez; geçerliyse temiz bir kopya döndürür.
 */
export function parseDocument(raw: unknown): ParseResult {
  const errors: string[] = [];
  const fail = (msg: string) => {
    if (errors.length < 8) errors.push(msg);
  };

  if (!isObject(raw)) return { ok: false, errors: ['Dosya bir JSON nesnesi değil.'] };
  if (raw.app !== APP_ID) {
    return { ok: false, errors: ['Bu dosya Akış Editörü ile oluşturulmamış görünüyor ("app" alanı eksik ya da farklı).'] };
  }
  if (typeof raw.schemaVersion !== 'number') {
    return { ok: false, errors: ['Dosyada sürüm numarası (schemaVersion) yok.'] };
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Dosya daha yeni bir sürümle (${raw.schemaVersion}) kaydedilmiş; bu uygulama en fazla ${SCHEMA_VERSION}. sürümü açabilir.`],
    };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(raw.schemaVersion as never)) {
    return { ok: false, errors: [`Desteklenmeyen sürüm: ${raw.schemaVersion}.`] };
  }

  const name = isStr(raw.name, LIMITS.name) ? raw.name : (fail('"name" alanı geçersiz.'), '');

  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  if (raw.viewport !== undefined) {
    const v = raw.viewport;
    if (isObject(v) && isNum(v.x, LIMITS.coordinate * 10) && isNum(v.y, LIMITS.coordinate * 10) && isNum(v.zoom, 10) && v.zoom > 0) {
      viewport = { x: v.x, y: v.y, zoom: v.zoom };
    } else {
      fail('"viewport" alanı geçersiz.');
    }
  }

  if (!Array.isArray(raw.nodes)) fail('"nodes" bir liste olmalı.');
  if (!Array.isArray(raw.edges)) fail('"edges" bir liste olmalı.');
  if (errors.length) return { ok: false, errors };

  const rawNodes = raw.nodes as unknown[];
  const rawEdges = raw.edges as unknown[];
  // Sürüm 3 öncesinde harita verisi yoktur; boş kabul edilir. Hata varsa aşağıda toplu döner.
  const vsmMap = parseVsmMap(raw.vsmMap, fail) ?? emptyVsmMap();
  if (rawNodes.length > LIMITS.nodes) fail(`Çok fazla şekil var (en fazla ${LIMITS.nodes}).`);
  if (rawEdges.length > LIMITS.edges) fail(`Çok fazla bağlantı var (en fazla ${LIMITS.edges}).`);
  if (errors.length) return { ok: false, errors };

  const nodes: StoredNode[] = [];
  const nodeIds = new Set<string>();
  rawNodes.forEach((n, i) => {
    const where = `${i + 1}. şekil`;
    if (!isObject(n)) return fail(`${where} bir nesne değil.`);
    if (!isId(n.id)) return fail(`${where}: "id" geçersiz.`);
    if (nodeIds.has(n.id)) return fail(`${where}: "${n.id}" kimliği birden fazla kez kullanılmış.`);
    if (!SHAPE_KINDS.includes(n.kind as ShapeKind)) return fail(`${where}: bilinmeyen şekil türü "${String(n.kind)}".`);
    if (!isNum(n.x, LIMITS.coordinate) || !isNum(n.y, LIMITS.coordinate)) return fail(`${where}: konum (x, y) geçersiz.`);
    if (!isNum(n.width, LIMITS.size) || !isNum(n.height, LIMITS.size) || n.width < 10 || n.height < 10) {
      return fail(`${where}: boyut (width, height) geçersiz.`);
    }
    const d = n.data;
    if (!isObject(d)) return fail(`${where}: "data" alanı yok.`);
    if (!isStr(d.title, LIMITS.title)) return fail(`${where}: başlık geçersiz ya da çok uzun.`);
    if (!isStr(d.description, LIMITS.description)) return fail(`${where}: açıklama geçersiz ya da çok uzun.`);
    if (typeof d.color !== 'string' || !COLOR_RE.test(d.color)) return fail(`${where}: renk #rrggbb biçiminde olmalı.`);
    const data: ShapeData = { title: d.title, description: d.description, color: d.color.toLowerCase() };
    if (n.kind === 'process') {
      // Sürüm 1 dosyalarında VSM verisi yoktur; boş veriyle başlar. Diğer şekillerdeki VSM verisi yok sayılır.
      const vsm = parseVsm(d.vsm, where, fail);
      if (!vsm) return;
      data.vsm = vsm;
    }
    nodeIds.add(n.id);
    nodes.push({
      id: n.id,
      kind: n.kind as ShapeKind,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      data,
    });
  });

  const edges: StoredEdge[] = [];
  const edgeIds = new Set<string>();
  rawEdges.forEach((e, i) => {
    const where = `${i + 1}. bağlantı`;
    if (!isObject(e)) return fail(`${where} bir nesne değil.`);
    if (!isId(e.id)) return fail(`${where}: "id" geçersiz.`);
    if (edgeIds.has(e.id)) return fail(`${where}: "${e.id}" kimliği birden fazla kez kullanılmış.`);
    if (!isId(e.source) || !nodeIds.has(e.source)) return fail(`${where}: başlangıç şekli bulunamadı.`);
    if (!isId(e.target) || !nodeIds.has(e.target)) return fail(`${where}: hedef şekli bulunamadı.`);
    const sourceHandle = e.sourceHandle ?? null;
    const targetHandle = e.targetHandle ?? null;
    if (!isHandle(sourceHandle) || !isHandle(targetHandle)) return fail(`${where}: bağlantı kenarı geçersiz.`);
    const label = e.label ?? '';
    if (!isStr(label, LIMITS.label)) return fail(`${where}: etiket geçersiz ya da çok uzun.`);
    edgeIds.add(e.id);
    // Sürüm 3 öncesinde tür yoktu: genel ok kabul edilir.
    const kind = e.kind ?? 'flow';
    if (!EDGE_KINDS.includes(kind as EdgeKind)) return fail(`${where}: bilinmeyen bağlantı türü "${String(kind)}".`);
    edges.push({ id: e.id, source: e.source, target: e.target, sourceHandle, targetHandle, label, kind: kind as EdgeKind });
  });

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    doc: {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      name,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
      viewport,
      vsmMap,
      nodes,
      edges,
    },
  };
}

/** JSON metnini okur ve doğrular. Hatalı metin hiçbir zaman istisna fırlatmaz. */
export function parseDocumentText(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Dosya geçerli bir JSON değil (biçim hatası).'] };
  }
  return parseDocument(raw);
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

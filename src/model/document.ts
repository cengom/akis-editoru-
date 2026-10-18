import { SHAPES, zIndexFor } from './shapes';
import { EDGE_KIND_SPECS } from './edges';
import {
  cloneInventory,
  cloneVsm,
  cloneVsmMap,
  emptyInventory,
  emptyKaizen,
  emptyVsm,
  emptyVsmMap,
  parseInventory,
  parseKaizen,
  parseVsm,
  parseVsmMap,
} from './vsm';
import {
  APP_ID,
  EDGE_KINDS,
  HANDLE_SIDES,
  REMOVED_VSM_FIELD_KEYS,
  REMOVED_VSM_MAP_FIELD_KEYS,
  SCHEMA_VERSION,
  SHAPE_KINDS,
  isStockKind,
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
  type MapState,
  type StateContent,
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

/**
 * Editördeki haritayı kayıt formatına çevirir.
 * `active`: editörde açık olan harita; `other`: diğer haritanın içeriği (yoksa `null`).
 * Üst düzey alanlar her zaman mevcut durumdur; gelecek durum `futureState` alanındadır.
 */
export function toDocument(
  name: string,
  nodes: ShapeNode[],
  edges: FlowEdge[],
  viewport: Viewport,
  vsmMap: VsmMapData,
  active: MapState = 'current',
  other: StateContent | null = null,
): DiagramDocument {
  const content = toStateContent(nodes, edges, viewport, vsmMap);
  const current = active === 'future' && other ? other : content;
  const future = active === 'future' ? content : other;
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    name,
    savedAt: new Date().toISOString(),
    ...current,
    futureState: future,
    activeState: future && active === 'future' ? 'future' : 'current',
  };
}

/** Editördeki tek bir haritanın içeriği. */
export function toStateContent(nodes: ShapeNode[], edges: FlowEdge[], viewport: Viewport, vsmMap: VsmMapData): StateContent {
  return {
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
  if (kind === 'kaizen') base.kaizen = data.kaizen ? { ...data.kaizen } : emptyKaizen();
  if (isStockKind(kind)) base.inventory = data.inventory ? cloneInventory(data.inventory) : emptyInventory();
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

/** Bir haritanın içeriğini tuval şekillerine çevirir. */
export function fromState(content: StateContent): { nodes: ShapeNode[]; edges: FlowEdge[] } {
  return { nodes: content.nodes.map(makeNode), edges: content.edges.map(makeEdge) };
}

/** Belgenin mevcut durum içeriği (üst düzey alanlar). */
export function currentContent(doc: DiagramDocument): StateContent {
  return { viewport: doc.viewport, vsmMap: doc.vsmMap, nodes: doc.nodes, edges: doc.edges };
}

/** Editörde açılacak harita ve diğeri. */
export function splitStates(doc: DiagramDocument): { active: MapState; activeContent: StateContent; otherContent: StateContent | null } {
  const current = currentContent(doc);
  if (doc.activeState === 'future' && doc.futureState) return { active: 'future', activeContent: doc.futureState, otherContent: current };
  return { active: 'current', activeContent: current, otherContent: doc.futureState };
}

/** Belgenin editörde açık olan haritasını tuval şekillerine çevirir. */
export function fromDocument(doc: DiagramDocument): { nodes: ShapeNode[]; edges: FlowEdge[] } {
  return fromState(splitStates(doc).activeContent);
}

/* ---------- Doğrulama ---------- */

/**
 * `warnings`: dosya açılabildi ama bir şey bilinçli olarak atıldı (ör. sürüm 4'te kaldırılan alanlar).
 * Kullanıcıya gösterilmelidir.
 */
export type ParseResult = { ok: true; doc: DiagramDocument; warnings: string[] } | { ok: false; errors: string[] };

/** Eski sürüm proses verisinde, artık kullanılmayan alanlara değer girilmiş mi? */
function hasRemovedVsmValues(rawVsm: unknown): boolean {
  if (!isObject(rawVsm) || !isObject(rawVsm.fields)) return false;
  const fields = rawVsm.fields;
  return REMOVED_VSM_FIELD_KEYS.some((k) => {
    const f = fields[k];
    return isObject(f) && f.value !== null && f.value !== undefined && f.value !== '';
  });
}

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
  const notes: ParseNotes = { removedValueCount: 0, droppedPitch: false };
  const failed = () => errors.length > 0;

  const current = parseStateContent(raw, '', fail, failed, notes);
  if (!current) return { ok: false, errors };
  // Sürüm 6 öncesinde gelecek durum yoktur.
  let futureState: StateContent | null = null;
  if (raw.futureState !== undefined && raw.futureState !== null) {
    if (!isObject(raw.futureState)) return { ok: false, errors: ['"futureState" alanı geçersiz.'] };
    futureState = parseStateContent(raw.futureState, 'Gelecek durum – ', fail, failed, notes);
    if (!futureState) return { ok: false, errors };
  }
  const activeState: MapState = raw.activeState === 'future' && futureState ? 'future' : 'current';

  const warnings: string[] = [];
  if (notes.removedValueCount > 0) {
    warnings.push(
      `${notes.removedValueCount} proseste eski "WIP / stok", "değer katan süre" ya da "değer katmayan süre" değerleri vardı. ` +
        'Klasik VSM yönteminde işlem süresi çevrim süresi (C/T), bekleme ise stok üçgenlerinden geldiği için bu alanlar kaldırıldı; değerler kullanılmadı.',
    );
  }
  if (notes.droppedPitch) {
    warnings.push(
      'Elle girilmiş "pitch" değeri kullanılmadı: pitch artık takt × paket adedi olarak hesaplanıyor. ' +
        'Pitch görmek için VSM genel verilerine "paket adedi" girin.',
    );
  }
  return {
    ok: true,
    warnings,
    doc: {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      name,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
      ...current,
      futureState,
      activeState,
    },
  };
}


interface ParseNotes {
  removedValueCount: number;
  droppedPitch: boolean;
}

/** Bir haritanın (mevcut ya da gelecek durum) içeriğini doğrular: görünüm, harita verileri, şekiller, oklar. */
function parseStateContent(
  src: Record<string, unknown>,
  prefix: string,
  fail: (msg: string) => void,
  failed: () => boolean,
  notes: ParseNotes,
): StateContent | null {
  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  if (src.viewport !== undefined) {
    const v = src.viewport;
    if (isObject(v) && isNum(v.x, LIMITS.coordinate * 10) && isNum(v.y, LIMITS.coordinate * 10) && isNum(v.zoom, 10) && v.zoom > 0) {
      viewport = { x: v.x, y: v.y, zoom: v.zoom };
    } else {
      fail(`${prefix}"viewport" alanı geçersiz.`);
    }
  }

  if (!Array.isArray(src.nodes)) fail(`${prefix}"nodes" bir liste olmalı.`);
  if (!Array.isArray(src.edges)) fail(`${prefix}"edges" bir liste olmalı.`);
  if (failed()) return null;

  const rawNodes = src.nodes as unknown[];
  const rawEdges = src.edges as unknown[];
  // Sürüm 3 öncesinde harita verisi yoktur; boş kabul edilir. Hata varsa aşağıda toplu döner.
  const vsmMap = parseVsmMap(src.vsmMap, fail) ?? emptyVsmMap();
  // Sürüm 5 öncesinde pitch elle girilirdi; artık takt × paket adedinden hesaplanıyor.
  notes.droppedPitch ||=
    isObject(src.vsmMap) &&
    isObject(src.vsmMap.fields) &&
    REMOVED_VSM_MAP_FIELD_KEYS.some((k) => {
      const f = (src.vsmMap as { fields: Record<string, unknown> }).fields[k];
      return isObject(f) && f.value !== null && f.value !== undefined && f.value !== '';
    });
  if (rawNodes.length > LIMITS.nodes) fail(`Çok fazla şekil var (en fazla ${LIMITS.nodes}).`);
  if (rawEdges.length > LIMITS.edges) fail(`Çok fazla bağlantı var (en fazla ${LIMITS.edges}).`);
  if (failed()) return null;

  const nodes: StoredNode[] = [];
  const nodeIds = new Set<string>();
  rawNodes.forEach((n, i) => {
    const where = `${prefix}${i + 1}. şekil`;
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
      if (hasRemovedVsmValues(d.vsm)) notes.removedValueCount++;
    }
    if (n.kind === 'kaizen') {
      const kaizen = parseKaizen(d.kaizen, where, fail);
      if (!kaizen) return;
      data.kaizen = kaizen;
    }
    if (isStockKind(n.kind as string)) {
      const inventory = parseInventory(d.inventory, where, fail);
      if (!inventory) return;
      data.inventory = inventory;
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
    const where = `${prefix}${i + 1}. bağlantı`;
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

  if (failed()) return null;
  // Hız belirleyici artık olmayan ya da proses olmayan bir şekli gösteriyorsa seçim kaldırılır.
  if (vsmMap.pacemakerId && !nodes.some((n) => n.id === vsmMap.pacemakerId && n.kind === 'process')) vsmMap.pacemakerId = null;
  return { viewport, vsmMap, nodes, edges };
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

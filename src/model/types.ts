import type { Edge, Node } from '@xyflow/react';

/**
 * Kayıt formatının sürümü. Formatta değişiklik olursa artırılır.
 * 1: ilk sürüm. 2: proseslere VSM verileri (`data.vsm`) eklendi.
 * 3: harita düzeyi VSM verileri (`vsmMap`), VSM şekilleri ve bağlantı türleri (`edge.kind`).
 * 4: klasik VSM yöntemi — proseste "değer katan/katmayan süre" ve "WIP" alanları kaldırıldı;
 *    stok verisi stok üçgenlerinde (`data.inventory`). İşlem süresi = çevrim süresi (C/T).
 * 5: proseste EPEI, hurda (%) ve parti büyüklüğü; haritada elle girilen "pitch" yerine "paket adedi"
 *    (pitch artık takt × paket adedi olarak hesaplanır).
 * Eski sürüm dosyaları hâlâ açılır; eksik alanlar boş kabul edilir, kaldırılan alanlar yok sayılır.
 */
export const SCHEMA_VERSION = 5 as const;
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5] as const;

/** Dosyanın bu uygulamaya ait olduğunu gösteren işaret. */
export const APP_ID = 'akis-editoru' as const;

export const SHAPE_KINDS = [
  // Genel şekiller
  'terminal',
  'process',
  'decision',
  'department',
  'note',
  // VSM sembolleri
  'customer',
  'supplier',
  'inventory',
  'kaizen',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Her şeklin dört kenarındaki bağlantı noktaları. */
export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type HandleSide = (typeof HANDLE_SIDES)[number];

/**
 * Bağlantı türleri. `flow`: genel ok. VSM: `info` bilgi akışı, `material` malzeme (itme) akışı,
 * `shipment` sevkiyat.
 */
export const EDGE_KINDS = ['flow', 'info', 'material', 'shipment'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/* ---------- VSM (değer akışı) verileri ---------- */

/** VSM alanlarının anahtarları. Yeni alan eklemek için buraya ve `vsm.ts` içindeki kataloğa ekleyin. */
export const VSM_FIELD_KEYS = [
  'cycleTime',
  'changeoverTime',
  'uptime',
  'operators',
  'distance',
  'epei',
  'scrapRate',
  'batchSize',
] as const;

/** Sürüm 4'te kaldırılan proses alanları (eski dosyalarda bulunabilir; okunmaz). */
export const REMOVED_VSM_FIELD_KEYS = ['wip', 'valueAddedTime', 'nonValueAddedTime'] as const;
export type VsmFieldKey = (typeof VSM_FIELD_KEYS)[number];

export const TIME_UNITS = ['sn', 'dk', 'saat'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

/** VSM alanlarında kullanılabilecek tüm birimler. Her alanın izinli birimleri katalogda tanımlıdır. */
export const VSM_UNITS = [
  ...TIME_UNITS,
  '%',
  'kişi',
  'adet',
  'gün',
  'm',
  'adet/gün',
  'dk/gün',
  'sn/gün',
  'vardiya',
  'kez/gün',
  'kez/hafta',
  'kez/ay',
  'hafta',
] as const;
export type VsmUnit = (typeof VSM_UNITS)[number];

/**
 * Sayı + birim. Boş alan `value: null` ile gösterilir;
 * 0 geçerli bir değerdir ve "boş" anlamına gelmez.
 */
export interface VsmQuantity {
  value: number | null;
  unit: VsmUnit;
}

/** Yalnızca "proses" şekillerinde bulunan VSM verileri. */
export interface VsmData {
  /** Veri kutusu tuvalde, prosesin altında gösterilsin mi? */
  showDataBox: boolean;
  fields: Record<VsmFieldKey, VsmQuantity>;
  note: string;
}

/** Stok üçgeninin verisi. Miktar adet ya da doğrudan gün olarak girilir. */
export interface InventoryData {
  stock: VsmQuantity;
}

/** Harita (hat) düzeyindeki VSM alanları. */
export const VSM_MAP_FIELD_KEYS = ['customerDemand', 'netWorkingTime', 'shifts', 'shipmentFrequency', 'packQuantity'] as const;

/** Sürüm 5'te kaldırılan harita alanları (pitch artık hesaplanıyor). */
export const REMOVED_VSM_MAP_FIELD_KEYS = ['pitch'] as const;
export type VsmMapFieldKey = (typeof VSM_MAP_FIELD_KEYS)[number];

/** Haritanın genel VSM verileri ve görünüm tercihleri. */
export interface VsmMapData {
  fields: Record<VsmMapFieldKey, VsmQuantity>;
  /** Tuvalin altında zaman çizgisi gösterilsin mi? */
  showTimeline: boolean;
}

/** Bir şeklin taşıdığı, düzenlenebilir veri. */
export type ShapeData = {
  title: string;
  description: string;
  /** #rrggbb biçiminde dolgu rengi */
  color: string;
  /** Yalnızca `process` türünde dolu; diğer şekillerde yoktur. */
  vsm?: VsmData;
  /** Yalnızca `inventory` (stok üçgeni) türünde dolu. */
  inventory?: InventoryData;
};

/** Tuvaldeki (React Flow) şekil. `type` alanı şeklin türüdür. */
export type ShapeNode = Node<ShapeData, ShapeKind>;

/** Tuvaldeki bağlantı (ok). Etiket `label` alanında düz metin olarak tutulur. */
export type FlowEdge = Edge;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Dosyaya / tarayıcıya kaydedilen şekil. */
export interface StoredNode {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  data: ShapeData;
}

/** Dosyaya / tarayıcıya kaydedilen bağlantı. */
export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: HandleSide | null;
  targetHandle: HandleSide | null;
  label: string;
  kind: EdgeKind;
}

/** Kayıt formatının tamamı (JSON dosyası ve yerel kayıt aynı formatı kullanır). */
export interface DiagramDocument {
  app: typeof APP_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  savedAt: string;
  viewport: Viewport;
  vsmMap: VsmMapData;
  nodes: StoredNode[];
  edges: StoredEdge[];
}

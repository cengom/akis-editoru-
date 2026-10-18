import type { Edge, Node } from '@xyflow/react';

/**
 * Kayıt formatının sürümü. Formatta değişiklik olursa artırılır.
 * 1: ilk sürüm. 2: proseslere VSM verileri (`data.vsm`) eklendi.
 * 3: harita düzeyi VSM verileri (`vsmMap`), VSM şekilleri ve bağlantı türleri (`edge.kind`).
 * 4: klasik VSM yöntemi — proseste "değer katan/katmayan süre" ve "WIP" alanları kaldırıldı;
 *    stok verisi stok üçgenlerinde (`data.inventory`). İşlem süresi = çevrim süresi (C/T).
 * 5: proseste EPEI, hurda (%) ve parti büyüklüğü; haritada elle girilen "pitch" yerine "paket adedi"
 *    (pitch artık takt × paket adedi olarak hesaplanır).
 * 6: gelecek durum haritası (`futureState`) ve açık olan harita (`activeState`); çekme/planlama sembolleri,
 *    süpermarket boyutu ve kaizen verisi.
 * 7: OEE için proses alanları (ideal C/T, plansız duruş, günlük değişim sayısı).
 * 8: birden fazla ürün ailesi (karma model): haritada aile listesi (talep ve paket adedi aileye taşındı),
 *    proseste geçen aileler ve aile başına C/T, stokta aile.
 * Eski sürüm dosyaları hâlâ açılır; eksik alanlar boş kabul edilir, kaldırılan alanlar yok sayılır.
 */
export const SCHEMA_VERSION = 8 as const;
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

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
  'control',
  'operator',
  'truck',
  // Çekme sistemi ve planlama sembolleri
  'supermarket',
  'fifo',
  'safetyStock',
  'kanbanProduction',
  'kanbanWithdrawal',
  'kanbanSignal',
  'kanbanPost',
  'heijunka',
  'goSee',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Stok tutan şekiller: stok verisi taşır ve zaman çizgisinde bekleme olarak sayılır. */
export const STOCK_KINDS = ['inventory', 'supermarket', 'fifo', 'safetyStock'] as const satisfies readonly ShapeKind[];
export type StockKind = (typeof STOCK_KINDS)[number];
export const isStockKind = (k: string): k is StockKind => (STOCK_KINDS as readonly string[]).includes(k);

/** Her şeklin dört kenarındaki bağlantı noktaları. */
export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type HandleSide = (typeof HANDLE_SIDES)[number];

/**
 * Bağlantı türleri. `flow`: genel ok. VSM: `info` elle bilgi akışı, `electronic` elektronik bilgi akışı
 * (zikzak), `material` malzeme (itme) akışı, `pull` çekme (malzeme çekilmesi), `shipment` sevkiyat.
 */
export const EDGE_KINDS = ['flow', 'info', 'electronic', 'material', 'pull', 'shipment'] as const;
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
  'idealCycleTime',
  'unplannedDowntime',
  'changeoversPerDay',
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
  /** Bu prosesten geçen aileler; boş liste = tüm aileler */
  familyIds: string[];
  /** Aile başına çevrim süresi; olmayan aile için ortak `cycleTime` kullanılır */
  cycleByFamily: Record<string, VsmQuantity>;
}

/** Stok üçgeninin verisi. Miktar adet ya da doğrudan gün olarak girilir. */
export interface InventoryData {
  stock: VsmQuantity;
  /** Yalnızca süpermarket boyut hesabı için: yenileme süresi (gün/saat) */
  replenishTime: VsmQuantity;
  /** Yalnızca süpermarket boyut hesabı için: güvenlik payı (%) */
  safetyRate: VsmQuantity;
  /** Stok tek bir aileye aitse o ailenin kimliği; `null` = tüm aileler */
  familyId: string | null;
}

export const KAIZEN_STATUSES = ['open', 'doing', 'done'] as const;
export type KaizenStatus = (typeof KAIZEN_STATUSES)[number];

/** Kaizen patlamasının eylem bilgisi. */
export interface KaizenData {
  owner: string;
  /** YYYY-AA-GG; boşsa tarih yok */
  dueDate: string;
  status: KaizenStatus;
}

/** Harita (hat) düzeyindeki VSM alanları. */
export const VSM_MAP_FIELD_KEYS = ['netWorkingTime', 'shifts', 'shipmentFrequency'] as const;

/** Ürün ailesi: kendi talebi ve paket adedi olan, aynı proseslerden geçen ürün grubu. */
export interface ProductFamily {
  id: string;
  name: string;
  /** #rrggbb */
  color: string;
  /** adet/gün */
  demand: VsmQuantity;
  /** adet */
  packQuantity: VsmQuantity;
}

/** Hesapların görünümü: tek bir aile ya da tüm aileler birlikte */
export type FamilyView = 'all' | string;

/** Sürüm 5'te kaldırılan harita alanları (pitch artık hesaplanıyor). */
export const REMOVED_VSM_MAP_FIELD_KEYS = ['pitch'] as const;
export type VsmMapFieldKey = (typeof VSM_MAP_FIELD_KEYS)[number];

/** Haritanın genel VSM verileri ve görünüm tercihleri. */
export interface VsmMapData {
  fields: Record<VsmMapFieldKey, VsmQuantity>;
  /** Tuvalin altında zaman çizgisi gösterilsin mi? */
  showTimeline: boolean;
  /** Prosesler C/T ÷ takt oranına göre renklendirilsin mi? (yalnızca görünüm) */
  colorByTakt: boolean;
  /** Ürün aileleri (en az bir aile vardır) */
  families: ProductFamily[];
  /** Hesapların ve grafiklerin gösterdiği aile (yalnızca görünüm) */
  familyView: FamilyView;
}

/** Bir şeklin taşıdığı, düzenlenebilir veri. */
export type ShapeData = {
  title: string;
  description: string;
  /** #rrggbb biçiminde dolgu rengi */
  color: string;
  /** Yalnızca `process` türünde dolu; diğer şekillerde yoktur. */
  vsm?: VsmData;
  /** Yalnızca stok tutan şekillerde (stok üçgeni, süpermarket, FIFO, güvenlik stoğu) dolu. */
  inventory?: InventoryData;
  /** Yalnızca `kaizen` şeklinde dolu. */
  kaizen?: KaizenData;
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

/** Projedeki iki harita: mevcut durum ve (isteğe bağlı) gelecek durum. */
export type MapState = 'current' | 'future';

/** Bir haritanın içeriği. */
export interface StateContent {
  viewport: Viewport;
  vsmMap: VsmMapData;
  nodes: StoredNode[];
  edges: StoredEdge[];
}

/** Kayıt formatının tamamı (JSON dosyası ve yerel kayıt aynı formatı kullanır). */
export interface DiagramDocument {
  app: typeof APP_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  savedAt: string;
  viewport: Viewport;
  vsmMap: VsmMapData;
  /** Mevcut durum haritasının şekilleri (üst düzey alanlar her zaman mevcut durumdur) */
  nodes: StoredNode[];
  edges: StoredEdge[];
  /** Gelecek durum haritası; henüz oluşturulmadıysa `null` */
  futureState: StateContent | null;
  /** Editörde açık olan harita */
  activeState: MapState;
}

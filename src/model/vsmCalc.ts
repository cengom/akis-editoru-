import type { ShapeNode, VsmMapData, VsmQuantity } from './types';
import { toSeconds } from './vsm';

/*
 * VSM özet hesapları (klasik yöntem, Rother & Shook "Learning to See"):
 * - İşlem süresi: her prosesin çevrim süresi (C/T). Zaman çizgisinin alt basamakları.
 * - Bekleme: prosesler arasındaki stok üçgenleri. Gün = stok adedi ÷ günlük müşteri talebi.
 *   Zaman çizgisinin üst basamakları.
 * - Lead time: bekleme günleri + işlem süresi (günlük net çalışma süresiyle güne çevrilir).
 * - Değer katma oranı: işlem süresi ÷ lead time.
 * Hepsi saf fonksiyonlardır. Boş değer (`null`) hesaba katılmaz; 0 ise gerçek değer olarak toplanır.
 */

export interface TaktResult {
  /** Saniye cinsinden takt süresi; hesaplanamıyorsa `null`. */
  seconds: number | null;
  /** Hesaplanamama nedeni (Türkçe). */
  reason: string | null;
}

/** Takt süresi = net çalışma süresi / müşteri talebi. */
export function computeTakt(map: VsmMapData): TaktResult {
  const net = toSeconds(map.fields.netWorkingTime);
  const demand = map.fields.customerDemand.value;
  if (net === null && demand === null) return { seconds: null, reason: 'Müşteri talebi ve net çalışma süresi girilmedi.' };
  if (demand === null) return { seconds: null, reason: 'Müşteri talebi girilmedi.' };
  if (net === null) return { seconds: null, reason: 'Net çalışma süresi girilmedi.' };
  if (demand === 0) return { seconds: null, reason: 'Müşteri talebi 0 olduğu için takt hesaplanamaz.' };
  return { seconds: net / demand, reason: null };
}

/** Çevrim süresi takt süresinden büyükse true. */
export function isOverTakt(cycleSeconds: number | null, taktSeconds: number | null): boolean {
  return cycleSeconds !== null && taktSeconds !== null && cycleSeconds > taktSeconds;
}

export interface InventoryDays {
  /** Bekleme günü; hesaplanamıyorsa `null`. */
  days: number | null;
  /** Gün, adetten talebe bölünerek mi hesaplandı (elle girilmedi)? */
  calculated: boolean;
  /** Hesaplanamama nedeni */
  reason: string | null;
}

/** Stok üçgeninin bekleme günü: "gün" girildiyse o, "adet" girildiyse adet ÷ günlük talep. */
export function inventoryDays(stock: VsmQuantity, demand: VsmQuantity): InventoryDays {
  if (stock.value === null) return { days: null, calculated: false, reason: 'Stok girilmedi.' };
  if (stock.unit === 'gün') return { days: stock.value, calculated: false, reason: null };
  if (demand.value === null) return { days: null, calculated: true, reason: 'Gün hesabı için müşteri talebi gerekli.' };
  if (demand.value === 0) return { days: null, calculated: true, reason: 'Müşteri talebi 0.' };
  return { days: stock.value / demand.value, calculated: true, reason: null };
}

export interface ProcessStep {
  kind: 'process';
  id: string;
  title: string;
  x: number;
  cycleSec: number | null;
  distance: number | null;
  overTakt: boolean;
}

export interface InventoryStep extends InventoryDays {
  kind: 'inventory';
  id: string;
  title: string;
  x: number;
  stock: VsmQuantity;
}

export type TimelineStep = ProcessStep | InventoryStep;

/** Toplam + kaç adımın bu değeri doldurduğu. Hiçbiri doldurmadıysa `value` boştur. */
export interface Total {
  value: number | null;
  filled: number;
}

export interface VsmSummary {
  takt: TaktResult;
  /** VSM verisi girilmiş prosesler, soldan sağa */
  processes: ProcessStep[];
  /** Stok verisi girilmiş üçgenler, soldan sağa */
  inventories: InventoryStep[];
  /** Zaman çizgisi: prosesler ve stoklar birlikte, tuvaldeki soldan sağa sırayla */
  steps: TimelineStep[];
  /** Toplam işlem süresi (saniye) = çevrim sürelerinin toplamı */
  processingSec: Total;
  /** Stoklarda toplam bekleme (gün) */
  waitDays: Total;
  /** Üretim lead time (gün) */
  leadTimeDays: number | null;
  /** İşlem süresi lead time'a eklendi mi (net çalışma süresi biliniyorsa)? */
  leadTimeIncludesProcessing: boolean;
  /** Değer katma oranı (0–1); hesaplanamıyorsa `null` */
  valueAddedRatio: number | null;
  totalDistance: Total;
  overTakt: ProcessStep[];
  /** Adet girilmiş ama talep olmadığı için günü hesaplanamayan stok sayısı */
  inventoriesMissingDemand: number;
  netTimeOverDay: boolean;
}

function sum(values: (number | null)[]): Total {
  const filled = values.filter((v): v is number => v !== null);
  return { value: filled.length ? filled.reduce((a, b) => a + b, 0) : null, filled: filled.length };
}

const byX = (a: { x: number }, b: { x: number }) => a.x - b.x;

export function computeSummary(nodes: ShapeNode[], map: VsmMapData): VsmSummary {
  const takt = computeTakt(map);
  const demand = map.fields.customerDemand;

  const processes: ProcessStep[] = nodes
    .filter((n) => n.type === 'process' && n.data.vsm && Object.values(n.data.vsm.fields).some((q) => q.value !== null))
    .map((n) => {
      const f = n.data.vsm!.fields;
      const cycleSec = toSeconds(f.cycleTime);
      return {
        kind: 'process' as const,
        id: n.id,
        title: n.data.title.trim() || 'Başlıksız',
        x: n.position.x,
        cycleSec,
        distance: f.distance.value,
        overTakt: isOverTakt(cycleSec, takt.seconds),
      };
    })
    .sort(byX);

  const inventories: InventoryStep[] = nodes
    .filter((n) => n.type === 'inventory' && n.data.inventory && n.data.inventory.stock.value !== null)
    .map((n) => ({
      kind: 'inventory' as const,
      id: n.id,
      title: n.data.title.trim() || 'Stok',
      x: n.position.x,
      stock: n.data.inventory!.stock,
      ...inventoryDays(n.data.inventory!.stock, demand),
    }))
    .sort(byX);

  const processingSec = sum(processes.map((p) => p.cycleSec));
  const waitDays = sum(inventories.map((i) => i.days));
  const daySec = toSeconds(map.fields.netWorkingTime);
  const usableDay = daySec !== null && daySec > 0 ? daySec : null;

  // İşlem süresi ancak günlük net çalışma süresi biliniyorsa güne çevrilip eklenebilir.
  const processingDays = usableDay && processingSec.value !== null ? processingSec.value / usableDay : null;
  const leadTimeDays =
    waitDays.value === null && processingDays === null ? null : (waitDays.value ?? 0) + (processingDays ?? 0);
  const leadTimeIncludesProcessing = usableDay !== null && processingSec.value !== null;
  const valueAddedRatio =
    usableDay && processingSec.value !== null && leadTimeDays !== null && leadTimeDays > 0
      ? processingSec.value / (leadTimeDays * usableDay)
      : null;

  return {
    takt,
    processes,
    inventories,
    steps: [...processes, ...inventories].sort(byX),
    processingSec,
    waitDays,
    leadTimeDays,
    leadTimeIncludesProcessing,
    valueAddedRatio,
    totalDistance: sum(processes.map((p) => p.distance)),
    overTakt: processes.filter((p) => p.overTakt),
    inventoriesMissingDemand: inventories.filter((i) => i.days === null).length,
    netTimeOverDay: daySec !== null && daySec > 24 * 3600,
  };
}

import { isStockKind, type FlowEdge, type ShapeKind, type ShapeNode, type VsmData, type VsmMapData, type VsmQuantity } from './types';
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

/**
 * Etkin çevrim süresi: duruşlar (uptime) ve hurda düşüldükten sonra iyi bir parçanın gerçekte aldığı süre.
 * Etkin C/T = C/T ÷ uptime ÷ (1 − hurda). Uptime ya da hurda boşsa o etki yok sayılır.
 * Yalnızca kapasite karşılaştırması içindir; zaman çizgisindeki işlem süresi klasik C/T olarak kalır.
 */
export function effectiveCycleSeconds(vsm: VsmData): number | null {
  const ct = toSeconds(vsm.fields.cycleTime);
  if (ct === null) return null;
  const uptime = vsm.fields.uptime.value;
  const scrap = vsm.fields.scrapRate.value;
  const u = uptime === null ? 1 : uptime / 100;
  const good = scrap === null ? 1 : 1 - scrap / 100;
  if (u <= 0 || good <= 0) return null; // %0 uptime ya da %100 hurda: üretim yok
  return ct / u / good;
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

export interface SupermarketSizing {
  /** Gereken stok (adet) = günlük talep × yenileme (gün) × (1 + güvenlik) */
  requiredQty: number | null;
  /** Kanban kartı = ⌈gereken ÷ paket adedi⌉ */
  kanbanCards: number | null;
  reason: string | null;
}

/** Süpermarket boyutu ve kanban kartı sayısı. */
export function supermarketSizing(
  replenishTime: VsmQuantity,
  safetyRate: VsmQuantity,
  demand: VsmQuantity,
  packQuantity: VsmQuantity,
): SupermarketSizing {
  if (demand.value === null) return { requiredQty: null, kanbanCards: null, reason: 'Müşteri talebi gerekli.' };
  if (replenishTime.value === null) return { requiredQty: null, kanbanCards: null, reason: 'Yenileme süresini girin.' };
  const days = replenishTime.unit === 'saat' ? replenishTime.value / 24 : replenishTime.value;
  const requiredQty = demand.value * days * (1 + (safetyRate.value ?? 0) / 100);
  const pack = packQuantity.value;
  return {
    requiredQty,
    kanbanCards: pack && pack > 0 ? Math.ceil(requiredQty / pack - 1e-9) : null,
    reason: pack && pack > 0 ? null : 'Kanban kartı için harita verilerine paket adedi girin.',
  };
}

export interface ProcessStep {
  kind: 'process';
  id: string;
  title: string;
  x: number;
  cycleSec: number | null;
  /** Uptime ve hurda dahil etkin C/T */
  effectiveCycleSec: number | null;
  operators: number | null;
  distance: number | null;
  /** C/T > takt */
  overTakt: boolean;
  /** C/T ≤ takt ama etkin C/T > takt (duruş/hurda nedeniyle kapasite yetmiyor) */
  overTaktEffective: boolean;
}

export interface InventoryStep extends InventoryDays {
  kind: 'inventory';
  /** Şeklin türü: stok üçgeni, süpermarket, FIFO ya da güvenlik stoğu */
  shapeKind: ShapeKind;
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
  /** Zaman çizgisi: prosesler ve stoklar birlikte, akış oklarına göre sıralı */
  steps: TimelineStep[];
  /** Sıralama oklardan mı yapıldı (yoksa yalnızca yatay konumdan mı)? */
  orderedByArrows: boolean;
  /** En büyük C/T'ye sahip proses (darboğaz) */
  bottleneck: ProcessStep | null;
  /** Teorik gereken operatör = ⌈∑C/T ÷ takt⌉ */
  requiredOperators: number | null;
  /** Proseslere girilen operatörlerin toplamı */
  currentOperators: Total;
  /** Pitch (saniye) = takt × paket adedi */
  pitchSec: number | null;
  pitchReason: string | null;
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
  /** Yalnızca etkin C/T ile takt üstü olanlar */
  overTaktEffective: ProcessStep[];
  /** Adet girilmiş ama talep olmadığı için günü hesaplanamayan stok sayısı */
  inventoriesMissingDemand: number;
  netTimeOverDay: boolean;
}

function sum(values: (number | null)[]): Total {
  const filled = values.filter((v): v is number => v !== null);
  return { value: filled.length ? filled.reduce((a, b) => a + b, 0) : null, filled: filled.length };
}

const byX = (a: { x: number }, b: { x: number }) => a.x - b.x;

/** Bilgi akışı okları hariç: malzeme/sevkiyat/genel oklar ürünün yolunu gösterir. */
const isFlowEdge = (e: FlowEdge) => e.type !== 'info';

/**
 * Şekilleri akış oklarına göre sıralar (topolojik sıra).
 * 1. Geri dönüş okları (ör. yeniden işleme, "Hayır" dalının geri dönmesi) bulunur ve sıralamada yok sayılır:
 *    soldan başlayan derinlik öncelikli gezinmede, yolda zaten bulunan bir şekle dönen ok geri dönüş okudur.
 * 2. Kalan oklarla sıralanır; aynı anda sıraya girebilen şekiller arasında soldaki önce gelir.
 *    Oku olmayan şekiller (ör. iki proses arasına konmuş stok) böylece yatay konumuna göre araya yerleşir.
 * Dönen: şekil kimliği → sıra numarası.
 */
export function flowOrder(nodes: ShapeNode[], edges: FlowEdge[]): { rank: Map<string, number>; usedArrows: boolean } {
  const ids = new Set(nodes.map((n) => n.id));
  const x = new Map(nodes.map((n) => [n.id, n.position.x]));
  const byLeft = (a: string, b: string) => (x.get(a) ?? 0) - (x.get(b) ?? 0);
  const out = new Map<string, string[]>();
  let usedArrows = false;
  for (const e of edges) {
    if (!isFlowEdge(e) || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    usedArrows = true;
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  }
  for (const list of out.values()) list.sort(byLeft);

  // 1) Geri dönüş oklarını bul (yinelemeli DFS; 1 = yolda, 2 = bitti).
  const state = new Map<string, 1 | 2>();
  const back = new Set<string>();
  for (const start of [...ids].sort(byLeft)) {
    if (state.has(start)) continue;
    const stack: { id: string; i: number }[] = [{ id: start, i: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = (out.get(top.id) ?? [])[top.i++];
      if (next === undefined) {
        state.set(top.id, 2);
        stack.pop();
      } else if (state.get(next) === 1) {
        back.add(`${top.id}>${next}`);
      } else if (!state.has(next)) {
        state.set(next, 1);
        stack.push({ id: next, i: 0 });
      }
    }
  }

  // 2) Geri dönüşler hariç oklarla sırala.
  const indeg = new Map<string, number>([...ids].map((id) => [id, 0]));
  for (const [src, list] of out) for (const t of list) if (!back.has(`${src}>${t}`)) indeg.set(t, (indeg.get(t) ?? 0) + 1);
  const rank = new Map<string, number>();
  const remaining = new Set(ids);
  while (remaining.size) {
    const ready = [...remaining].filter((id) => (indeg.get(id) ?? 0) === 0);
    const next = (ready.length ? ready : [...remaining]).sort(byLeft)[0];
    remaining.delete(next);
    rank.set(next, rank.size);
    for (const t of out.get(next) ?? []) {
      if (!back.has(`${next}>${t}`) && remaining.has(t)) indeg.set(t, (indeg.get(t) ?? 1) - 1);
    }
  }
  return { rank, usedArrows };
}

export function computeSummary(nodes: ShapeNode[], edges: FlowEdge[], map: VsmMapData): VsmSummary {
  const takt = computeTakt(map);
  const demand = map.fields.customerDemand;

  const processes: ProcessStep[] = nodes
    .filter((n) => n.type === 'process' && n.data.vsm && Object.values(n.data.vsm.fields).some((q) => q.value !== null))
    .map((n) => {
      const f = n.data.vsm!.fields;
      const cycleSec = toSeconds(f.cycleTime);
      const effectiveCycleSec = effectiveCycleSeconds(n.data.vsm!);
      const overTakt = isOverTakt(cycleSec, takt.seconds);
      return {
        kind: 'process' as const,
        id: n.id,
        title: n.data.title.trim() || 'Başlıksız',
        x: n.position.x,
        cycleSec,
        effectiveCycleSec,
        operators: f.operators.value,
        distance: f.distance.value,
        overTakt,
        overTaktEffective: !overTakt && isOverTakt(effectiveCycleSec, takt.seconds),
      };
    })
    .sort(byX);

  const inventories: InventoryStep[] = nodes
    .filter((n) => isStockKind(n.type ?? '') && n.data.inventory && n.data.inventory.stock.value !== null)
    .map((n) => ({
      kind: 'inventory' as const,
      shapeKind: n.type as ShapeKind,
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

  const { rank, usedArrows } = flowOrder(nodes, edges);
  const steps: TimelineStep[] = [...processes, ...inventories].sort(
    (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
  );

  const withCycle = processes.filter((p) => p.cycleSec !== null);
  const bottleneck = withCycle.length ? withCycle.reduce((a, b) => ((b.cycleSec as number) > (a.cycleSec as number) ? b : a)) : null;
  const requiredOperators =
    takt.seconds && takt.seconds > 0 && processingSec.value !== null ? Math.ceil(processingSec.value / takt.seconds - 1e-9) : null;

  const pack = map.fields.packQuantity.value;
  const pitchSec = takt.seconds !== null && pack !== null && pack > 0 ? takt.seconds * pack : null;
  const pitchReason =
    pitchSec !== null ? null : takt.seconds === null ? 'Önce takt hesaplanmalı.' : 'Paket adedi girilmedi.';

  return {
    takt,
    processes,
    inventories,
    steps,
    orderedByArrows: usedArrows,
    bottleneck,
    requiredOperators,
    currentOperators: sum(processes.map((p) => p.operators)),
    pitchSec,
    pitchReason,
    processingSec,
    waitDays,
    leadTimeDays,
    leadTimeIncludesProcessing,
    valueAddedRatio,
    totalDistance: sum(processes.map((p) => p.distance)),
    overTakt: processes.filter((p) => p.overTakt),
    overTaktEffective: processes.filter((p) => p.overTaktEffective),
    inventoriesMissingDemand: inventories.filter((i) => i.days === null).length,
    netTimeOverDay: daySec !== null && daySec > 24 * 3600,
  };
}

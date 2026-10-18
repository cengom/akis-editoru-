import type { ShapeNode, VsmMapData } from './types';
import { toSeconds } from './vsm';

/*
 * VSM özet hesapları. Hepsi saf fonksiyonlardır; girdi değişmez.
 * Boş değer (`null`) hesaba katılmaz; 0 ise gerçek değer olarak toplanır.
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

export interface ProcessCalc {
  id: string;
  title: string;
  x: number;
  cycleSec: number | null;
  vaSec: number | null;
  nvaSec: number | null;
  distance: number | null;
  overTakt: boolean;
}

/** Toplam + kaç prosesin bu alanı doldurduğu. Hiçbiri doldurmadıysa `value` boştur. */
export interface Total {
  value: number | null;
  filled: number;
}

export interface VsmSummary {
  takt: TaktResult;
  /** VSM verisi girilmiş prosesler, soldan sağa (x konumuna göre) sıralı. */
  processes: ProcessCalc[];
  totalVa: Total;
  totalNva: Total;
  /** Toplam değer katan + değer katmayan süre. */
  leadTime: Total;
  totalDistance: Total;
  overTakt: ProcessCalc[];
  netTimeOverDay: boolean;
}

function sum(values: (number | null)[]): Total {
  const filled = values.filter((v): v is number => v !== null);
  return { value: filled.length ? filled.reduce((a, b) => a + b, 0) : null, filled: filled.length };
}

export function computeSummary(nodes: ShapeNode[], map: VsmMapData): VsmSummary {
  const takt = computeTakt(map);
  const processes: ProcessCalc[] = nodes
    .filter((n) => n.type === 'process' && n.data.vsm && Object.values(n.data.vsm.fields).some((q) => q.value !== null))
    .map((n) => {
      const f = n.data.vsm!.fields;
      const cycleSec = toSeconds(f.cycleTime);
      return {
        id: n.id,
        title: n.data.title.trim() || 'Başlıksız',
        x: n.position.x,
        cycleSec,
        vaSec: toSeconds(f.valueAddedTime),
        nvaSec: toSeconds(f.nonValueAddedTime),
        distance: f.distance.value,
        overTakt: isOverTakt(cycleSec, takt.seconds),
      };
    })
    .sort((a, b) => a.x - b.x);

  const totalVa = sum(processes.map((p) => p.vaSec));
  const totalNva = sum(processes.map((p) => p.nvaSec));
  const leadTime: Total =
    totalVa.value === null && totalNva.value === null
      ? { value: null, filled: 0 }
      : { value: (totalVa.value ?? 0) + (totalNva.value ?? 0), filled: Math.max(totalVa.filled, totalNva.filled) };
  const net = toSeconds(map.fields.netWorkingTime);

  return {
    takt,
    processes,
    totalVa,
    totalNva,
    leadTime,
    totalDistance: sum(processes.map((p) => p.distance)),
    overTakt: processes.filter((p) => p.overTakt),
    netTimeOverDay: net !== null && net > 24 * 3600,
  };
}

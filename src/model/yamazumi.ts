import { WORK_KINDS, type FlowEdge, type ShapeNode, type VsmData, type VsmMapData, type WorkKind } from './types';
import { toSeconds } from './vsm';
import { computeTakt, familyLoad, flowOrder } from './vsmCalc';
import { familyCycle, isMultiFamily, passes, viewFamily } from './families';

/*
 * Operatör dengeleme (Yamazumi) hesapları. Saf fonksiyonlardır.
 * - İş adımı girilmiş proseste her operatörün yükü = o operatöre atanmış adımların süre toplamı,
 *   türlere göre (katma değerli / gerekli / israf) ayrılır.
 * - İş adımı yoksa prosesin C/T ve operatör alanına geri düşülür: her operatörün yükü C/T kabul edilir
 *   (türü bilinmez). Operatör sayısı boşsa 1 kabul edilir; 0 ise (otomatik proses) operatör yükü yoktur.
 * - Denge oranı = Σ iş ÷ (operatör sayısı × en yüklü operatörün yükü).
 * - Gereken operatör = ⌈Σ iş ÷ takt⌉.
 * Süresi boş (`null`) adım hesaba katılmaz ve ayrıca sayılır; 0 sn gerçek değerdir.
 */

/** Grafikteki parça türleri: üç iş türü ve C/T'den gelen, türü bilinmeyen süre. */
export type YamazumiKind = WorkKind | 'unknown';
export const YAMAZUMI_KINDS: readonly YamazumiKind[] = [...WORK_KINDS, 'unknown'];

export type KindTotals = Record<YamazumiKind, number>;
const zeroKinds = (): KindTotals => ({ va: 0, nva: 0, waste: 0, unknown: 0 });

export interface OperatorBar {
  /** Benzersiz anahtar: proses kimliği + operatör numarası */
  key: string;
  processId: string;
  processTitle: string;
  operator: number;
  /** Türlere göre saniye (yalnızca süresi bilinen adımlar) */
  byKind: KindTotals;
  /** Toplam yük (sn); hiçbir adımın süresi bilinmiyorsa `null` */
  totalSec: number | null;
  stepCount: number;
  /** Süresi girilmemiş adım sayısı */
  missingTimes: number;
  overTakt: boolean;
}

export interface YamazumiProcess {
  id: string;
  title: string;
  /** `steps`: iş adımlarından; `cycle`: C/T ve operatör alanından (geri düşme) */
  source: 'steps' | 'cycle';
  operators: OperatorBar[];
  /** Operatör sayısı boş olduğu için 1 kabul edildi mi? (yalnızca `cycle`) */
  operatorsAssumed: boolean;
  byKind: KindTotals;
  /** Prosesin toplam iş içeriği (sn) */
  totalSec: number | null;
  /** En yüklü operatörün yükü = prosesin gerçek çevrimi */
  maxLoadSec: number | null;
  missingTimes: number;
  /** Proses içi denge oranı */
  balance: number | null;
  /** Bu operatör sayısıyla takt içinde yapılabilecek iş (takt × operatör) */
  taktCapacitySec: number | null;
}

export interface YamazumiResult {
  taktSec: number | null;
  taktReason: string | null;
  processes: YamazumiProcess[];
  /** Tüm operatörler, akış sırasıyla */
  operators: OperatorBar[];
  byKind: KindTotals;
  /** Σ iş (sn); hiçbir yük bilinmiyorsa `null` */
  totalSec: number | null;
  /** Yükü bilinen operatör sayısı */
  operatorCount: number;
  maxLoadSec: number | null;
  /** Denge oranı (0–1) */
  balanceRatio: number | null;
  /** ⌈Σ iş ÷ takt⌉ */
  requiredOperators: number | null;
  overTakt: OperatorBar[];
  /** Verisi olduğu hâlde grafiğe giremeyen prosesler ve nedeni */
  skipped: { id: string; title: string; reason: string }[];
  missingTimes: number;
  /** En az bir proseste iş adımı var mı? */
  hasSteps: boolean;
}

const sumOrNull = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

/** Denge oranı = Σ yük ÷ (operatör sayısı × en büyük yük); yükü bilinmeyen operatörler dışarıda kalır. */
export function balanceOf(loads: (number | null)[]): number | null {
  const known = loads.filter((v): v is number => v !== null);
  if (!known.length) return null;
  const max = Math.max(...known);
  if (max <= 0) return null;
  return known.reduce((a, b) => a + b, 0) / (known.length * max);
}

/** Gereken operatör = ⌈Σ iş ÷ takt⌉; takt ya da iş bilinmiyorsa `null`. */
export function requiredOperatorsOf(totalSec: number | null, taktSec: number | null): number | null {
  if (totalSec === null || taktSec === null || taktSec <= 0) return null;
  return Math.ceil(totalSec / taktSec - 1e-9);
}

/** İş adımlarından operatör yükleri (operatör numarasına göre sıralı; yalnızca kullanılan numaralar). */
export function operatorLoads(vsm: VsmData): { operator: number; byKind: KindTotals; totalSec: number | null; stepCount: number; missingTimes: number }[] {
  const map = new Map<number, { byKind: KindTotals; known: number; total: number; stepCount: number; missingTimes: number }>();
  for (const step of vsm.workSteps) {
    const row = map.get(step.operator) ?? { byKind: zeroKinds(), known: 0, total: 0, stepCount: 0, missingTimes: 0 };
    row.stepCount++;
    const sec = toSeconds(step.time);
    if (sec === null) row.missingTimes++;
    else {
      row.byKind[step.kind] += sec;
      row.total += sec;
      row.known++;
    }
    map.set(step.operator, row);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([operator, r]) => ({ operator, byKind: r.byKind, totalSec: r.known ? r.total : null, stepCount: r.stepCount, missingTimes: r.missingTimes }));
}

export function computeYamazumi(nodes: ShapeNode[], edges: FlowEdge[], map: VsmMapData): YamazumiResult {
  const takt = computeTakt(map);
  const taktSec = takt.seconds;
  const netSec = toSeconds(map.fields.netWorkingTime);
  const multi = isMultiFamily(map);
  const view = viewFamily(map);
  const { rank } = flowOrder(nodes, edges);
  const over = (v: number | null) => v !== null && taktSec !== null && v > taktSec + 1e-9;

  const candidates = nodes
    .filter((n) => n.type === 'process' && n.data.vsm)
    .filter((n) => !view || !multi || passes(n.data.vsm!, map, view.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const processes: YamazumiProcess[] = [];
  const skipped: YamazumiResult['skipped'] = [];

  for (const n of candidates) {
    const vsm = n.data.vsm!;
    const title = n.data.title.trim() || 'Başlıksız';
    const bar = (operator: number, byKind: KindTotals, totalSec: number | null, stepCount: number, missingTimes: number): OperatorBar => ({
      key: `${n.id}:${operator}`,
      processId: n.id,
      processTitle: title,
      operator,
      byKind,
      totalSec,
      stepCount,
      missingTimes,
      overTakt: over(totalSec),
    });

    let operators: OperatorBar[];
    let source: YamazumiProcess['source'];
    let operatorsAssumed = false;
    if (vsm.workSteps.length) {
      source = 'steps';
      operators = operatorLoads(vsm).map((o) => bar(o.operator, o.byKind, o.totalSec, o.stepCount, o.missingTimes));
    } else {
      source = 'cycle';
      // Aile görünümünde o ailenin C/T'si; karma görünümde talebe göre ağırlıklı C/T (özetle aynı).
      const cycleSec = view
        ? toSeconds(familyCycle(vsm, view.id))
        : (familyLoad(vsm, map, netSec).weightedCycleSec ?? toSeconds(vsm.fields.cycleTime));
      const hasData = Object.values(vsm.fields).some((q) => q.value !== null);
      if (cycleSec === null) {
        if (hasData) skipped.push({ id: n.id, title, reason: 'C/T ya da iş adımı girilmedi.' });
        continue;
      }
      const opValue = vsm.fields.operators.value;
      if (opValue === 0) {
        skipped.push({ id: n.id, title, reason: 'Operatör sayısı 0 (otomatik proses).' });
        continue;
      }
      operatorsAssumed = opValue === null;
      const count = opValue ?? 1;
      operators = Array.from({ length: count }, (_, i) => bar(i + 1, { ...zeroKinds(), unknown: cycleSec }, cycleSec, 0, 0));
    }

    const byKind = zeroKinds();
    for (const o of operators) for (const k of YAMAZUMI_KINDS) byKind[k] += o.byKind[k];
    const loads = operators.map((o) => o.totalSec);
    const known = loads.filter((v): v is number => v !== null);
    processes.push({
      id: n.id,
      title,
      source,
      operators,
      operatorsAssumed,
      byKind,
      totalSec: sumOrNull(loads),
      maxLoadSec: known.length ? Math.max(...known) : null,
      missingTimes: operators.reduce((a, o) => a + o.missingTimes, 0),
      balance: balanceOf(loads),
      taktCapacitySec: taktSec !== null ? taktSec * operators.length : null,
    });
  }

  const operators = processes.flatMap((p) => p.operators);
  const loads = operators.map((o) => o.totalSec);
  const known = loads.filter((v): v is number => v !== null);
  const totalSec = sumOrNull(loads);
  const byKind = zeroKinds();
  for (const p of processes) for (const k of YAMAZUMI_KINDS) byKind[k] += p.byKind[k];

  return {
    taktSec,
    taktReason: takt.reason,
    processes,
    operators,
    byKind,
    totalSec,
    operatorCount: known.length,
    maxLoadSec: known.length ? Math.max(...known) : null,
    balanceRatio: balanceOf(loads),
    requiredOperators: requiredOperatorsOf(totalSec, taktSec),
    overTakt: operators.filter((o) => o.overTakt),
    skipped,
    missingTimes: processes.reduce((a, p) => a + p.missingTimes, 0),
    hasSteps: processes.some((p) => p.source === 'steps'),
  };
}

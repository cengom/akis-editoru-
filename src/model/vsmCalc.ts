import { isStockKind, type FlowEdge, type InventoryData, type ProductFamily, type ShapeKind, type ShapeNode, type VsmData, type VsmMapData, type VsmQuantity } from './types';
import { currencyOf, toSeconds } from './vsm';
import { familyCycle, isMultiFamily, passes, passingFamilies, stockDemand, stockInView, viewFamily, viewDemand, viewPack } from './families';

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
  const demand = viewDemand(map).value;
  if (net === null && demand === null) return { seconds: null, reason: 'Müşteri talebi ve net çalışma süresi girilmedi.' };
  if (demand === null) return { seconds: null, reason: 'Müşteri talebi girilmedi.' };
  if (net === null) return { seconds: null, reason: 'Net çalışma süresi girilmedi.' };
  if (demand === 0) return { seconds: null, reason: 'Müşteri talebi 0 olduğu için takt hesaplanamaz.' };
  return { seconds: net / demand, reason: null };
}

/* ---------- OEE ---------- */

export interface OeeResult {
  /** Hesapta kullanılan kullanılabilirlik (0–1): elle girilen uptime, yoksa duruşlardan hesaplanan */
  availability: number | null;
  availabilitySource: 'manual' | 'calculated' | null;
  /** Duruş ve değişimlerden hesaplanan kullanılabilirlik (elle girilmiş olsa da gösterim için) */
  availabilityCalculated: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  /** OEE'yi hesaplamak için eksik olanlar */
  missing: string[];
  warnings: string[];
  /** Günlük kapasite (adet/gün) = net süre × A × Q ÷ C/T */
  capacityPerDay: number | null;
}

/**
 * OEE = Kullanılabilirlik × Performans × Kalite.
 * - A: uptime elle girildiyse o; değilse (net süre − duruş − değişim sayısı × C/O) ÷ net süre.
 * - P: ideal C/T ÷ C/T (en fazla %100).
 * - Q: 1 − hurda.
 * `netSec`: günlük net çalışma süresi (saniye); harita verilerinden gelir.
 */
export function oeeOf(vsm: VsmData, netSec: number | null): OeeResult {
  const f = vsm.fields;
  const ct = toSeconds(f.cycleTime);
  const missing: string[] = [];
  const warnings: string[] = [];

  let availabilityCalculated: number | null = null;
  const downtime = f.unplannedDowntime.value;
  const changeovers = f.changeoversPerDay.value;
  if (netSec && netSec > 0 && (downtime !== null || changeovers !== null)) {
    const co = toSeconds(f.changeoverTime);
    if (changeovers !== null && changeovers > 0 && co === null) {
      warnings.push('Değişim sayısı girildi ama setup (C/O) süresi yok; değişim kaybı hesaba katılmadı.');
    }
    const lost = (downtime ?? 0) * 60 + (changeovers ?? 0) * (co ?? 0);
    availabilityCalculated = Math.max(0, (netSec - lost) / netSec);
    if (lost > netSec) warnings.push('Duruş ve değişimler net çalışma süresinden uzun.');
  }
  const manual = f.uptime.value === null ? null : f.uptime.value / 100;
  const availability = manual ?? availabilityCalculated;
  const availabilitySource = manual !== null ? 'manual' : availabilityCalculated !== null ? 'calculated' : null;
  if (availability === null) missing.push('kullanılabilirlik (uptime ya da duruş)');
  if (manual !== null && availabilityCalculated !== null && Math.abs(manual - availabilityCalculated) > 0.02) {
    warnings.push('Elle girilen uptime, duruşlardan hesaplanan kullanılabilirlikten farklı; hesapta elle girilen kullanıldı.');
  }

  const ideal = toSeconds(f.idealCycleTime);
  let performance: number | null = null;
  if (ideal !== null && ct !== null && ct > 0) {
    performance = ideal / ct;
    if (performance > 1) {
      warnings.push('İdeal C/T, gerçek C/T\'den büyük; performans %100 kabul edildi.');
      performance = 1;
    }
  } else missing.push(ct === null ? 'çevrim süresi (C/T)' : 'ideal C/T');

  const quality = f.scrapRate.value === null ? null : 1 - f.scrapRate.value / 100;
  if (quality === null) missing.push('hurda %');

  const oee = availability !== null && performance !== null && quality !== null ? availability * performance * quality : null;
  const capacityPerDay =
    netSec && ct && ct > 0 ? (netSec * (availability ?? 1) * (quality ?? 1)) / ct : null;
  return { availability, availabilitySource, availabilityCalculated, performance, quality, oee, missing, warnings, capacityPerDay };
}

/**
 * Etkin çevrim süresi: duruşlar ve hurda düşüldükten sonra iyi bir parçanın gerçekte aldığı süre.
 * Etkin C/T = C/T ÷ kullanılabilirlik ÷ (1 − hurda) (= ideal C/T ÷ OEE). Kullanılabilirlik elle girilen
 * uptime, yoksa duruşlardan hesaplanan değerdir. Yalnızca kapasite karşılaştırması içindir; zaman
 * çizgisindeki işlem süresi klasik C/T olarak kalır.
 */
export function effectiveCycleSeconds(vsm: VsmData, netSec: number | null = null): number | null {
  const ct = toSeconds(vsm.fields.cycleTime);
  if (ct === null) return null;
  const r = oeeOf(vsm, netSec);
  const u = r.availability ?? 1;
  const good = r.quality ?? 1;
  if (u <= 0 || good <= 0) return null; // %0 kullanılabilirlik ya da %100 hurda: üretim yok
  return ct / u / good;
}

/**
 * Prosesin karma yükü: geçen ailelerin talep × C/T toplamı.
 * `weightedCycleSec` = Σ(talep × C/T) ÷ Σ talep (yalnızca talebi ve C/T'si bilinen aileler).
 */
export function familyLoad(vsm: VsmData, map: VsmMapData, netSec: number | null) {
  let work = 0;
  let qty = 0;
  for (const fam of passingFamilies(vsm, map)) {
    const ct = toSeconds(familyCycle(vsm, fam.id));
    const d = fam.demand.value;
    if (ct === null || d === null) continue;
    work += d * ct;
    qty += d;
  }
  return {
    weightedCycleSec: qty > 0 ? work / qty : null,
    rawLoad: qty > 0 && netSec && netSec > 0 ? work / netSec : null,
  };
}

/* ---------- EPEI ---------- */

export interface EpeiResult {
  /** Hesaplanan en kısa EPEI (iş günü); hesaplanamıyorsa `null` */
  days: number | null;
  /** Hesapta kullanılan çeşit sayısı ve kaynağı */
  partTypes: number | null;
  partTypesSource: 'manual' | 'families' | null;
  /** Günlük kullanılabilir süre (sn) = net süre − plansız duruş */
  availableSec: number | null;
  /** Günlük üretim süresi (sn) = Σ(talep × C/T) ÷ (1 − hurda) */
  productionSec: number | null;
  /** Değişime kalan süre (sn/gün) */
  spareSec: number | null;
  /** Bir tam döngüdeki toplam değişim süresi (sn) = çeşit × C/O */
  cycleChangeoverSec: number | null;
  reason: string | null;
  notes: string[];
  /** Elle girilen EPEI (iş günü) */
  enteredDays: number | null;
  /** Elle girilen EPEI hesaplanandan kısa: bu sıklıkta değişime zaman yetmez */
  enteredTooShort: boolean;
}

/** Elle girilen EPEI'yi iş gününe çevirir (saat: net süreyle; hafta: 5 iş günü). */
function epeiDays(q: VsmQuantity, netSec: number | null): number | null {
  if (q.value === null) return null;
  if (q.unit === 'gün') return q.value;
  if (q.unit === 'hafta') return q.value * 5;
  if (q.unit === 'saat') return netSec && netSec > 0 ? (q.value * 3600) / netSec : null;
  return null;
}

/**
 * En kısa EPEI (her parça her …): günlük üretimden arta kalan süre, tüm çeşitleri bir kez değiştirmeye
 * kaç günde yeter? EPEI = (çeşit sayısı × C/O) ÷ (kullanılabilir süre − üretim süresi).
 * Kullanılabilir süre = net süre − plansız duruş (uptime kullanılmaz; çünkü uptime çoğu zaman değişim
 * kaybını zaten içerir). Üretim süresi tüm geçen ailelerin talebiyle hesaplanır (görünümden bağımsız).
 */
export function epeiOf(vsm: VsmData, map: VsmMapData, netSec: number | null): EpeiResult {
  const f = vsm.fields;
  const notes: string[] = [];
  const passing = passingFamilies(vsm, map);
  const manualTypes = f.partTypes.value;
  const partTypes = manualTypes ?? (isMultiFamily(map) ? passing.length : null);
  const partTypesSource = manualTypes !== null ? 'manual' : partTypes !== null ? 'families' : null;
  const enteredDays = epeiDays(f.epei, netSec);
  const base: EpeiResult = {
    days: null,
    partTypes,
    partTypesSource,
    availableSec: null,
    productionSec: null,
    spareSec: null,
    cycleChangeoverSec: null,
    reason: null,
    notes,
    enteredDays,
    enteredTooShort: false,
  };
  if (!netSec || netSec <= 0) return { ...base, reason: 'Net çalışma süresi gerekli.' };
  if (partTypes === null) return { ...base, reason: 'Ürün çeşidi sayısını girin (Gelişmiş alanlar).' };
  if (partTypes <= 1) return { ...base, reason: 'Tek çeşit üretiliyor; çeşit değişimi gerekmez.' };
  const co = toSeconds(f.changeoverTime);
  if (co === null) return { ...base, reason: 'Setup (C/O) süresi gerekli.' };
  const { rawLoad } = familyLoad(vsm, map, netSec);
  if (rawLoad === null) return { ...base, reason: 'Talep ve C/T gerekli.' };
  const quality = f.scrapRate.value === null ? 1 : 1 - f.scrapRate.value / 100;
  if (quality <= 0) return { ...base, reason: 'Hurda %100: üretim yok.' };
  const productionSec = (rawLoad * netSec) / quality;
  const downtime = f.unplannedDowntime.value;
  if (downtime === null) notes.push('Plansız duruş girilmedi; net sürenin tamamı kullanılabilir sayıldı.');
  const availableSec = netSec - (downtime ?? 0) * 60;
  const spareSec = availableSec - productionSec;
  const cycleChangeoverSec = partTypes * co;
  const filled = { ...base, availableSec, productionSec, spareSec, cycleChangeoverSec };
  if (spareSec <= 0) return { ...filled, reason: 'Üretimden sonra değişime zaman kalmıyor (kapasite dolu).' };
  const days = cycleChangeoverSec / spareSec;
  return { ...filled, days, enteredTooShort: enteredDays !== null && enteredDays < days - 1e-9 };
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

/* ---------- Stok değeri ---------- */

export interface StockValue {
  amount: number | null;
  /** "TL", "€", "$" */
  currency: string | null;
  /** Değerin hesaplandığı adet (gün girildiyse gün × talep) */
  quantity: number | null;
  /** Kullanılan birim değer ve kaynağı */
  unitCost: number | null;
  costSource: 'stock' | 'family' | 'weighted' | null;
  reason: string | null;
}

/**
 * Stok değeri = adet × birim değer. Gün girildiyse adet = gün × günlük talep.
 * Birim değer: stoğa girilen; yoksa stoğun ailesinin birim maliyeti; ortak stokta ailelerin
 * talebe göre ağırlıklı ortalaması (para birimleri aynıysa).
 */
export function stockValue(inv: InventoryData, map: VsmMapData): StockValue {
  const empty = { amount: null, currency: null, quantity: null, unitCost: null, costSource: null } as const;
  if (inv.stock.value === null) return { ...empty, reason: 'Stok girilmedi.' };
  let quantity: number;
  if (inv.stock.unit === 'gün') {
    const d = stockDemand(inv, map).value;
    if (d === null) return { ...empty, reason: 'Gün olarak girilen stoğun adedi için müşteri talebi gerekli.' };
    quantity = inv.stock.value * d;
  } else quantity = inv.stock.value;

  let unitCost: number | null = null;
  let unit: string | null = null;
  let costSource: StockValue['costSource'] = null;
  const fam = inv.familyId ? map.families.find((f) => f.id === inv.familyId) : map.families.length === 1 ? map.families[0] : undefined;
  if (inv.unitValue.value !== null) {
    [unitCost, unit, costSource] = [inv.unitValue.value, inv.unitValue.unit, 'stock'];
  } else if (fam) {
    if (fam.unitCost.value !== null) [unitCost, unit, costSource] = [fam.unitCost.value, fam.unitCost.unit, 'family'];
  } else {
    const known = map.families.filter((f) => f.unitCost.value !== null && f.demand.value !== null && f.demand.value > 0);
    const units = new Set(known.map((f) => f.unitCost.unit));
    if (units.size > 1) return { ...empty, quantity, reason: 'Ailelerin para birimi farklı; stoğa birim değer girin.' };
    const dSum = known.reduce((a, f) => a + (f.demand.value as number), 0);
    if (known.length && dSum > 0) {
      unitCost = known.reduce((a, f) => a + (f.demand.value as number) * (f.unitCost.value as number), 0) / dSum;
      [unit, costSource] = [known[0].unitCost.unit, 'weighted'];
    }
  }
  if (unitCost === null || unit === null) return { ...empty, quantity, reason: 'Birim maliyet girilmedi (ürün ailesinde ya da stokta).' };
  return { amount: quantity * unitCost, currency: currencyOf(unit), quantity, unitCost, costSource, reason: null };
}

export interface MoneyTotal {
  /** Para birimine göre toplamlar (birden çok para birimi karışmaz) */
  totals: { currency: string; amount: number }[];
  filled: number;
  count: number;
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
  /** Hurda / ret (%) */
  scrapRate: number | null;
  /** C/T > takt */
  overTakt: boolean;
  /** C/T ≤ takt ama etkin C/T > takt (duruş/hurda nedeniyle kapasite yetmiyor) */
  overTaktEffective: boolean;
  oee: OeeResult;
  /** Ham yük = Σ(aile talebi × aile C/T) ÷ net süre (duruş/hurda hariç) */
  rawLoad: number | null;
  /** Yük = ham yük ÷ kullanılabilirlik ÷ kalite; %100 üstü kapasite yetersiz */
  load: number | null;
  /** Prosesten geçen aileler */
  familyIds: string[];
  /** Parti beklemesi (sn) = (parti − 1) × C/T: bir parça partinin geri kalanını bekler */
  batchWaitSec: number | null;
  epei: EpeiResult;
  isPacemaker: boolean;
}

export interface InventoryStep extends InventoryDays {
  kind: 'inventory';
  /** Şeklin türü: stok üçgeni, süpermarket, FIFO ya da güvenlik stoğu */
  shapeKind: ShapeKind;
  id: string;
  title: string;
  x: number;
  stock: VsmQuantity;
  value: StockValue;
}

export type TimelineStep = ProcessStep | InventoryStep;

/** Toplam + kaç adımın bu değeri doldurduğu. Hiçbiri doldurmadıysa `value` boştur. */
export interface Total {
  value: number | null;
  filled: number;
}

export interface FamilySummary {
  family: ProductFamily;
  taktSec: number | null;
  pitchSec: number | null;
  /** Bu ailenin geçtiği proseslerin zincir verimi */
  rty: RtyResult;
}

/** Zincir verimi (RTY, rolled throughput yield) = Π(1 − hurda). */
export interface RtyResult {
  /** 0–1; hiçbir proseste hurda girilmediyse `null` */
  value: number | null;
  /** Hurda girilen proses sayısı / toplam proses */
  filled: number;
  count: number;
}

/** Proseslerin hurda oranlarından zincir verimi. Boş hurda hesaba katılmaz; %0 katılır. */
export function rtyOf(scrapRates: (number | null)[]): RtyResult {
  const known = scrapRates.filter((v): v is number => v !== null);
  return {
    value: known.length ? known.reduce((acc, s) => acc * (1 - s / 100), 1) : null,
    filled: known.length,
    count: scrapRates.length,
  };
}

export interface PacemakerInfo {
  /** Seçili hız belirleyici (yoksa `null`) */
  id: string | null;
  title: string | null;
  /** Hız belirleyicinin bu görünümdeki proses adımı (aile görünümünde o aileden geçmiyorsa `null`) */
  step: ProcessStep | null;
  /** Akış kuralına uymayanlar: hız belirleyiciden sonra itme stoğu / itme oku, takt üstü */
  warnings: { id: string; text: string }[];
  /** Seçilmediyse öneri: akış sırasında en sondaki proses */
  suggestion: { id: string; title: string } | null;
}

export interface VsmSummary {
  /** Görünümün takt'ı: seçili aile ya da karma (toplam talep) */
  takt: TaktResult;
  multiFamily: boolean;
  /** Seçili aile; "Tümü" ise `null` */
  view: ProductFamily | null;
  /** Birden çok aile ve "Tümü" görünümü */
  mixed: boolean;
  families: FamilySummary[];
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
  /** Proseslerde toplam parti beklemesi (sn) */
  batchWaitSec: Total;
  /** Parti beklemesi lead time'a eklendi mi? */
  leadTimeIncludesBatchWait: boolean;
  pacemaker: PacemakerInfo;
  /** Üretim lead time (gün) */
  leadTimeDays: number | null;
  /** İşlem süresi lead time'a eklendi mi (net çalışma süresi biliniyorsa)? */
  leadTimeIncludesProcessing: boolean;
  /** Değer katma oranı (0–1); hesaplanamıyorsa `null` */
  valueAddedRatio: number | null;
  totalDistance: Total;
  overTakt: ProcessStep[];
  /** OEE'si hesaplanan prosesler, düşükten yükseğe */
  oeeRanking: ProcessStep[];
  /** Görünümdeki stokların toplam değeri */
  inventoryValue: MoneyTotal;
  /** Görünümdeki proseslerin zincir verimi */
  rty: RtyResult;
  /** Talebi karşılamak için hatta girmesi gereken adet/gün = talep ÷ RTY */
  requiredInputPerDay: number | null;
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
  const netSec = toSeconds(map.fields.netWorkingTime);
  const multi = isMultiFamily(map);
  const view = viewFamily(map);
  /** "Tümü" görünümü ve birden çok aile: karma model (yük tabanlı) */
  const mixed = multi && !view;

  const processes: ProcessStep[] = nodes
    .filter((n) => n.type === 'process' && n.data.vsm && Object.values(n.data.vsm.fields).some((q) => q.value !== null))
    .filter((n) => !view || !multi || passes(n.data.vsm!, map, view.id))
    .map((n) => {
      const vsm = n.data.vsm!;
      const f = vsm.fields;
      const oee = oeeOf(vsm, netSec);
      const famLoad = familyLoad(vsm, map, netSec);
      // Aile görünümünde o ailenin C/T'si; karma görünümde talebe göre ağırlıklı C/T.
      const cycleSec = view ? toSeconds(familyCycle(vsm, view.id)) : (famLoad.weightedCycleSec ?? toSeconds(f.cycleTime));
      const a = oee.availability ?? 1;
      const q = oee.quality ?? 1;
      const effectiveCycleSec = cycleSec === null || a <= 0 || q <= 0 ? null : cycleSec / a / q;
      const load = famLoad.rawLoad === null || a <= 0 || q <= 0 ? null : famLoad.rawLoad / a / q;
      const overTakt = mixed ? famLoad.rawLoad !== null && famLoad.rawLoad > 1 + 1e-9 : isOverTakt(cycleSec, takt.seconds);
      const overTaktEffective = !overTakt && (mixed ? load !== null && load > 1 + 1e-9 : isOverTakt(effectiveCycleSec, takt.seconds));
      return {
        kind: 'process' as const,
        id: n.id,
        title: n.data.title.trim() || 'Başlıksız',
        x: n.position.x,
        cycleSec,
        effectiveCycleSec,
        operators: f.operators.value,
        distance: f.distance.value,
        scrapRate: f.scrapRate.value,
        overTakt,
        overTaktEffective,
        oee,
        rawLoad: famLoad.rawLoad,
        load,
        familyIds: passingFamilies(vsm, map).map((x) => x.id),
        batchWaitSec: batchWait(f.batchSize.value, cycleSec),
        epei: epeiOf(vsm, map, netSec),
        isPacemaker: map.pacemakerId === n.id,
      };
    })
    .sort(byX);

  const inventories: InventoryStep[] = nodes
    .filter((n) => isStockKind(n.type ?? '') && n.data.inventory && n.data.inventory.stock.value !== null)
    .filter((n) => stockInView(n.data.inventory, map))
    .map((n) => ({
      kind: 'inventory' as const,
      shapeKind: n.type as ShapeKind,
      id: n.id,
      title: n.data.title.trim() || 'Stok',
      x: n.position.x,
      stock: n.data.inventory!.stock,
      value: stockValue(n.data.inventory!, map),
      ...inventoryDays(n.data.inventory!.stock, stockDemand(n.data.inventory!, map)),
    }))
    .sort(byX);

  const processingSec = sum(processes.map((p) => p.cycleSec));
  const waitDays = sum(inventories.map((i) => i.days));
  const daySec = toSeconds(map.fields.netWorkingTime);
  const usableDay = daySec !== null && daySec > 0 ? daySec : null;

  // İşlem süresi ancak günlük net çalışma süresi biliniyorsa güne çevrilip eklenebilir.
  const processingDays = usableDay && processingSec.value !== null ? processingSec.value / usableDay : null;
  const batchWaitSec = sum(processes.map((p) => p.batchWaitSec));
  // Parti beklemesi isteğe bağlıdır (klasik yöntemde lead time'a girmez).
  const leadTimeIncludesBatchWait = map.includeBatchWait && usableDay !== null && batchWaitSec.value !== null;
  const batchDays = leadTimeIncludesBatchWait ? (batchWaitSec.value as number) / (usableDay as number) : 0;
  const leadTimeDays =
    waitDays.value === null && processingDays === null ? null : (waitDays.value ?? 0) + (processingDays ?? 0) + batchDays;
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
  // Karma görünümde: tüm ailelerin iş içeriği ÷ günlük süre; tek ailede: ∑C/T ÷ takt (aynı sonuç).
  const loads = processes.map((p) => p.rawLoad).filter((v): v is number => v !== null);
  const requiredOperators = mixed
    ? loads.length
      ? Math.ceil(loads.reduce((a, b) => a + b, 0) - 1e-9)
      : null
    : takt.seconds && takt.seconds > 0 && processingSec.value !== null
      ? Math.ceil(processingSec.value / takt.seconds - 1e-9)
      : null;

  const pack = viewPack(map).value;
  const pitchSec = takt.seconds !== null && pack !== null && pack > 0 ? takt.seconds * pack : null;
  const pitchReason =
    pitchSec !== null
      ? null
      : mixed
        ? 'Aile seçin (pitch aile başına).'
        : takt.seconds === null
          ? 'Önce takt hesaplanmalı.'
          : 'Paket adedi girilmedi.';

  // Aile başına zincir verimi: o ailenin geçtiği tüm VSM prosesleri (görünümden bağımsız).
  const vsmProcesses = nodes.filter((n) => n.type === 'process' && n.data.vsm && Object.values(n.data.vsm.fields).some((q) => q.value !== null));
  const families: FamilySummary[] = map.families.map((fam) => {
    const t = netSec && fam.demand.value ? netSec / fam.demand.value : null;
    const pk = fam.packQuantity.value;
    const rtyFam = rtyOf(vsmProcesses.filter((n) => passes(n.data.vsm!, map, fam.id)).map((n) => n.data.vsm!.fields.scrapRate.value));
    return { family: fam, taktSec: t, pitchSec: t !== null && pk ? t * pk : null, rty: rtyFam };
  });
  const rty = rtyOf(processes.map((p) => p.scrapRate));
  const viewDemandValue = viewDemand(map).value;
  const requiredInputPerDay = rty.value !== null && rty.value > 0 && viewDemandValue !== null ? viewDemandValue / rty.value : null;

  const pacemaker = pacemakerInfo(nodes, edges, map, processes, rank);

  return {
    takt,
    multiFamily: multi,
    view,
    mixed,
    families,
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
    batchWaitSec,
    leadTimeIncludesBatchWait,
    pacemaker,
    leadTimeDays,
    leadTimeIncludesProcessing,
    valueAddedRatio,
    totalDistance: sum(processes.map((p) => p.distance)),
    overTakt: processes.filter((p) => p.overTakt),
    overTaktEffective: processes.filter((p) => p.overTaktEffective),
    rty,
    requiredInputPerDay,
    inventoryValue: moneyTotal(inventories.map((i) => i.value)),
    oeeRanking: processes.filter((p) => p.oee.oee !== null).sort((a, b) => (a.oee.oee as number) - (b.oee.oee as number)),
    inventoriesMissingDemand: inventories.filter((i) => i.days === null).length,
    netTimeOverDay: daySec !== null && daySec > 24 * 3600,
  };
}

/** (parti − 1) × C/T; parti 1 ise 0, parti ya da C/T yoksa boş. */
function batchWait(batch: number | null, cycleSec: number | null): number | null {
  if (batch === null || cycleSec === null || batch < 1) return null;
  return (batch - 1) * cycleSec;
}

/** Hız belirleyiciden sonra akışı bozan stok türleri (FIFO ve güvenlik stoğu akışı bozmaz). */
const PUSH_STOCK_KINDS = new Set(['inventory', 'supermarket']);

/**
 * Hız belirleyici (pacemaker) kontrolleri. Klasik kural: hız belirleyiciden sonraki akış sürekli ya da FIFO
 * olmalı; itme stoğu (üçgen), süpermarket ya da itme oku olmamalı. Son prosesten sonraki mamul stoğu sayılmaz.
 */
function pacemakerInfo(
  nodes: ShapeNode[],
  edges: FlowEdge[],
  map: VsmMapData,
  processes: ProcessStep[],
  rank: Map<string, number>,
): PacemakerInfo {
  const allProcesses = nodes.filter((n) => n.type === 'process');
  const pm = map.pacemakerId ? allProcesses.find((n) => n.id === map.pacemakerId) : undefined;
  const r = (id: string) => rank.get(id) ?? 0;
  if (!pm) {
    const candidates = processes.length ? processes : [];
    const last = candidates.reduce<ProcessStep | null>((a, b) => (!a || r(b.id) > r(a.id) ? b : a), null);
    return { id: null, title: null, step: null, warnings: [], suggestion: last ? { id: last.id, title: last.title } : null };
  }
  const pmRank = r(pm.id);
  const title = pm.data.title.trim() || 'Başlıksız';
  const step = processes.find((p) => p.id === pm.id) ?? null;
  const warnings: PacemakerInfo['warnings'] = [];
  // Akıştaki son proses (VSM verisi olanlar; planlama gibi bilgi kutuları sayılmaz)
  const lastProcessRank = Math.max(pmRank, ...processes.map((p) => r(p.id)));
  for (const n of nodes) {
    if (!PUSH_STOCK_KINDS.has(n.type ?? '')) continue;
    const nr = r(n.id);
    if (nr > pmRank && nr < lastProcessRank) {
      warnings.push({
        id: n.id,
        text: `${n.data.title.trim() || 'Stok'}: hız belirleyiciden sonra ${n.type === 'supermarket' ? 'süpermarket' : 'itme stoğu'} var. Bundan sonrası FIFO ya da sürekli akış olmalı.`,
      });
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    if (e.type !== 'material') continue;
    const target = byId.get(e.target);
    if (r(e.source) >= pmRank && target && r(e.target) <= lastProcessRank && target.type !== 'terminal') {
      const from = byId.get(e.source)?.data.title.trim() || 'şekil';
      warnings.push({ id: e.source, text: `${from} → ${target.data.title.trim() || 'şekil'}: hız belirleyiciden sonra itme oku var.` });
    }
  }
  if (step?.overTakt) warnings.push({ id: pm.id, text: `${title} takt üstü: hız belirleyici müşteri taktını karşılamalı.` });
  return { id: pm.id, title, step, warnings, suggestion: null };
}

function moneyTotal(values: StockValue[]): MoneyTotal {
  const by = new Map<string, number>();
  let filled = 0;
  for (const v of values) {
    if (v.amount === null || v.currency === null) continue;
    filled++;
    by.set(v.currency, (by.get(v.currency) ?? 0) + v.amount);
  }
  return { totals: [...by].map(([currency, amount]) => ({ currency, amount })), filled, count: values.length };
}

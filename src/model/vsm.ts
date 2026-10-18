import {
  TIME_UNITS,
  VSM_FIELD_KEYS,
  VSM_MAP_FIELD_KEYS,
  KAIZEN_STATUSES,
  type InventoryData,
  type KaizenData,
  type KaizenStatus,
  type ProductFamily,
  type VsmData,
  type VsmFieldKey,
  type VsmMapData,
  type VsmMapFieldKey,
  type VsmQuantity,
  type VsmUnit,
} from './types';

/** Sayı + birim biçimindeki bir alanın tanımı: etiket, izinli birimler ve kurallar. */
export interface QuantitySpec<K extends string = string> {
  key: K;
  /** Özellik panelindeki ad */
  label: string;
  /** Tuvaldeki veri kutusunda kullanılan kısa ad */
  short: string;
  units: readonly VsmUnit[];
  defaultUnit: VsmUnit;
  integer?: boolean;
  max?: number;
  /** Gelişmiş alanlar panelde katlanabilir bölümde gösterilir. */
  advanced: boolean;
  /** Panelde alanın altında gösterilen kısa açıklama */
  hint?: string;
}

export type VsmFieldSpec = QuantitySpec<VsmFieldKey>;
export type VsmMapFieldSpec = QuantitySpec<VsmMapFieldKey>;

/* ---------- Proses alanları ---------- */

export const VSM_FIELDS: readonly VsmFieldSpec[] = [
  {
    key: 'cycleTime',
    label: 'Çevrim süresi (C/T)',
    short: 'Çevrim (C/T)',
    units: TIME_UNITS,
    defaultUnit: 'sn',
    advanced: false,
    hint: 'Zaman çizgisinde işlem süresi olarak kullanılır.',
  },
  { key: 'changeoverTime', label: 'Setup / değişim', short: 'Setup (C/O)', units: TIME_UNITS, defaultUnit: 'dk', advanced: false },
  { key: 'uptime', label: 'Uptime', short: 'Uptime', units: ['%'], defaultUnit: '%', max: 100, advanced: false },
  { key: 'operators', label: 'Operatör sayısı', short: 'Operatör', units: ['kişi'], defaultUnit: 'kişi', integer: true, advanced: false },
  { key: 'distance', label: 'Mesafe', short: 'Mesafe', units: ['m'], defaultUnit: 'm', advanced: true },
  {
    key: 'epei',
    label: 'EPEI',
    short: 'EPEI',
    units: ['saat', 'gün', 'hafta'],
    defaultUnit: 'gün',
    advanced: true,
    hint: 'Her parça her …: tüm ürün çeşitlerini bir kez üretme döngüsü.',
  },
  { key: 'scrapRate', label: 'Hurda / ret', short: 'Hurda', units: ['%'], defaultUnit: '%', max: 100, advanced: true },
  { key: 'batchSize', label: 'Parti büyüklüğü', short: 'Parti', units: ['adet'], defaultUnit: 'adet', integer: true, advanced: true },
  // OEE için
  {
    key: 'idealCycleTime',
    label: 'İdeal C/T',
    short: 'İdeal C/T',
    units: TIME_UNITS,
    defaultUnit: 'sn',
    advanced: true,
    hint: 'Tasarım / en iyi çevrim süresi. Performans = ideal C/T ÷ C/T.',
  },
  {
    key: 'unplannedDowntime',
    label: 'Plansız duruş',
    short: 'Duruş',
    units: ['dk/gün'],
    defaultUnit: 'dk/gün',
    advanced: true,
    hint: 'Arıza vb. Uptime boşsa kullanılabilirlik bundan hesaplanır.',
  },
  {
    key: 'changeoversPerDay',
    label: 'Değişim sayısı',
    short: 'Değişim',
    units: ['kez/gün'],
    defaultUnit: 'kez/gün',
    integer: true,
    advanced: true,
    hint: 'Günde kaç kez setup yapılıyor (C/O ile çarpılır).',
  },
  {
    key: 'partTypes',
    label: 'Ürün çeşidi sayısı',
    short: 'Çeşit',
    units: ['çeşit'],
    defaultUnit: 'çeşit',
    integer: true,
    advanced: true,
    hint: 'Bu proseste değişimle sırayla üretilen çeşit sayısı. EPEI hesabı için; boşsa geçen aile sayısı kullanılır.',
  },
];

/* ---------- Stok üçgeni ---------- */

export type InventoryFieldKey = 'stock' | 'unitValue' | 'replenishTime' | 'safetyRate';

/** Para birimli maliyet birimleri. Toplamlar para birimine göre ayrı tutulur. */
export const COST_UNITS = ['TL/adet', '€/adet', '$/adet'] as const;

export const INVENTORY_FIELDS: readonly QuantitySpec<InventoryFieldKey>[] = [
  {
    key: 'stock',
    label: 'Stok',
    short: 'Stok',
    units: ['adet', 'gün'],
    defaultUnit: 'adet',
    advanced: false,
    hint: 'Adet girilirse bekleme günü müşteri talebinden hesaplanır.',
  },
  {
    key: 'unitValue',
    label: 'Birim değer',
    short: 'Değer',
    units: COST_UNITS,
    defaultUnit: 'TL/adet',
    advanced: false,
    hint: 'Stok değeri için. Boşsa ürün ailesinin birim maliyeti kullanılır.',
  },
  // Süpermarket boyut hesabı (yalnızca süpermarkette gösterilir)
  {
    key: 'replenishTime',
    label: 'Yenileme süresi',
    short: 'Yenileme',
    units: ['gün', 'saat'],
    defaultUnit: 'gün',
    advanced: true,
    hint: 'Çekilen malzemenin yeniden üretilip rafa gelmesi.',
  },
  { key: 'safetyRate', label: 'Güvenlik payı', short: 'Güvenlik', units: ['%'], defaultUnit: '%', max: 1000, advanced: true },
];

export const VSM_FIELD_SPECS = Object.fromEntries(VSM_FIELDS.map((f) => [f.key, f])) as Record<VsmFieldKey, VsmFieldSpec>;

/* ---------- Harita (hat) alanları ---------- */

export const VSM_MAP_FIELDS: readonly VsmMapFieldSpec[] = [
  {
    key: 'netWorkingTime',
    label: 'Net çalışma süresi',
    short: 'Net süre',
    units: ['dk/gün', 'sn/gün'],
    defaultUnit: 'dk/gün',
    advanced: false,
    hint: 'Günlük toplam (tüm vardiyalar, molalar düşülmüş).',
  },
  { key: 'shifts', label: 'Vardiya sayısı', short: 'Vardiya', units: ['vardiya'], defaultUnit: 'vardiya', integer: true, max: 10, advanced: false },
  {
    key: 'shipmentFrequency',
    label: 'Sevkiyat sıklığı',
    short: 'Sevkiyat',
    units: ['kez/gün', 'kez/hafta', 'kez/ay'],
    defaultUnit: 'kez/gün',
    advanced: false,
  },
];

/* ---------- Ürün aileleri ---------- */

export const DEMAND_SPEC: QuantitySpec<'demand'> = {
  key: 'demand',
  label: 'Müşteri talebi',
  short: 'Talep',
  units: ['adet/gün'],
  defaultUnit: 'adet/gün',
  advanced: false,
};
export const PACK_SPEC: QuantitySpec<'packQuantity'> = {
  key: 'packQuantity',
  label: 'Paket adedi',
  short: 'Paket',
  units: ['adet'],
  defaultUnit: 'adet',
  integer: true,
  advanced: false,
  hint: 'Bir kap/kutudaki adet. Pitch = takt × paket adedi.',
};

/** En fazla aile sayısı: renkler doğrulanmış kategorik paletten sabit sırayla gelir, yeni renk üretilmez. */
export const COST_SPEC: QuantitySpec<'unitCost'> = {
  key: 'unitCost',
  label: 'Birim maliyet',
  short: 'Maliyet',
  units: COST_UNITS,
  defaultUnit: 'TL/adet',
  advanced: false,
  hint: 'Stok değeri hesabı için (stoğa ayrıca birim değer girilebilir).',
};

export const MAX_FAMILIES = 8;
export const FAMILY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export function newFamily(index: number, id: string): ProductFamily {
  return {
    id,
    name: `Ürün ailesi ${index + 1}`,
    color: FAMILY_COLORS[index % FAMILY_COLORS.length],
    demand: { value: null, unit: 'adet/gün' },
    packQuantity: { value: null, unit: 'adet' },
    unitCost: { value: null, unit: 'TL/adet' },
  };
}

export const DEFAULT_FAMILY_ID = 'aile-1';

export const VSM_MAP_FIELD_SPECS = Object.fromEntries(VSM_MAP_FIELDS.map((f) => [f.key, f])) as Record<
  VsmMapFieldKey,
  VsmMapFieldSpec
>;

export const VSM_LIMITS = { value: 1_000_000_000, note: 2000 };

/* ---------- Boş veri ---------- */

function emptyFields<K extends string>(specs: readonly QuantitySpec<K>[]): Record<K, VsmQuantity> {
  return Object.fromEntries(specs.map((s) => [s.key, { value: null, unit: s.defaultUnit }])) as Record<K, VsmQuantity>;
}

/** Yeni bir proses için boş VSM verisi. Veri girilince kutu kendiliğinden görünür. */
export function emptyVsm(): VsmData {
  return { showDataBox: true, fields: emptyFields(VSM_FIELDS), note: '', familyIds: [], cycleByFamily: {} };
}

/** Yeni bir harita için boş genel VSM verisi. */
export function emptyVsmMap(): VsmMapData {
  return {
    fields: emptyFields(VSM_MAP_FIELDS),
    showTimeline: false,
    colorByTakt: false,
    families: [newFamily(0, DEFAULT_FAMILY_ID)],
    familyView: 'all',
    pacemakerId: null,
    includeBatchWait: false,
  };
}

/** Yeni bir stok üçgeni için boş veri. */
export function emptyInventory(): InventoryData {
  return { ...emptyFields(INVENTORY_FIELDS), familyId: null } as InventoryData;
}

export function cloneInventory(inv: InventoryData): InventoryData {
  return {
    stock: { ...inv.stock },
    replenishTime: { ...inv.replenishTime },
    safetyRate: { ...inv.safetyRate },
    unitValue: { ...inv.unitValue },
    familyId: inv.familyId ?? null,
  };
}

export function cloneVsm(vsm: VsmData): VsmData {
  return {
    showDataBox: vsm.showDataBox,
    fields: Object.fromEntries(VSM_FIELD_KEYS.map((k) => [k, { ...vsm.fields[k] }])) as Record<VsmFieldKey, VsmQuantity>,
    note: vsm.note,
    familyIds: [...vsm.familyIds],
    cycleByFamily: Object.fromEntries(Object.entries(vsm.cycleByFamily).map(([k, q]) => [k, { ...q }])),
  };
}

export function cloneVsmMap(map: VsmMapData): VsmMapData {
  return {
    fields: Object.fromEntries(VSM_MAP_FIELD_KEYS.map((k) => [k, { ...map.fields[k] }])) as Record<VsmMapFieldKey, VsmQuantity>,
    showTimeline: map.showTimeline,
    colorByTakt: map.colorByTakt,
    families: map.families.map((f) => ({ ...f, demand: { ...f.demand }, packQuantity: { ...f.packQuantity }, unitCost: { ...f.unitCost } })),
    familyView: map.familyView,
    pacemakerId: map.pacemakerId,
    includeBatchWait: map.includeBatchWait,
  };
}

/** En az bir alan dolu ya da not yazılmışsa true. */
export function hasVsmContent(vsm: VsmData): boolean {
  return (
    vsm.note.trim() !== '' ||
    VSM_FIELD_KEYS.some((k) => vsm.fields[k].value !== null) ||
    Object.values(vsm.cycleByFamily).some((q) => q.value !== null)
  );
}

/* ---------- Sayı biçimi ---------- */

/** Sayıyı Türkçe biçimde yazar (ondalık ayırıcı virgül). */
export function formatNumber(value: number, maxDecimals = 3): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: maxDecimals });
}

export function formatQuantity(q: VsmQuantity): string {
  return q.value === null ? '—' : `${formatNumber(q.value)} ${q.unit}`;
}

/** Giriş kutusunda düzenlemek için sayı → metin (binlik ayırıcı yok). */
export function numberToInput(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/**
 * Kullanıcının yazdığı metni sayıya çevirir. Boş metin `null` (boş) olur.
 * Hem "12,5" hem "12.5" kabul edilir.
 */
export function parseNumberInput(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim().replace(/\s/g, '');
  if (t === '') return { ok: true, value: null };
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return { ok: false };
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

/** Değerin alan kurallarına uyup uymadığını denetler; sorun varsa Türkçe mesaj döndürür. */
export function checkVsmValue(spec: QuantitySpec, value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Geçerli bir sayı girin.';
  if (value < 0) return 'Negatif olamaz.';
  if (value > (spec.max ?? VSM_LIMITS.value)) return `En fazla ${formatNumber(spec.max ?? VSM_LIMITS.value)} olabilir.`;
  if (spec.integer && !Number.isInteger(value)) return 'Tam sayı olmalı.';
  return null;
}

/* ---------- Süre dönüşümleri ---------- */

const SECONDS: Partial<Record<VsmUnit, number>> = { sn: 1, dk: 60, saat: 3600, 'sn/gün': 1, 'dk/gün': 60 };

/** Süre alanını saniyeye çevirir; boş ya da süre olmayan alan için `null`. */
export function toSeconds(q: VsmQuantity): number | null {
  const factor = SECONDS[q.unit];
  return q.value === null || factor === undefined ? null : q.value * factor;
}

/** Saniyeyi okunaklı bir birimle yazar (sn, dk veya saat). */
export function formatDuration(seconds: number): string {
  if (seconds < 120) return `${formatNumber(seconds, 2)} sn`;
  if (seconds < 7200) return `${formatNumber(seconds / 60, 2)} dk`;
  return `${formatNumber(seconds / 3600, 2)} saat`;
}

export function formatDays(days: number): string {
  return `${formatNumber(days, 2)} gün`;
}

/** Oranı yüzde olarak yazar; çok küçük oranlarda daha fazla basamak gösterir. */
/** Para tutarı: 100'ün altında 2 ondalık, üstünde tam sayı. */
export function formatMoney(amount: number, currency: string): string {
  return `${formatNumber(amount, Math.abs(amount) < 100 ? 2 : 0)} ${currency}`;
}

/** "TL/adet" → "TL" */
export const currencyOf = (unit: string) => unit.split('/')[0];

export function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  return `%${formatNumber(pct, pct < 1 ? 3 : 1)}`;
}

/* ---------- Dosyadan okuma (doğrulama) ---------- */

type Fail = (msg: string) => void;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Sayı + birim alanlarını okur. Eksik alanlar boş kabul edilir (geriye uyumluluk);
 * "12,5" gibi metin sayıya çevrilir; birim yoksa varsayılan birim kullanılır.
 * Gerçekten hatalı değerler için hata bildirir ve `null` döndürür.
 */
function parseQuantityFields<K extends string>(
  raw: unknown,
  specs: readonly QuantitySpec<K>[],
  where: string,
  fail: Fail,
): Record<K, VsmQuantity> | null {
  const result = emptyFields(specs);
  if (raw === undefined || raw === null) return result;
  if (!isPlainObject(raw)) {
    fail(`${where}: alanlar geçersiz.`);
    return null;
  }
  let ok = true;
  for (const spec of specs) {
    const f = raw[spec.key];
    if (f === undefined || f === null) continue;
    const bad = (msg: string) => {
      fail(`${where}: "${spec.label}" ${msg}`);
      ok = false;
    };
    if (!isPlainObject(f)) {
      bad('geçersiz.');
      continue;
    }
    let value: number | null = null;
    if (typeof f.value === 'number') value = f.value;
    else if (typeof f.value === 'string') {
      const parsed = parseNumberInput(f.value);
      if (!parsed.ok) {
        bad('sayı değil.');
        continue;
      }
      value = parsed.value;
    } else if (f.value !== undefined && f.value !== null) {
      bad('sayı değil.');
      continue;
    }
    const problem = checkVsmValue(spec, value);
    if (problem) {
      bad(`— ${problem}`);
      continue;
    }
    const unit = f.unit === undefined ? spec.defaultUnit : f.unit;
    if (!spec.units.includes(unit as VsmUnit)) {
      bad(`için birim "${String(unit)}" geçersiz (${spec.units.join(', ')} olmalı).`);
      continue;
    }
    result[spec.key] = { value, unit: unit as VsmUnit };
  }
  return ok ? result : null;
}

/** Bir prosesin VSM verisini okur. Eksik veri boş kabul edilir. */
export function parseVsm(raw: unknown, where: string, fail: Fail): VsmData | null {
  const result = emptyVsm();
  if (raw === undefined || raw === null) return result;
  if (!isPlainObject(raw)) {
    fail(`${where}: VSM verisi geçersiz.`);
    return null;
  }
  if (typeof raw.showDataBox === 'boolean') result.showDataBox = raw.showDataBox;
  if (raw.note !== undefined) {
    if (typeof raw.note !== 'string' || raw.note.length > VSM_LIMITS.note) {
      fail(`${where}: VSM notu geçersiz ya da çok uzun.`);
      return null;
    }
    result.note = raw.note;
  }
  const fields = parseQuantityFields(raw.fields, VSM_FIELDS, where, fail);
  if (!fields) return null;
  result.fields = fields;
  // Sürüm 8 öncesinde yoktur: tüm aileler geçer, ortak C/T kullanılır.
  if (Array.isArray(raw.familyIds)) {
    result.familyIds = raw.familyIds.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 100);
  }
  if (isPlainObject(raw.cycleByFamily)) {
    for (const [fid, q] of Object.entries(raw.cycleByFamily)) {
      const parsed = parseQuantityFields({ cycleTime: q }, [VSM_FIELD_SPECS.cycleTime], `${where} (aile C/T)`, fail);
      if (!parsed) return null;
      if (parsed.cycleTime.value !== null) result.cycleByFamily[fid] = parsed.cycleTime;
    }
  }
  return result;
}

/** Haritanın genel VSM verisini okur. Eski sürüm dosyalarında yoktur; boş kabul edilir. */
export function parseVsmMap(raw: unknown, fail: Fail): VsmMapData | null {
  const result = emptyVsmMap();
  if (raw === undefined || raw === null) return result;
  if (!isPlainObject(raw)) {
    fail('VSM genel verileri ("vsmMap") geçersiz.');
    return null;
  }
  if (typeof raw.showTimeline === 'boolean') result.showTimeline = raw.showTimeline;
  if (typeof raw.colorByTakt === 'boolean') result.colorByTakt = raw.colorByTakt;
  // Sürüm 9 öncesinde yoktur: hız belirleyici seçilmemiş, parti beklemesi lead time'a eklenmez.
  if (typeof raw.includeBatchWait === 'boolean') result.includeBatchWait = raw.includeBatchWait;
  if (typeof raw.pacemakerId === 'string' && raw.pacemakerId.length > 0 && raw.pacemakerId.length <= 100) {
    result.pacemakerId = raw.pacemakerId;
  }
  const fields = parseQuantityFields(raw.fields, VSM_MAP_FIELDS, 'VSM genel verileri', fail);
  if (!fields) return null;
  result.fields = fields;

  if (Array.isArray(raw.families) && raw.families.length > 0) {
    if (raw.families.length > MAX_FAMILIES) {
      fail(`En fazla ${MAX_FAMILIES} ürün ailesi olabilir.`);
      return null;
    }
    const ids = new Set<string>();
    const families: ProductFamily[] = [];
    for (const [i, f] of raw.families.entries()) {
      const where = `${i + 1}. ürün ailesi`;
      if (!isPlainObject(f) || typeof f.id !== 'string' || !f.id || f.id.length > 100 || ids.has(f.id)) {
        fail(`${where}: kimlik geçersiz ya da tekrarlı.`);
        return null;
      }
      // Sürüm 10 öncesinde birim maliyet yoktur (boş gelir).
      const q = parseQuantityFields(
        { demand: f.demand, packQuantity: f.packQuantity, unitCost: f.unitCost },
        [DEMAND_SPEC, PACK_SPEC, COST_SPEC],
        where,
        fail,
      );
      if (!q) return null;
      ids.add(f.id);
      families.push({
        id: f.id,
        name: typeof f.name === 'string' && f.name.trim() ? f.name.slice(0, 100) : `Ürün ailesi ${i + 1}`,
        color: typeof f.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color.toLowerCase() : FAMILY_COLORS[i % FAMILY_COLORS.length],
        demand: q.demand,
        packQuantity: q.packQuantity,
        unitCost: q.unitCost,
      });
    }
    result.families = families;
  } else {
    // Sürüm 8 öncesi: harita düzeyindeki talep ve paket adedi tek aileye taşınır.
    const legacy = isPlainObject(raw.fields) ? raw.fields : {};
    const q = parseQuantityFields(
      { demand: legacy.customerDemand, packQuantity: legacy.packQuantity },
      [DEMAND_SPEC, PACK_SPEC],
      'VSM genel verileri',
      fail,
    );
    if (!q) return null;
    result.families = [{ ...newFamily(0, DEFAULT_FAMILY_ID), demand: q.demand, packQuantity: q.packQuantity }];
  }
  const view = raw.familyView;
  result.familyView = typeof view === 'string' && result.families.some((f) => f.id === view) ? view : 'all';
  return result;
}

/* ---------- Kaizen ---------- */

export const KAIZEN_STATUS_LABELS: Record<KaizenStatus, string> = { open: 'Açık', doing: 'Devam ediyor', done: 'Tamamlandı' };

export function emptyKaizen(): KaizenData {
  return { owner: '', dueDate: '', status: 'open' };
}

/** Kaizen verisini okur; eski dosyalarda yoktur. Hatalı alanlar varsayılana döner. */
export function parseKaizen(raw: unknown, where: string, fail: Fail): KaizenData | null {
  const result = emptyKaizen();
  if (raw === undefined || raw === null) return result;
  if (!isPlainObject(raw)) {
    fail(`${where}: kaizen verisi geçersiz.`);
    return null;
  }
  if (typeof raw.owner === 'string' && raw.owner.length <= 200) result.owner = raw.owner;
  if (typeof raw.dueDate === 'string' && /^(\d{4}-\d{2}-\d{2})?$/.test(raw.dueDate)) result.dueDate = raw.dueDate;
  if (KAIZEN_STATUSES.includes(raw.status as KaizenStatus)) result.status = raw.status as KaizenStatus;
  return result;
}

/** Stok üçgeninin verisini okur. Eski sürümlerde yoktur; boş kabul edilir. */
export function parseInventory(raw: unknown, where: string, fail: Fail): InventoryData | null {
  if (raw === undefined || raw === null) return emptyInventory();
  if (!isPlainObject(raw)) {
    fail(`${where}: stok verisi geçersiz.`);
    return null;
  }
  const fields = parseQuantityFields(raw, INVENTORY_FIELDS, where, fail);
  if (!fields) return null;
  const familyId = typeof raw.familyId === 'string' && raw.familyId ? raw.familyId : null;
  return { ...(fields as Omit<InventoryData, 'familyId'>), familyId };
}

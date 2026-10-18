import {
  TIME_UNITS,
  VSM_FIELD_KEYS,
  VSM_MAP_FIELD_KEYS,
  type InventoryData,
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
];

/* ---------- Stok üçgeni ---------- */

export const INVENTORY_FIELDS: readonly QuantitySpec<'stock'>[] = [
  {
    key: 'stock',
    label: 'Stok',
    short: 'Stok',
    units: ['adet', 'gün'],
    defaultUnit: 'adet',
    advanced: false,
    hint: 'Adet girilirse bekleme günü müşteri talebinden hesaplanır.',
  },
];

export const VSM_FIELD_SPECS = Object.fromEntries(VSM_FIELDS.map((f) => [f.key, f])) as Record<VsmFieldKey, VsmFieldSpec>;

/* ---------- Harita (hat) alanları ---------- */

export const VSM_MAP_FIELDS: readonly VsmMapFieldSpec[] = [
  { key: 'customerDemand', label: 'Müşteri talebi', short: 'Talep', units: ['adet/gün'], defaultUnit: 'adet/gün', advanced: false },
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
  {
    key: 'packQuantity',
    label: 'Paket adedi',
    short: 'Paket',
    units: ['adet'],
    defaultUnit: 'adet',
    integer: true,
    advanced: true,
    hint: 'Bir kap/kutudaki adet. Pitch = takt × paket adedi (hesaplanır).',
  },
];

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
  return { showDataBox: true, fields: emptyFields(VSM_FIELDS), note: '' };
}

/** Yeni bir harita için boş genel VSM verisi. */
export function emptyVsmMap(): VsmMapData {
  return { fields: emptyFields(VSM_MAP_FIELDS), showTimeline: false };
}

/** Yeni bir stok üçgeni için boş veri. */
export function emptyInventory(): InventoryData {
  return { stock: { value: null, unit: 'adet' } };
}

export function cloneInventory(inv: InventoryData): InventoryData {
  return { stock: { ...inv.stock } };
}

export function cloneVsm(vsm: VsmData): VsmData {
  return {
    showDataBox: vsm.showDataBox,
    fields: Object.fromEntries(VSM_FIELD_KEYS.map((k) => [k, { ...vsm.fields[k] }])) as Record<VsmFieldKey, VsmQuantity>,
    note: vsm.note,
  };
}

export function cloneVsmMap(map: VsmMapData): VsmMapData {
  return {
    fields: Object.fromEntries(VSM_MAP_FIELD_KEYS.map((k) => [k, { ...map.fields[k] }])) as Record<VsmMapFieldKey, VsmQuantity>,
    showTimeline: map.showTimeline,
  };
}

/** En az bir alan dolu ya da not yazılmışsa true. */
export function hasVsmContent(vsm: VsmData): boolean {
  return vsm.note.trim() !== '' || VSM_FIELD_KEYS.some((k) => vsm.fields[k].value !== null);
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
  const fields = parseQuantityFields(raw.fields, VSM_MAP_FIELDS, 'VSM genel verileri', fail);
  if (!fields) return null;
  result.fields = fields;
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
  return fields ? { stock: fields.stock } : null;
}

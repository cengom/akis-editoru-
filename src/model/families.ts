import type { InventoryData, ProductFamily, VsmData, VsmMapData, VsmQuantity } from './types';

/*
 * Ürün aileleri (karma model) için yardımcılar.
 * Talep ve paket adedi ailelerdedir. Hesaplar "görünüm"e göre yapılır: tek bir aile ya da tüm aileler.
 * Tek aileli haritalarda sonuçlar, ailesiz eski hesaplarla birebir aynıdır.
 */

export const isMultiFamily = (map: VsmMapData) => map.families.length > 1;

/** Görünümdeki aile; "Tümü" seçiliyse `null`. Tek aileli haritada her zaman o aile. */
export function viewFamily(map: VsmMapData): ProductFamily | null {
  if (!isMultiFamily(map)) return map.families[0] ?? null;
  return map.families.find((f) => f.id === map.familyView) ?? null;
}

/** Tüm ailelerin toplam talebi; hiçbir ailede talep yoksa boş. */
export function totalDemand(map: VsmMapData): VsmQuantity {
  const known = map.families.map((f) => f.demand.value).filter((v): v is number => v !== null);
  return { value: known.length ? known.reduce((a, b) => a + b, 0) : null, unit: 'adet/gün' };
}

/** Görünümün talebi: seçili aile ya da toplam. */
export function viewDemand(map: VsmMapData): VsmQuantity {
  return viewFamily(map)?.demand ?? totalDemand(map);
}

/** Görünümün paket adedi: seçili ailenin; "Tümü"nde (birden çok aile varken) yok. */
export function viewPack(map: VsmMapData): VsmQuantity {
  return viewFamily(map)?.packQuantity ?? { value: null, unit: 'adet' };
}

/** Prosesten geçen aileler (liste boşsa tümü; artık olmayan aile kimlikleri yok sayılır). */
export function passingFamilies(vsm: VsmData, map: VsmMapData): ProductFamily[] {
  if (!vsm.familyIds.length) return map.families;
  const set = new Set(vsm.familyIds);
  const list = map.families.filter((f) => set.has(f.id));
  return list.length ? list : map.families;
}

export const passes = (vsm: VsmData, map: VsmMapData, familyId: string) =>
  passingFamilies(vsm, map).some((f) => f.id === familyId);

/** Ailenin bu prosesteki çevrim süresi: aileye özel değer, yoksa ortak C/T. */
export function familyCycle(vsm: VsmData, familyId: string): VsmQuantity {
  const own = vsm.cycleByFamily[familyId];
  return own && own.value !== null ? own : vsm.fields.cycleTime;
}

/** Stoğun günlük tüketimi: stok bir aileye bağlıysa o ailenin talebi, değilse toplam talep. */
export function stockDemand(inv: InventoryData, map: VsmMapData): VsmQuantity {
  const f = inv.familyId ? map.families.find((x) => x.id === inv.familyId) : null;
  return f ? f.demand : totalDemand(map);
}

/** Stok görünüme dahil mi? (Aile görünümünde yalnızca o ailenin ya da ortak stoklar.) */
export function stockInView(inv: InventoryData | undefined, map: VsmMapData): boolean {
  const f = viewFamily(map);
  if (!f || !isMultiFamily(map) || !inv?.familyId) return true;
  return inv.familyId === f.id;
}

import { createContext } from 'react';
import type { InventoryData, ProductFamily, VsmQuantity } from '../model/types';

/** Prosesin özetten gelen durumu (aileye duyarlı). */
export interface ProcessStatus {
  overTakt: boolean;
  overEffective: boolean;
  /** Etkin C/T ÷ takt (ya da karma görünümde yük); renklendirme için */
  ratio: number | null;
}

/**
 * Tuvaldeki şekillerin ihtiyaç duyduğu harita düzeyi bilgiler.
 * Sürükleme sırasında değişmeyen değerlerdir; böylece şekiller gereksiz yere yeniden çizilmez.
 */
export interface VsmCanvasInfo {
  taktSec: number | null;
  demand: VsmQuantity;
  /** Prosesleri takt oranına göre renklendir */
  colorByTakt: boolean;
  /** Günlük net çalışma süresi (sn); OEE kullanılabilirlik hesabı için */
  netSec: number | null;
  /** Proses kimliği → takt durumu */
  processStatus: Record<string, ProcessStatus>;
  /** Seçili aileden geçmediği için soluk gösterilecek proses kimlikleri */
  dimmed: string[];
  /** Ürün aileleri (birden çoksa veri kutusunda renk etiketleri gösterilir) */
  families: ProductFamily[];
  /** Hız belirleyici prosesin kimliği */
  pacemakerId: string | null;
  /** Stok için günlük talep (stok bir aileye bağlıysa o aile) */
  stockDemandOf: (inv: InventoryData) => VsmQuantity;
}

export const VsmCanvasContext = createContext<VsmCanvasInfo>({
  taktSec: null,
  demand: { value: null, unit: 'adet/gün' },
  colorByTakt: false,
  netSec: null,
  processStatus: {},
  dimmed: [],
  families: [],
  pacemakerId: null,
  stockDemandOf: () => ({ value: null, unit: 'adet/gün' }),
});

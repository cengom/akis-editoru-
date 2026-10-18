import { createContext } from 'react';
import type { VsmQuantity } from '../model/types';

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
}

export const VsmCanvasContext = createContext<VsmCanvasInfo>({
  taktSec: null,
  demand: { value: null, unit: 'adet/gün' },
  colorByTakt: false,
  netSec: null,
});

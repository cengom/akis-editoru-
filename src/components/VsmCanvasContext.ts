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
}

export const VsmCanvasContext = createContext<VsmCanvasInfo>({
  taktSec: null,
  demand: { value: null, unit: 'adet/gün' },
  colorByTakt: false,
});

import { MarkerType, type EdgeMarker } from '@xyflow/react';
import type { EdgeKind } from './types';

export interface EdgeKindSpec {
  label: string;
  hint: string;
  group: 'general' | 'vsm';
  marker: EdgeMarker;
}

/** Bağlantı türlerinin görünümü ve adları. Çizgi stili `edges/FlowEdgeView.tsx` ve CSS'tedir. */
export const EDGE_KIND_SPECS: Record<EdgeKind, EdgeKindSpec> = {
  flow: {
    label: 'Genel ok',
    hint: 'Akış diyagramı için düz ok',
    group: 'general',
    marker: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  },
  info: {
    label: 'Bilgi akışı',
    hint: 'Sipariş, plan, tahmin gibi bilgiler (kesikli ince çizgi)',
    group: 'vsm',
    marker: { type: MarkerType.Arrow, width: 18, height: 18, color: '#2563eb', markerUnits: 'userSpaceOnUse', strokeWidth: 1.5 },
  },
  electronic: {
    label: 'Elektronik bilgi akışı',
    hint: 'EDI, e-posta, ERP gibi elektronik bilgi (zikzaklı çizgi)',
    group: 'vsm',
    marker: { type: MarkerType.Arrow, width: 18, height: 18, color: '#2563eb', markerUnits: 'userSpaceOnUse', strokeWidth: 1.5 },
  },
  material: {
    label: 'Malzeme akışı (itme)',
    hint: 'Prosesler arasında itilen malzeme (kalın çizgili ok)',
    group: 'vsm',
    marker: { type: MarkerType.ArrowClosed, width: 30, height: 30, color: '#111827', markerUnits: 'userSpaceOnUse' },
  },
  pull: {
    label: 'Çekme',
    hint: 'Sonraki prosesin süpermarketten malzeme çekmesi (kavisli ok)',
    group: 'vsm',
    marker: { type: MarkerType.ArrowClosed, width: 22, height: 22, color: '#374151', markerUnits: 'userSpaceOnUse' },
  },
  shipment: {
    label: 'Sevkiyat',
    hint: 'Tedarikçiden gelen / müşteriye giden sevkiyat (kalın boş ok)',
    group: 'vsm',
    marker: { type: MarkerType.ArrowClosed, width: 34, height: 34, color: '#111827', markerUnits: 'userSpaceOnUse' },
  },
};

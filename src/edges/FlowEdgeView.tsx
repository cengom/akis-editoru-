import { memo } from 'react';
import { BaseEdge, EdgeText, getSmoothStepPath, getStraightPath, type EdgeProps, type EdgeTypes } from '@xyflow/react';
import { EDGE_KINDS, type EdgeKind, type FlowEdge } from '../model/types';

/**
 * Tüm bağlantı türleri için tek bileşen. Tür `edge.type` alanındadır.
 * - flow: köşeli düz ok (akış diyagramı)
 * - info: düz, kesikli, ince mavi çizgi (bilgi akışı)
 * - material: kalın, beyaz çizgili ok (itme / malzeme akışı)
 * - shipment: kalın, içi boş ok (sevkiyat)
 */
function FlowEdgeView(props: EdgeProps<FlowEdge>) {
  const kind = (props.type ?? 'flow') as EdgeKind;
  const [path, labelX, labelY] =
    kind === 'info'
      ? getStraightPath(props)
      : getSmoothStepPath({ ...props, borderRadius: kind === 'flow' ? 5 : 10 });
  const label = typeof props.label === 'string' ? props.label : '';

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={`edge-${kind}`}
        interactionWidth={kind === 'flow' || kind === 'info' ? 20 : 26}
      />
      {/* Malzeme okunda beyaz şeritler, sevkiyatta içi boş görünüm */}
      {(kind === 'material' || kind === 'shipment') && (
        <path d={path} className={`edge-overlay edge-overlay-${kind}`} fill="none" />
      )}
      {label && (
        <EdgeText
          x={labelX}
          y={labelY}
          label={label}
          labelShowBg
          labelBgPadding={[4, 2]}
          labelBgBorderRadius={3}
          className="edge-label"
        />
      )}
    </>
  );
}

const View = memo(FlowEdgeView);

export const edgeTypes: EdgeTypes = Object.fromEntries(EDGE_KINDS.map((k) => [k, View]));

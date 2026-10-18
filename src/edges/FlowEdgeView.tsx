import { memo } from 'react';
import { BaseEdge, EdgeText, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, type EdgeTypes } from '@xyflow/react';
import { EDGE_KINDS, type EdgeKind, type FlowEdge } from '../model/types';

/**
 * Tüm bağlantı türleri için tek bileşen. Tür `edge.type` alanındadır.
 * - flow: köşeli düz ok (akış diyagramı)
 * - info: düz, kesikli, ince mavi çizgi (elle bilgi akışı)
 * - electronic: düz, ince mavi çizgi; ortasında zikzak (elektronik bilgi akışı)
 * - pull: kavisli, koyu gri ok (çekme)
 * - material: kalın, beyaz çizgili ok (itme / malzeme akışı)
 * - shipment: kalın, içi boş ok (sevkiyat)
 */
function FlowEdgeView(props: EdgeProps<FlowEdge>) {
  const kind = (props.type ?? 'flow') as EdgeKind;
  const [path, labelX, labelY] =
    kind === 'info'
      ? getStraightPath(props)
      : kind === 'electronic'
        ? zigzagPath(props.sourceX, props.sourceY, props.targetX, props.targetY)
        : kind === 'pull'
          ? getBezierPath({ ...props, curvature: 0.5 })
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

/** Düz çizgi; ortasında üç dişli zikzak (klasik "elektronik bilgi" simgesi). */
function zigzagPath(sx: number, sy: number, tx: number, ty: number): [string, number, number] {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // dik doğrultu
  const py = ux;
  const mid = len / 2;
  const half = Math.min(30, len / 4);
  const amp = 8;
  const at = (d: number, off = 0) => `${sx + ux * d + px * off},${sy + uy * d + py * off}`;
  const pts = [at(0), at(mid - half), at(mid - half / 2, amp), at(mid, -amp), at(mid + half / 2, amp), at(mid + half), at(len)];
  return [`M ${pts.join(' L ')}`, sx + dx / 2, sy + dy / 2 - 14];
}

const View = memo(FlowEdgeView);

export const edgeTypes: EdgeTypes = Object.fromEntries(EDGE_KINDS.map((k) => [k, View]));

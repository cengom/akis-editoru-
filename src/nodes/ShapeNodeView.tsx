import { memo, useContext, type CSSProperties } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { VsmCanvasContext } from '../components/VsmCanvasContext';
import { SymbolSvg, isSymbolKind } from './VsmSymbols';
import { todayIso } from '../components/KaizenList';
import { SHAPES, readableTextColor } from '../model/shapes';
import { HANDLE_SIDES, SHAPE_KINDS, type HandleSide, type ShapeKind, type KaizenData, type ProductFamily, type ShapeNode, type VsmData, type VsmQuantity } from '../model/types';
import { inventoryDays, oeeOf } from '../model/vsmCalc';
import { KAIZEN_STATUS_LABELS, VSM_FIELDS, formatDays, formatPercent, formatDuration, formatNumber, formatQuantity, hasVsmContent } from '../model/vsm';

const POSITIONS: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** SVG ile çizilen şekillerin dış hatları (0–100 koordinatlarında). */
const OUTLINES: Partial<Record<ShapeKind, string>> = {
  decision: '50,1 99,50 50,99 1,50',
  // Testere dişi çatılı fabrika simgesi
  customer: '1,99 1,35 33,1 33,35 66,1 66,35 99,1 99,99',
  supplier: '1,99 1,35 33,1 33,35 66,1 66,35 99,1 99,99',
  inventory: '50,2 98,98 2,98',
  // 12 uçlu patlama
  kaizen: Array.from({ length: 24 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    const r = i % 2 === 0 ? 49 : 34;
    return `${(50 + r * Math.cos(angle)).toFixed(1)},${(50 + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' '),
};

function ShapeNodeView({ id, type, data, selected }: NodeProps<ShapeNode>) {
  const kind = type as ShapeKind;
  const spec = SHAPES[kind];
  const { taktSec, demand, colorByTakt, netSec, processStatus, dimmed, families, stockDemandOf } = useContext(VsmCanvasContext);
  // Takt durumu özetten gelir (ürün ailesine duyarlı).
  const status = kind === 'process' ? processStatus[id] : undefined;
  const overTakt = !!status?.overTakt;
  const overEffective = !!status?.overEffective;
  const isDimmed = dimmed.includes(id);
  const outline = OUTLINES[kind];
  const fill = (colorByTakt && status && ratioColor(status.ratio)) || data.color;
  const style = {
    '--shape-color': fill,
    '--shape-text': readableTextColor(fill),
  } as CSSProperties;
  const symbol = isSymbolKind(kind);
  const classes = ['shape', `shape-${kind}`, outline ? 'shape-svg' : '', symbol ? 'shape-symbol' : '', isDimmed ? 'is-dimmed' : '', selected ? 'is-selected' : '', overTakt ? 'is-over-takt' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} data-testid={`sekil-${kind}`}>
      <NodeResizer isVisible={selected} minWidth={spec.minWidth} minHeight={spec.minHeight} color="#2563eb" />
      {outline && (
        <svg className="shape-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={outline} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {kind === 'inventory' ? (
        <>
          <div className="inventory-mark" aria-hidden="true">I</div>
          <div className="inventory-label">
            <div className="shape-title">{data.title.trim() || 'Stok'}</div>
            {data.inventory && <InventoryInfo stock={data.inventory.stock} demand={stockDemandOf(data.inventory)} />}
            {data.description && <div className="shape-desc">{data.description}</div>}
          </div>
        </>
      ) : symbol ? (
        <>
          <SymbolSvg kind={kind} fill={data.color} className="symbol-svg" />
          <div className="inventory-label">
            <div className="shape-title">{data.title.trim() || spec.label}</div>
            {data.inventory && <InventoryInfo stock={data.inventory.stock} demand={stockDemandOf(data.inventory)} />}
            {data.description && <div className="shape-desc">{data.description}</div>}
          </div>
        </>
      ) : (
        <div className="shape-body">
          <div className="shape-title">{data.title.trim() || 'Başlıksız'}</div>
          {data.description && <div className="shape-desc">{data.description}</div>}
          {kind === 'customer' && <CustomerInfo demand={demand} taktSec={taktSec} />}
          {kind === 'kaizen' && data.kaizen && <KaizenChip kaizen={data.kaizen} />}
        </div>
      )}
      {overTakt && (
        <div className="takt-badge" title="Çevrim süresi takt süresinden büyük">
          ⚠ Takt üstü
        </div>
      )}
      {overEffective && (
        <div className="takt-badge takt-badge-eff" title="Uptime ve hurda dahil etkin çevrim süresi takt süresinden büyük">
          ⚠ Etkin C/T takt üstü
        </div>
      )}
      {kind === 'process' && data.vsm?.showDataBox && hasVsmContent(data.vsm) && (
        <VsmDataBox vsm={data.vsm} overTakt={overTakt} netSec={netSec} families={families} />
      )}
      {HANDLE_SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={POSITIONS[side]} className="shape-handle" />
      ))}
    </div>
  );
}

/** Stok üçgeninin altında: girilen miktar ve (adetse) hesaplanan bekleme günü. */
function InventoryInfo({ stock, demand }: { stock: VsmQuantity; demand: VsmQuantity }) {
  if (stock.value === null) return null;
  const wait = inventoryDays(stock, demand);
  return (
    <div className="inventory-stock" data-testid="stok-bilgisi">
      <div>{formatQuantity(stock)}</div>
      {wait.calculated && wait.days !== null && (
        <div className="calc-value" title="Stok adedi ÷ günlük müşteri talebi">
          {formatDays(wait.days)}
        </div>
      )}
    </div>
  );
}

/**
 * Takt oranına göre dolgu: etkin C/T ÷ takt ≤ %85 yeşil, ≤ %100 sarı, üstü kırmızı.
 * Takt ya da C/T yoksa `null` (prosesin kendi rengi kalır). Renk tek başına değil, takt rozetleriyle birlikte okunur.
 */
function ratioColor(r: number | null): string | null {
  if (r === null) return null;
  return r <= 0.85 ? '#d1fae5' : r <= 1 ? '#fef3c7' : '#fee2e2';
}

/** Kaizen patlamasında durum ve sorumlu */
function KaizenChip({ kaizen }: { kaizen: KaizenData }) {
  if (!kaizen.owner && !kaizen.dueDate && kaizen.status === 'open') return null;
  const late = kaizen.status !== 'done' && !!kaizen.dueDate && kaizen.dueDate < todayIso();
  return (
    <div className={`kaizen-chip kz-${kaizen.status}${late ? ' kz-late' : ''}`}>
      {kaizen.status === 'done' ? '✓ ' : late ? '⚠ ' : ''}
      {KAIZEN_STATUS_LABELS[kaizen.status]}
      {kaizen.owner && ` · ${kaizen.owner}`}
    </div>
  );
}

/** Müşteri simgesinde harita düzeyi talep (girilen) ve takt (hesaplanan). */
function CustomerInfo({ demand, taktSec }: { demand: VsmQuantity; taktSec: number | null }) {
  if (demand.value === null && taktSec === null) return null;
  return (
    <div className="customer-info">
      {demand.value !== null && <div>Talep: {formatQuantity(demand)}</div>}
      {taktSec !== null && (
        <div className="calc-value" title="Hesaplanan değer">
          Takt = {formatDuration(taktSec)}
        </div>
      )}
    </div>
  );
}

/** Prosesin altında duran VSM veri kutusu. Düğümün parçası olduğu için onunla birlikte taşınır. */
function VsmDataBox({
  vsm,
  overTakt,
  netSec,
  families,
}: {
  vsm: VsmData;
  overTakt: boolean;
  netSec: number | null;
  families: ProductFamily[];
}) {
  const passing = families.length > 1 ? (vsm.familyIds.length ? families.filter((f) => vsm.familyIds.includes(f.id)) : families) : [];
  const filled = VSM_FIELDS.filter((f) => vsm.fields[f.key].value !== null);
  const oee = oeeOf(vsm, netSec).oee;
  const familyCycles = passing.filter((f) => vsm.cycleByFamily[f.id]?.value != null);
  return (
    <div className="vsm-box" data-testid="vsm-veri-kutusu">
      {passing.length > 0 && (
        <div className="family-chips" title="Bu prosesten geçen ürün aileleri">
          {passing.map((f) => (
            <span key={f.id} className="family-chip">
              <span className="family-dot" style={{ background: f.color }} />
              {f.name}
            </span>
          ))}
        </div>
      )}
      {(filled.length > 0 || familyCycles.length > 0) && (
        <table>
          <tbody>
            {filled.map((f) => {
              const q = vsm.fields[f.key];
              return (
                <tr key={f.key} className={f.key === 'cycleTime' && overTakt ? 'over-takt' : undefined}>
                  <th scope="row">{f.short}</th>
                  <td>
                    {formatNumber(q.value as number)} {q.unit}
                  </td>
                </tr>
              );
            })}
            {familyCycles.map((f) => {
              const q = vsm.cycleByFamily[f.id];
              return (
                <tr key={`ct-${f.id}`}>
                  <th scope="row">
                    <span className="family-dot" style={{ background: f.color }} />
                    C/T {f.name}
                  </th>
                  <td>
                    {formatNumber(q.value as number)} {q.unit}
                  </td>
                </tr>
              );
            })}
            {oee !== null && (
              <tr className={oee < 0.85 ? 'oee-low' : undefined}>
                <th scope="row">OEE</th>
                <td className="calc-value" title="Kullanılabilirlik × Performans × Kalite">
                  {formatPercent(oee)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {vsm.note.trim() && <div className="vsm-note">{vsm.note}</div>}
    </div>
  );
}

const View = memo(ShapeNodeView);

export const nodeTypes: NodeTypes = Object.fromEntries(SHAPE_KINDS.map((k) => [k, View]));

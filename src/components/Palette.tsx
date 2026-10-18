import type { DragEvent } from 'react';
import { EDGE_KIND_SPECS } from '../model/edges';
import { SHAPES } from '../model/shapes';
import { EDGE_KINDS, SHAPE_KINDS, type EdgeKind, type ShapeKind } from '../model/types';

export const DRAG_MIME = 'application/x-akis-sekil';

interface Props {
  onAdd: (kind: ShapeKind) => void;
  connectKind: EdgeKind;
  onConnectKindChange: (kind: EdgeKind) => void;
}

const GROUPS = [
  { id: 'general', title: 'Genel şekiller' },
  { id: 'vsm', title: 'VSM' },
] as const;

export function Palette({ onAdd, connectKind, onConnectKindChange }: Props) {
  const onDragStart = (event: DragEvent, kind: ShapeKind) => {
    event.dataTransfer.setData(DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="panel palette" aria-label="Şekil paleti">
      <h2>Şekiller</h2>
      <p className="muted">Tuvale sürükleyip bırakın ya da tıklayarak ortaya ekleyin.</p>
      {GROUPS.map((group) => (
        <section key={group.id} className="palette-group" aria-label={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {SHAPE_KINDS.filter((k) => SHAPES[k].group === group.id).map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  className="palette-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, kind)}
                  onClick={() => onAdd(kind)}
                  title={SHAPES[kind].hint}
                  data-kind={kind}
                >
                  <ShapeIcon kind={kind} color={SHAPES[kind].color} />
                  <span>
                    <strong>{SHAPES[kind].label}</strong>
                    <small>{SHAPES[kind].hint}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {group.id === 'vsm' && (
            <div className="arrow-kinds" role="radiogroup" aria-label="Yeni bağlantı türü">
              <h4>Yeni ok türü</h4>
              <p className="muted small">Seçin, sonra şekillerin kenar noktalarından ok çekin.</p>
              {EDGE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={connectKind === k}
                  className={`arrow-kind${connectKind === k ? ' is-active' : ''}`}
                  onClick={() => onConnectKindChange(k)}
                  title={EDGE_KIND_SPECS[k].hint}
                  data-edge-kind={k}
                >
                  <ArrowIcon kind={k} />
                  <span>{EDGE_KIND_SPECS[k].label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </aside>
  );
}

function ShapeIcon({ kind, color }: { kind: ShapeKind; color: string }) {
  const common = { fill: color, stroke: '#374151', strokeWidth: 1.5 };
  let shape;
  switch (kind) {
    case 'terminal':
      shape = <rect x="3" y="6" width="30" height="16" rx="8" {...common} />;
      break;
    case 'process':
      shape = <rect x="3" y="5" width="30" height="18" rx="2" {...common} />;
      break;
    case 'decision':
      shape = <polygon points="18,2 32,14 18,26 4,14" {...common} />;
      break;
    case 'department':
      shape = <rect x="3" y="5" width="30" height="18" rx="2" {...common} strokeDasharray="3 2" />;
      break;
    case 'note':
      shape = <path d="M3 5 H27 L33 11 V23 H3 Z" {...common} />;
      break;
    case 'customer':
    case 'supplier':
      shape = <polygon points="3,25 3,12 11,5 11,12 19,5 19,12 27,5 27,25" {...common} />;
      break;
    case 'inventory':
      shape = (
        <>
          <polygon points="18,3 32,25 4,25" {...common} />
          <text x="18" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">
            I
          </text>
        </>
      );
      break;
    case 'kaizen':
      shape = <polygon points="18,1 21,9 30,5 25,13 34,16 25,18 29,26 20,21 16,28 14,20 5,24 10,16 2,12 11,10 8,3 15,8" {...common} />;
      break;
  }
  return (
    <svg className="palette-icon" viewBox="0 0 36 28" aria-hidden="true">
      {shape}
    </svg>
  );
}

function ArrowIcon({ kind }: { kind: EdgeKind }) {
  return (
    <svg className="arrow-icon" viewBox="0 0 44 16" aria-hidden="true">
      {kind === 'flow' && (
        <>
          <line x1="2" y1="8" x2="34" y2="8" stroke="#374151" strokeWidth="1.5" />
          <polygon points="34,4 42,8 34,12" fill="#374151" />
        </>
      )}
      {kind === 'info' && (
        <>
          <line x1="2" y1="8" x2="38" y2="8" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" />
          <polyline points="34,4 42,8 34,12" fill="none" stroke="#2563eb" strokeWidth="1.5" />
        </>
      )}
      {kind === 'material' && (
        <>
          <line x1="2" y1="8" x2="32" y2="8" stroke="#111827" strokeWidth="6" />
          <line x1="2" y1="8" x2="32" y2="8" stroke="#fff" strokeWidth="2" strokeDasharray="3 4" />
          <polygon points="32,2 43,8 32,14" fill="#111827" />
        </>
      )}
      {kind === 'shipment' && (
        <>
          <line x1="2" y1="8" x2="32" y2="8" stroke="#111827" strokeWidth="7" />
          <line x1="3" y1="8" x2="32" y2="8" stroke="#fff" strokeWidth="3.5" />
          <polygon points="31,1 43,8 31,15" fill="#111827" />
        </>
      )}
    </svg>
  );
}

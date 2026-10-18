import type { TimelineStep, VsmSummary } from '../model/vsmCalc';
import { formatDays, formatDuration, formatPercent, formatQuantity } from '../model/vsm';

/** Zaman çizgisinde stok türünü gösteren kısa işaret */
const STOCK_PREFIX: Record<string, string> = { inventory: '▲', supermarket: '⊐', fifo: '⇉', safetyStock: '▣' };

interface Props {
  summary: VsmSummary;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

/**
 * Tuvalin altındaki VSM zaman çizgisi (merdiven). Prosesler ve stok üçgenleri tuvaldeki soldan sağa
 * sırayla dizilir. Üst basamak: stokta bekleme (gün). Alt basamak: prosesin çevrim süresi (C/T).
 * Sağda toplam bekleme, toplam işlem süresi, lead time ve değer katma oranı hesaplanır.
 */
export function Timeline({ summary, onSelectNode, onClose }: Props) {
  const { steps } = summary;
  return (
    <section className="timeline" aria-label="VSM zaman çizgisi" data-testid="zaman-cizgisi">
      <header>
        <strong>VSM zaman çizgisi</strong>
        <span className="muted small">
          {summary.orderedByArrows ? 'Sıra: akış oklarına göre' : 'Sıra: soldan sağa (ok yok)'} · boş alan "—"
        </span>
        <button type="button" className="icon" onClick={onClose} aria-label="Zaman çizgisini gizle" title="Gizle">
          ×
        </button>
      </header>
      {steps.length === 0 ? (
        <p className="muted small timeline-empty">
          Henüz veri yok. Proseslere çevrim süresi, stok üçgenlerine stok miktarı girin.
        </p>
      ) : (
        <div className="timeline-scroll">
          <table>
            <thead>
              <tr>
                <th scope="row" className="row-head" />
                {steps.map((s) => (
                  <th key={s.id} scope="col" className={`tl-col-${s.kind}`}>
                    <button type="button" className="link" onClick={() => onSelectNode(s.id)} title="Şekli seç">
                      {s.kind === 'inventory' ? `${STOCK_PREFIX[s.shapeKind] ?? '▲'} ${s.title}` : s.title}
                    </button>
                    {s.kind === 'process' && s.overTakt && <span className="tl-warn" title="Takt üstü"> ⚠</span>}
                  </th>
                ))}
                <th scope="col" className="tl-total-head">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="tl-wait">
                <th scope="row" className="row-head">
                  Stokta bekleme
                </th>
                {steps.map((s) => (
                  <td key={s.id} className={s.kind === 'inventory' ? 'tl-on' : 'tl-off'}>
                    {s.kind === 'inventory' && <WaitCell step={s} />}
                  </td>
                ))}
                <td className="tl-total">
                  Bekleme ={' '}
                  <span className="calc-value" data-testid="cizgi-bekleme">
                    {summary.waitDays.value === null ? '—' : formatDays(summary.waitDays.value)}
                  </span>
                </td>
              </tr>
              <tr className="tl-process">
                <th scope="row" className="row-head">
                  İşlem süresi (C/T)
                </th>
                {steps.map((s) => (
                  <td key={s.id} className={s.kind === 'process' ? 'tl-on' : 'tl-off'}>
                    {s.kind === 'process' && (s.cycleSec === null ? '—' : formatDuration(s.cycleSec))}
                  </td>
                ))}
                <td className="tl-total">
                  İşlem ={' '}
                  <span className="calc-value" data-testid="cizgi-islem">
                    {summary.processingSec.value === null ? '—' : formatDuration(summary.processingSec.value)}
                  </span>
                </td>
              </tr>
              <tr className="tl-lead">
                <th scope="row" className="row-head" />
                <td colSpan={steps.length} />
                <td className="tl-total">
                  Lead time ={' '}
                  <span className="calc-value" data-testid="cizgi-lt">
                    {summary.leadTimeDays === null ? '—' : formatDays(summary.leadTimeDays)}
                  </span>
                  {summary.valueAddedRatio !== null && (
                    <>
                      {' · '}Değer katma ={' '}
                      <span className="calc-value" data-testid="cizgi-oran">
                        {formatPercent(summary.valueAddedRatio)}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WaitCell({ step }: { step: Extract<TimelineStep, { kind: 'inventory' }> }) {
  if (step.days === null) return <span title={step.reason ?? undefined}>— ({formatQuantity(step.stock)})</span>;
  return step.calculated ? (
    <span title={`${formatQuantity(step.stock)} ÷ günlük talep`}>
      <span className="calc-value">{formatDays(step.days)}</span>
    </span>
  ) : (
    <>{formatDays(step.days)}</>
  );
}

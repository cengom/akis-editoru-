import type { VsmData } from '../model/types';
import { formatNumber, formatPercent } from '../model/vsm';
import { oeeOf, type VsmSummary } from '../model/vsmCalc';

const WORLD_CLASS = 0.85;

function Bar({ label, value, note, testId }: { label: string; value: number | null; note?: string; testId: string }) {
  return (
    <div className="oee-row" data-testid={testId}>
      <span className="oee-label">{label}</span>
      <span className="oee-track" aria-hidden="true">
        {value !== null && <span className="oee-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />}
      </span>
      <span className="oee-value">
        {value === null ? <span className="muted">—</span> : <span className="calc-value">{formatPercent(value)}</span>}
        {note && <span className="muted small"> {note}</span>}
      </span>
    </div>
  );
}

/** Proses panelinde OEE dökümü: Kullanılabilirlik × Performans × Kalite. */
/** `load`: prosesin talep yükü (özetten; ürün ailelerinin toplam iş içeriği ÷ kullanılabilir süre). */
export function OeeBreakdown({ vsm, netSec, load }: { vsm: VsmData; netSec: number | null; load: number | null }) {
  const r = oeeOf(vsm, netSec);
  return (
    <div className="oee-box" data-testid="oee-dokum">
      <h4>OEE</h4>
      <Bar
        label="Kullanılabilirlik"
        value={r.availability}
        note={r.availabilitySource === 'calculated' ? '(duruşlardan)' : r.availabilitySource === 'manual' ? '(uptime)' : undefined}
        testId="oee-a"
      />
      <Bar label="Performans" value={r.performance} note={r.performance !== null ? '(ideal ÷ C/T)' : undefined} testId="oee-p" />
      <Bar label="Kalite" value={r.quality} note={r.quality !== null ? '(1 − hurda)' : undefined} testId="oee-q" />
      <div className={`oee-total${r.oee !== null && r.oee < WORLD_CLASS ? ' is-low' : ''}`} data-testid="oee-toplam">
        <Bar label="OEE" value={r.oee} testId="oee-o" />
        {r.oee !== null && (
          <p className="small">
            {r.oee >= WORLD_CLASS ? '✓ Sınıfının en iyisi düzeyinde (≥ %85).' : '⚠ %85 hedefinin altında.'}
          </p>
        )}
      </div>
      {r.missing.length > 0 && <p className="muted small">OEE için eksik: {r.missing.join(', ')}.</p>}
      {r.availabilitySource === 'manual' && r.availabilityCalculated !== null && (
        <p className="muted small">
          Duruşlardan hesaplanan kullanılabilirlik: <span className="calc-value">{formatPercent(r.availabilityCalculated)}</span>
        </p>
      )}
      {r.warnings.map((w) => (
        <p key={w} className="caution-box small">
          {w}
        </p>
      ))}
      {r.capacityPerDay !== null && (
        <p className="small" data-testid="oee-kapasite">
          Günlük kapasite: <span className="calc-value">{formatNumber(r.capacityPerDay, 0)} adet/gün</span>
          {load !== null && (
            <>
              {' '}
              · talep yükü <span className={`calc-value${load > 1 ? ' over' : ''}`}>{formatPercent(load)}</span>
              {load > 1 && <strong className="over"> ⚠ kapasite yetmiyor</strong>}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Özette proses bazında OEE tablosu (düşükten yükseğe). */
export function OeeTable({ summary, onSelectNode }: { summary: VsmSummary; onSelectNode: (id: string) => void }) {
  const rows = summary.oeeRanking;
  const partial = summary.processes.filter((p) => p.oee.oee === null).length;
  return (
    <div data-testid="oee-tablosu">
      <h4 className="chart-title">OEE (kullanılabilirlik × performans × kalite)</h4>
      {rows.length === 0 ? (
        <p className="muted small">OEE için proseslere uptime ya da duruş, ideal C/T ve hurda % girin.</p>
      ) : (
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Proses</th>
              <th scope="col">A</th>
              <th scope="col">P</th>
              <th scope="col">Q</th>
              <th scope="col">OEE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  <button type="button" className="link" onClick={() => onSelectNode(p.id)}>
                    {p.title}
                  </button>
                </th>
                <td>{formatPercent(p.oee.availability!)}</td>
                <td>{formatPercent(p.oee.performance!)}</td>
                <td>{formatPercent(p.oee.quality!)}</td>
                <td className={(p.oee.oee as number) < WORLD_CLASS ? 'worse' : 'better'}>
                  {(p.oee.oee as number) < WORLD_CLASS ? '⚠ ' : '✓ '}
                  {formatPercent(p.oee.oee as number)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {partial > 0 && rows.length > 0 && <p className="muted small">{partial} proseste OEE için veri eksik.</p>}
    </div>
  );
}

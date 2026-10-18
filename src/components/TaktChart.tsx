import type { VsmSummary } from '../model/vsmCalc';
import { formatDuration } from '../model/vsm';

interface Props {
  summary: VsmSummary;
  onSelectNode: (id: string) => void;
}

/**
 * Takt – çevrim süresi grafiği (operatör denge grafiğinin sade hali).
 * Her proses için yatay çubuk: koyu kısım C/T, soluk uzantı uptime ve hurda kaybı (etkin C/T).
 * Dikey kesikli çizgi takt süresidir. Takt üstü prosesler kırmızı + ⚠ ve yazıyla işaretlenir
 * (renk tek başına anlam taşımaz).
 */
export function TaktChart({ summary, onSelectNode }: Props) {
  const rows = summary.steps.filter((s) => s.kind === 'process' && s.cycleSec !== null).map((s) => s as Extract<typeof s, { kind: 'process' }>);
  if (rows.length === 0) return <p className="muted small">Grafik için proseslere çevrim süresi girin.</p>;

  const takt = summary.takt.seconds;
  const max = Math.max(takt ?? 0, ...rows.map((r) => r.effectiveCycleSec ?? r.cycleSec ?? 0)) * 1.08 || 1;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <figure className="takt-chart" aria-label="Takt ve çevrim süresi grafiği" data-testid="takt-grafigi">
      <div className="tc-plot">
        {takt !== null && (
          <div className="tc-takt" style={{ left: pct(takt) }} aria-hidden="true">
            <span>Takt {formatDuration(takt)}</span>
          </div>
        )}
        {rows.map((r) => {
          const ct = r.cycleSec as number;
          const eff = r.effectiveCycleSec;
          const loss = eff !== null && eff > ct ? eff - ct : 0;
          const state = r.overTakt ? 'over' : r.overTaktEffective ? 'over-eff' : 'ok';
          const isBottleneck = summary.bottleneck?.id === r.id;
          const tip = [
            `${r.title}`,
            `C/T: ${formatDuration(ct)}`,
            eff !== null && loss > 0 ? `Etkin C/T (uptime/hurda dahil): ${formatDuration(eff)}` : null,
            takt !== null ? `Takt: ${formatDuration(takt)}` : null,
            r.overTakt ? 'Takt üstü' : r.overTaktEffective ? 'Etkin C/T takt üstü' : null,
            isBottleneck ? 'Darboğaz (en büyük C/T)' : null,
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <button
              type="button"
              key={r.id}
              className={`tc-row tc-${state}`}
              onClick={() => onSelectNode(r.id)}
              title={tip}
              aria-label={tip.replace(/\n/g, ', ')}
            >
              <span className="tc-label">
                {r.title}
                {isBottleneck && <span className="tc-tag">darboğaz</span>}
              </span>
              <span className="tc-track">
                <span className="tc-bar" style={{ width: pct(ct) }} />
                {loss > 0 && <span className="tc-loss" style={{ left: pct(ct), width: pct(loss) }} />}
              </span>
              <span className="tc-value">
                {state !== 'ok' && <span aria-hidden="true">⚠ </span>}
                {formatDuration(ct)}
                {loss > 0 && <span className="muted"> · etkin {formatDuration(eff as number)}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <figcaption className="tc-legend muted small">
        <span className="tc-key tc-key-bar" /> C/T
        <span className="tc-key tc-key-loss" /> uptime/hurda kaybı
        {takt !== null && (
          <>
            <span className="tc-key tc-key-takt" /> takt
          </>
        )}
        <span className="tc-key tc-key-over" /> ⚠ takt üstü
      </figcaption>
    </figure>
  );
}

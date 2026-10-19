import { useEffect, useState } from 'react';
import { WORK_KINDS, type VsmData, type WorkKind, type WorkStep } from '../model/types';
import {
  WORK_KIND_LABELS,
  WORK_KIND_SHORT,
  WORK_LIMITS,
  WORK_STEP_TIME_SPEC,
  checkVsmValue,
  formatDuration,
  formatNumber,
  formatPercent,
  newWorkStep,
  numberToInput,
  parseNumberInput,
  toSeconds,
} from '../model/vsm';
import { newId } from '../model/document';
import { YAMAZUMI_KINDS, balanceOf, operatorLoads, type KindTotals, type YamazumiKind, type YamazumiResult } from '../model/yamazumi';

/** Grafikte ve tabloda türlerin adı. `unknown`: iş adımı girilmemiş, C/T'den gelen süre. */
export const YAMAZUMI_KIND_LABELS: Record<YamazumiKind, string> = { ...WORK_KIND_LABELS, unknown: 'Türü belirsiz (C/T)' };

/** Bir sütun: operatör ya da proses. */
interface Bar {
  key: string;
  label: string;
  /** İkinci satır (ör. proses adı) */
  sub?: string;
  byKind: KindTotals;
  totalSec: number | null;
  /** Taktla karşılaştırılan süre: operatörde toplam yük, proseste en yüklü operatör */
  compareSec?: number | null;
  /** Tablodaki satır adı */
  rowLabel: string;
  overTakt: boolean;
  /** Proses görünümünde takt × operatör sayısı (birden çok operatör varsa) */
  capacitySec?: number | null;
  onClick?: () => void;
  note?: string;
}

/**
 * Yamazumi (yığılmış) grafiği: her sütun bir operatör ya da proses; parçalar türlere göre
 * (katma değerli düz, gerekli çizgili, israf kareli, belirsiz noktalı). Yatay kesikli çizgi takt.
 * Takt üstü sütunlar ⚠ ile ve yazıyla işaretlenir (renk tek başına anlam taşımaz).
 * "Tablo" düğmesi aynı veriyi tablo olarak gösterir.
 */
export function YamazumiChart({ bars, taktSec, testId }: { bars: Bar[]; taktSec: number | null; testId: string }) {
  const [asTable, setAsTable] = useState(false);
  const known = bars.filter((b) => b.totalSec !== null);
  if (known.length === 0) return <p className="muted small">Grafik için iş adımlarına süre girin ya da proseslere C/T girin.</p>;
  const used = YAMAZUMI_KINDS.filter((k) => bars.some((b) => b.byKind[k] > 0));
  const max = Math.max(taktSec ?? 0, ...known.map((b) => b.totalSec as number), ...bars.map((b) => b.capacitySec ?? 0)) * 1.1 || 1;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <figure className="yamazumi" data-testid={testId} aria-label="Operatör dengeleme (Yamazumi) grafiği">
      <div className="yz-switch" role="group" aria-label="Görünüm">
        <button type="button" aria-pressed={!asTable} onClick={() => setAsTable(false)}>
          Grafik
        </button>
        <button type="button" aria-pressed={asTable} onClick={() => setAsTable(true)} data-testid={`${testId}-tablo-dugme`}>
          Tablo
        </button>
      </div>
      {asTable ? (
        <YamazumiTable bars={bars} used={used} taktSec={taktSec} />
      ) : (
        <>
          <div className="yz-scroll">
            <div className="yz-plot" style={{ minWidth: `${bars.length * 44}px` }}>
              {taktSec !== null && (
                <div className="yz-takt" style={{ bottom: pct(taktSec) }} aria-hidden="true">
                  <span>Takt {formatDuration(taktSec)}</span>
                </div>
              )}
              {bars.map((b) => {
                const tip = [
                  b.sub ? `${b.sub} · ${b.label}` : b.label,
                  ...used.filter((k) => b.byKind[k] > 0).map((k) => `${YAMAZUMI_KIND_LABELS[k]}: ${formatDuration(b.byKind[k])}`),
                  b.totalSec !== null ? `Toplam: ${formatDuration(b.totalSec)}` : 'Süre girilmedi',
                  taktSec !== null ? `Takt: ${formatDuration(taktSec)}` : null,
                  b.capacitySec ? `Takt × operatör: ${formatDuration(b.capacitySec)}` : null,
                  b.overTakt ? 'Takt üstü' : null,
                  b.note ?? null,
                ]
                  .filter(Boolean)
                  .join('\n');
                const Tag = b.onClick ? 'button' : 'div';
                return (
                  <Tag
                    key={b.key}
                    {...(b.onClick ? { type: 'button' as const, onClick: b.onClick } : {})}
                    className={`yz-col${b.overTakt ? ' yz-over' : ''}`}
                    title={tip}
                    aria-label={tip.replace(/\n/g, ', ')}
                  >
                    {used.map((k) =>
                      b.byKind[k] > 0 ? <span key={k} className={`yz-seg yz-${k}`} style={{ height: pct(b.byKind[k]) }} /> : null,
                    )}
                    <span className="yz-value">
                      {b.overTakt && <span aria-hidden="true">⚠</span>}
                      {b.totalSec !== null ? formatShort(b.totalSec) : '—'}
                    </span>
                    {b.capacitySec ? <span className="yz-cap" style={{ bottom: pct(b.capacitySec) }} aria-hidden="true" /> : null}
                    <span className="yz-label">
                      {b.label}
                      {b.sub && <span className="yz-sub">{b.sub}</span>}
                    </span>
                  </Tag>
                );
              })}
            </div>
          </div>
          <figcaption className="tc-legend muted small">
            {used.map((k) => (
              <span key={k} className="yz-legend-item">
                <span className={`yz-key yz-${k}`} /> {YAMAZUMI_KIND_LABELS[k]}
              </span>
            ))}
            {taktSec !== null && (
              <span className="yz-legend-item">
                <span className="yz-key yz-key-takt" /> takt
              </span>
            )}
            {bars.some((b) => b.capacitySec) && (
              <span className="yz-legend-item">
                <span className="yz-key yz-key-cap" /> takt × operatör
              </span>
            )}
            <span className="yz-legend-item">⚠ takt üstü</span>
          </figcaption>
        </>
      )}
    </figure>
  );
}

/** Sütun üstündeki değer: dar sütuna sığsın diye kısa yazım (10 dakikanın altında birimsiz saniye). */
function formatShort(sec: number): string {
  return sec < 600 ? formatNumber(sec, 1) : `${formatNumber(sec / 60, 1)} dk`;
}

function takeRatio(b: Bar, taktSec: number): string {
  const v = b.compareSec === undefined ? b.totalSec : b.compareSec;
  if (v === null) return '—';
  return `${b.overTakt ? '⚠ ' : ''}${formatPercent(v / taktSec)}`;
}

function YamazumiTable({ bars, used, taktSec }: { bars: Bar[]; used: YamazumiKind[]; taktSec: number | null }) {
  return (
    <div className="yz-table-wrap">
      <table className="yz-table">
        <thead>
          <tr>
            <th scope="col">Sütun</th>
            {used.map((k) => (
              <th scope="col" key={k}>
                {YAMAZUMI_KIND_LABELS[k]}
              </th>
            ))}
            <th scope="col">Toplam</th>
            {taktSec !== null && (
              <th scope="col" title="Operatörün yükü ÷ takt; proseste en yüklü operatör ÷ takt">
                Takta göre
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key} className={b.overTakt ? 'yz-row-over' : undefined}>
              <th scope="row">{b.rowLabel}</th>
              {used.map((k) => (
                <td key={k}>{b.byKind[k] > 0 ? formatDuration(b.byKind[k]) : '—'}</td>
              ))}
              <td>{b.totalSec !== null ? formatDuration(b.totalSec) : '—'}</td>
              {taktSec !== null && (
                <td>{takeRatio(b, taktSec)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Özet paneli bölümü ---------- */

export function YamazumiSection({
  result,
  mixed,
  onSelectNode,
}: {
  result: YamazumiResult;
  mixed: boolean;
  onSelectNode: (id: string) => void;
}) {
  const [by, setBy] = useState<'operator' | 'process'>('operator');
  const r = result;
  if (r.processes.length === 0 && r.skipped.length === 0) return null;

  const bars: Bar[] =
    by === 'operator'
      ? r.operators.map((o) => ({
          key: o.key,
          label: `Op ${o.operator}`,
          sub: o.processTitle,
          rowLabel: `${o.processTitle} · Op ${o.operator}`,
          byKind: o.byKind,
          totalSec: o.totalSec,
          overTakt: o.overTakt,
          onClick: () => onSelectNode(o.processId),
        }))
      : r.processes.map((p) => ({
          key: p.id,
          label: p.title,
          sub: `${p.operators.length} op`,
          rowLabel: `${p.title} (${p.operators.length} op)`,
          byKind: p.byKind,
          totalSec: p.totalSec,
          compareSec: p.maxLoadSec,
          overTakt: p.maxLoadSec !== null && r.taktSec !== null && p.maxLoadSec > r.taktSec + 1e-9,
          capacitySec: p.operators.length > 1 ? p.taktCapacitySec : null,
          onClick: () => onSelectNode(p.id),
          note: p.operators.length > 1 ? 'Çubuk tüm operatörlerin toplam işidir.' : undefined,
        }));

  const assumed = r.processes.filter((p) => p.operatorsAssumed);
  return (
    <div className="yz-section" data-testid="yamazumi">
      <h4 className="chart-title">Operatör dengeleme (Yamazumi)</h4>
      <p className="muted small">
        Her operatörün bir parça için yaptığı işin süresi, türlerine göre üst üste. İş adımları prosesin panelinden
        girilir; girilmeyen proseste C/T kullanılır.
        {mixed && ' İş adımları tüm aileler için aynı kabul edilir.'}
      </p>
      <dl>
        <dt>Toplam iş (Σ)</dt>
        <dd>{r.totalSec !== null ? <span className="calc-value">{formatDuration(r.totalSec)}</span> : <span className="muted small">Veri yok</span>}</dd>
        <dt>Operatör sayısı</dt>
        <dd>
          <span className="calc-value" data-testid="yz-operator">{r.operatorCount} kişi</span>
        </dd>
        <dt>En yüklü operatör</dt>
        <dd>{r.maxLoadSec !== null ? <span className="calc-value">{formatDuration(r.maxLoadSec)}</span> : '—'}</dd>
        <dt title="Σ iş ÷ (operatör sayısı × en yüklü operatör). %100 = herkes eşit yüklü.">Denge oranı</dt>
        <dd>
          {r.balanceRatio !== null ? (
            <span className="calc-value" data-testid="yz-denge">{formatPercent(r.balanceRatio)}</span>
          ) : (
            '—'
          )}
        </dd>
        <dt title="⌈Σ iş ÷ takt⌉">Gereken operatör</dt>
        <dd>
          {r.requiredOperators !== null ? (
            <span className="calc-value" data-testid="yz-gereken">{r.requiredOperators} kişi</span>
          ) : (
            <span className="muted small">{r.taktReason ?? 'Veri yok'}</span>
          )}
        </dd>
      </dl>
      <div className="yz-switch" role="group" aria-label="Sütunlar">
        <button type="button" aria-pressed={by === 'operator'} onClick={() => setBy('operator')}>
          Operatör başına
        </button>
        <button type="button" aria-pressed={by === 'process'} onClick={() => setBy('process')} data-testid="yz-proses-dugme">
          Proses başına
        </button>
      </div>
      <YamazumiChart bars={bars} taktSec={r.taktSec} testId="yamazumi-grafigi" />
      {r.overTakt.length > 0 && (
        <div className="warning-box" data-testid="yz-uyari">
          <strong>⚠ Takt süresini aşan operatörler</strong>
          <ul>
            {r.overTakt.map((o) => (
              <li key={o.key}>
                <button type="button" className="link" onClick={() => onSelectNode(o.processId)}>
                  {o.processTitle} · Op {o.operator}
                </button>
                : {formatDuration(o.totalSec!)} &gt; takt {formatDuration(r.taktSec!)}
              </li>
            ))}
          </ul>
          İşi diğer operatörlere kaydırın ya da israfı azaltın.
        </div>
      )}
      {r.missingTimes > 0 && <p className="muted small">{r.missingTimes} iş adımında süre girilmedi; hesaba katılmadı.</p>}
      {assumed.length > 0 && (
        <p className="muted small">
          Operatör sayısı girilmediği için 1 kabul edildi: {assumed.map((p) => p.title).join(', ')}.
        </p>
      )}
      {r.skipped.length > 0 && (
        <p className="muted small">
          Grafikte yok: {r.skipped.map((s) => `${s.title} (${s.reason})`).join(', ')}
        </p>
      )}
    </div>
  );
}

/* ---------- Proses paneli: iş adımları ---------- */

export function WorkStepsEditor({ vsm, taktSec, onChange }: { vsm: VsmData; taktSec: number | null; onChange: (v: VsmData) => void }) {
  const steps = vsm.workSteps;
  const setSteps = (next: WorkStep[]) => onChange({ ...vsm, workSteps: next });
  const update = (i: number, patch: Partial<WorkStep>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
  };
  const maxOp = Math.min(
    WORK_LIMITS.operator,
    Math.max(2, (vsm.fields.operators.value ?? 0), ...steps.map((s) => s.operator + 1)),
  );
  const add = () => setSteps([...steps, newWorkStep(newId('adim'), steps.at(-1)?.operator ?? 1)]);

  const loads = operatorLoads(vsm);
  const balance = balanceOf(loads.map((l) => l.totalSec));
  const maxLoad = Math.max(0, ...loads.map((l) => l.totalSec ?? 0));
  const ct = toSeconds(vsm.fields.cycleTime);
  const differs = ct !== null && loads.some((l) => l.totalSec !== null) && Math.abs(maxLoad - ct) > Math.max(0.5, ct * 0.01);

  return (
    <details className="work-steps" open={steps.length > 0 || undefined} data-testid="is-adimlari">
      <summary>İş adımları (operatör dengeleme){steps.length > 0 ? ` · ${steps.length}` : ''}</summary>
      <p className="muted small">
        Bir parça için yapılan işleri sırayla yazın: süresi, türü ve hangi operatörün yaptığı. Özetteki Yamazumi
        grafiği bu adımlardan çizilir.
      </p>
      {steps.length > 0 && (
        <ol className="ws-list">
          {steps.map((s, i) => (
            <li key={s.id} className="ws-row" data-testid="is-adimi">
              <span className="ws-num" aria-hidden="true">
                {i + 1}.
              </span>
              <input
                className="ws-name"
                value={s.name}
                maxLength={WORK_LIMITS.name}
                placeholder="İş adımı adı"
                aria-label={`${i + 1}. adımın adı`}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <span className="ws-actions">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}. adımı yukarı taşı`} title="Yukarı">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  aria-label={`${i + 1}. adımı aşağı taşı`}
                  title="Aşağı"
                >
                  ↓
                </button>
                <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`${i + 1}. adımı sil`} title="Sil">
                  ✕
                </button>
              </span>
              <span className="ws-fields">
                <StepTimeInput step={s} index={i} onChange={(time) => update(i, { time })} />
                <select
                  value={s.time.unit}
                  aria-label={`${i + 1}. adımın süre birimi`}
                  onChange={(e) => update(i, { time: { ...s.time, unit: e.target.value as WorkStep['time']['unit'] } })}
                >
                  {WORK_STEP_TIME_SPEC.units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <select
                  className={`ws-kind ws-kind-${s.kind}`}
                  value={s.kind}
                  aria-label={`${i + 1}. adımın türü`}
                  onChange={(e) => update(i, { kind: e.target.value as WorkKind })}
                >
                  {WORK_KINDS.map((k) => (
                    <option key={k} value={k} title={WORK_KIND_LABELS[k]}>
                      {WORK_KIND_SHORT[k]}
                    </option>
                  ))}
                </select>
                <select
                  value={s.operator}
                  aria-label={`${i + 1}. adımı yapan operatör`}
                  onChange={(e) => update(i, { operator: Number(e.target.value) })}
                >
                  {Array.from({ length: maxOp }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      Op {n}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={add} disabled={steps.length >= WORK_LIMITS.steps} data-testid="is-adimi-ekle">
        + İş adımı ekle
      </button>
      {loads.length > 0 && (
        <>
          <YamazumiChart
            testId="proses-yamazumi"
            taktSec={taktSec}
            bars={loads.map((l) => ({
              key: String(l.operator),
              label: `Op ${l.operator}`,
              rowLabel: `Op ${l.operator}`,
              byKind: l.byKind,
              totalSec: l.totalSec,
              overTakt: l.totalSec !== null && taktSec !== null && l.totalSec > taktSec + 1e-9,
            }))}
          />
          {balance !== null && (
            <p className="small">
              Denge oranı: <span className="calc-value">{formatPercent(balance)}</span>
              <span className="muted"> (Σ iş ÷ (operatör × en yüklü))</span>
            </p>
          )}
          {differs && (
            <p className="muted small">
              En yüklü operatör {formatDuration(maxLoad)}, C/T alanı {formatDuration(ct!)}. Zaman çizgisi ve takt grafiği C/T
              alanını kullanır; gerekirse C/T'yi güncelleyin.
            </p>
          )}
        </>
      )}
    </details>
  );
}

function StepTimeInput({ step, index, onChange }: { step: WorkStep; index: number; onChange: (q: WorkStep['time']) => void }) {
  // Yazarken "12," gibi yarım değerler kaybolmasın diye metin ayrı tutulur.
  const [draft, setDraft] = useState(numberToInput(step.time.value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const parsed = parseNumberInput(draft);
    if (!parsed.ok || parsed.value !== step.time.value) {
      setDraft(numberToInput(step.time.value));
      setError(null);
    }
  }, [step.time.value]);
  const onText = (text: string) => {
    setDraft(text);
    const parsed = parseNumberInput(text);
    if (!parsed.ok) return setError('Geçerli bir sayı girin.');
    const problem = checkVsmValue(WORK_STEP_TIME_SPEC, parsed.value);
    setError(problem);
    if (!problem) onChange({ ...step.time, value: parsed.value });
  };
  return (
    <span className="ws-time">
      <input
        inputMode="decimal"
        value={draft}
        placeholder="—"
        className={error ? 'invalid' : undefined}
        aria-invalid={error ? true : undefined}
        aria-label={`${index + 1}. adımın süresi`}
        onChange={(e) => onText(e.target.value)}
      />
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}

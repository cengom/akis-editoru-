import type { VsmMapData } from '../model/types';
import type { Total, VsmSummary } from '../model/vsmCalc';
import { VSM_MAP_FIELDS, formatDuration, formatNumber } from '../model/vsm';
import { QuantityTable } from './QuantityFields';

interface Props {
  vsmMap: VsmMapData;
  summary: VsmSummary;
  onChange: (map: VsmMapData) => void;
  onSelectNode: (id: string) => void;
}

/** Hiçbir şey seçili değilken: harita düzeyi VSM verileri ve hesaplanan VSM özeti. */
export function MapPanel({ vsmMap, summary, onChange, onSelectNode }: Props) {
  const basic = VSM_MAP_FIELDS.filter((f) => !f.advanced);
  const advanced = VSM_MAP_FIELDS.filter((f) => f.advanced);
  const setField = (key: keyof VsmMapData['fields'], q: VsmMapData['fields'][typeof key]) =>
    onChange({ ...vsmMap, fields: { ...vsmMap.fields, [key]: q } });

  return (
    <div className="editor map-panel">
      <section className="vsm-section" aria-label="VSM genel verileri">
        <h3>VSM genel verileri</h3>
        <p className="muted small">Tüm hat / harita için geçerlidir. Boş alan "veri yok" demektir.</p>
        <QuantityTable specs={basic} values={vsmMap.fields} onChange={setField} idPrefix="harita" />
        <details open={advanced.some((f) => vsmMap.fields[f.key].value !== null) || undefined}>
          <summary>İsteğe bağlı alanlar</summary>
          <QuantityTable specs={advanced} values={vsmMap.fields} onChange={setField} idPrefix="harita" />
        </details>
        <label className="check">
          <input
            type="checkbox"
            checked={vsmMap.showTimeline}
            onChange={(e) => onChange({ ...vsmMap, showTimeline: e.target.checked })}
            data-testid="zaman-cizgisi-goster"
          />
          Tuvalin altında zaman çizgisini göster
        </label>
      </section>

      <section className="vsm-section vsm-summary" aria-label="VSM özeti" data-testid="vsm-ozeti">
        <h3>VSM özeti</h3>
        <p className="muted small">
          <span className="calc-value">Mavi italik</span> değerler otomatik hesaplanır; elle değiştirilemez.
        </p>
        <dl>
          <dt>Takt süresi</dt>
          <dd>
            {summary.takt.seconds !== null ? (
              <span className="calc-value" data-testid="ozet-takt">
                {formatDuration(summary.takt.seconds)}
              </span>
            ) : (
              <span className="muted small">{summary.takt.reason}</span>
            )}
          </dd>
          <dt>Toplam değer katan süre</dt>
          <dd>
            <TotalValue total={summary.totalVa} count={summary.processes.length} format={formatDuration} testId="ozet-va" />
          </dd>
          <dt>Toplam değer katmayan süre</dt>
          <dd>
            <TotalValue total={summary.totalNva} count={summary.processes.length} format={formatDuration} testId="ozet-nva" />
          </dd>
          <dt>Toplam süre (lead time)</dt>
          <dd>
            <TotalValue total={summary.leadTime} count={summary.processes.length} format={formatDuration} testId="ozet-lt" />
          </dd>
          <dt>Toplam mesafe</dt>
          <dd>
            <TotalValue
              total={summary.totalDistance}
              count={summary.processes.length}
              format={(v) => `${formatNumber(v, 2)} m`}
              testId="ozet-mesafe"
            />
          </dd>
        </dl>
        {summary.netTimeOverDay && <p className="warning-box">Net çalışma süresi bir günü (24 saat) aşıyor.</p>}
        {summary.overTakt.length > 0 && (
          <div className="warning-box" role="alert" data-testid="takt-uyarilari">
            <strong>⚠ Takt süresini aşan prosesler</strong>
            <ul>
              {summary.overTakt.map((p) => (
                <li key={p.id}>
                  <button type="button" className="link" onClick={() => onSelectNode(p.id)}>
                    {p.title}
                  </button>
                  : çevrim {formatDuration(p.cycleSec!)} &gt; takt {formatDuration(summary.takt.seconds!)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted small">
          Hesaplar, VSM verisi girilmiş {summary.processes.length} prosesten yapılır. Boş alanlar toplama katılmaz; 0
          katılır.
        </p>
      </section>
    </div>
  );
}

function TotalValue({
  total,
  count,
  format,
  testId,
}: {
  total: Total;
  count: number;
  format: (v: number) => string;
  testId: string;
}) {
  if (total.value === null) return <span className="muted small">Veri yok</span>;
  return (
    <>
      <span className="calc-value" data-testid={testId}>
        {format(total.value)}
      </span>
      {total.filled < count && (
        <span className="muted small">
          {' '}
          (veri olan proses: {total.filled}/{count})
        </span>
      )}
    </>
  );
}

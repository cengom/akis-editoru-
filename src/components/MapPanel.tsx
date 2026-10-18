import type { VsmMapData } from '../model/types';
import type { Total, VsmSummary } from '../model/vsmCalc';
import { VSM_MAP_FIELDS, formatDays, formatDuration, formatNumber, formatPercent } from '../model/vsm';
import { QuantityTable } from './QuantityFields';
import { TaktChart } from './TaktChart';

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
          <dt>Toplam işlem süresi (∑ C/T)</dt>
          <dd>
            <TotalValue total={summary.processingSec} count={summary.processes.length} format={formatDuration} testId="ozet-islem" />
          </dd>
          <dt>Stokta bekleme (∑ gün)</dt>
          <dd>
            <TotalValue total={summary.waitDays} count={summary.inventories.length} format={formatDays} testId="ozet-bekleme" />
          </dd>
          <dt>Üretim lead time</dt>
          <dd>
            {summary.leadTimeDays === null ? (
              <span className="muted small">Veri yok</span>
            ) : (
              <span className="calc-value" data-testid="ozet-lt">
                {formatDays(summary.leadTimeDays)}
              </span>
            )}
          </dd>
          <dt>Değer katma oranı</dt>
          <dd>
            {summary.valueAddedRatio === null ? (
              <span className="muted small">{summary.leadTimeDays === null ? 'Veri yok' : 'Net çalışma süresi gerekli'}</span>
            ) : (
              <span className="calc-value" data-testid="ozet-oran">
                {formatPercent(summary.valueAddedRatio)}
              </span>
            )}
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
          <dt>Darboğaz (en büyük C/T)</dt>
          <dd>
            {summary.bottleneck ? (
              <span className="calc-value" data-testid="ozet-darbogaz">
                {summary.bottleneck.title} · {formatDuration(summary.bottleneck.cycleSec!)}
              </span>
            ) : (
              <span className="muted small">Veri yok</span>
            )}
          </dd>
          <dt>Gereken operatör (teorik)</dt>
          <dd>
            {summary.requiredOperators === null ? (
              <span className="muted small">Takt ve C/T gerekli</span>
            ) : (
              <>
                <span className="calc-value" data-testid="ozet-operator" title="⌈ toplam C/T ÷ takt ⌉">
                  {summary.requiredOperators} kişi
                </span>
                {summary.currentOperators.value !== null && (
                  <span className="muted small"> (şu an {formatNumber(summary.currentOperators.value)})</span>
                )}
              </>
            )}
          </dd>
          <dt>Pitch</dt>
          <dd>
            {summary.pitchSec === null ? (
              <span className="muted small">{summary.pitchReason}</span>
            ) : (
              <span className="calc-value" data-testid="ozet-pitch" title="takt × paket adedi">
                {formatDuration(summary.pitchSec)}
              </span>
            )}
          </dd>
        </dl>
        <h4 className="chart-title">Takt – çevrim süresi</h4>
        <TaktChart summary={summary} onSelectNode={onSelectNode} />
        {summary.inventoriesMissingDemand > 0 && (
          <p className="warning-box">
            {summary.inventoriesMissingDemand} stok üçgeninde miktar adet olarak girildi ama müşteri talebi yok; bekleme
            günü hesaplanamadı. Müşteri talebini girin ya da stoğu gün olarak yazın.
          </p>
        )}
        {summary.leadTimeDays !== null && !summary.leadTimeIncludesProcessing && summary.processingSec.value !== null && (
          <p className="muted small">Lead time'a işlem süresi eklenmedi: güne çevirmek için net çalışma süresi gerekli.</p>
        )}
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
        {summary.overTaktEffective.length > 0 && (
          <div className="caution-box" data-testid="etkin-takt-uyarilari">
            <strong>⚠ Duruş/hurda nedeniyle kapasitesi yetmeyebilecek prosesler</strong>
            <ul>
              {summary.overTaktEffective.map((p) => (
                <li key={p.id}>
                  <button type="button" className="link" onClick={() => onSelectNode(p.id)}>
                    {p.title}
                  </button>
                  : etkin C/T {formatDuration(p.effectiveCycleSec!)} &gt; takt {formatDuration(summary.takt.seconds!)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted small">
          Klasik VSM yöntemi: işlem süresi proseslerin çevrim süresidir (C/T); bekleme stok üçgenlerinden gelir (adet ÷
          günlük talep). Lead time = bekleme + işlem süresi. Etkin C/T = C/T ÷ uptime ÷ (1 − hurda); yalnızca kapasite
          karşılaştırmasında kullanılır. Boş alanlar toplama katılmaz; 0 katılır.
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

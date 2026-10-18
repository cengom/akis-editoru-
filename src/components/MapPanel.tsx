import { useRef } from 'react';
import type { ShapeNode, VsmMapData } from '../model/types';
import type { Total, VsmSummary } from '../model/vsmCalc';
import { VSM_MAP_FIELDS, formatDays, formatDuration, formatNumber, formatPercent } from '../model/vsm';
import { QuantityTable } from './QuantityFields';
import { LoadChart, TaktChart } from './TaktChart';
import { FamilyEditor } from './FamilyEditor';
import { OeeTable } from './OeeBreakdown';
import { KaizenList } from './KaizenList';
import { StateCompare } from './StateCompare';

interface Props {
  vsmMap: VsmMapData;
  kaizens: ShapeNode[];
  compare: { current: VsmSummary; future: VsmSummary } | null;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  summary: VsmSummary;
  onChange: (map: VsmMapData) => void;
  onSelectNode: (id: string) => void;
}

/** Hiçbir şey seçili değilken: harita düzeyi VSM verileri ve hesaplanan VSM özeti. */
export function MapPanel({ vsmMap, summary, kaizens, compare, onChange, onSelectNode, onExportCsv, onImportCsv }: Props) {
  const csvInput = useRef<HTMLInputElement>(null);
  const basic = VSM_MAP_FIELDS.filter((f) => !f.advanced);
  const advanced = VSM_MAP_FIELDS.filter((f) => f.advanced);
  const setField = (key: keyof VsmMapData['fields'], q: VsmMapData['fields'][typeof key]) =>
    onChange({ ...vsmMap, fields: { ...vsmMap.fields, [key]: q } });

  return (
    <div className="editor map-panel">
      <section className="vsm-section" aria-label="VSM genel verileri">
        <h3>VSM genel verileri</h3>
        <p className="muted small">Tüm hat / harita için geçerlidir. Boş alan "veri yok" demektir.</p>
        <h4 className="chart-title">Ürün aileleri</h4>
        <p className="muted small">
          Müşteri talebi ve paket adedi aile başınadır. Tek ürün grubu varsa tek aile yeterlidir; birden çok aile
          aynı prosesleri paylaşıyorsa ekleyin.
        </p>
        <FamilyEditor vsmMap={vsmMap} onChange={onChange} />
        <QuantityTable specs={basic} values={vsmMap.fields} onChange={setField} idPrefix="harita" />
        {advanced.length > 0 && (
          <details open={advanced.some((f) => vsmMap.fields[f.key].value !== null) || undefined}>
            <summary>İsteğe bağlı alanlar</summary>
            <QuantityTable specs={advanced} values={vsmMap.fields} onChange={setField} idPrefix="harita" />
          </details>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={vsmMap.showTimeline}
            onChange={(e) => onChange({ ...vsmMap, showTimeline: e.target.checked })}
            data-testid="zaman-cizgisi-goster"
          />
          Tuvalin altında zaman çizgisini göster
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={vsmMap.colorByTakt}
            onChange={(e) => onChange({ ...vsmMap, colorByTakt: e.target.checked })}
            data-testid="takta-gore-renk"
          />
          Prosesleri takta göre renklendir
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={vsmMap.includeBatchWait}
            onChange={(e) => onChange({ ...vsmMap, includeBatchWait: e.target.checked })}
            data-testid="parti-lt"
          />
          Parti beklemesini lead time'a ekle
        </label>
        <p className="muted small">
          Parti beklemesi = (parti − 1) × C/T. Klasik VSM'de lead time'a eklenmez; büyük partilerin etkisini görmek için açın.
        </p>
        {vsmMap.colorByTakt && (
          <p className="color-legend small">
            <span className="sw sw-ok" /> etkin C/T ≤ %85 takt <span className="sw sw-near" /> ≤ %100 <span className="sw sw-over" /> takt
            üstü
          </p>
        )}
        <div className="csv-row">
          <span className="small">Proses verileri (Excel/CSV):</span>
          <button type="button" onClick={onExportCsv} data-testid="csv-disa">
            Dışa aktar
          </button>
          <button type="button" onClick={() => csvInput.current?.click()}>
            İçe aktar
          </button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            data-testid="csv-ice"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onImportCsv(f);
            }}
          />
        </div>
      </section>

      <section className="vsm-section vsm-summary" aria-label="VSM özeti" data-testid="vsm-ozeti">
        <h3>VSM özeti</h3>
        <p className="muted small">
          <span className="calc-value">Mavi italik</span> değerler otomatik hesaplanır; elle değiştirilemez.
        </p>
        {summary.multiFamily && (
          <p className="family-view-note small" data-testid="aile-gorunum">
            Görünüm:{' '}
            <strong>{summary.view ? summary.view.name : 'Tüm aileler (karma model)'}</strong>
            {summary.view ? ' — bu ailenin C/T ve takt değerleri.' : ' — ağırlıklı C/T, karma takt ve proses yükü.'}
          </p>
        )}
        {summary.multiFamily && <FamilyTable summary={summary} />}
        <dl>
          <dt>{summary.mixed ? 'Karma takt (toplam talep)' : summary.view && summary.multiFamily ? `Takt (${summary.view.name})` : 'Takt süresi'}</dt>
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
          <dt>Parti beklemesi (∑)</dt>
          <dd>
            <TotalValue
              total={summary.batchWaitSec}
              count={summary.processes.length}
              format={(v) => `${formatDuration(v)}${summary.leadTimeIncludesBatchWait ? ' · lead time\'a dahil' : ' · lead time\'a dahil değil'}`}
              testId="ozet-parti"
            />
          </dd>
          <dt>Üretim lead time{summary.leadTimeIncludesBatchWait ? ' (parti dahil)' : ''}</dt>
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
          <dt>Hız belirleyici (pacemaker)</dt>
          <dd data-testid="ozet-hiz-belirleyici">
            {summary.pacemaker.id ? (
              <button type="button" className="link" onClick={() => onSelectNode(summary.pacemaker.id!)}>
                ⏱ {summary.pacemaker.title}
              </button>
            ) : (
              <span className="muted small">
                Seçilmedi.
                {summary.pacemaker.suggestion && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="link"
                      onClick={() => onChange({ ...vsmMap, pacemakerId: summary.pacemaker.suggestion!.id })}
                      data-testid="hiz-belirleyici-oner"
                    >
                      {summary.pacemaker.suggestion.title} seçilsin mi?
                    </button>
                  </>
                )}
              </span>
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

        {summary.mixed ? (
          <>
            <h4 className="chart-title">Proses yükü (tüm aileler)</h4>
            <LoadChart summary={summary} onSelectNode={onSelectNode} />
          </>
        ) : (
          <TaktChart summary={summary} onSelectNode={onSelectNode} />
        )}
        <OeeTable summary={summary} onSelectNode={onSelectNode} />
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
        {summary.pacemaker.warnings.length > 0 && (
          <div className="caution-box" data-testid="hiz-belirleyici-uyarilari">
            <strong>⏱ Hız belirleyici sonrası akış</strong>
            <ul>
              {summary.pacemaker.warnings.map((w, i) => (
                <li key={w.id + i}>
                  <button type="button" className="link" onClick={() => onSelectNode(w.id)}>
                    {w.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted small">
          Klasik VSM yöntemi: işlem süresi proseslerin çevrim süresidir (C/T); bekleme stok üçgenlerinden gelir (adet ÷
          günlük talep). Lead time = bekleme + işlem süresi (isteğe bağlı: + parti beklemesi). Etkin C/T = C/T ÷ uptime ÷ (1 − hurda); yalnızca kapasite
          karşılaştırmasında kullanılır. Boş alanlar toplama katılmaz; 0 katılır.
        </p>
      </section>
      {compare && <StateCompare current={compare.current} future={compare.future} />}
      <KaizenList kaizens={kaizens} onSelectNode={onSelectNode} />
    </div>
  );
}

/** Aile başına talep, takt ve pitch. */
function FamilyTable({ summary }: { summary: VsmSummary }) {
  return (
    <table className="compare-table" data-testid="aile-tablosu">
      <thead>
        <tr>
          <th scope="col">Aile</th>
          <th scope="col">Talep</th>
          <th scope="col">Takt</th>
          <th scope="col">Pitch</th>
        </tr>
      </thead>
      <tbody>
        {summary.families.map(({ family, taktSec, pitchSec }) => (
          <tr key={family.id} className={summary.view?.id === family.id ? 'is-current' : undefined}>
            <th scope="row">
              <span className="family-dot" style={{ background: family.color }} aria-hidden="true" /> {family.name}
            </th>
            <td>{family.demand.value === null ? '—' : formatNumber(family.demand.value)}</td>
            <td>{taktSec === null ? '—' : <span className="calc-value">{formatDuration(taktSec)}</span>}</td>
            <td>{pitchSec === null ? '—' : <span className="calc-value">{formatDuration(pitchSec)}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

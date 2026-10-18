import type { VsmData, VsmMapData } from '../model/types';
import { epeiOf } from '../model/vsmCalc';
import { formatDays, formatDuration, formatNumber, toSeconds } from '../model/vsm';
import { passingFamilies } from '../model/families';

/** Proses panelinde: bu prosesi hız belirleyici (pacemaker) yap. Haritada tek bir hız belirleyici olur. */
export function PacemakerToggle({ nodeId, vsmMap, onUpdateMap }: { nodeId: string; vsmMap: VsmMapData; onUpdateMap: (m: VsmMapData) => void }) {
  const on = vsmMap.pacemakerId === nodeId;
  return (
    <div className="pacemaker-toggle">
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onUpdateMap({ ...vsmMap, pacemakerId: e.target.checked ? nodeId : null })}
          data-testid="hiz-belirleyici"
        />
        ⏱ Hız belirleyici proses (pacemaker)
      </label>
      <p className="muted small">
        Üretim çizelgesinin verildiği tek proses; genelde müşteriye en yakın, sürekli akışın başladığı yer.
        {vsmMap.pacemakerId && !on && ' Bunu seçerseniz önceki seçim kalkar.'}
      </p>
    </div>
  );
}

/** Parti beklemesi: (parti − 1) × C/T. */
export function BatchWaitNote({ vsm, vsmMap }: { vsm: VsmData; vsmMap: VsmMapData }) {
  const b = vsm.fields.batchSize.value;
  const ct = toSeconds(vsm.fields.cycleTime);
  if (b === null || ct === null || b < 1) return null;
  const wait = (b - 1) * ct;
  return (
    <p className="small" data-testid="parti-bekleme">
      Parti beklemesi: <span className="calc-value" title="(parti − 1) × C/T">{formatDuration(wait)}</span>{' '}
      <span className="muted">
        — bir parça, partinin geri kalanı işlenene kadar bekler.{' '}
        {vsmMap.includeBatchWait ? "Lead time'a ekleniyor." : "Lead time'a eklenmiyor (harita ayarı)."}
      </span>
    </p>
  );
}

/** EPEI hesabı: girilen ve hesaplanan en kısa EPEI. */
export function EpeiBox({ vsm, vsmMap, netSec }: { vsm: VsmData; vsmMap: VsmMapData; netSec: number | null }) {
  const r = epeiOf(vsm, vsmMap, netSec);
  // Hiç ilgili veri yoksa kutuyu gösterme.
  if (r.partTypes === null && vsm.fields.epei.value === null) return null;
  const families = passingFamilies(vsm, vsmMap);
  return (
    <div className="epei-box" data-testid="epei-kutusu">
      <h4>EPEI (her parça her …)</h4>
      {r.days !== null ? (
        <>
          <p>
            En kısa olası EPEI: <span className="calc-value" data-testid="epei-hesap">{formatDays(r.days)}</span>
          </p>
          <p className="muted small">
            ({r.partTypes} çeşit × C/O = {formatDuration(r.cycleChangeoverSec!)}) ÷ değişime kalan süre{' '}
            {formatDuration(r.spareSec!)}/gün. Kullanılabilir {formatDuration(r.availableSec!)} − üretim{' '}
            {formatDuration(r.productionSec!)}.
            {r.partTypesSource === 'families' && ' Çeşit sayısı = bu prosesten geçen aile sayısı.'}
          </p>
          {families.length > 0 && families.every((f) => f.demand.value !== null) && (
            <p className="muted small">
              Bir döngüde üretilecek miktar (talep × EPEI):{' '}
              {families.map((f) => `${f.name} ${formatNumber(Math.ceil(f.demand.value! * r.days! - 1e-9))} adet`).join(', ')}
              {r.partTypesSource === 'manual' && families.length < (r.partTypes ?? 0) && ' — ailenin çeşitlerine bölünür'}.
            </p>
          )}
          {r.enteredDays !== null && !r.enteredTooShort && (
            <p className="small">
              Girilen EPEI ({formatDays(r.enteredDays)}) bununla uyumlu.
            </p>
          )}
          {r.enteredTooShort && (
            <p className="caution-box small" data-testid="epei-uyari">
              ⚠ Girilen EPEI ({formatDays(r.enteredDays!)}) hesaplanan en kısa değerden kısa: bu sıklıkta değişime zaman yetmez.
              Setup süresini kısaltın (SMED) ya da EPEI'yi uzatın.
            </p>
          )}
        </>
      ) : (
        <p className="muted small">{r.reason}</p>
      )}
      {r.notes.map((n) => (
        <p key={n} className="muted small">
          {n}
        </p>
      ))}
    </div>
  );
}

import type { VsmSummary } from '../model/vsmCalc';
import { formatDuration } from '../model/vsm';

interface Props {
  summary: VsmSummary;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

const dur = (sec: number | null) => (sec === null ? '—' : formatDuration(sec));

/**
 * Tuvalin altındaki VSM zaman çizgisi. Prosesler soldan sağa (tuvaldeki x konumuna göre) sıralanır.
 * Üst satır değer katan süre, alt satır bekleme / değer katmayan süredir. Sağda toplamlar hesaplanır.
 */
export function Timeline({ summary, onSelectNode, onClose }: Props) {
  const { processes } = summary;
  return (
    <section className="timeline" aria-label="VSM zaman çizgisi" data-testid="zaman-cizgisi">
      <header>
        <strong>VSM zaman çizgisi</strong>
        <span className="muted small">
          Prosesler tuvaldeki soldan sağa sırayla · boş alan "—"
        </span>
        <button type="button" className="icon" onClick={onClose} aria-label="Zaman çizgisini gizle" title="Gizle">
          ×
        </button>
      </header>
      {processes.length === 0 ? (
        <p className="muted small timeline-empty">Henüz VSM verisi girilmiş proses yok. Bir proses seçip sağ panelden veri girin.</p>
      ) : (
        <div className="timeline-scroll">
          <table>
            <thead>
              <tr>
                <th scope="row" className="row-head" />
                {processes.map((p) => (
                  <th key={p.id} scope="col">
                    <button type="button" className="link" onClick={() => onSelectNode(p.id)} title="Prosesi seç">
                      {p.title}
                    </button>
                    {p.overTakt && <span className="tl-warn" title="Takt üstü"> ⚠</span>}
                  </th>
                ))}
                <th scope="col" className="tl-total-head">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="tl-va">
                <th scope="row" className="row-head">
                  Değer katan
                </th>
                {processes.map((p) => (
                  <td key={p.id}>{dur(p.vaSec)}</td>
                ))}
                <td className="tl-total">
                  VA = <span className="calc-value" data-testid="cizgi-va">{dur(summary.totalVa.value)}</span>
                </td>
              </tr>
              <tr className="tl-nva">
                <th scope="row" className="row-head">
                  Bekleme / katmayan
                </th>
                {processes.map((p) => (
                  <td key={p.id}>{dur(p.nvaSec)}</td>
                ))}
                <td className="tl-total">
                  NVA = <span className="calc-value" data-testid="cizgi-nva">{dur(summary.totalNva.value)}</span>
                </td>
              </tr>
              <tr className="tl-lead">
                <th scope="row" className="row-head" />
                <td colSpan={processes.length} />
                <td className="tl-total">
                  Lead time = <span className="calc-value" data-testid="cizgi-lt">{dur(summary.leadTime.value)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

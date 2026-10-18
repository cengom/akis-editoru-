import type { VsmSummary } from '../model/vsmCalc';
import { formatDays, formatDuration, formatMoney, formatNumber, formatPercent } from '../model/vsm';

interface Row {
  label: string;
  current: number | null;
  future: number | null;
  format: (v: number) => string;
  /** Daha küçük değer daha mı iyi? (lead time, stok…) */
  lowerIsBetter: boolean | null;
}

/** Mevcut durum ve gelecek durum haritalarının özet karşılaştırması. */
/** Tek para birimli toplam (iki haritada aynı birim olmalı); değilse karşılaştırılmaz. */
function singleMoney(s: VsmSummary): { currency: string; amount: number } | null {
  return s.inventoryValue.totals.length === 1 ? s.inventoryValue.totals[0] : null;
}

export function StateCompare({ current, future }: { current: VsmSummary; future: VsmSummary }) {
  const cm = singleMoney(current);
  const fm = singleMoney(future);
  const sameCurrency = cm && fm && cm.currency === fm.currency;
  const money = sameCurrency ? cm.currency : (cm ?? fm)?.currency;
  const rows: Row[] = [
    { label: 'Üretim lead time', current: current.leadTimeDays, future: future.leadTimeDays, format: formatDays, lowerIsBetter: true },
    { label: 'Stokta bekleme', current: current.waitDays.value, future: future.waitDays.value, format: formatDays, lowerIsBetter: true },
    {
      label: 'Stok değeri',
      current: money && cm?.currency === money ? cm.amount : null,
      future: money && fm?.currency === money ? fm.amount : null,
      format: (v) => formatMoney(v, money ?? ''),
      lowerIsBetter: true,
    },
    { label: 'İşlem süresi (∑ C/T)', current: current.processingSec.value, future: future.processingSec.value, format: formatDuration, lowerIsBetter: true },
    { label: 'Değer katma oranı', current: current.valueAddedRatio, future: future.valueAddedRatio, format: formatPercent, lowerIsBetter: false },
    { label: 'Takt süresi', current: current.takt.seconds, future: future.takt.seconds, format: formatDuration, lowerIsBetter: null },
    {
      label: 'Darboğaz C/T',
      current: current.bottleneck?.cycleSec ?? null,
      future: future.bottleneck?.cycleSec ?? null,
      format: formatDuration,
      lowerIsBetter: true,
    },
    { label: 'Zincir verimi (RTY)', current: current.rty.value, future: future.rty.value, format: formatPercent, lowerIsBetter: false },
    { label: 'Takt üstü proses', current: current.overTakt.length, future: future.overTakt.length, format: (v) => formatNumber(v), lowerIsBetter: true },
    { label: 'Operatör (girilen)', current: current.currentOperators.value, future: future.currentOperators.value, format: (v) => `${formatNumber(v)} kişi`, lowerIsBetter: true },
    { label: 'Toplam mesafe', current: current.totalDistance.value, future: future.totalDistance.value, format: (v) => `${formatNumber(v, 1)} m`, lowerIsBetter: true },
  ];

  return (
    <section className="vsm-section" aria-label="Mevcut ve gelecek durum karşılaştırması" data-testid="durum-karsilastirma">
      <h3>Mevcut ↔ gelecek durum</h3>
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Mevcut</th>
            <th scope="col">Gelecek</th>
            <th scope="col">Fark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const both = r.current !== null && r.future !== null;
            const diff = both ? (r.future as number) - (r.current as number) : null;
            const pct = both && r.current ? (diff as number) / (r.current as number) : null;
            const tone =
              diff === null || r.lowerIsBetter === null || Math.abs(diff) < 1e-9
                ? ''
                : (diff < 0) === r.lowerIsBetter
                  ? 'better'
                  : 'worse';
            return (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{r.current === null ? '—' : r.format(r.current)}</td>
                <td>{r.future === null ? '—' : r.format(r.future)}</td>
                <td className={tone}>
                  {diff === null ? '—' : Math.abs(diff) < 1e-9 ? '=' : pct !== null ? `${pct > 0 ? '+' : '−'}%${formatNumber(Math.abs(pct) * 100, 0)}` : '≠'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Yeşil iyileşme, kırmızı kötüleşme demektir. Değerler her haritanın kendi verisinden hesaplanır.</p>
    </section>
  );
}

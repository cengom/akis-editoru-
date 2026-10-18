import { getNodesBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import type { ShapeNode } from '../model/types';
import type { VsmSummary } from '../model/vsmCalc';
import { formatDays, formatDuration, formatPercent } from '../model/vsm';

const PAD = 40;
/** Proses veri kutuları ve sembol etiketleri şekil sınırının altına taştığı için alta ek boşluk */
const BOTTOM_EXTRA = 200;
const MAX_SIDE = 5000;

/** Çıktıya girmeyecek öğeler: bağlantı noktaları, boyut tutamaçları, mini harita, paneller. */
const EXCLUDE = ['react-flow__handle', 'react-flow__resize-control', 'react-flow__minimap', 'react-flow__panel'];

/**
 * Tuvaldeki tüm çizimi (görünen alandan bağımsız) PNG olarak üretir.
 * Seçim çerçeveleri görünmesin diye çağırmadan önce seçim kaldırılmalıdır.
 */
export async function diagramToPng(nodes: ShapeNode[]): Promise<string> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) throw new Error('Tuval bulunamadı.');
  if (nodes.length === 0) throw new Error('Tuvalde şekil yok.');
  const b = getNodesBounds(nodes);
  let width = b.width + PAD * 2;
  let height = b.height + PAD + BOTTOM_EXTRA;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  return toPng(viewport, {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${(PAD - b.x) * scale}px, ${(PAD - b.y) * scale}px) scale(${scale})`,
    },
    filter: (el) => !(el instanceof Element && EXCLUDE.some((c) => el.classList?.contains(c))),
  });
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const v = (x: number | null, f: (n: number) => string) => (x === null ? '—' : f(x));

/** Yazdırma sayfasının HTML'i: başlık, görsel, VSM özeti ve zaman çizgisi. */
export function printHtml(title: string, stateLabel: string, image: string, summary: VsmSummary): string {
  const rows: [string, string][] = [
    ['Takt süresi', v(summary.takt.seconds, formatDuration)],
    ['Toplam işlem süresi (∑ C/T)', v(summary.processingSec.value, formatDuration)],
    ['Stokta bekleme', v(summary.waitDays.value, formatDays)],
    ['Üretim lead time', v(summary.leadTimeDays, formatDays)],
    ['Değer katma oranı', v(summary.valueAddedRatio, formatPercent)],
    ['Darboğaz', summary.bottleneck ? `${summary.bottleneck.title} · ${formatDuration(summary.bottleneck.cycleSec!)}` : '—'],
  ];
  const steps = summary.steps
    .map((s) =>
      s.kind === 'process'
        ? `<tr><td>${esc(s.title)}</td><td>İşlem (C/T)</td><td>${v(s.cycleSec, formatDuration)}</td></tr>`
        : `<tr><td>${esc(s.title)}</td><td>Bekleme</td><td>${v(s.days, formatDays)}</td></tr>`,
    )
    .join('');
  const hasVsm = summary.processes.length > 0 || summary.inventories.length > 0;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 8px; }
  img { max-width: 100%; max-height: 150mm; object-fit: contain; display: block; margin: 0 auto 10px; border: 1px solid #e5e7eb; }
  .cols { display: flex; gap: 24px; align-items: flex-start; page-break-inside: avoid; }
  table { border-collapse: collapse; font-size: 11px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 3px 8px; text-align: left; }
  td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 13px; margin: 0 0 4px; }
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">${esc(stateLabel)} · ${new Date().toLocaleString('tr-TR')} · Akış Editörü</div>
<img src="${image}" alt="Diyagram">
${
  hasVsm
    ? `<div class="cols"><div><h2>VSM özeti</h2><table>${rows.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table></div>
<div><h2>Zaman çizgisi</h2><table><tr><th>Adım</th><th>Tür</th><th>Süre</th></tr>${steps}</table></div></div>`
    : ''
}
</body></html>`;
}

/** Yazdırma sayfasını gizli bir çerçevede açar ve tarayıcının yazdır penceresini başlatır (PDF olarak kaydedilebilir). */
export function printDocument(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const img = doc.querySelector('img');
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  if (img && !img.complete) img.onload = go;
  else go();
}

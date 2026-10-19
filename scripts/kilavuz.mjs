#!/usr/bin/env node
/*
 * VSM rehberinin ekran görüntülerini ve PDF'ini üretir.
 *
 *   1. Geliştirme sunucusunu açın:  npm run dev
 *   2. Başka bir terminalde:        npm run kilavuz
 *
 * Bilgisayardaki Google Chrome'u başsız (headless) ve AYRI, geçici bir profille açar (kendi Chrome
 * profilinize dokunmaz). Uygulama ilk açılıştaki gibi örnek süreçle açılır; script düğmelere basıp
 * görüntüleri public/kilavuz/img/ altına, PDF'i public/kilavuz/akis-editoru-vsm-rehberi.pdf olarak yazar.
 * Ek paket gerekmez (Node'un yerleşik WebSocket ve fetch'i kullanılır).
 *
 * Seçenekler: --url http://localhost:5173  --chrome "/yol/Google Chrome"  --yalniz-pdf
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = opt('--url', 'http://localhost:5173').replace(/\/$/, '');
const CHROME = opt('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const ONLY_PDF = args.includes('--yalniz-pdf');
const IMG_DIR = join(root, 'public/kilavuz/img');
const PDF_PATH = join(root, 'public/kilavuz/akis-editoru-vsm-rehberi.pdf');
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  try {
    await fetch(BASE);
  } catch {
    throw new Error(`${BASE} açılamadı. Önce "npm run dev" ile geliştirme sunucusunu başlatın.`);
  }
  const profile = mkdtempSync(join(tmpdir(), 'akis-kilavuz-'));
  const chrome = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
    { stdio: 'ignore' },
  );
  try {
    const target = await waitForTarget();
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    if (!ONLY_PDF) await screenshots(cdp);
    await pdf(cdp);
    cdp.close();
  } finally {
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* Chrome henüz açılmadı */
    }
    await sleep(200);
  }
  throw new Error(`Chrome başlatılamadı (${CHROME}). --chrome ile yolunu verin.`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const waiters = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        for (const w of [...waiters]) if (w.method === msg.method) (waiters.splice(waiters.indexOf(w), 1), w.res(msg.params));
      }
    };
    ws.onerror = reject;
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const mid = ++id;
            pending.set(mid, { res, rej });
            ws.send(JSON.stringify({ id: mid, method, params }));
          }),
        once: (method) => new Promise((res) => waiters.push({ method, res })),
        close: () => ws.close(),
      });
  });
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  await sleep(1200);
}

/** Sayfada JavaScript çalıştırır (await destekli) ve sonucu döndürür. */
async function run(cdp, code) {
  const r = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`Sayfa betiği hata verdi: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
}

async function viewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await sleep(500);
}

/** Seçiciye uyan öğenin (ya da tüm sayfanın) görüntüsünü PNG olarak kaydeder. */
async function shot(cdp, file, selector, pad = 6) {
  let clip;
  if (selector) {
    const rect = await run(
      cdp,
      `const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
       // Kaydırılan panelin içindeyse görünür alana getir (kaydırma kutusunun dışı çizilmez).
       el.scrollIntoView({ block: 'start' }); await new Promise((r) => setTimeout(r, 300));
       const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };`,
    );
    if (!rect) throw new Error(`Öğe bulunamadı: ${selector}`);
    clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + pad * 2, height: rect.height + pad * 2, scale: 1 };
  }
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(join(IMG_DIR, file), Buffer.from(data, 'base64'));
  console.log('  ✓', file);
}

/** İki öğe arasındaki bölgenin görüntüsü: `from` öğesinin üstünden `to` öğesinin altına (aynı sütunda). */
async function shotRange(cdp, file, from, to, pad = 6) {
  const rect = await run(
    cdp,
    `const a = document.querySelector(${JSON.stringify(from)}); const b = document.querySelector(${JSON.stringify(to)});
     if (!a || !b) return null; a.scrollIntoView({ block: 'start' }); await new Promise((r) => setTimeout(r, 300)); const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
     const col = a.closest('aside') ?? a.parentElement; const rc = col.getBoundingClientRect();
     return { x: rc.x, y: ra.y, width: rc.width, height: rb.bottom - ra.y };`,
  );
  if (!rect) throw new Error(`Öğe bulunamadı: ${from} / ${to}`);
  const clip = { x: rect.x, y: Math.max(0, rect.y - pad), width: rect.width, height: rect.height + pad * 2, scale: 1 };
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  writeFileSync(join(IMG_DIR, file), Buffer.from(data, 'base64'));
  console.log('  ✓', file);
}

/** Tuvaldeki şekillerin kapladığı alanın görüntüsü (boş kenarlar ve zaman çizgisi olmadan). */
async function shotDiagram(cdp, file, pad = 16) {
  const rect = await run(
    cdp,
    `const tl = document.querySelector('[data-testid="zaman-cizgisi"]'); if (tl) tl.style.visibility = 'hidden';
     const mm = document.querySelector('.react-flow__minimap'); if (mm) mm.style.visibility = 'hidden';
     const rs = [...document.querySelectorAll('.react-flow__node')].map((n) => n.getBoundingClientRect());
     const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
     const r = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom + 60));
     return { x, y, width: r - x, height: b - y };`,
  );
  const clip = { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, scale: 1 };
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(join(IMG_DIR, file), Buffer.from(data, 'base64'));
  await run(cdp, `for (const s of ['[data-testid="zaman-cizgisi"]', '.react-flow__minimap']) { const e = document.querySelector(s); if (e) e.style.visibility = ''; }`);
  console.log('  ✓', file);
}

// Sayfa içi yardımcılar: düğmeye metinle basma, seçim kaldırma, özet panelini açma.
const H = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
  const press = async (t) => { const b = btn(t); if (!b) throw new Error('Düğme yok: ' + t); b.click(); await sleep(500); };
  const deselect = async () => { document.querySelector('.react-flow__pane')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(300); await press('VSM verileri / özet'); };
  const pick = async (t) => { const b = [...document.querySelectorAll('button.tc-row')].find((x) => x.textContent.startsWith(t)); if (!b) throw new Error('Proses yok: ' + t); b.click(); await sleep(600); };
`;

async function screenshots(cdp) {
  mkdirSync(IMG_DIR, { recursive: true });
  console.log('Ekran görüntüleri:');
  await viewport(cdp, 1440, 900);
  await navigate(cdp, `${BASE}/`);
  // Tertemiz profil: uygulama örnek süreçle açılır. Yine de örneği açıkça yükle.
  await run(cdp, `${H} await press('Örnek süreç'); const d = document.querySelector('dialog.confirm'); if (d?.open) { [...d.querySelectorAll('button')].slice(-1)[0].click(); await sleep(800); }
    // "Örnek yüklendi" bildirimini kapat
    document.querySelector('.notice button[aria-label="Kapat"]')?.click();
    await sleep(300); await press('Sığdır'); await sleep(600);`);
  await shot(cdp, 'genel.png');
  await shot(cdp, 'zaman-cizgisi.png', '[data-testid="zaman-cizgisi"]');

  // Panel görüntüleri için uzun bir pencere: panelin tamamı görünsün.
  await viewport(cdp, 1440, 2600);
  await run(cdp, `${H} await deselect();`);
  await shot(cdp, 'harita-verileri.png', 'section[aria-label="VSM genel verileri"]');
  await shot(cdp, 'ozet.png', '[data-testid="vsm-ozeti"] dl');
  await shot(cdp, 'takt-grafigi.png', '[data-testid="takt-grafigi"]');
  await shot(cdp, 'yamazumi.png', '[data-testid="yamazumi"]');
  await run(cdp, `${H} await pick('Kesim');`);
  // Hız belirleyici seçimi + OEE + temel alanlar (gelişmiş alanlar kapalı; rehberde tablo olarak var)
  await shotRange(cdp, 'proses-paneli.png', '.pacemaker-toggle', 'section[aria-label="VSM verileri"] details > summary');
  await shot(cdp, 'epei.png', '[data-testid="epei-kutusu"]');
  await run(cdp, `${H} await deselect(); await pick('Montaj');`);
  await shot(cdp, 'is-adimlari.png', '[data-testid="is-adimlari"]');

  await viewport(cdp, 1440, 900);
  await run(cdp, `${H} document.querySelector('[data-testid="sekme-gelecek"]').click(); await sleep(800); await deselect(); await press('Sığdır'); await sleep(600);`);
  await shotDiagram(cdp, 'gelecek-durum.png');
  await viewport(cdp, 1440, 2600);
  await run(cdp, `${H} await deselect();`);
  await shot(cdp, 'karsilastirma.png', '[data-testid="durum-karsilastirma"]');
}

async function pdf(cdp) {
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await navigate(cdp, `${BASE}/kilavuz/index.html`);
  // Görsellerin yüklenmesini bekle.
  await run(cdp, `await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));`);
  const { data } = await cdp.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="font-size:8px;width:100%;text-align:center;color:#6b7280;font-family:system-ui,sans-serif">Akış Editörü · VSM rehberi · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  writeFileSync(PDF_PATH, Buffer.from(data, 'base64'));
  console.log('PDF:', PDF_PATH.replace(root + '/', ''));
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});

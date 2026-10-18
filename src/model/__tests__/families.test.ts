import { describe, expect, it } from 'vitest';
import { computeSummary } from '../vsmCalc';
import { newFamily } from '../vsm';
import type { DiagramDocument } from '../types';
import { exampleCanvas } from './helpers';

const NET = 460 * 60;

/** Örneğe ikinci aile ekler: Özel ürün, 100 adet/gün, paket 10. */
function addSecondFamily(doc: DiagramDocument) {
  doc.vsmMap.families.push({ ...newFamily(1, 'ozel'), name: 'Özel ürün', demand: { value: 100, unit: 'adet/gün' }, packQuantity: { value: 10, unit: 'adet' } });
}

const proc = (s: ReturnType<typeof computeSummary>, title: string) => s.processes.find((p) => p.title === title)!;

describe('tek aile', () => {
  it('ailesiz eski hesapla aynı sonucu verir', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.mixed).toBe(false);
    expect(s.takt.seconds).toBe(60);
    // Tek ailede "Tümü" görünümü seçili olsa bile o ailenin değerleri kullanılır.
    expect(s.view?.id).toBe(doc.vsmMap.families[0].id);
    expect(s.pitchSec).toBe(1200);
  });
});

describe('karma görünüm (tüm aileler)', () => {
  it('karma takt = net süre ÷ toplam talep', () => {
    const { doc, nodes, edges } = exampleCanvas(addSecondFamily);
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.mixed).toBe(true);
    expect(s.takt.seconds).toBeCloseTo(NET / 560);
    expect(s.pitchSec).toBeNull(); // pitch aile başına
    expect(s.families.map((f) => f.taktSec)).toEqual([60, 276]);
    expect(s.families.map((f) => f.pitchSec)).toEqual([1200, 2760]);
  });

  it('proses yükü = Σ(talep × C/T) ÷ net süre, kayıplar ayrıca', () => {
    const { doc, nodes, edges } = exampleCanvas(addSecondFamily);
    const montaj = proc(computeSummary(nodes, edges, doc.vsmMap), 'Montaj');
    expect(montaj.rawLoad).toBeCloseTo((560 * 90) / NET);
    expect(montaj.load).toBeCloseTo((560 * 90) / NET / 0.98 / 0.99);
    expect(montaj.overTakt).toBe(true);
  });

  it('yalnızca seçili ailelerin talebi prosese yük olur', () => {
    const { doc, nodes, edges } = exampleCanvas(addSecondFamily);
    nodes.find((n) => n.id === 'montaj')!.data.vsm!.familyIds = ['aile-1'];
    const montaj = proc(computeSummary(nodes, edges, doc.vsmMap), 'Montaj');
    expect(montaj.rawLoad).toBeCloseTo(1.5);
  });

  it('aileye özel C/T ağırlıklı ortalamaya girer', () => {
    const { doc, nodes, edges } = exampleCanvas(addSecondFamily);
    nodes.find((n) => n.id === 'kesim')!.data.vsm!.cycleByFamily = { ozel: { value: 70, unit: 'sn' } };
    const kesim = proc(computeSummary(nodes, edges, doc.vsmMap), 'Kesim');
    expect(kesim.cycleSec).toBeCloseTo((460 * 50 + 100 * 70) / 560);
    expect(kesim.rawLoad).toBeCloseTo((460 * 50 + 100 * 70) / NET);
  });

  it('ortak stok toplam talebe göre gün hesaplar', () => {
    const { doc, nodes, edges } = exampleCanvas(addSecondFamily);
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.inventories.find((i) => i.id === 'stok-mamul')!.days).toBeCloseTo(300 / 560);
  });
});

describe('aile görünümü', () => {
  it("ailenin talebi, taktı ve C/T'si; geçmeyen proses ve başka ailenin stoğu dışarıda", () => {
    const { doc, nodes, edges } = exampleCanvas((d) => {
      addSecondFamily(d);
      d.vsmMap.familyView = 'ozel';
    });
    nodes.find((n) => n.id === 'montaj')!.data.vsm!.familyIds = ['aile-1'];
    nodes.find((n) => n.id === 'kesim')!.data.vsm!.cycleByFamily = { ozel: { value: 70, unit: 'sn' } };
    nodes.find((n) => n.id === 'stok-mamul')!.data.inventory!.familyId = 'aile-1';
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.mixed).toBe(false);
    expect(s.takt.seconds).toBe(276);
    expect(s.processes.map((p) => p.title)).toEqual(['Kesim', 'Paketleme']);
    expect(s.processingSec.value).toBe(100);
    expect(s.inventories.some((i) => i.id === 'stok-mamul')).toBe(false);
    expect(s.pitchSec).toBe(2760);
  });

  it('silinmiş aile seçiliyse karma görünüme düşer', () => {
    const { doc, nodes, edges } = exampleCanvas((d) => {
      addSecondFamily(d);
      d.vsmMap.familyView = 'artik-yok';
    });
    expect(computeSummary(nodes, edges, doc.vsmMap).mixed).toBe(true);
  });
});

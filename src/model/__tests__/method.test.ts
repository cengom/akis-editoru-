import { describe, expect, it } from 'vitest';
import { computeSummary, epeiOf } from '../vsmCalc';
import { newFamily } from '../vsm';
import { fromState, parseDocument } from '../document';
import { exampleCanvas, vsmWith } from './helpers';
import { emptyVsmMap } from '../vsm';

const NET = 460 * 60;

describe('parti beklemesi', () => {
  it('(parti − 1) × C/T; klasik yöntemde lead time değişmez', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const s = computeSummary(nodes, edges, doc.vsmMap);
    const wait = (t: string) => s.processes.find((p) => p.title === t)!.batchWaitSec;
    expect(wait('Kesim')).toBe(119 * 50);
    expect(wait('Montaj')).toBe(59 * 90);
    expect(wait('Paketleme')).toBe(19 * 30);
    expect(s.batchWaitSec.value).toBe(5950 + 5310 + 570);
    expect(s.leadTimeIncludesBatchWait).toBe(false);
    expect(s.leadTimeDays).toBeCloseTo(2 + 300 / 460 + 120 / 460 + 1.5 + 170 / NET);
  });

  it("seçilirse lead time'a eklenir, değer katma oranı düşer", () => {
    const { doc, nodes, edges } = exampleCanvas((d) => (d.vsmMap.includeBatchWait = true));
    const s = computeSummary(nodes, edges, doc.vsmMap);
    const base = 2 + 300 / 460 + 120 / 460 + 1.5 + 170 / NET;
    expect(s.leadTimeIncludesBatchWait).toBe(true);
    expect(s.leadTimeDays).toBeCloseTo(base + 11830 / NET);
    expect(s.valueAddedRatio).toBeCloseTo(170 / ((base + 11830 / NET) * NET));
  });

  it('parti 1 ise bekleme 0; parti boşsa hesaba katılmaz', () => {
    const { doc, nodes, edges } = exampleCanvas();
    nodes.find((n) => n.id === 'kesim')!.data.vsm!.fields.batchSize = { value: 1, unit: 'adet' };
    nodes.find((n) => n.id === 'montaj')!.data.vsm!.fields.batchSize = { value: null, unit: 'adet' };
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.batchWaitSec).toEqual({ value: 570, filled: 2 });
  });
});

describe('EPEI', () => {
  const map = () => {
    const m = emptyVsmMap();
    m.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
    m.families[0].demand = { value: 460, unit: 'adet/gün' };
    return m;
  };

  it('(çeşit × C/O) ÷ (kullanılabilir süre − üretim süresi)', () => {
    const v = vsmWith({ cycleTime: [50, 'sn'], changeoverTime: [30, 'dk'], scrapRate: [3, '%'], partTypes: [3, 'çeşit'], epei: [2, 'gün'] });
    const r = epeiOf(v, map(), NET);
    const spare = NET - (460 * 50) / 0.97;
    expect(r.spareSec).toBeCloseTo(spare);
    expect(r.days).toBeCloseTo((3 * 1800) / spare);
    expect(r.partTypesSource).toBe('manual');
    expect(r.enteredTooShort).toBe(false);
    expect(r.notes.length).toBe(1); // plansız duruş girilmedi notu
  });

  it('plansız duruş kullanılabilir süreden düşülür; kısa girilen EPEI uyarı alır', () => {
    const v = vsmWith({ cycleTime: [30, 'sn'], changeoverTime: [5, 'dk'], unplannedDowntime: [10, 'dk/gün'], partTypes: [2, 'çeşit'], epei: [0.25, 'saat'] });
    const r = epeiOf(v, map(), NET);
    expect(r.availableSec).toBe(NET - 600);
    expect(r.days).toBeCloseTo(600 / (NET - 600 - 460 * 30));
    expect(r.enteredDays).toBeCloseTo(900 / NET);
    expect(r.enteredTooShort).toBe(true);
  });

  it('kapasite doluysa ya da tek çeşitse hesaplamaz', () => {
    expect(epeiOf(vsmWith({ cycleTime: [60, 'sn'], changeoverTime: [5, 'dk'], partTypes: [2, 'çeşit'] }), map(), NET).reason).toMatch(/zaman kalmıyor/);
    expect(epeiOf(vsmWith({ cycleTime: [30, 'sn'], changeoverTime: [5, 'dk'], partTypes: [1, 'çeşit'] }), map(), NET).days).toBeNull();
  });

  it('çeşit sayısı girilmezse geçen aile sayısı kullanılır', () => {
    const m = map();
    m.families.push({ ...newFamily(1, 'b'), demand: { value: 100, unit: 'adet/gün' } });
    const r = epeiOf(vsmWith({ cycleTime: [30, 'sn'], changeoverTime: [5, 'dk'] }), m, NET);
    expect(r.partTypes).toBe(2);
    expect(r.partTypesSource).toBe('families');
    expect(r.days).toBeCloseTo(600 / (NET - 560 * 30));
  });
});

describe('hız belirleyici (pacemaker)', () => {
  it('seçilmediyse akıştaki son prosesi önerir', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const pm = computeSummary(nodes, edges, doc.vsmMap).pacemaker;
    expect(pm.id).toBeNull();
    expect(pm.suggestion?.title).toBe('Paketleme');
  });

  it('sonrasındaki itme stoğunu, itme okunu ve takt aşımını uyarır', () => {
    const { doc, nodes, edges } = exampleCanvas((d) => (d.vsmMap.pacemakerId = 'montaj'));
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.pacemaker.title).toBe('Montaj');
    expect(s.processes.find((p) => p.id === 'montaj')!.isPacemaker).toBe(true);
    const ids = s.pacemaker.warnings.map((w) => w.id);
    expect(ids).toContain('stok-montaj'); // Montaj sonrası WIP üçgeni
    expect(ids).toContain('montaj'); // montaj → kalite itme oku ve takt üstü
    expect(ids).not.toContain('stok-kesim'); // öncesindeki stok sorun değil
    expect(ids).not.toContain('stok-mamul'); // son prosesten sonraki mamul stoğu sayılmaz
  });

  it('son proses hız belirleyiciyse uyarı yok', () => {
    const { doc, nodes, edges } = exampleCanvas((d) => (d.vsmMap.pacemakerId = 'paket'));
    expect(computeSummary(nodes, edges, doc.vsmMap).pacemaker.warnings).toEqual([]);
  });

  it('dosyada olmayan şekli gösteren seçim okunurken kaldırılır', () => {
    const { doc } = exampleCanvas((d) => (d.vsmMap.pacemakerId = 'yok'));
    const r = parseDocument(JSON.parse(JSON.stringify(doc)));
    expect(r.ok && r.doc.vsmMap.pacemakerId).toBeNull();
  });
});

describe('örnek harita', () => {
  it("gelecek durumda hız belirleyici Paketleme ve akış uyarısı yok; Kesim'in en kısa EPEI'si girilen 2 günün altında", () => {
    const { doc } = exampleCanvas();
    const future = doc.futureState!;
    expect(future.vsmMap.pacemakerId).toBe('paket');
    const f = fromState(future);
    expect(computeSummary(f.nodes, f.edges, future.vsmMap).pacemaker.warnings).toEqual([]);
    const cur = exampleCanvas();
    const kesim = computeSummary(cur.nodes, cur.edges, cur.doc.vsmMap).processes.find((p) => p.id === 'kesim')!;
    expect(kesim.epei.days).toBeCloseTo((3 * 1800) / (NET - (460 * 50) / 0.97));
    expect(kesim.epei.enteredTooShort).toBe(false);
  });
});

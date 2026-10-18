import { describe, expect, it } from 'vitest';
import { computeSummary, computeTakt, effectiveCycleSeconds, flowOrder, inventoryDays, oeeOf, supermarketSizing } from '../vsmCalc';
import { emptyVsmMap } from '../vsm';
import { exampleCanvas, vsmWith } from './helpers';

const NET = 460 * 60; // 460 dk/gün

describe('takt', () => {
  it('net süre ÷ talep', () => {
    const map = emptyVsmMap();
    map.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
    map.families[0].demand = { value: 460, unit: 'adet/gün' };
    expect(computeTakt(map)).toEqual({ seconds: 60, reason: null });
  });

  it('eksik ya da sıfır talepte hesaplamaz ve nedenini söyler', () => {
    const map = emptyVsmMap();
    map.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
    expect(computeTakt(map).seconds).toBeNull();
    expect(computeTakt(map).reason).toBe('Müşteri talebi girilmedi.');
    map.families[0].demand = { value: 0, unit: 'adet/gün' };
    expect(computeTakt(map).seconds).toBeNull();
  });
});

describe('stok bekleme günü', () => {
  it('adet ÷ günlük talep, gün girildiyse olduğu gibi', () => {
    const d = { value: 460, unit: 'adet/gün' } as const;
    expect(inventoryDays({ value: 230, unit: 'adet' }, d)).toMatchObject({ days: 0.5, calculated: true });
    expect(inventoryDays({ value: 2, unit: 'gün' }, d)).toMatchObject({ days: 2, calculated: false });
  });

  it('boş stok hesaba katılmaz, 0 stok gerçek değerdir', () => {
    const d = { value: 460, unit: 'adet/gün' } as const;
    expect(inventoryDays({ value: null, unit: 'adet' }, d).days).toBeNull();
    expect(inventoryDays({ value: 0, unit: 'adet' }, d).days).toBe(0);
  });
});

describe('OEE', () => {
  it('A × P × Q (elle uptime)', () => {
    const r = oeeOf(vsmWith({ cycleTime: [50, 'sn'], idealCycleTime: [45, 'sn'], uptime: [85, '%'], scrapRate: [3, '%'] }), NET);
    expect(r.availability).toBeCloseTo(0.85);
    expect(r.availabilitySource).toBe('manual');
    expect(r.performance).toBeCloseTo(0.9);
    expect(r.quality).toBeCloseTo(0.97);
    expect(r.oee).toBeCloseTo(0.85 * 0.9 * 0.97);
  });

  it('uptime boşsa kullanılabilirliği duruş ve değişimlerden hesaplar', () => {
    const v = vsmWith({
      cycleTime: [30, 'sn'],
      idealCycleTime: [28, 'sn'],
      changeoverTime: [5, 'dk'],
      unplannedDowntime: [10, 'dk/gün'],
      changeoversPerDay: [2, 'kez/gün'],
      scrapRate: [0, '%'],
    });
    const r = oeeOf(v, NET);
    expect(r.availabilitySource).toBe('calculated');
    expect(r.availability).toBeCloseTo((NET - 600 - 600) / NET);
    expect(r.quality).toBe(1); // %0 hurda gerçek değerdir
    expect(r.oee).toBeCloseTo(((NET - 1200) / NET) * (28 / 30));
  });

  it('performans %100 ile sınırlanır ve uyarı verir', () => {
    const r = oeeOf(vsmWith({ cycleTime: [40, 'sn'], idealCycleTime: [50, 'sn'], uptime: [100, '%'], scrapRate: [0, '%'] }), NET);
    expect(r.performance).toBe(1);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('eksik bileşen varsa OEE boş kalır', () => {
    const r = oeeOf(vsmWith({ cycleTime: [40, 'sn'] }), NET);
    expect(r.oee).toBeNull();
    expect(r.missing).toContain('ideal C/T');
  });

  it('etkin C/T = C/T ÷ A ÷ Q; %100 hurdada hesaplanmaz', () => {
    expect(effectiveCycleSeconds(vsmWith({ cycleTime: [50, 'sn'], uptime: [80, '%'], scrapRate: [20, '%'] }))).toBeCloseTo(78.125);
    expect(effectiveCycleSeconds(vsmWith({ cycleTime: [50, 'sn'], scrapRate: [100, '%'] }))).toBeNull();
  });
});

describe('süpermarket boyutu', () => {
  it('talep × yenileme × (1 + güvenlik) ve kanban kartı', () => {
    const r = supermarketSizing(
      { value: 0.5, unit: 'gün' },
      { value: 10, unit: '%' },
      { value: 460, unit: 'adet/gün' },
      { value: 20, unit: 'adet' },
    );
    expect(r.requiredQty).toBeCloseTo(253);
    expect(r.kanbanCards).toBe(13);
  });
});

describe('örnek harita özeti', () => {
  it('bilinen sonuçları verir', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const s = computeSummary(nodes, edges, doc.vsmMap);
    expect(s.takt.seconds).toBe(60);
    expect(s.processingSec.value).toBe(50 + 90 + 30);
    expect(s.waitDays.value).toBeCloseTo(2 + 300 / 460 + 120 / 460 + 1.5);
    expect(s.leadTimeDays).toBeCloseTo(2 + 300 / 460 + 120 / 460 + 1.5 + 170 / NET);
    expect(s.bottleneck?.title).toBe('Montaj');
    expect(s.overTakt.map((p) => p.title)).toEqual(['Montaj']);
    expect(s.requiredOperators).toBe(3); // ⌈170 ÷ 60⌉
    expect(s.pitchSec).toBe(60 * 20);
    expect(s.orderedByArrows).toBe(true);
    expect(s.multiFamily).toBe(false);
  });

  it('boş C/T toplama katılmaz, 0 C/T katılır', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const paket = nodes.find((n) => n.id === 'paket')!;
    paket.data.vsm!.fields.cycleTime = { value: 0, unit: 'sn' };
    expect(computeSummary(nodes, edges, doc.vsmMap).processingSec).toEqual({ value: 140, filled: 3 });
    paket.data.vsm!.fields.cycleTime = { value: null, unit: 'sn' };
    expect(computeSummary(nodes, edges, doc.vsmMap).processingSec).toEqual({ value: 140, filled: 2 });
  });
});

describe('akış sırası', () => {
  it('oklara göre sıralar, geri dönüş oklarını (yeniden işleme) yok sayar', () => {
    const { nodes, edges } = exampleCanvas();
    const { rank, usedArrows } = flowOrder(nodes, edges);
    expect(usedArrows).toBe(true);
    const r = (id: string) => rank.get(id)!;
    expect(r('kesim')).toBeLessThan(r('montaj'));
    expect(r('montaj')).toBeLessThan(r('kalite'));
    expect(r('kalite')).toBeLessThan(r('paket'));
    expect(r('stok-kesim')).toBeGreaterThan(r('kesim'));
    expect(r('stok-kesim')).toBeLessThan(r('montaj'));
  });
});

import { describe, expect, it } from 'vitest';
import { fromDocument, parseDocument, toDocument } from '../document';
import { balanceOf, computeYamazumi, operatorLoads, requiredOperatorsOf } from '../yamazumi';
import { emptyVsmMap, newWorkStep, parseVsm } from '../vsm';
import { SCHEMA_VERSION, type ShapeNode, type VsmData, type WorkKind } from '../types';
import { exampleCanvas, vsmWith } from './helpers';

const step = (id: string, sec: number | null, kind: WorkKind, operator: number, unit: 'sn' | 'dk' = 'sn') => ({
  ...newWorkStep(id, operator),
  name: id,
  time: { value: sec, unit },
  kind,
});

function processNode(id: string, x: number, vsm: VsmData): ShapeNode {
  return { id, type: 'process', position: { x, y: 0 }, data: { title: id, description: '', color: '#fff', vsm } } as ShapeNode;
}

function map60() {
  const map = emptyVsmMap();
  map.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
  map.families[0].demand = { value: 460, unit: 'adet/gün' }; // takt 60 sn
  return map;
}

describe('operatör yükleri', () => {
  it('adımları operatöre ve türe göre toplar; dk saniyeye çevrilir', () => {
    const v = vsmWith({});
    v.workSteps = [step('a', 20, 'va', 1), step('b', 0.5, 'waste', 1, 'dk'), step('c', 10, 'nva', 2)];
    const loads = operatorLoads(v);
    expect(loads.map((l) => l.operator)).toEqual([1, 2]);
    expect(loads[0]).toMatchObject({ totalSec: 50, byKind: { va: 20, nva: 0, waste: 30, unknown: 0 } });
    expect(loads[1].totalSec).toBe(10);
  });

  it('süresi boş adım toplanmaz ama sayılır; 0 sn gerçek değerdir', () => {
    const v = vsmWith({});
    v.workSteps = [step('a', null, 'va', 1), step('b', 0, 'va', 2), step('c', null, 'va', 3)];
    const loads = operatorLoads(v);
    expect(loads[0]).toMatchObject({ totalSec: null, missingTimes: 1 });
    expect(loads[1]).toMatchObject({ totalSec: 0, missingTimes: 0 });
  });
});

describe('denge oranı ve gereken operatör', () => {
  it('Σ iş ÷ (operatör × en yüklü)', () => {
    expect(balanceOf([90, 70])).toBeCloseTo(160 / 180);
    expect(balanceOf([50, 50, 50])).toBe(1);
    expect(balanceOf([null, 40])).toBe(1); // yükü bilinmeyen operatör dışarıda
    expect(balanceOf([])).toBeNull();
    expect(balanceOf([0, 0])).toBeNull();
  });

  it('⌈Σ iş ÷ takt⌉', () => {
    expect(requiredOperatorsOf(160, 60)).toBe(3);
    expect(requiredOperatorsOf(120, 60)).toBe(2);
    expect(requiredOperatorsOf(160, null)).toBeNull();
    expect(requiredOperatorsOf(null, 60)).toBeNull();
  });
});

describe('Yamazumi hattı', () => {
  it('örnek: Montaj iki operatör, 90 + 70 sn, türlere göre kırılım', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const y = computeYamazumi(nodes, edges, doc.vsmMap);
    expect(y.taktSec).toBe(60);
    const montaj = y.processes.find((p) => p.id === 'montaj')!;
    expect(montaj.source).toBe('steps');
    expect(montaj.operators.map((o) => o.totalSec)).toEqual([90, 70]);
    expect(montaj.byKind).toEqual({ va: 93, nva: 35, waste: 32, unknown: 0 });
    expect(montaj.maxLoadSec).toBe(90);
    expect(montaj.balance).toBeCloseTo(160 / 180);
    expect(montaj.taktCapacitySec).toBe(120);
    expect(montaj.operators.every((o) => o.overTakt)).toBe(true);
  });

  it('iş adımı olmayan proses C/T ve operatör alanına geri düşer', () => {
    const map = map60();
    const a = vsmWith({ cycleTime: [40, 'sn'], operators: [2, 'kişi'] });
    const b = vsmWith({ cycleTime: [30, 'sn'] }); // operatör boş → 1 kabul
    const c = vsmWith({ cycleTime: [25, 'sn'], operators: [0, 'kişi'] }); // otomatik
    const d = vsmWith({ uptime: [90, '%'] }); // C/T yok
    const y = computeYamazumi([processNode('A', 0, a), processNode('B', 100, b), processNode('C', 200, c), processNode('D', 300, d)], [], map);
    expect(y.processes.map((p) => p.id)).toEqual(['A', 'B']);
    expect(y.processes[0].operators.map((o) => o.totalSec)).toEqual([40, 40]);
    expect(y.processes[0].byKind.unknown).toBe(80);
    expect(y.processes[1]).toMatchObject({ operatorsAssumed: true, totalSec: 30 });
    expect(y.skipped.map((s) => s.id)).toEqual(['C', 'D']);
    expect(y.totalSec).toBe(110);
    expect(y.operatorCount).toBe(3);
    expect(y.balanceRatio).toBeCloseTo(110 / 120);
    expect(y.requiredOperators).toBe(2);
    expect(y.overTakt).toHaveLength(0);
  });

  it('veri yoksa toplam boş kalır (0 değil)', () => {
    const y = computeYamazumi([processNode('A', 0, vsmWith({}))], [], map60());
    expect(y.totalSec).toBeNull();
    expect(y.balanceRatio).toBeNull();
    expect(y.requiredOperators).toBeNull();
    expect(y.skipped).toHaveLength(0);
  });

  it('karma modelde görünümdeki ailenin taktını kullanır', () => {
    const map = map60();
    map.families.push({ ...map.families[0], id: 'aile-2', name: 'B', demand: { value: 230, unit: 'adet/gün' } });
    const v = vsmWith({});
    v.workSteps = [step('a', 100, 'va', 1)];
    const nodes = [processNode('A', 0, v)];
    // Tümü: 27600 ÷ 690 = 40 sn
    expect(computeYamazumi(nodes, [], map).taktSec).toBeCloseTo(40);
    map.familyView = 'aile-2'; // 27600 ÷ 230 = 120 sn
    const y = computeYamazumi(nodes, [], map);
    expect(y.taktSec).toBe(120);
    expect(y.overTakt).toHaveLength(0);
    expect(y.requiredOperators).toBe(1);
  });

  it('aile görünümünde o aileden geçmeyen proses dışarıda kalır', () => {
    const map = map60();
    map.families.push({ ...map.families[0], id: 'aile-2', name: 'B' });
    const a = vsmWith({ cycleTime: [30, 'sn'] });
    a.familyIds = ['aile-2'];
    map.familyView = 'aile-1';
    expect(computeYamazumi([processNode('A', 0, a)], [], map).processes).toHaveLength(0);
  });
});

describe('kayıt formatı (sürüm 11)', () => {
  it('sürüm 10 dosyası açılır: iş adımları boş liste olur', () => {
    const { doc } = exampleCanvas();
    const old = JSON.parse(JSON.stringify(doc));
    old.schemaVersion = 10;
    for (const n of old.nodes) if (n.data.vsm) delete n.data.vsm.workSteps;
    old.futureState = null;
    const r = parseDocument(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.doc.nodes.find((n) => n.id === 'montaj')!.data.vsm!.workSteps).toEqual([]);
  });

  it('iş adımları kaydet → aç turunda korunur', () => {
    const { doc, nodes, edges } = exampleCanvas();
    const saved = toDocument(doc.name, nodes, edges, doc.viewport, doc.vsmMap, 'current', doc.futureState);
    const r = parseDocument(JSON.parse(JSON.stringify(saved)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const montaj = fromDocument(r.doc).nodes.find((n) => n.id === 'montaj')!;
    expect(montaj.data.vsm!.workSteps).toHaveLength(10);
    expect(montaj.data.vsm!.workSteps[3]).toMatchObject({ name: 'Eksik vidayı ara', kind: 'waste', operator: 1, time: { value: 10, unit: 'sn' } });
  });

  it('hatalı adımı reddeder, eksik ad ve türü varsayılana çevirir', () => {
    const errors: string[] = [];
    const fail = (m: string) => errors.push(m);
    expect(parseVsm({ workSteps: [{ time: { value: 5, unit: 'sn' }, operator: 0 }] }, 'P', fail)).toBeNull();
    expect(parseVsm({ workSteps: [{ time: { value: -1, unit: 'sn' } }] }, 'P', fail)).toBeNull();
    expect(parseVsm({ workSteps: [{ time: { value: 5, unit: 'saat' } }] }, 'P', fail)).toBeNull();
    expect(parseVsm({ workSteps: 'x' }, 'P', fail)).toBeNull();
    expect(errors.length).toBe(4);
    const ok = parseVsm({ workSteps: [{ time: { value: '7,5' }, kind: 'bilinmeyen' }, { id: 'x' }, { id: 'x' }] }, 'P', fail)!;
    expect(ok.workSteps[0]).toMatchObject({ name: '', kind: 'va', operator: 1, time: { value: 7.5, unit: 'sn' } });
    expect(ok.workSteps[1].time.value).toBeNull();
    expect(new Set(ok.workSteps.map((w) => w.id)).size).toBe(3);
  });
});

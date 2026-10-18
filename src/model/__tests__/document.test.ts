import { describe, expect, it } from 'vitest';
import { fromDocument, parseDocument, parseDocumentText, toDocument } from '../document';
import { createExampleDocument } from '../example';
import { SCHEMA_VERSION } from '../types';
import { parseNumberInput } from '../vsm';

const base = { app: 'akis-editoru', name: 'Test', savedAt: 'x', viewport: { x: 0, y: 0, zoom: 1 } };
const proc = (vsm?: object) => ({
  id: 'p1', kind: 'process', x: 0, y: 0, width: 180, height: 80,
  data: { title: 'Montaj', description: '', color: '#dbeafe', ...(vsm ? { vsm } : {}) },
});

describe('içe aktarma doğrulaması', () => {
  it('başka uygulamanın ya da yeni sürümün dosyasını reddeder', () => {
    expect(parseDocument({ ...base, app: 'baska', schemaVersion: 1, nodes: [], edges: [] }).ok).toBe(false);
    expect(parseDocument({ ...base, schemaVersion: SCHEMA_VERSION + 1, nodes: [], edges: [] }).ok).toBe(false);
    expect(parseDocumentText('{bozuk').ok).toBe(false);
  });

  it('olmayan şekle bağlanan oku reddeder', () => {
    const r = parseDocument({ ...base, schemaVersion: SCHEMA_VERSION, nodes: [proc()], edges: [{ id: 'e', source: 'p1', target: 'yok' }] });
    expect(r.ok).toBe(false);
  });
});

describe('eski sürümler', () => {
  it('sürüm 1 dosyası açılır (boş VSM verisiyle)', () => {
    const r = parseDocument({ ...base, schemaVersion: 1, nodes: [proc()], edges: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.doc.nodes[0].data.vsm?.fields.cycleTime.value).toBeNull();
  });

  it('sürüm 7: talep ve paket adedi varsayılan aileye taşınır', () => {
    const r = parseDocument({
      ...base,
      schemaVersion: 7,
      vsmMap: {
        fields: {
          customerDemand: { value: 460, unit: 'adet/gün' },
          netWorkingTime: { value: 460, unit: 'dk/gün' },
          packQuantity: { value: 20, unit: 'adet' },
        },
        showTimeline: true,
        colorByTakt: false,
      },
      nodes: [proc({ showDataBox: true, fields: { cycleTime: { value: 90, unit: 'sn' } }, note: '' })],
      edges: [],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.vsmMap.families).toHaveLength(1);
    expect(r.doc.vsmMap.families[0].demand.value).toBe(460);
    expect(r.doc.vsmMap.families[0].packQuantity.value).toBe(20);
    expect(r.doc.nodes[0].data.vsm?.familyIds).toEqual([]);
  });
});

describe('gidiş-dönüş', () => {
  /** Okuma, VSM verisi olmayan proseslere boş veri ekler; bu yüzden karşılaştırma bir kez okunmuş belgeyle yapılır. */
  function normalizedExample() {
    const r = parseDocumentText(JSON.stringify(createExampleDocument()));
    if (!r.ok) throw new Error(r.errors.join(' '));
    return r;
  }

  it('örnek belge uyarısız açılır ve tekrar kaydedilip açıldığında aynı kalır', () => {
    const first = normalizedExample();
    expect(first.warnings).toEqual([]);
    const again = parseDocumentText(JSON.stringify(first.doc));
    expect(again.ok && again.doc).toEqual(first.doc);
  });

  it('tuvalden yeniden belgeye dönüşüm veriyi korur', () => {
    const { doc } = normalizedExample();
    const { nodes, edges } = fromDocument(doc);
    const back = toDocument(doc.name, nodes, edges, doc.viewport, doc.vsmMap, 'current', doc.futureState);
    expect({ ...back, savedAt: doc.savedAt }).toEqual(doc);
  });
});

describe('sayı girişi', () => {
  it('virgül ve nokta kabul edilir; boş metin boş değerdir', () => {
    expect(parseNumberInput('12,5')).toEqual({ ok: true, value: 12.5 });
    expect(parseNumberInput('12.5')).toEqual({ ok: true, value: 12.5 });
    expect(parseNumberInput('  ')).toEqual({ ok: true, value: null });
    expect(parseNumberInput('0')).toEqual({ ok: true, value: 0 });
    expect(parseNumberInput('12a').ok).toBe(false);
  });
});

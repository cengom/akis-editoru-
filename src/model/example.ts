import { currentContent } from './document';
import { SHAPES } from './shapes';
import { emptyInventory, emptyVsm, emptyVsmMap } from './vsm';
import {
  APP_ID,
  SCHEMA_VERSION,
  type DiagramDocument,
  type EdgeKind,
  type HandleSide,
  type InventoryData,
  type StateContent,
  type StockKind,
  type ShapeKind,
  type StoredEdge,
  type StoredNode,
  type VsmData,
  type VsmFieldKey,
  type VsmMapData,
  type VsmQuantity,
} from './types';

/*
 * Örnek üretim süreci. Tamamen uydurmadır; gerçek bir şirkete ait veri içermez.
 */

function node(id: string, kind: ShapeKind, x: number, y: number, title: string, description = '', size?: [number, number]): StoredNode {
  const spec = SHAPES[kind];
  return {
    id,
    kind,
    x,
    y,
    width: size?.[0] ?? spec.width,
    height: size?.[1] ?? spec.height,
    data: { title, description, color: spec.color },
  };
}

/** Örnek VSM verisi: verilmeyen alanlar boş kalır. */
function vsm(fields: Partial<Record<VsmFieldKey, [number, VsmQuantity['unit']]>>, note = ''): VsmData {
  const data = emptyVsm();
  for (const [key, [value, unit]] of Object.entries(fields) as [VsmFieldKey, [number, VsmQuantity['unit']]][]) {
    data.fields[key] = { value, unit };
  }
  data.note = note;
  return data;
}

/** Stok tutan şekil (varsayılan: stok üçgeni); miktar adet ya da gün olarak. */
function inventory(
  id: string,
  x: number,
  y: number,
  title: string,
  value: number,
  unit: 'adet' | 'gün',
  size?: [number, number],
  kind: StockKind = 'inventory',
  extra: Partial<InventoryData> = {},
): StoredNode {
  const stored = node(id, kind, x, y, title, '', size);
  return { ...stored, data: { ...stored.data, inventory: { ...emptyInventory(), stock: { value, unit }, ...extra } } };
}

function withVsm(stored: StoredNode, data: VsmData): StoredNode {
  return { ...stored, data: { ...stored.data, vsm: data } };
}

function edge(
  source: string,
  sourceHandle: HandleSide,
  target: string,
  targetHandle: HandleSide,
  label = '',
  kind: EdgeKind = 'flow',
): StoredEdge {
  return { id: `e-${source}-${target}`, source, target, sourceHandle, targetHandle, label, kind };
}

/** Örnek hat verileri: 460 dk/gün ÷ 460 adet/gün = 60 sn takt. */
function exampleMap(): VsmMapData {
  const map = emptyVsmMap();
  map.families = [{ ...map.families[0], name: 'Standart ürün', demand: { value: 460, unit: 'adet/gün' }, packQuantity: { value: 20, unit: 'adet' } }];
  map.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
  map.fields.shifts = { value: 1, unit: 'vardiya' };
  map.fields.shipmentFrequency = { value: 1, unit: 'kez/gün' };
  map.showTimeline = true;
  return map;
}

export function createExampleDocument(): DiagramDocument {
  const doc: DiagramDocument = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    name: 'Örnek üretim süreci',
    savedAt: new Date().toISOString(),
    viewport: { x: 0, y: 0, zoom: 1 },
    vsmMap: exampleMap(),
    futureState: null,
    activeState: 'current',
    nodes: [
      node('dep-depo', 'department', -30, -30, 'Depo', 'Malzeme hazırlığı', [690, 380]),
      node('dep-uretim', 'department', 680, -30, 'Üretim', 'Kesim, montaj ve kontrol', [950, 380]),
      node('dep-sevk', 'department', 1650, -30, 'Sevkiyat', '', [440, 380]),
      node('basla', 'terminal', 0, 60, 'Sipariş alındı'),
      node('malzeme', 'process', 220, 50, 'Malzeme kontrolü', 'Depo, siparişe göre malzemeyi ayırır.'),
      node('stok', 'decision', 460, 35, 'Stok yeterli mi?'),
      node('satinalma', 'process', 450, 230, 'Satın alma talebi', 'Eksik malzeme için talep açılır.'),
      withVsm(
        node('kesim', 'process', 710, 50, 'Kesim'),
        vsm({
          cycleTime: [50, 'sn'],
          changeoverTime: [30, 'dk'],
          uptime: [85, '%'],
          operators: [1, 'kişi'],
          distance: [15, 'm'],
          epei: [2, 'gün'],
          scrapRate: [3, '%'],
          batchSize: [120, 'adet'],
          idealCycleTime: [45, 'sn'],
          partTypes: [3, 'çeşit'],
        }),
      ),
      withVsm(
        node('montaj', 'process', 950, 50, 'Montaj'),
        vsm({
          cycleTime: [90, 'sn'],
          changeoverTime: [10, 'dk'],
          uptime: [98, '%'],
          operators: [2, 'kişi'],
          distance: [8, 'm'],
          scrapRate: [1, '%'],
          batchSize: [60, 'adet'],
          idealCycleTime: [80, 'sn'],
        }),
      ),
      node('kalite', 'process', 1190, 50, 'Kalite kontrol', 'Örnek ölçüm yapılır.'),
      node('uygun', 'decision', 1430, 35, 'Uygun mu?'),
      node('yeniden', 'process', 1420, 230, 'Yeniden işleme'),
      withVsm(
        node('paket', 'process', 1670, 50, 'Paketleme'),
        vsm(
          {
            cycleTime: [30, 'sn'],
            changeoverTime: [5, 'dk'],
            operators: [1, 'kişi'],
            distance: [25, 'm'],
            batchSize: [20, 'adet'],
            scrapRate: [0, '%'],
            idealCycleTime: [28, 'sn'],
            // Uptime boş: kullanılabilirlik duruş ve değişimlerden hesaplanır
            unplannedDowntime: [10, 'dk/gün'],
            changeoversPerDay: [2, 'kez/gün'],
            partTypes: [2, 'çeşit'],
          },
          'Değerler örnektir.',
        ),
      ),
      node('bitis', 'terminal', 1900, 60, 'Sevkiyat yapıldı'),
      node(
        'not-1',
        'note',
        0,
        390,
        'Bu bir örnektir',
        'Gerçek veri içermez. Kutuları sürükleyin; kenarlardaki noktalardan yeni ok çekin.',
        [320, 110],
      ),
      // VSM üst bölümü: dış taraflar, planlama, stoklar ve iyileştirme
      node('tedarikci', 'supplier', -30, -360, 'Örnek Tedarikçi', 'Hammadde'),
      node('musteri', 'customer', 1940, -360, 'Örnek Müşteri'),
      node('planlama', 'process', 820, -280, 'Üretim planlama', 'MRP'),
      inventory('stok-hammadde', 10, -150, 'Hammadde', 2, 'gün'),
      inventory('stok-mamul', 1980, -150, 'Mamul', 300, 'adet'),
      // Prosesler arası stoklar (WIP): zaman çizgisinde bekleme olarak görünür
      inventory('stok-kesim', 895, 150, 'WIP', 120, 'adet', [50, 45]),
      inventory('stok-montaj', 1135, 150, 'WIP', 1.5, 'gün', [50, 45]),
      {
        ...node('kaizen-1', 'kaizen', 990, -175, 'Montaj çevrimini düşür'),
        data: {
          ...node('kaizen-1', 'kaizen', 990, -175, 'Montaj çevrimini düşür').data,
          kaizen: { owner: 'Üretim mühendisliği', dueDate: '2026-12-15', status: 'doing' },
        },
      },
    ],
    edges: [
      edge('basla', 'right', 'malzeme', 'left'),
      edge('malzeme', 'right', 'stok', 'left'),
      edge('stok', 'right', 'kesim', 'left', 'Evet'),
      edge('stok', 'bottom', 'satinalma', 'top', 'Hayır'),
      edge('satinalma', 'left', 'malzeme', 'bottom'),
      edge('kesim', 'right', 'montaj', 'left', '', 'material'),
      edge('montaj', 'right', 'kalite', 'left', '', 'material'),
      edge('kalite', 'right', 'uygun', 'left'),
      edge('uygun', 'right', 'paket', 'left', 'Evet'),
      edge('uygun', 'bottom', 'yeniden', 'top', 'Hayır'),
      edge('yeniden', 'left', 'kalite', 'bottom'),
      edge('paket', 'right', 'bitis', 'left'),
      edge('musteri', 'left', 'planlama', 'right', 'Günlük sipariş', 'info'),
      edge('planlama', 'left', 'tedarikci', 'right', 'Haftalık sipariş', 'info'),
      edge('planlama', 'bottom', 'kesim', 'top', 'Üretim çizelgesi', 'info'),
      edge('tedarikci', 'bottom', 'stok-hammadde', 'top', 'Haftalık', 'shipment'),
      edge('stok-hammadde', 'right', 'malzeme', 'top', '', 'material'),
      edge('bitis', 'top', 'stok-mamul', 'left', '', 'material'),
      edge('stok-mamul', 'top', 'musteri', 'bottom', 'Günlük', 'shipment'),
    ],
  };
  doc.futureState = exampleFuture(currentContent(doc));
  return doc;
}

/**
 * Örnek gelecek durum (hedef) haritası: mevcut haritanın kopyası üzerinde iyileştirmeler.
 * Paketleme hız belirleyicidir. Montaj kaizen ile 55 sn'ye iner; Kesim sonrası stok süpermarket, Montaj sonrası stok FIFO olur;
 * stoklar azalır. Uydurma değerlerdir.
 */
function exampleFuture(current: StateContent): StateContent {
  const c = JSON.parse(JSON.stringify(current)) as StateContent;
  const byId = (id: string) => c.nodes.find((n) => n.id === id)!;
  byId('montaj').data.vsm!.fields.cycleTime = { value: 55, unit: 'sn' };
  byId('kesim').data.vsm!.fields.uptime = { value: 95, unit: '%' };
  byId('kesim').data.vsm!.fields.scrapRate = { value: 1, unit: '%' };
  const sm = byId('stok-kesim');
  Object.assign(sm, { kind: 'supermarket', width: 56, height: 45 });
  sm.data = {
    ...sm.data,
    title: 'Süpermarket',
    color: '#ffffff',
    inventory: { stock: { value: 60, unit: 'adet' }, replenishTime: { value: 0.5, unit: 'gün' }, safetyRate: { value: 10, unit: '%' }, familyId: null },
  };
  const fifo = byId('stok-montaj');
  Object.assign(fifo, { kind: 'fifo', width: 54, height: 30 });
  fifo.data = { ...fifo.data, title: 'FIFO', color: '#ffffff', inventory: { ...emptyInventory(), stock: { value: 0.25, unit: 'gün' } } };
  byId('stok-hammadde').data.inventory!.stock = { value: 1, unit: 'gün' };
  byId('stok-mamul').data.inventory!.stock = { value: 150, unit: 'adet' };
  // Hız belirleyici: Paketleme (müşteriye en yakın proses; sonrası yalnızca sevkiyat)
  c.vsmMap.pacemakerId = 'paket';
  byId('kaizen-1').data.kaizen = { owner: 'Üretim mühendisliği', dueDate: '2026-12-15', status: 'done' };
  const pull = c.edges.find((e) => e.id === 'e-kesim-montaj');
  if (pull) Object.assign(pull, { kind: 'pull', label: 'Çekme' });
  return c;
}

/** Boş bir çizim (Temizle ve "Boş tuval" ile yeni proje için). */
export function createBlankDocument(name: string): DiagramDocument {
  return { ...createExampleDocument(), name, vsmMap: emptyVsmMap(), nodes: [], edges: [], futureState: null, activeState: 'current' };
}

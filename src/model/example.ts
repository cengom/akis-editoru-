import { SHAPES } from './shapes';
import { emptyVsm, emptyVsmMap } from './vsm';
import {
  APP_ID,
  SCHEMA_VERSION,
  type DiagramDocument,
  type EdgeKind,
  type HandleSide,
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
  map.fields.customerDemand = { value: 460, unit: 'adet/gün' };
  map.fields.netWorkingTime = { value: 460, unit: 'dk/gün' };
  map.fields.shifts = { value: 1, unit: 'vardiya' };
  map.fields.shipmentFrequency = { value: 1, unit: 'kez/gün' };
  map.fields.pitch = { value: 20, unit: 'dk' };
  map.showTimeline = true;
  return map;
}

export function createExampleDocument(): DiagramDocument {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    name: 'Örnek üretim süreci',
    savedAt: new Date().toISOString(),
    viewport: { x: 0, y: 0, zoom: 1 },
    vsmMap: exampleMap(),
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
          cycleTime: [45, 'sn'],
          changeoverTime: [30, 'dk'],
          uptime: [92, '%'],
          operators: [1, 'kişi'],
          wip: [120, 'adet'],
          valueAddedTime: [40, 'sn'],
          distance: [15, 'm'],
        }),
      ),
      withVsm(
        node('montaj', 'process', 950, 50, 'Montaj'),
        vsm({
          cycleTime: [90, 'sn'],
          changeoverTime: [10, 'dk'],
          uptime: [98, '%'],
          operators: [2, 'kişi'],
          wip: [1.5, 'gün'],
          valueAddedTime: [75, 'sn'],
          nonValueAddedTime: [4, 'saat'],
          distance: [8, 'm'],
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
            uptime: [99, '%'],
            operators: [1, 'kişi'],
            wip: [300, 'adet'],
            valueAddedTime: [25, 'sn'],
            nonValueAddedTime: [0, 'sn'],
            distance: [25, 'm'],
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
      node('stok-hammadde', 'inventory', 10, -150, 'Hammadde', '2 gün'),
      node('stok-mamul', 'inventory', 1980, -150, 'Mamul', '300 adet'),
      node('kaizen-1', 'kaizen', 990, -175, 'Montaj çevrimini düşür'),
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
}

/** Boş bir çizim (Temizle ve "Boş tuval" ile yeni proje için). */
export function createBlankDocument(name: string): DiagramDocument {
  return { ...createExampleDocument(), name, vsmMap: emptyVsmMap(), nodes: [], edges: [] };
}

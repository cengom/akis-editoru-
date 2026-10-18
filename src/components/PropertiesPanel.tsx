import { COLOR_PRESETS, SHAPES } from '../model/shapes';
import { LIMITS } from '../model/document';
import { EDGE_KIND_SPECS } from '../model/edges';
import { EDGE_KINDS, KAIZEN_STATUSES, isStockKind, type KaizenData, type KaizenStatus, type ProductFamily, type EdgeKind, type FlowEdge, type ShapeData, type ShapeKind, type InventoryData, type ShapeNode, type VsmData, type VsmMapData, type VsmQuantity } from '../model/types';
import { INVENTORY_FIELDS, VSM_FIELDS, VSM_LIMITS, KAIZEN_STATUS_LABELS, emptyInventory, emptyKaizen, emptyVsm, formatDays, formatDuration, formatMoney, formatNumber, toSeconds , VSM_FIELD_SPECS, type QuantitySpec} from '../model/vsm';
import { effectiveCycleSeconds, inventoryDays, isOverTakt, stockValue, supermarketSizing, type VsmSummary } from '../model/vsmCalc';
import { MapPanel } from './MapPanel';
import { stockDemand } from '../model/families';
import { OeeBreakdown } from './OeeBreakdown';
import { QuantityTable } from './QuantityFields';
import { BatchWaitNote, EpeiBox, PacemakerToggle } from './MethodBoxes';

interface Props {
  nodes: ShapeNode[];
  edges: FlowEdge[];
  selectedNodes: ShapeNode[];
  selectedEdges: FlowEdge[];
  vsmMap: VsmMapData;
  summary: VsmSummary;
  /** Gelecek durum varsa iki haritanın özeti */
  compare: { current: VsmSummary; future: VsmSummary } | null;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  onUpdateNode: (id: string, patch: Partial<ShapeData>) => void;
  onUpdateEdgeLabel: (id: string, label: string) => void;
  onUpdateEdgeKind: (id: string, kind: EdgeKind) => void;
  onUpdateMap: (map: VsmMapData) => void;
  onSelectNode: (id: string) => void;
  onDelete: () => void;
  storage: StorageInfo;
}

/** Sağ paneldeki kayıt notunun içeriğini belirler. */
export interface StorageInfo {
  mode: 'local' | 'cloud';
  cloudAvailable: boolean;
  signedIn: boolean;
  isGuest: boolean;
}

export function PropertiesPanel(props: Props) {
  const { selectedNodes, selectedEdges } = props;
  const total = selectedNodes.length + selectedEdges.length;

  return (
    <aside className="panel properties" aria-label="Özellikler">
      <h2>{total === 0 ? 'Harita' : 'Özellikler'}</h2>
      {total === 0 && (
        <>
          <MapPanel
            vsmMap={props.vsmMap}
            summary={props.summary}
            kaizens={props.nodes.filter((n) => n.type === 'kaizen')}
            compare={props.compare}
            onExportCsv={props.onExportCsv}
            onImportCsv={props.onImportCsv}
            onChange={props.onUpdateMap}
            onSelectNode={props.onSelectNode}
          />
          <EmptyState nodeCount={props.nodes.length} edgeCount={props.edges.length} />
        </>
      )}
      {total === 1 && selectedNodes[0] && (
        <NodeEditor
          node={selectedNodes[0]}
          taktSec={props.summary.takt.seconds}
          netSec={toSeconds(props.vsmMap.fields.netWorkingTime)}
          vsmMap={props.vsmMap}
          processLoad={props.summary.processes.find((p) => p.id === selectedNodes[0].id)?.load ?? null}
          onUpdate={props.onUpdateNode}
          onUpdateMap={props.onUpdateMap}
        />
      )}
      {total === 1 && selectedEdges[0] && (
        <EdgeEditor
          edge={selectedEdges[0]}
          nodes={props.nodes}
          onUpdateLabel={props.onUpdateEdgeLabel}
          onUpdateKind={props.onUpdateEdgeKind}
        />
      )}
      {total > 1 && (
        <p>
          {selectedNodes.length} şekil ve {selectedEdges.length} bağlantı seçili. Düzenlemek için tek bir öğe seçin.
        </p>
      )}
      {total > 0 && (
        <button type="button" className="danger" onClick={props.onDelete}>
          Seçileni sil
        </button>
      )}
      <StorageNote info={props.storage} />
    </aside>
  );
}

function EmptyState({ nodeCount, edgeCount }: { nodeCount: number; edgeCount: number }) {
  return (
    <details className="help">
      <summary>Nasıl kullanılır?</summary>
      <p className="muted">
        Tuvalde {nodeCount} şekil ve {edgeCount} bağlantı var. Düzenlemek için bir şekle ya da oka tıklayın.
      </p>
      <ul>
        <li>Şekli taşımak için sürükleyin.</li>
        <li>Ok çekmek için şeklin kenarındaki noktadan başka bir şeklin noktasına sürükleyin.</li>
        <li>Yeni okun türünü (genel, bilgi, malzeme, sevkiyat) soldaki paletten seçin.</li>
        <li>Boş alanı sürükleyerek tuvali kaydırın; fare tekerleğiyle yakınlaştırın.</li>
        <li>Birden çok öğe seçmek için Shift'e basılı tutup alan seçin.</li>
        <li>Seçili öğeyi Delete veya Backspace ile silin.</li>
      </ul>
    </details>
  );
}

function NodeEditor({
  node,
  taktSec,
  netSec,
  vsmMap,
  processLoad,
  onUpdate,
  onUpdateMap,
}: {
  node: ShapeNode;
  taktSec: number | null;
  netSec: number | null;
  vsmMap: VsmMapData;
  processLoad: number | null;
  onUpdate: Props['onUpdateNode'];
  onUpdateMap: Props['onUpdateMap'];
}) {
  const kind = node.type as ShapeKind;
  const isPreset = COLOR_PRESETS.includes(node.data.color);
  return (
    <div className="editor">
      <p className="kind-badge">{SHAPES[kind].label}</p>
      <label>
        Başlık
        <input
          value={node.data.title}
          maxLength={LIMITS.title}
          onChange={(e) => onUpdate(node.id, { title: e.target.value })}
          data-testid="ozellik-baslik"
        />
      </label>
      <label>
        Açıklama
        <textarea
          value={node.data.description}
          maxLength={LIMITS.description}
          rows={kind === 'process' ? 3 : 5}
          onChange={(e) => onUpdate(node.id, { description: e.target.value })}
          data-testid="ozellik-aciklama"
        />
      </label>
      {kind === 'customer' && (
        <p className="muted small">
          Müşteri talebi ve takt süresi harita düzeyinde girilir: boş alana tıklayıp sağdaki "VSM genel verileri"ni
          doldurun. Değerler bu simgenin içinde görünür.
        </p>
      )}
      <fieldset>
        <legend>Renk</legend>
        <div className="swatches">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${c === node.data.color ? ' is-active' : ''}`}
              style={{ background: c }}
              onClick={() => onUpdate(node.id, { color: c })}
              aria-label={`Renk ${c}`}
              title={c}
            />
          ))}
        </div>
        <label className="inline">
          Özel renk
          <input type="color" value={node.data.color} onChange={(e) => onUpdate(node.id, { color: e.target.value })} />
          <code>{node.data.color}</code>
          {!isPreset && <span className="muted">(özel)</span>}
        </label>
      </fieldset>
      <p className="muted small">
        Konum: x {Math.round(node.position.x)}, y {Math.round(node.position.y)}
      </p>
      {kind === 'kaizen' && (
        <KaizenEditor kaizen={node.data.kaizen ?? emptyKaizen()} onChange={(kaizen) => onUpdate(node.id, { kaizen })} />
      )}
      {isStockKind(kind) && (
        <InventoryEditor
          key={node.id}
          inventory={node.data.inventory ?? emptyInventory()}
          vsmMap={vsmMap}
          isSupermarket={kind === 'supermarket'}
          onChange={(inventory) => onUpdate(node.id, { inventory })}
        />
      )}
      {kind === 'process' && <PacemakerToggle nodeId={node.id} vsmMap={vsmMap} onUpdateMap={onUpdateMap} />}
      {kind === 'process' && (
        <VsmEditor
          key={node.id}
          vsm={node.data.vsm ?? emptyVsm()}
          taktSec={taktSec}
          netSec={netSec}
          load={processLoad}
          vsmMap={vsmMap}
          onChange={(vsm) => onUpdate(node.id, { vsm })}
        />
      )}
    </div>
  );
}

/* ---------- Ürün–proses matrisi ---------- */

function FamilyMatrix({ vsm, families, onChange }: { vsm: VsmData; families: ProductFamily[]; onChange: (v: VsmData) => void }) {
  const all = vsm.familyIds.length === 0;
  const passes = (id: string) => all || vsm.familyIds.includes(id);
  const toggle = (id: string, on: boolean) => {
    const current = all ? families.map((f) => f.id) : vsm.familyIds;
    const next = on ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    if (next.length === 0) return; // en az bir aile geçmeli
    onChange({ ...vsm, familyIds: next.length === families.length ? [] : next });
  };
  const specs: QuantitySpec<string>[] = families
    .filter((f) => passes(f.id))
    .map((f) => ({ ...VSM_FIELD_SPECS.cycleTime, key: f.id, label: `${f.name} C/T`, hint: undefined, advanced: false }));
  const values = Object.fromEntries(
    specs.map((sp) => [sp.key, vsm.cycleByFamily[sp.key] ?? { value: null, unit: vsm.fields.cycleTime.unit }]),
  );
  return (
    <div className="family-matrix" data-testid="aile-matrisi">
      <h4>Ürün aileleri</h4>
      <p className="muted small">Bu prosesten geçen aileler. Aileye özel C/T boşsa ortak C/T kullanılır.</p>
      <div className="family-checks">
        {families.map((f) => (
          <label key={f.id} className="check">
            <input type="checkbox" checked={passes(f.id)} onChange={(e) => toggle(f.id, e.target.checked)} data-testid={`aile-gecer-${f.id}`} />
            <span className="family-dot" style={{ background: f.color }} />
            {f.name}
          </label>
        ))}
      </div>
      <QuantityTable
        specs={specs}
        values={values}
        onChange={(key, q) => {
          const next = { ...vsm.cycleByFamily };
          if (q.value === null) delete next[key];
          else next[key] = q;
          onChange({ ...vsm, cycleByFamily: next });
        }}
        idPrefix="aile-ct"
      />
    </div>
  );
}

/* ---------- Kaizen eylemi ---------- */

function KaizenEditor({ kaizen, onChange }: { kaizen: KaizenData; onChange: (k: KaizenData) => void }) {
  return (
    <section className="vsm-section" aria-label="Kaizen eylemi">
      <h3>Kaizen eylemi</h3>
      <label>
        Sorumlu
        <input
          value={kaizen.owner}
          maxLength={200}
          placeholder="Ad ya da ekip"
          onChange={(e) => onChange({ ...kaizen, owner: e.target.value })}
          data-testid="kaizen-sorumlu"
        />
      </label>
      <label>
        Hedef tarih
        <input type="date" value={kaizen.dueDate} onChange={(e) => onChange({ ...kaizen, dueDate: e.target.value })} data-testid="kaizen-tarih" />
      </label>
      <label>
        Durum
        <select
          className="select"
          value={kaizen.status}
          onChange={(e) => onChange({ ...kaizen, status: e.target.value as KaizenStatus })}
          data-testid="kaizen-durum"
        >
          {KAIZEN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {KAIZEN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">Tüm kaizenler, boş alana tıklayınca sağ paneldeki "Kaizen eylemleri" listesinde görünür.</p>
    </section>
  );
}

/* ---------- Stok üçgeni ---------- */

function InventoryEditor({
  inventory,
  vsmMap,
  isSupermarket,
  onChange,
}: {
  inventory: InventoryData;
  vsmMap: VsmMapData;
  isSupermarket: boolean;
  onChange: (inv: InventoryData) => void;
}) {
  const multi = vsmMap.families.length > 1;
  const fam = vsmMap.families.find((f) => f.id === inventory.familyId) ?? null;
  const demand = stockDemand(inventory, vsmMap);
  // Kanban kartı paket adedine bağlı: stok bir aileye aitse o ailenin, tek aileli haritada o ailenin paket adedi.
  const packQuantity: VsmQuantity = fam ? fam.packQuantity : multi ? { value: null, unit: 'adet' } : vsmMap.families[0].packQuantity;
  const wait = inventoryDays(inventory.stock, demand);
  const sizing = supermarketSizing(inventory.replenishTime, inventory.safetyRate, demand, packQuantity);
  const value = stockValue(inventory, vsmMap);
  const COST_SOURCE = { stock: 'stoğa girilen birim değer', family: 'ailenin birim maliyeti', weighted: 'ailelerin talebe göre ağırlıklı maliyeti' } as const;
  return (
    <section className="vsm-section" aria-label="Stok verisi">
      <h3>Stok verisi</h3>
      <QuantityTable
        specs={INVENTORY_FIELDS.filter((f) => !f.advanced)}
        values={inventory}
        onChange={(key, q) => onChange({ ...inventory, [key]: q })}
        idPrefix="stok"
      />
      {multi && (
        <label>
          Ürün ailesi
          <select
            className="select"
            value={inventory.familyId ?? ''}
            onChange={(e) => onChange({ ...inventory, familyId: e.target.value || null })}
            data-testid="stok-aile"
          >
            <option value="">Tüm aileler (ortak stok)</option>
            {vsmMap.families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="small" data-testid="stok-bekleme">
        Bekleme:{' '}
        {wait.days === null ? (
          <span className="muted">{wait.reason}</span>
        ) : wait.calculated ? (
          <span className="calc-value">{formatDays(wait.days)}</span>
        ) : (
          <strong>{formatDays(wait.days)}</strong>
        )}
      </p>
      <p className="small" data-testid="stok-deger">
        Stok değeri:{' '}
        {value.amount === null ? (
          <span className="muted">{value.reason}</span>
        ) : (
          <>
            <span className="calc-value">{formatMoney(value.amount, value.currency!)}</span>{' '}
            <span className="muted">
              ({formatNumber(value.quantity!, 1)} adet × {formatMoney(value.unitCost!, value.currency!)}; {COST_SOURCE[value.costSource!]})
            </span>
          </>
        )}
      </p>
      <p className="muted small">
        Zaman çizgisinde üst basamak olarak gösterilir. Adet girilirse gün = adet ÷ günlük müşteri talebi.
      </p>
      {isSupermarket && (
        <>
          <h3>Süpermarket boyutu</h3>
          <QuantityTable
            specs={INVENTORY_FIELDS.filter((f) => f.advanced)}
            values={inventory}
            onChange={(key, q) => onChange({ ...inventory, [key]: q })}
            idPrefix="stok"
          />
          <dl className="mini-dl" data-testid="supermarket-boyut">
            <dt>Gereken stok</dt>
            <dd>
              {sizing.requiredQty === null ? (
                <span className="muted small">{sizing.reason}</span>
              ) : (
                <span className="calc-value">{formatNumber(sizing.requiredQty, 1)} adet</span>
              )}
            </dd>
            <dt>Kanban kartı</dt>
            <dd>
              {sizing.kanbanCards === null ? (
                <span className="muted small">{sizing.requiredQty === null ? '—' : sizing.reason}</span>
              ) : (
                <span className="calc-value">{sizing.kanbanCards} kart</span>
              )}
            </dd>
          </dl>
          <p className="muted small">
            Gereken stok = günlük talep × yenileme süresi × (1 + güvenlik payı). Kanban kartı = ⌈gereken stok ÷ paket
            adedi⌉.
          </p>
        </>
      )}
    </section>
  );
}

/* ---------- VSM alanları (yalnızca proses) ---------- */

function VsmEditor({
  vsm,
  taktSec,
  netSec,
  load,
  vsmMap,
  onChange,
}: {
  vsm: VsmData;
  taktSec: number | null;
  netSec: number | null;
  load: number | null;
  vsmMap: VsmMapData;
  onChange: (vsm: VsmData) => void;
}) {
  const families = vsmMap.families;
  const basic = VSM_FIELDS.filter((f) => !f.advanced);
  const advanced = VSM_FIELDS.filter((f) => f.advanced);
  const advancedFilled = advanced.some((f) => vsm.fields[f.key].value !== null);
  const setField = (key: keyof VsmData['fields'], q: VsmData['fields'][typeof key]) =>
    onChange({ ...vsm, fields: { ...vsm.fields, [key]: q } });
  const cycleSec = toSeconds(vsm.fields.cycleTime);
  const over = isOverTakt(cycleSec, taktSec);
  const effective = effectiveCycleSeconds(vsm, netSec);
  const showEffective = effective !== null && cycleSec !== null && effective > cycleSec + 1e-9;
  const overEffective = !over && isOverTakt(effective, taktSec);

  return (
    <section className="vsm-section" aria-label="VSM verileri">
      <h3>VSM verileri</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={vsm.showDataBox}
          onChange={(e) => onChange({ ...vsm, showDataBox: e.target.checked })}
          data-testid="vsm-kutu-goster"
        />
        Veri kutusunu tuvalde göster
      </label>
      <p className="muted small">Boş bırakılan alan "veri yok" demektir; 0 ise gerçek bir değerdir.</p>
      {over && (
        <p className="warning-box" role="alert" data-testid="proses-takt-uyari">
          ⚠ Çevrim süresi ({formatDuration(cycleSec!)}) takt süresinden (
          <span className="calc-value">{formatDuration(taktSec!)}</span>) büyük. Bu proses talebi karşılayamayabilir.
        </p>
      )}
      <OeeBreakdown vsm={vsm} netSec={netSec} load={load} />
      {families.length > 1 && <FamilyMatrix vsm={vsm} families={families} onChange={onChange} />}
      {showEffective && (
        <p className="small" data-testid="etkin-ct">
          Etkin C/T (uptime ve hurda dahil): <span className="calc-value">{formatDuration(effective!)}</span>
        </p>
      )}
      {overEffective && (
        <p className="caution-box small" data-testid="proses-etkin-uyari">
          ⚠ C/T takt altında ama duruş ve hurda hesaba katılınca etkin C/T (
          <span className="calc-value">{formatDuration(effective!)}</span>) takt süresini aşıyor.
        </p>
      )}
      {!over && !overEffective && taktSec !== null && cycleSec !== null && (
        <p className="ok-box small">
          Çevrim süresi takt süresinin (<span className="calc-value">{formatDuration(taktSec)}</span>) altında.
        </p>
      )}
      <QuantityTable specs={basic} values={vsm.fields} onChange={setField} idPrefix="vsm" />
      <details open={advancedFilled || undefined}>
        <summary>Gelişmiş alanlar</summary>
        <QuantityTable specs={advanced} values={vsm.fields} onChange={setField} idPrefix="vsm" />
      </details>
      <BatchWaitNote vsm={vsm} vsmMap={vsmMap} />
      <EpeiBox vsm={vsm} vsmMap={vsmMap} netSec={netSec} />
      <label>
        VSM notu
        <textarea
          rows={2}
          value={vsm.note}
          maxLength={VSM_LIMITS.note}
          onChange={(e) => onChange({ ...vsm, note: e.target.value })}
          data-testid="vsm-not"
        />
      </label>
    </section>
  );
}

function EdgeEditor({
  edge,
  nodes,
  onUpdateLabel,
  onUpdateKind,
}: {
  edge: FlowEdge;
  nodes: ShapeNode[];
  onUpdateLabel: Props['onUpdateEdgeLabel'];
  onUpdateKind: Props['onUpdateEdgeKind'];
}) {
  const title = (id: string) => nodes.find((n) => n.id === id)?.data.title || 'Başlıksız';
  const kind = (edge.type ?? 'flow') as EdgeKind;
  return (
    <div className="editor">
      <p className="kind-badge">Bağlantı</p>
      <p className="small">
        <strong>{title(edge.source)}</strong> → <strong>{title(edge.target)}</strong>
      </p>
      <label>
        Etiket
        <input
          value={typeof edge.label === 'string' ? edge.label : ''}
          maxLength={LIMITS.label}
          placeholder="Örn. Evet, Hayır, Haftalık sipariş"
          onChange={(e) => onUpdateLabel(edge.id, e.target.value)}
          data-testid="ozellik-etiket"
        />
      </label>
      <label>
        Bağlantı türü
        <select
          className="select"
          value={kind}
          onChange={(e) => onUpdateKind(edge.id, e.target.value as EdgeKind)}
          data-testid="ozellik-baglanti-turu"
        >
          {EDGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {EDGE_KIND_SPECS[k].label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">{EDGE_KIND_SPECS[kind].hint}</p>
    </div>
  );
}

function StorageNote({ info }: { info: StorageInfo }) {
  if (info.mode === 'local') {
    return (
      <div className="storage-note" data-testid="kayit-notu">
        <strong>Yerel taslak:</strong> Çiziminiz otomatik olarak yalnızca <em>bu tarayıcıya</em> kaydedilir. Bu bir
        bulut kaydı değildir; başka bir cihazdan görülemez ve tarayıcı verileri silinirse kaybolur.{' '}
        {info.cloudAvailable
          ? info.signedIn
            ? 'Buluta almak için üstteki "Buluta kaydet" düğmesini kullanın.'
            : 'Buluta kaydetmek için üstten "Giriş yap"a basın.'
          : 'Yedek almak için "JSON dışa aktar" düğmesini kullanın.'}
      </div>
    );
  }
  return (
    <div className="storage-note storage-note-cloud" data-testid="kayit-notu">
      <strong>Bulut projesi:</strong> Değişiklikler <em>Kaydet</em> düğmesiyle (ya da Ctrl/⌘+S) buluta yazılır;
      otomatik değildir. Kaydetmeden önceki değişiklikler bu tarayıcıda geçici olarak yedeklenir.
      {info.isGuest && (
        <>
          {' '}
          <strong>Misafir hesabı:</strong> yalnızca bu tarayıcıya bağlıdır. Başka cihazdan açılamaz; tarayıcı verileri
          silinirse ya da çıkış yaparsanız projelerinize bir daha ulaşamazsınız. Önemli çizimler için JSON yedeği alın.
        </>
      )}
    </div>
  );
}

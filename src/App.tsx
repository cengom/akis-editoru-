import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type IsValidConnection,
} from '@xyflow/react';
import { useCloudProject, type CloudNotice } from './cloud/useCloudProject';
import { useCloudSession } from './cloud/useCloudSession';
import { cloud } from './cloud';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ProjectsDialog } from './components/ProjectsDialog';
import { DRAG_MIME, Palette } from './components/Palette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Timeline } from './components/Timeline';
import { VsmCanvasContext, type VsmCanvasInfo } from './components/VsmCanvasContext';
import { Toolbar, type SaveState } from './components/Toolbar';
import {
  LIMITS,
  asHandle,
  edgeKindProps,
  fromState,
  makeEdge,
  makeNode,
  newId,
  parseDocumentText,
  splitStates,
  toDocument,
  toStateContent,
} from './model/document';
import { createBlankDocument, createExampleDocument } from './model/example';
import { SHAPES } from './model/shapes';
import { CLOUD_BACKUP_KEY, STORAGE_KEY, loadCloudBackup, loadFromStorage, saveToStorage, type CloudBackup } from './model/storage';
import {
  SHAPE_KINDS,
  type DiagramDocument,
  type MapState,
  type StateContent,
  type EdgeKind,
  type FlowEdge,
  type ShapeData,
  type ShapeKind,
  type ShapeNode,
  type VsmMapData,
} from './model/types';
import { computeSummary } from './model/vsmCalc';
import { edgeTypes } from './edges/FlowEdgeView';
import { nodeTypes } from './nodes/ShapeNodeView';

type Notice = CloudNotice;

interface Initial {
  doc: DiagramDocument;
  fit: boolean;
  notice: Notice | null;
  /** Bulut projesi açıkken sayfa yenilendiyse: o projenin yedeği */
  cloudBackup: CloudBackup | null;
}

function loadInitial(): Initial {
  // Son açık olan bir bulut projesiyse onunla (kaydedilmemiş değişiklikleriyle) devam et.
  const cloudBackup = cloud ? loadCloudBackup() : null;
  if (cloudBackup) return { doc: cloudBackup.doc, fit: false, notice: null, cloudBackup };
  return { ...loadLocalDraft(), cloudBackup: null };
}

/** Yerel taslağı okur; yoksa örnek süreç, okunamazsa uyarıyla örnek süreç. */
function loadLocalDraft(): Omit<Initial, 'cloudBackup'> {
  const result = loadFromStorage();
  if (result.status === 'ok') {
    return {
      doc: result.doc,
      fit: false,
      notice: result.warnings.length
        ? { type: 'info', title: 'Taslak yeni VSM yöntemine göre açıldı.', details: result.warnings }
        : null,
    };
  }
  if (result.status === 'invalid') {
    return {
      doc: createExampleDocument(),
      fit: true,
      notice: {
        type: 'error',
        title: 'Tarayıcıdaki kayıt okunamadı. Eski kayıt silinmedi, ayrı bir yedeğe taşındı; örnek süreç açıldı.',
        details: result.errors,
      },
    };
  }
  return { doc: createExampleDocument(), fit: true, notice: null };
}

const SAVE_DELAY_MS = 400;

/** Departman dışındaki şekillerle çakışmayan ilk konumu bulur (çapraz adımlarla). */
function findFreeSpot(start: { x: number; y: number }, width: number, height: number, nodes: ShapeNode[]) {
  const others = nodes.filter((n) => n.type !== 'department');
  const overlaps = (x: number, y: number) =>
    others.some((n) => {
      const w = n.width ?? n.measured?.width ?? 0;
      const h = n.height ?? n.measured?.height ?? 0;
      return x < n.position.x + w && x + width > n.position.x && y < n.position.y + h && y + height > n.position.y;
    });
  let { x, y } = start;
  for (let i = 0; i < 30 && overlaps(x, y); i++) {
    x += 40;
    y += 40;
  }
  return { x, y };
}

function Editor() {
  const [initial] = useState(loadInitial);
  const initialSplit = useMemo(() => splitStates(initial.doc), [initial]);
  const initialFlow = useMemo(() => fromState(initialSplit.activeContent), [initialSplit]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ShapeNode>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialFlow.edges);
  const [name, setName] = useState(initial.doc.name);
  const [notice, setNotice] = useState<Notice | null>(initial.notice);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'saved', at: new Date() });
  const [viewTick, setViewTick] = useState(0);
  const [vsmMap, setVsmMap] = useState<VsmMapData>(initialSplit.activeContent.vsmMap);
  /** Editörde açık olan harita (mevcut / gelecek durum) ve diğer haritanın içeriği */
  const [activeState, setActiveState] = useState<MapState>(initialSplit.active);
  const [otherState, setOtherState] = useState<StateContent | null>(initialSplit.otherContent);
  /** Paletten seçilen, yeni çekilecek okların türü */
  const [connectKind, setConnectKind] = useState<EdgeKind>('flow');
  const rf = useReactFlow<ShapeNode, FlowEdge>();
  const wrapper = useRef<HTMLDivElement>(null);

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);

  /* ---------- VSM hesapları ---------- */
  const summary = useMemo(() => computeSummary(nodes, edges, vsmMap), [nodes, edges, vsmMap]);
  const otherSummary = useMemo(() => {
    if (!otherState) return null;
    const flow = fromState(otherState);
    return computeSummary(flow.nodes, flow.edges, otherState.vsmMap);
  }, [otherState]);
  const compare = otherSummary
    ? activeState === 'current'
      ? { current: summary, future: otherSummary }
      : { current: otherSummary, future: summary }
    : null;
  const taktSec = summary.takt.seconds;
  const demand = vsmMap.fields.customerDemand;
  // Sürükleme sırasında değişmez; şekiller gereksiz yere yeniden çizilmez.
  const canvasInfo = useMemo<VsmCanvasInfo>(() => ({ taktSec, demand }), [taktSec, demand]);

  /* ---------- Başka sekmede yapılan değişiklik uyarısı ---------- */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== CLOUD_BACKUP_KEY) return;
      setNotice({
        type: 'info',
        title:
          'Bu çizim başka bir sekmede de açık ve orada değiştirildi. İki sekme birbirinin kaydının üzerine yazar; yalnızca bir sekmede çalışın.',
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ---------- Bildirimler ---------- */
  useEffect(() => {
    if (notice?.type !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---------- Şekil ekleme ---------- */
  const addShape = useCallback(
    (kind: ShapeKind, center: { x: number; y: number }, avoidOverlap: boolean) => {
      const spec = SHAPES[kind];
      const node = makeNode({
        id: newId('n'),
        kind,
        x: Math.round(center.x - spec.width / 2),
        y: Math.round(center.y - spec.height / 2),
        width: spec.width,
        height: spec.height,
        data: { title: spec.defaultTitle, description: '', color: spec.color },
      });
      node.selected = true;
      setNodes((ns) => {
        if (avoidOverlap) node.position = findFreeSpot(node.position, spec.width, spec.height, ns);
        return [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), node];
      });
      setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
    },
    [setNodes, setEdges],
  );

  /** Palette tıklanınca şekli görünen alanın ortasına (boş bir yere) ekler. */
  const addAtCenter = useCallback(
    (kind: ShapeKind) => {
      const rect = wrapper.current?.getBoundingClientRect();
      if (!rect) return;
      const center = rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      addShape(kind, center, true);
    },
    [addShape, rf],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const kind = event.dataTransfer.getData(DRAG_MIME) as ShapeKind;
      if (!SHAPE_KINDS.includes(kind)) return;
      event.preventDefault();
      addShape(kind, rf.screenToFlowPosition({ x: event.clientX, y: event.clientY }), false);
    },
    [addShape, rf],
  );

  /* ---------- Bağlantılar ---------- */
  const isValidConnection: IsValidConnection<FlowEdge> = useCallback((c) => c.source !== c.target, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((es) =>
        addEdge(
          makeEdge({
            id: newId('e'),
            source: connection.source,
            target: connection.target,
            sourceHandle: asHandle(connection.sourceHandle),
            targetHandle: asHandle(connection.targetHandle),
            label: '',
            kind: connectKind,
          }),
          es,
        ),
      );
    },
    [setEdges, connectKind],
  );

  /* ---------- Düzenleme ---------- */
  const updateNode = useCallback(
    (id: string, patch: Partial<ShapeData>) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes],
  );

  const updateEdgeLabel = useCallback(
    (id: string, label: string) => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, label } : e)));
    },
    [setEdges],
  );

  const updateEdgeKind = useCallback(
    (id: string, kind: EdgeKind) => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, ...edgeKindProps(kind) } : e)));
    },
    [setEdges],
  );

  /** Tek bir şekli seçer (özet ve zaman çizgisindeki bağlantılardan). */
  const selectNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.map((n) => (n.selected !== (n.id === id) ? { ...n, selected: n.id === id } : n)));
      setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
    },
    [setNodes, setEdges],
  );

  /** Seçimi kaldırır; sağ panelde harita verileri ve VSM özeti görünür. */
  const clearSelection = useCallback(() => {
    setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
    setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, [setNodes, setEdges]);

  const deleteSelected = useCallback(() => {
    void rf.deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [rf, selectedNodes, selectedEdges]);

  /* ---------- Belge değiştirme (yeni / örnek / içe aktarma) ---------- */
  /** Açık haritanın içeriğini değiştirir (diğer haritaya dokunmaz). */
  const loadActiveContent = useCallback(
    (content: StateContent, fit: boolean) => {
      const flow = fromState(content);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setVsmMap(content.vsmMap);
      if (fit && flow.nodes.length) {
        // fitView, yeni şekiller ölçüldükten sonra doğru çalışır.
        window.setTimeout(() => void rf.fitView({ padding: 0.15 }), 30);
      } else {
        void rf.setViewport(content.viewport);
      }
      setViewTick((t) => t + 1);
    },
    [rf, setNodes, setEdges],
  );

  /** Bütün projeyi değiştirir: ad, iki harita ve hangisinin açık olduğu. */
  const replaceDocument = useCallback(
    (doc: DiagramDocument, fit: boolean) => {
      const split = splitStates(doc);
      setName(doc.name);
      setActiveState(split.active);
      setOtherState(split.otherContent);
      loadActiveContent(split.activeContent, fit);
    },
    [loadActiveContent],
  );

  /** Mevcut durum ↔ gelecek durum arasında geçiş. */
  const switchState = (target: MapState, startFrom?: 'copy' | 'blank') => {
    if (target === activeState) return;
    const snapshot = toStateContent(nodes, edges, rf.getViewport(), vsmMap);
    let next = otherState;
    if (!next) {
      // Gelecek durum henüz yok: mevcut haritanın kopyasından ya da boş başla.
      next = startFrom === 'blank' ? { ...snapshot, nodes: [], edges: [] } : (JSON.parse(JSON.stringify(snapshot)) as StateContent);
    }
    setOtherState(snapshot);
    setActiveState(target);
    loadActiveContent(next, false);
  };

  const askSwitchState = (target: MapState) => {
    if (target === 'future' && !otherState) {
      setConfirm({
        title: 'Gelecek durum haritası oluştur',
        message:
          'Gelecek durum (hedef) haritası mevcut haritanın bir kopyasıyla başlar; üzerinde değişiklik yapıp iki haritayı karşılaştırabilirsiniz. Mevcut harita değişmez.',
        confirmLabel: 'Mevcut haritadan kopyala',
        secondary: { label: 'Boş başla', onClick: () => switchState('future', 'blank') },
        onConfirm: () => switchState('future', 'copy'),
      });
    } else switchState(target);
  };

  const askRemoveFuture = () =>
    setConfirm({
      title: 'Gelecek durumu kaldır',
      message: 'Gelecek durum haritası silinecek ve mevcut durum haritası açılacak. Mevcut durum haritası değişmez.',
      confirmLabel: 'Gelecek durumu kaldır',
      danger: true,
      onConfirm: () => {
        if (activeState === 'future' && otherState) {
          setActiveState('current');
          const current = otherState;
          setOtherState(null);
          loadActiveContent(current, false);
        } else setOtherState(null);
      },
    });

  /* ---------- Kayıt modları: yerel taslak / bulut proje ---------- */
  const session = useCloudSession();
  const getDocument = () => toDocument(name, nodes, edges, rf.getViewport(), vsmMap, activeState, otherState);
  const cp = useCloudProject({
    session,
    initialBackup: initial.cloudBackup,
    getDocument,
    loadDocument: replaceDocument,
    loadLocalDraft: () => {
      const local = loadLocalDraft();
      replaceDocument(local.doc, local.fit);
      if (local.notice) setNotice(local.notice);
    },
    flushLocalDraft: () => saveToStorage(getDocument()),
    setName,
    notify: setNotice,
    confirm: setConfirm,
  });
  const inCloud = cp.project !== null;
  const onCloudChange = cp.onDocumentChanged;

  /*
   * Otomatik yerel kayıt. Yerel taslakta çizim bu tarayıcıya yazılır.
   * Bulut projesi açıkken yerel taslağa dokunulmaz; kaydedilmemiş değişiklikler ayrı bir yedeğe yazılır.
   */
  useEffect(() => {
    if (!inCloud) setSaveState({ kind: 'pending' });
    const timer = window.setTimeout(() => {
      const doc = toDocument(name, nodes, edges, rf.getViewport(), vsmMap, activeState, otherState);
      if (inCloud) onCloudChange(doc);
      else setSaveState(saveToStorage(doc) ? { kind: 'saved', at: new Date() } : { kind: 'error' });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [name, nodes, edges, vsmMap, activeState, otherState, viewTick, rf, inCloud, cp.project?.id, onCloudChange]);

  const whereText = inCloud ? 'Açık bulut projesinin içeriği değişecek (Kaydet ile buluta yazılır).' : '';

  const askNew = () =>
    setConfirm({
      title: 'Tuvali temizle',
      message: `Açık harita (${activeState === 'future' ? 'gelecek durum' : 'mevcut durum'}) silinip boş bir tuval açılacak; diğer harita değişmez. ${whereText} Gerekirse önce JSON olarak dışa aktarın.`,
      confirmLabel: 'Temizle',
      onConfirm: () => {
        const blank = createBlankDocument('');
        loadActiveContent({ viewport: blank.viewport, vsmMap: blank.vsmMap, nodes: [], edges: [] }, false);
        setNotice({ type: 'success', title: 'Boş bir tuval açıldı.' });
      },
    });

  const askExample = () =>
    setConfirm({
      title: 'Örnek süreci yükle',
      message: `Projenin yerine (her iki harita) örnek üretim süreci açılacak: mevcut durum ve gelecek durum haritası. ${whereText} Gerekirse önce JSON olarak dışa aktarın.`,
      confirmLabel: 'Örneği yükle',
      onConfirm: () => {
        const example = createExampleDocument();
        // Bulut projesinde proje adı korunur.
        replaceDocument(inCloud ? { ...example, name } : example, true);
        setNotice({ type: 'success', title: 'Örnek üretim süreci yüklendi.' });
      },
    });

  const exportJson = () => {
    const doc = getDocument();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = (name.trim() || 'diyagram').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ type: 'success', title: `"${a.download}" dosyası indirildi.` });
  };

  const importFile = async (file: File) => {
    if (file.size > LIMITS.fileBytes) {
      setNotice({ type: 'error', title: 'Dosya çok büyük (en fazla 5 MB). Mevcut çiziminiz değişmedi.' });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ type: 'error', title: 'Dosya okunamadı. Mevcut çiziminiz değişmedi.' });
      return;
    }
    const result = parseDocumentText(text);
    if (!result.ok) {
      setNotice({
        type: 'error',
        title: `"${file.name}" içe aktarılamadı. Mevcut çiziminiz değişmedi.`,
        details: result.errors,
      });
      return;
    }
    setConfirm({
      title: 'JSON içe aktar',
      message: `"${file.name}" dosyası geçerli (${result.doc.nodes.length} şekil, ${result.doc.edges.length} bağlantı). Mevcut çizimin yerine açılsın mı? ${whereText}${
        result.warnings.length ? `\n\nNot: ${result.warnings.join(' ')}` : ''
      }`,
      confirmLabel: 'İçe aktar',
      onConfirm: () => {
        replaceDocument(inCloud ? { ...result.doc, name } : result.doc, false);
        setNotice({ type: 'success', title: `"${file.name}" içe aktarıldı.` });
      },
    });
  };

  return (
    <div className="app">
      <Toolbar
        name={name}
        onNameChange={setName}
        onNew={askNew}
        onExample={askExample}
        onExport={exportJson}
        onImportFile={(f) => void importFile(f)}
        onDelete={deleteSelected}
        canDelete={selectedNodes.length + selectedEdges.length > 0}
        onZoomIn={() => void rf.zoomIn({ duration: 200 })}
        onZoomOut={() => void rf.zoomOut({ duration: 200 })}
        onFit={() => void rf.fitView({ padding: 0.15, duration: 300 })}
        onShowMap={clearSelection}
        activeState={activeState}
        hasFuture={activeState === 'future' || otherState !== null}
        onSwitchState={askSwitchState}
        onRemoveFuture={askRemoveFuture}
        mode={
          cp.project
            ? { kind: 'cloud', dirty: cp.project.dirty, status: cp.status }
            : { kind: 'local', localSave: saveState }
        }
        session={session}
        authBusy={cp.authBusy}
        onSave={cp.save}
        onSaveCopy={cp.saveCopy}
        onOpenProjects={cp.openProjectsDialog}
        onNewCloudProject={cp.openNewProjectDialog}
        onCloseProject={cp.closeProject}
        onSignIn={cp.signIn}
        onSignOut={cp.signOut}
      />
      {notice && (
        <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <div>
            <strong>{notice.title}</strong>
            {notice.details && (
              <ul>
                {notice.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {notice.action && (
              <button
                type="button"
                className="notice-action"
                onClick={() => {
                  const run = notice.action!.run;
                  setNotice(null);
                  run();
                }}
              >
                {notice.action.label}
              </button>
            )}
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Kapat">
            ×
          </button>
        </div>
      )}
      <div className="workspace">
        <Palette onAdd={addAtCenter} connectKind={connectKind} onConnectKindChange={setConnectKind} />
        <div className={`canvas${activeState === 'future' ? ' is-future' : ''}`} ref={wrapper} onDragOver={onDragOver} onDrop={onDrop}>
          {activeState === 'future' && <div className="state-ribbon">Gelecek durum haritası</div>}
          <VsmCanvasContext.Provider value={canvasInfo}>
            <ReactFlow<ShapeNode, FlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              connectionMode={ConnectionMode.Loose}
              defaultViewport={initialSplit.activeContent.viewport}
              fitView={initial.fit}
              fitViewOptions={{ padding: 0.15 }}
              onMoveEnd={() => setViewTick((t) => t + 1)}
              deleteKeyCode={['Backspace', 'Delete']}
              elevateNodesOnSelect={false}
              elevateEdgesOnSelect
              minZoom={0.1}
              maxZoom={3}
              snapToGrid
              snapGrid={[10, 10]}
              proOptions={{ hideAttribution: false }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <MiniMap position="top-right" pannable zoomable style={{ width: 160, height: 110 }} nodeStrokeWidth={2} nodeColor={(n) => (n.data as ShapeData).color} />
            </ReactFlow>
          </VsmCanvasContext.Provider>
          {vsmMap.showTimeline && (
            <Timeline
              summary={summary}
              onSelectNode={selectNode}
              onClose={() => setVsmMap((m) => ({ ...m, showTimeline: false }))}
            />
          )}
        </div>
        <PropertiesPanel
          nodes={nodes}
          edges={edges}
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          onUpdateNode={updateNode}
          vsmMap={vsmMap}
          summary={summary}
          compare={compare}
          onUpdateEdgeLabel={updateEdgeLabel}
          onUpdateEdgeKind={updateEdgeKind}
          onUpdateMap={setVsmMap}
          onSelectNode={selectNode}
          onDelete={deleteSelected}
          storage={{
            mode: inCloud ? 'cloud' : 'local',
            cloudAvailable: session.available,
            signedIn: !!session.user,
            isGuest: session.user?.isAnonymous ?? false,
          }}
        />
      </div>
      {session.available && (
        <>
          <ProjectsDialog
            open={cp.projectsOpen}
            projects={cp.projects}
            loading={cp.listLoading}
            error={cp.listError}
            currentId={cp.project?.id ?? null}
            onClose={cp.closeProjectsDialog}
            onRefresh={cp.refreshProjects}
            onOpen={cp.openProject}
            onRename={cp.renameProject}
            onDelete={cp.deleteProject}
            onNew={cp.openNewProjectDialog}
          />
          <NewProjectDialog
            key={cp.newDialogKey}
            open={cp.newOpen}
            busy={cp.createBusy}
            onClose={cp.closeNewProjectDialog}
            onCreate={cp.createFromDialog}
          />
        </>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

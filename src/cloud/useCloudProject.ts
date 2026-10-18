import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmRequest } from '../components/ConfirmDialog';
import type { NewProjectSource } from '../components/NewProjectDialog';
import type { CloudStatus } from '../components/Toolbar';
import { LIMITS, parseDocument } from '../model/document';
import { createBlankDocument, createExampleDocument } from '../model/example';
import { clearCloudBackup, saveCloudBackup, type CloudBackup } from '../model/storage';
import type { DiagramDocument } from '../model/types';
import { CloudError, cloud, type CloudProjectSummary, type CloudUser } from './index';
import type { CloudSession } from './useCloudSession';

/** Editörde açık olan bulut projesi. `null` ise yerel taslak modundayız. */
export interface OpenProject {
  id: string;
  userId: string;
  /** Sunucudaki son bilinen güncelleme zamanı (çakışma kontrolü için) */
  updatedAt: string;
  /** Bulutta olmayan değişiklik var mı? */
  dirty: boolean;
}

export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface CloudNotice {
  type: 'error' | 'info' | 'success';
  title: string;
  details?: string[];
  action?: NoticeAction;
}

interface Params {
  session: CloudSession;
  /** Sayfa açılırken bulunan bulut yedeği (kaydedilmemiş değişikliklerle birlikte açılır) */
  initialBackup: CloudBackup | null;
  /** Editördeki güncel belge */
  getDocument: () => DiagramDocument;
  /** Belgeyi editöre yükler */
  loadDocument: (doc: DiagramDocument, fit: boolean) => void;
  /** Editöre yerel taslağı yükler */
  loadLocalDraft: () => void;
  /** Yerel moddayken ekrandaki çizimi hemen yerel taslağa yazar (moddan çıkmadan önce) */
  flushLocalDraft: () => void;
  setName: (name: string) => void;
  notify: (n: CloudNotice) => void;
  confirm: (r: ConfirmRequest) => void;
}

const ORPHAN_KEY = 'akis-editoru.bulut-yedek.sahipsiz';

/** Değişiklik karşılaştırması: görünüm (viewport) ve kayıt zamanı hariç içerik. */
function contentSignature(doc: DiagramDocument): string {
  // Üst düzey alanlar her zaman mevcut durumdur; hangi sekmenin açık olduğu değişiklik sayılmaz.
  const f = doc.futureState;
  // Yalnızca görünüm tercihleri (aile görünümü, renklendirme) değişiklik sayılmaz.
  const m = (v: DiagramDocument['vsmMap']) => ({ ...v, familyView: undefined, colorByTakt: undefined });
  return JSON.stringify({ n: doc.nodes, e: doc.edges, m: m(doc.vsmMap), f: f && { n: f.nodes, e: f.edges, m: m(f.vsmMap) } });
}

interface Baseline {
  name: string;
  sig: string;
}

const errorText = (e: unknown) => (e instanceof CloudError ? e.message : 'Beklenmeyen bir hata oluştu.');

export function useCloudProject(p: Params) {
  const { session } = p;
  const [project, setProject] = useState<OpenProject | null>(() =>
    p.initialBackup && cloud
      ? {
          id: p.initialBackup.projectId,
          userId: p.initialBackup.userId,
          updatedAt: p.initialBackup.baseUpdatedAt,
          dirty: p.initialBackup.dirty,
        }
      : null,
  );
  const [status, setStatus] = useState<CloudStatus>({ kind: 'idle' });
  const [authBusy, setAuthBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newDialogKey, setNewDialogKey] = useState(0);
  const [projects, setProjects] = useState<CloudProjectSummary[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Yedekten açıldıysa ve kaydedilmemiş değişiklik yoksa, başlangıç noktası o belgedir.
  const baseline = useRef<Baseline | null>(
    p.initialBackup && !p.initialBackup.dirty
      ? { name: p.initialBackup.doc.name, sig: contentSignature(p.initialBackup.doc) }
      : null,
  );
  // Geri çağrılarda her zaman güncel değerleri okumak için
  const projectRef = useRef(project);
  projectRef.current = project;
  const paramsRef = useRef(p);
  paramsRef.current = p;
  const userRef = useRef<CloudUser | null>(session.user);
  userRef.current = session.user;

  const isDirty = (doc: DiagramDocument) =>
    !baseline.current || doc.name !== baseline.current.name || contentSignature(doc) !== baseline.current.sig;

  const backup = (proj: OpenProject, doc: DiagramDocument, dirty: boolean) =>
    saveCloudBackup({ projectId: proj.id, userId: proj.userId, baseUpdatedAt: proj.updatedAt, dirty, doc });

  /** Editörde değişiklik olduğunda (gecikmeli) çağrılır: kirli bayrağını ve yerel yedeği günceller. */
  const onDocumentChanged = useCallback((doc: DiagramDocument) => {
    const proj = projectRef.current;
    if (!proj) return;
    const dirty = isDirty(doc);
    if (dirty !== proj.dirty) setProject({ ...proj, dirty });
    backup({ ...proj, dirty }, doc, dirty);
  }, []);

  /** Belgeyi bulut projesi olarak editöre yerleştirir. */
  const enterProject = (summary: CloudProjectSummary, userId: string, doc: DiagramDocument, fit: boolean) => {
    const { flushLocalDraft, loadDocument } = paramsRef.current;
    if (!projectRef.current) flushLocalDraft();
    const named = { ...doc, name: summary.name };
    loadDocument(named, fit);
    const proj: OpenProject = { id: summary.id, userId, updatedAt: summary.updatedAt, dirty: false };
    baseline.current = { name: named.name, sig: contentSignature(named) };
    projectRef.current = proj;
    setProject(proj);
    setStatus({ kind: 'idle' });
    backup(proj, named, false);
  };

  const closeProjectNow = () => {
    baseline.current = null;
    projectRef.current = null;
    setProject(null);
    setStatus({ kind: 'idle' });
    clearCloudBackup();
    paramsRef.current.loadLocalDraft();
  };

  /** Kaydedilmemiş değişiklik varsa önce sorar. */
  const guardDirty = (action: () => void, message: string) => {
    if (projectRef.current?.dirty) {
      paramsRef.current.confirm({
        title: 'Kaydedilmemiş değişiklikler',
        message: `${message} Açık projedeki kaydedilmemiş değişiklikler kaybolacak.`,
        confirmLabel: 'Kaydetmeden devam et',
        danger: true,
        onConfirm: action,
      });
    } else action();
  };

  /* ---------- Oturum ---------- */

  const signIn = useCallback(async (): Promise<CloudUser | null> => {
    if (!cloud) return null;
    setAuthBusy(true);
    try {
      const user = await cloud.signInAsGuest();
      paramsRef.current.notify({
        type: 'success',
        title: 'Misafir hesabıyla giriş yapıldı. Bu hesap yalnızca bu tarayıcıya bağlıdır.',
      });
      return user;
    } catch (e) {
      paramsRef.current.notify({ type: 'error', title: errorText(e) });
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const ensureUser = async () => userRef.current ?? (await signIn());

  const signOut = () => {
    if (!cloud) return;
    const user = userRef.current;
    const proj = projectRef.current;
    const parts = [
      user?.isAnonymous
        ? 'Misafir hesabından çıkarsanız bu hesaptaki bulut projelerine bir daha ulaşamazsınız (hesaba e-posta bağlı değil). Önemli projeleri önce JSON olarak dışa aktarın.'
        : 'Oturumunuz kapatılacak.',
      proj ? 'Açık bulut projesi kapanıp yerel taslağa dönülecek.' : '',
      proj?.dirty ? 'Kaydedilmemiş değişiklikler kaybolacak.' : '',
    ];
    paramsRef.current.confirm({
      title: 'Çıkış yap',
      message: parts.filter(Boolean).join(' '),
      confirmLabel: 'Çıkış yap',
      danger: true,
      onConfirm: async () => {
        setAuthBusy(true);
        try {
          await cloud!.signOut();
          if (projectRef.current) closeProjectNow();
          clearCloudBackup();
          setProjects(null);
          setProjectsOpen(false);
          setNewOpen(false);
          paramsRef.current.notify({ type: 'info', title: 'Çıkış yapıldı. Yerel taslakla çalışıyorsunuz.' });
        } catch (e) {
          paramsRef.current.notify({ type: 'error', title: errorText(e) });
        } finally {
          setAuthBusy(false);
        }
      },
    });
  };

  /*
   * Oturum ile açık proje uyuşmuyorsa (başka sekmede çıkış yapıldı, oturumun süresi doldu ya da
   * yedek başka bir kullanıcıya ait): proje kapanır, kaydedilmemiş değişiklikler kaybolmasın diye ayrı tutulur.
   */
  useEffect(() => {
    if (!session.ready) return;
    const userId = session.user?.id ?? null;
    if (!userId) {
      setProjects(null);
      setProjectsOpen(false);
    }
    const proj = projectRef.current;
    if (!proj || proj.userId === userId) return;
    const doc = paramsRef.current.getDocument();
    const hadChanges = proj.dirty;
    if (hadChanges) {
      try {
        localStorage.setItem(ORPHAN_KEY, JSON.stringify(doc));
      } catch {
        /* yer yoksa yapılacak bir şey yok */
      }
    }
    closeProjectNow();
    paramsRef.current.notify({
      type: 'error',
      title: hadChanges
        ? 'Bulut oturumu bulunamadı; proje kapatıldı. Kaydedilmemiş değişiklikleriniz kaybolmasın diye ayrıca saklandı.'
        : 'Bulut oturumu bulunamadı; proje kapatıldı ve yerel taslağa dönüldü.',
      action: hadChanges
        ? {
            label: 'Bu değişiklikleri yerel taslak olarak aç',
            run: () =>
              paramsRef.current.confirm({
                title: 'Kurtarılan değişiklikleri aç',
                message: 'Kurtarılan çizim yerel taslağın yerine açılacak. Gerekirse önce mevcut taslağı JSON olarak dışa aktarın.',
                confirmLabel: 'Aç',
                onConfirm: () => {
                  const parsed = parseDocument(JSON.parse(localStorage.getItem(ORPHAN_KEY) ?? 'null'));
                  if (parsed.ok) paramsRef.current.loadDocument(parsed.doc, false);
                  localStorage.removeItem(ORPHAN_KEY);
                },
              }),
          }
        : undefined,
    });
  }, [session.ready, session.user?.id]);

  /* ---------- Proje listesi ---------- */

  const refreshProjects = useCallback(async () => {
    if (!cloud || !userRef.current) return;
    setListLoading(true);
    setListError(null);
    try {
      setProjects(await cloud.listProjects());
    } catch (e) {
      setListError(errorText(e));
    } finally {
      setListLoading(false);
    }
  }, []);

  const openProjectsDialog = () => {
    setProjectsOpen(true);
    void refreshProjects();
  };

  const openProject = (summary: CloudProjectSummary) => {
    const proj = projectRef.current;
    if (proj?.id === summary.id && !proj.dirty) return setProjectsOpen(false);
    guardDirty(async () => {
      if (!cloud || !userRef.current) return;
      try {
        const row = await cloud.getProject(summary.id);
        if (!row) {
          paramsRef.current.notify({ type: 'error', title: `"${summary.name}" bulunamadı; silinmiş olabilir.` });
          void refreshProjects();
          return;
        }
        // Buluttan gelen belgeye de güvenme: doğrula (eski sürümler burada yükseltilir).
        const parsed = parseDocument(row.rawDocument);
        if (!parsed.ok) {
          paramsRef.current.notify({
            type: 'error',
            title: `"${row.name}" açılamadı: kayıtlı belge geçersiz. Mevcut çiziminiz değişmedi.`,
            details: parsed.errors,
          });
          return;
        }
        enterProject(row, userRef.current.id, parsed.doc, false);
        setProjectsOpen(false);
        paramsRef.current.notify(
          parsed.warnings.length
            ? { type: 'info', title: `"${row.name}" açıldı (yeni VSM yöntemine göre).`, details: parsed.warnings }
            : { type: 'success', title: `"${row.name}" açıldı.` },
        );
      } catch (e) {
        paramsRef.current.notify({ type: 'error', title: errorText(e) });
      }
    }, `"${summary.name}" açılacak.`);
  };

  const renameProject = async (summary: CloudProjectSummary, name: string): Promise<boolean> => {
    if (!cloud) return false;
    try {
      const updated = await cloud.renameProject(summary.id, name);
      setProjects((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      const proj = projectRef.current;
      if (proj?.id === updated.id) {
        // Açık projenin adı: editördeki ad ve karşılaştırma noktası da güncellenir.
        if (baseline.current) baseline.current = { ...baseline.current, name: updated.name };
        const next = { ...proj, updatedAt: updated.updatedAt };
        projectRef.current = next;
        setProject(next);
        paramsRef.current.setName(updated.name);
      }
      return true;
    } catch (e) {
      setListError(errorText(e));
      return false;
    }
  };

  const deleteProject = (summary: CloudProjectSummary) => {
    const isOpen = projectRef.current?.id === summary.id;
    paramsRef.current.confirm({
      title: 'Projeyi sil',
      message: `"${summary.name}" buluttan kalıcı olarak silinecek. Bu işlem geri alınamaz.${
        isOpen ? ' Bu proje şu an açık; silinince yerel taslağa dönülecek.' : ''
      }`,
      confirmLabel: 'Kalıcı olarak sil',
      danger: true,
      onConfirm: async () => {
        if (!cloud) return;
        try {
          await cloud.deleteProject(summary.id);
          setProjects((list) => list?.filter((x) => x.id !== summary.id) ?? null);
          if (projectRef.current?.id === summary.id) closeProjectNow();
          paramsRef.current.notify({ type: 'success', title: `"${summary.name}" silindi.` });
        } catch (e) {
          setListError(errorText(e));
        }
      },
    });
  };

  /* ---------- Oluşturma ve kaydetme ---------- */

  const tooLarge = (doc: DiagramDocument) => JSON.stringify(doc).length > LIMITS.fileBytes;

  const createProject = async (rawName: string, source: NewProjectSource) => {
    if (!cloud) return;
    const user = await ensureUser();
    if (!user) return;
    const name = rawName.trim() || 'Adsız proje';
    const doc =
      source === 'current'
        ? paramsRef.current.getDocument()
        : source === 'blank'
          ? createBlankDocument(name)
          : createExampleDocument();
    const named = { ...doc, name };
    if (tooLarge(named)) {
      paramsRef.current.notify({ type: 'error', title: 'Çizim çok büyük (en fazla 5 MB); buluta kaydedilemedi.' });
      return;
    }
    setCreateBusy(true);
    try {
      const created = await cloud.createProject(name, named);
      enterProject(created, user.id, named, source !== 'current');
      setNewOpen(false);
      setProjectsOpen(false);
      paramsRef.current.notify({ type: 'success', title: `"${created.name}" buluta kaydedildi ve açıldı.` });
    } catch (e) {
      paramsRef.current.notify({ type: 'error', title: errorText(e) });
    } finally {
      setCreateBusy(false);
    }
  };

  const openNewProjectDialog = () => {
    setNewDialogKey((k) => k + 1);
    setNewOpen(true);
  };

  /** Yeni proje penceresinden: boş/örnek seçilirse açık projedeki kaydedilmemiş değişiklikler için sorar. */
  const createFromDialog = (name: string, source: NewProjectSource) => {
    if (source === 'current') void createProject(name, source);
    else guardDirty(() => void createProject(name, source), 'Yeni bir proje açılacak.');
  };

  const saveCopy = () => {
    const name = paramsRef.current.getDocument().name.trim() || 'Adsız proje';
    void createProject(projectRef.current ? `${name} (kopya)` : name, 'current');
  };

  const saveExisting = async (force: boolean) => {
    const proj = projectRef.current;
    const user = userRef.current;
    if (!cloud || !proj) return;
    if (!user || user.id !== proj.userId) {
      setStatus({ kind: 'error', message: 'Kaydedilemedi: oturum yok. Giriş yapıp "Kopya olarak kaydet"i kullanın.' });
      return;
    }
    const current = paramsRef.current.getDocument();
    const name = current.name.trim() || 'Adsız proje';
    if (name !== current.name) paramsRef.current.setName(name);
    const doc = { ...current, name };
    if (tooLarge(doc)) {
      setStatus({ kind: 'error', message: 'Kaydedilemedi: çizim çok büyük (en fazla 5 MB).' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      const result = await cloud.saveProject(proj.id, name, doc, force ? null : proj.updatedAt);
      if (result.status === 'ok') {
        baseline.current = { name, sig: contentSignature(doc) };
        const latest = paramsRef.current.getDocument();
        const next: OpenProject = { ...proj, updatedAt: result.project.updatedAt, dirty: isDirty(latest) };
        projectRef.current = next;
        setProject(next);
        backup(next, latest, next.dirty);
        setStatus({ kind: 'saved', at: new Date() });
        return;
      }
      setStatus({ kind: 'idle' });
      if (result.status === 'conflict') {
        paramsRef.current.confirm({
          title: 'Proje başka bir yerde değiştirilmiş',
          message:
            'Bu proje siz açtıktan sonra başka bir sekmede ya da cihazda kaydedilmiş. Üzerine yazarsanız oradaki değişiklikler kaybolur.',
          confirmLabel: 'Benimkiyle üzerine yaz',
          danger: true,
          onConfirm: () => void saveExisting(true),
          secondary: { label: 'Kopya olarak kaydet', onClick: saveCopy },
        });
      } else {
        paramsRef.current.confirm({
          title: 'Proje bulutta bulunamadı',
          message: 'Bu proje silinmiş olabilir. Ekrandaki çizimi yeni bir bulut projesi olarak kaydetmek ister misiniz?',
          confirmLabel: 'Yeni proje olarak kaydet',
          onConfirm: () => void createProject(name, 'current'),
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', message: errorText(e) });
    }
  };

  /** "Kaydet": bulut projesi açıksa günceller; yerel taslaktaysa ne yapılacağını sorar. */
  const save = () => {
    if (!cloud) return;
    if (projectRef.current) return void saveExisting(false);
    paramsRef.current.confirm({
      title: 'Buluta kaydet',
      message: `Bu çizim şu an yerel taslak (yalnızca bu tarayıcıda). Buluta kaydederseniz yeni bir bulut projesi oluşturulur${
        userRef.current ? '' : ' ve misafir hesabıyla giriş yapılır'
      }. Yerel taslağınız da yerinde kalır.`,
      confirmLabel: 'Buluta kaydet',
      cancelLabel: 'Yerelde devam et',
      onConfirm: () => void createProject(paramsRef.current.getDocument().name, 'current'),
    });
  };

  const closeProject = () =>
    guardDirty(closeProjectNow, 'Bulut projesi kapatılıp yerel taslak açılacak.');

  /* ---------- Klavye kısayolu ve sayfadan çıkış uyarısı ---------- */

  useEffect(() => {
    if (!cloud) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (projectRef.current?.dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  return {
    project,
    status,
    authBusy,
    createBusy,
    projects,
    listLoading,
    listError,
    projectsOpen,
    newOpen,
    newDialogKey,
    onDocumentChanged,
    signIn: () => void signIn(),
    signOut,
    save,
    saveCopy,
    closeProject,
    openProjectsDialog,
    closeProjectsDialog: () => setProjectsOpen(false),
    refreshProjects: () => void refreshProjects(),
    openProject,
    renameProject,
    deleteProject,
    openNewProjectDialog,
    closeNewProjectDialog: () => setNewOpen(false),
    createFromDialog,
  };
}

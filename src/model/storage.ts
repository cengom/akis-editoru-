import { parseDocumentText } from './document';
import type { DiagramDocument } from './types';

/**
 * Yerel taslak: giriş yapmadan çalışırken (ya da bulut projesi kapalıyken) çizim burada saklanır.
 * Yalnızca bu tarayıcıdadır; bulut kaydı değildir.
 */
export const STORAGE_KEY = 'akis-editoru.cizim';
const BACKUP_KEY = 'akis-editoru.cizim.bozuk-yedek';

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; doc: DiagramDocument; warnings: string[] }
  | { status: 'invalid'; errors: string[] };

export function loadFromStorage(): LoadResult {
  let text: string | null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (text === null) return { status: 'empty' };
  const result = parseDocumentText(text);
  if (result.ok) return { status: 'ok', doc: result.doc, warnings: result.warnings };
  // Okunamayan kaydı silmeden ayrı bir anahtara yedekle.
  try {
    localStorage.setItem(BACKUP_KEY, text);
  } catch {
    /* yedek alınamadıysa yapılacak bir şey yok */
  }
  return { status: 'invalid', errors: result.errors };
}

export function saveToStorage(doc: DiagramDocument): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Bulut projesi yedeği ---------- */

/**
 * Bulut projesi açıkken, kaydedilmemiş değişiklikler kaybolmasın diye son durum burada tutulur.
 * Yerel taslağın (STORAGE_KEY) üzerine yazılmaz. Çıkış yapınca silinir.
 */
export const CLOUD_BACKUP_KEY = 'akis-editoru.bulut-yedek';

export interface CloudBackup {
  projectId: string;
  userId: string;
  /** Sunucudaki son bilinen güncelleme zamanı */
  baseUpdatedAt: string;
  /** Bulutta olmayan değişiklik var mı? */
  dirty: boolean;
  doc: DiagramDocument;
}

export function saveCloudBackup(backup: CloudBackup): boolean {
  try {
    localStorage.setItem(CLOUD_BACKUP_KEY, JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

/** Yedeği okur ve belgeyi doğrular; okunamazsa `null`. */
export function loadCloudBackup(): CloudBackup | null {
  try {
    const text = localStorage.getItem(CLOUD_BACKUP_KEY);
    if (!text) return null;
    const raw = JSON.parse(text) as Partial<CloudBackup>;
    if (typeof raw.projectId !== 'string' || typeof raw.userId !== 'string' || typeof raw.baseUpdatedAt !== 'string') return null;
    const parsed = parseDocumentText(JSON.stringify(raw.doc));
    if (!parsed.ok) return null;
    return {
      projectId: raw.projectId,
      userId: raw.userId,
      baseUpdatedAt: raw.baseUpdatedAt,
      dirty: raw.dirty === true,
      doc: parsed.doc,
    };
  } catch {
    return null;
  }
}

export function clearCloudBackup() {
  try {
    localStorage.removeItem(CLOUD_BACKUP_KEY);
  } catch {
    /* yok sayılır */
  }
}

/* ---------- Hata ekranı için ham kayıtlar ---------- */

/** Hata ekranında "Kaydı yedeğe al, yeniden başla" denince kayıtların taşındığı anahtarların ön eki (silinmez). */
export const CRASH_BACKUP_PREFIX = 'akis-editoru.hata-yedek.';

export interface RawSavedDrawing {
  label: string;
  fileName: string;
  /** Dosyaya yazılacak JSON metni (JSON içe aktar ile açılabilir) */
  text: string;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Bulut yedeğinden belge kısmını çıkarır; çıkaramazsa ham metni döndürür. */
function cloudBackupDocText(text: string): string {
  try {
    const raw = JSON.parse(text) as { doc?: unknown };
    return raw.doc ? JSON.stringify(raw.doc) : text;
  } catch {
    return text;
  }
}

/**
 * Tarayıcıdaki kayıtları doğrulamadan, olduğu gibi okur. Hata ekranında kullanılır: uygulama çöktüyse
 * kaydı ayrıştırmak da hata verebilir, bu yüzden burada ayrıştırma yapılmaz.
 */
export function rawSavedDrawings(): RawSavedDrawing[] {
  const list: RawSavedDrawing[] = [];
  const draft = readKey(STORAGE_KEY);
  if (draft) list.push({ label: 'Yerel taslak', fileName: 'akis-editoru-taslak.json', text: draft });
  const cloud = readKey(CLOUD_BACKUP_KEY);
  if (cloud) list.push({ label: 'Bulut projesinin kaydedilmemiş hâli', fileName: 'akis-editoru-bulut-yedek.json', text: cloudBackupDocText(cloud) });
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CRASH_BACKUP_PREFIX)).sort();
    for (const key of keys) {
      const stamp = key.slice(CRASH_BACKUP_PREFIX.length);
      const text = readKey(key);
      if (!text) continue;
      try {
        const saved = JSON.parse(text) as { draft?: string | null; cloud?: string | null };
        const day = stamp.slice(0, 10);
        if (saved.draft) list.push({ label: `Önceki hata yedeği (${day}) — taslak`, fileName: `akis-editoru-hata-yedegi-${day}.json`, text: saved.draft });
        if (saved.cloud) list.push({ label: `Önceki hata yedeği (${day}) — bulut`, fileName: `akis-editoru-hata-yedegi-bulut-${day}.json`, text: cloudBackupDocText(saved.cloud) });
      } catch {
        /* okunamayan yedek atlanır */
      }
    }
  } catch {
    /* localStorage erişilemiyorsa liste boş kalır */
  }
  return list;
}

/**
 * Yerel taslağı ve bulut yedeğini silmeden ayrı bir anahtara taşır; uygulama ilk açılıştaki gibi açılır.
 * Taşınamazsa (ör. depolama dolu) hiçbir şeyi kaldırmaz ve `false` döner.
 */
export function moveDrawingsAside(): boolean {
  const draft = readKey(STORAGE_KEY);
  const cloud = readKey(CLOUD_BACKUP_KEY);
  if (!draft && !cloud) return true;
  try {
    localStorage.setItem(CRASH_BACKUP_PREFIX + new Date().toISOString(), JSON.stringify({ draft, cloud }));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CLOUD_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

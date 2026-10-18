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
  | { status: 'ok'; doc: DiagramDocument }
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
  if (result.ok) return { status: 'ok', doc: result.doc };
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

import type { DiagramDocument } from '../model/types';
import { CloudError, type CloudBackend, type CloudProjectSummary, type CloudUser } from './types';

/*
 * YALNIZCA GELİŞTİRME İÇİN sahte bulut arka ucu.
 * Supabase hesabı olmadan arayüz akışlarını denemeyi sağlar. Veriler bu tarayıcının
 * localStorage'ında tutulur; gerçek bir sunucuya gitmez ve başka cihazdan görülemez.
 * `npm run dev:sahte-bulut` ile açılır; üretim derlemesine hiç girmez.
 */

const DATA_KEY = 'akis-editoru.sahte-bulut.veri';
const SESSION_KEY = 'akis-editoru.sahte-bulut.oturum';
const LATENCY_MS = 250;

interface Row {
  id: string;
  user_id: string;
  name: string;
  document_json: unknown;
  created_at: string;
  updated_at: string;
}

const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function readRows(): Row[] {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) ?? '[]') as Row[];
  } catch {
    return [];
  }
}

function writeRows(rows: Row[]) {
  localStorage.setItem(DATA_KEY, JSON.stringify(rows));
}

function readUser(): CloudUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    return id ? { id, email: null, isAnonymous: true } : null;
  } catch {
    return null;
  }
}

/** Sunucu saatini taklit eder: her güncellemede bir öncekinden büyük olmasını garanti eder. */
let lastStamp = 0;
function now(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
}

function summary(row: Row): CloudProjectSummary {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function createMockBackend(): CloudBackend {
  const listeners = new Set<(user: CloudUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(readUser()));
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY) emit();
  });

  const requireUser = (): CloudUser => {
    const user = readUser();
    if (!user) throw new CloudError('Oturum yok: önce giriş yapın.');
    return user;
  };
  /** RLS'i taklit eder: yalnızca kullanıcının kendi satırları görünür. */
  const ownRow = (id: string) => {
    const user = requireUser();
    return readRows().find((r) => r.id === id && r.user_id === user.id) ?? null;
  };
  const checkName = (name: string) => {
    if (name.length < 1 || name.length > 200) throw new CloudError('Kayıt sınırları aşıldı (ad 1–200 karakter).');
  };

  return {
    kind: 'mock',

    async getUser() {
      return readUser();
    },

    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    async signInAsGuest() {
      await wait();
      localStorage.setItem(SESSION_KEY, crypto.randomUUID());
      emit();
      return readUser()!;
    },

    async signOut() {
      await wait();
      localStorage.removeItem(SESSION_KEY);
      emit();
    },

    async listProjects() {
      await wait();
      const user = requireUser();
      return readRows()
        .filter((r) => r.user_id === user.id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(summary);
    },

    async getProject(id) {
      await wait();
      const row = ownRow(id);
      return row ? { ...summary(row), rawDocument: structuredClone(row.document_json) } : null;
    },

    async createProject(name, document: DiagramDocument) {
      await wait();
      const user = requireUser();
      checkName(name);
      const stamp = now();
      const row: Row = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        document_json: structuredClone(document),
        created_at: stamp,
        updated_at: stamp,
      };
      writeRows([...readRows(), row]);
      return summary(row);
    },

    async saveProject(id, name, document, expectedUpdatedAt) {
      await wait();
      checkName(name);
      const row = ownRow(id);
      if (!row) return { status: 'missing' };
      if (expectedUpdatedAt && row.updated_at !== expectedUpdatedAt) return { status: 'conflict' };
      const updated: Row = { ...row, name, document_json: structuredClone(document), updated_at: now() };
      writeRows(readRows().map((r) => (r.id === id ? updated : r)));
      return { status: 'ok', project: summary(updated) };
    },

    async renameProject(id, name) {
      await wait();
      checkName(name);
      const row = ownRow(id);
      if (!row) throw new CloudError('Yeniden adlandırılamadı: proje bulunamadı.');
      const updated: Row = { ...row, name, updated_at: now() };
      writeRows(readRows().map((r) => (r.id === id ? updated : r)));
      return summary(updated);
    },

    async deleteProject(id) {
      await wait();
      const row = ownRow(id);
      if (row) writeRows(readRows().filter((r) => r.id !== id));
    },
  };
}

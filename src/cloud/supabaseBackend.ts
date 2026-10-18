import type { AuthError, PostgrestError, SupabaseClient, User } from '@supabase/supabase-js';
import type { DiagramDocument } from '../model/types';
import { CloudError, type CloudBackend, type CloudProjectSummary, type CloudUser, type SaveResult } from './types';

const TABLE = 'diagrams';
const SUMMARY_COLUMNS = 'id, name, created_at, updated_at';

interface SummaryRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function toUser(user: User | null | undefined): CloudUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, isAnonymous: user.is_anonymous ?? !user.email };
}

function toSummary(row: SummaryRow): CloudProjectSummary {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

/** Supabase hatalarını kullanıcıya gösterilecek Türkçe mesaja çevirir. */
function fail(error: PostgrestError | AuthError | Error, action: string): never {
  const message = error.message ?? '';
  let detail = 'Beklenmeyen bir hata oluştu.';
  if (/fetch|network|Failed to fetch|NetworkError/i.test(message)) detail = 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  else if (/anonymous sign-ins are disabled/i.test(message))
    detail = 'Supabase projesinde misafir (anonim) girişi kapalı. README\'deki kurulum adımlarına bakın.';
  else if (/JWT|token|not authenticated|auth/i.test(message)) detail = 'Oturum geçersiz ya da süresi dolmuş. Yeniden giriş yapın.';
  else if (/row-level security|permission denied/i.test(message)) detail = 'Bu işlem için yetkiniz yok.';
  else if (/relation .* does not exist|Could not find the table/i.test(message))
    detail = 'Veritabanı tablosu bulunamadı. README\'deki SQL kurulumunu çalıştırın.';
  else if (/rate limit/i.test(message)) detail = 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.';
  else if (/check constraint|violates/i.test(message)) detail = 'Kayıt sınırları aşıldı (ad 1–200 karakter, belge en fazla 5 MB).';
  console.warn(`[bulut] ${action}:`, error);
  throw new CloudError(`${action}: ${detail}`);
}

export function createSupabaseBackend(client: SupabaseClient): CloudBackend {
  return {
    kind: 'supabase',

    async getUser() {
      const { data, error } = await client.auth.getSession();
      if (error) fail(error, 'Oturum okunamadı');
      return toUser(data.session?.user);
    },

    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },

    async signInAsGuest() {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) fail(error, 'Giriş yapılamadı');
      const user = toUser(data.user);
      if (!user) throw new CloudError('Giriş yapılamadı: kullanıcı bilgisi alınamadı.');
      return user;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) fail(error, 'Çıkış yapılamadı');
    },

    async listProjects() {
      const { data, error } = await client.from(TABLE).select(SUMMARY_COLUMNS).order('updated_at', { ascending: false });
      if (error) fail(error, 'Projeler yüklenemedi');
      return (data as SummaryRow[]).map(toSummary);
    },

    async getProject(id) {
      const { data, error } = await client
        .from(TABLE)
        .select(`${SUMMARY_COLUMNS}, document_json`)
        .eq('id', id)
        .maybeSingle();
      if (error) fail(error, 'Proje açılamadı');
      if (!data) return null;
      const row = data as SummaryRow & { document_json: unknown };
      return { ...toSummary(row), rawDocument: row.document_json };
    },

    async createProject(name, document) {
      const { data, error } = await client
        .from(TABLE)
        .insert({ name, document_json: document })
        .select(SUMMARY_COLUMNS)
        .single();
      if (error) fail(error, 'Proje oluşturulamadı');
      return toSummary(data as SummaryRow);
    },

    async saveProject(id, name, document: DiagramDocument, expectedUpdatedAt): Promise<SaveResult> {
      let query = client.from(TABLE).update({ name, document_json: document }).eq('id', id);
      if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
      const { data, error } = await query.select(SUMMARY_COLUMNS);
      if (error) fail(error, 'Kaydedilemedi');
      const rows = data as SummaryRow[];
      if (rows.length > 0) return { status: 'ok', project: toSummary(rows[0]) };
      // Hiç satır güncellenmediyse: proje ya silinmiş ya da başka yerde değiştirilmiş.
      const { data: existing, error: checkError } = await client.from(TABLE).select('id').eq('id', id).maybeSingle();
      if (checkError) fail(checkError, 'Kaydedilemedi');
      return existing ? { status: 'conflict' } : { status: 'missing' };
    },

    async renameProject(id, name) {
      const { data, error } = await client.from(TABLE).update({ name }).eq('id', id).select(SUMMARY_COLUMNS).single();
      if (error) fail(error, 'Yeniden adlandırılamadı');
      return toSummary(data as SummaryRow);
    },

    async deleteProject(id) {
      const { error } = await client.from(TABLE).delete().eq('id', id);
      if (error) fail(error, 'Silinemedi');
    },
  };
}

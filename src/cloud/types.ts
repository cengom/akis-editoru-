import type { DiagramDocument } from '../model/types';

/** Giriş yapmış kullanıcı. Misafir (anonim) hesapta e-posta yoktur. */
export interface CloudUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

/** Proje listesindeki satır. */
export interface CloudProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  /** Sunucunun verdiği son güncelleme zamanı; "başka yerde değişti mi?" kontrolünde kullanılır. */
  updatedAt: string;
}

export interface CloudProjectWithDocument extends CloudProjectSummary {
  /** Sunucudan gelen ham JSON. Kullanmadan önce `parseDocument` ile doğrulanmalı. */
  rawDocument: unknown;
}

export type SaveResult =
  | { status: 'ok'; project: CloudProjectSummary }
  /** Proje bu açıldıktan sonra başka bir yerde (sekme/cihaz) değiştirilmiş. */
  | { status: 'conflict' }
  /** Proje silinmiş ya da artık bu kullanıcıya ait değil. */
  | { status: 'missing' };

/**
 * Bulut kayıt arka ucu. Supabase ve geliştirme için sahte arka uç aynı arayüzü uygular;
 * böylece uygulama kodu hangisinin kullanıldığını bilmez.
 * Tüm hatalar Türkçe mesajlı `CloudError` olarak fırlatılır.
 */
export interface CloudBackend {
  readonly kind: 'supabase' | 'mock';
  getUser(): Promise<CloudUser | null>;
  /** Oturum değiştiğinde (giriş, çıkış, başka sekmede çıkış) çağrılır. Aboneliği bitiren fonksiyon döner. */
  onAuthChange(callback: (user: CloudUser | null) => void): () => void;
  /** E-posta/şifre olmadan misafir hesabı açar ve giriş yapar. */
  signInAsGuest(): Promise<CloudUser>;
  signOut(): Promise<void>;
  listProjects(): Promise<CloudProjectSummary[]>;
  getProject(id: string): Promise<CloudProjectWithDocument | null>;
  createProject(name: string, document: DiagramDocument): Promise<CloudProjectSummary>;
  /**
   * Projeyi günceller. `expectedUpdatedAt` verilirse yalnızca sunucudaki kayıt hâlâ o zamandaysa yazar;
   * değilse `conflict` döner (başka yerdeki değişikliğin üzerine sessizce yazılmaz).
   */
  saveProject(id: string, name: string, document: DiagramDocument, expectedUpdatedAt: string | null): Promise<SaveResult>;
  renameProject(id: string, name: string): Promise<CloudProjectSummary>;
  deleteProject(id: string): Promise<void>;
}

export class CloudError extends Error {}

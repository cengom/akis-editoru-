import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import type { CloudSession } from '../cloud/useCloudSession';
import type { MapState } from '../model/types';

/** Yerel taslağın tarayıcıya otomatik kaydı */
export type SaveState = { kind: 'saved'; at: Date } | { kind: 'pending' } | { kind: 'error' };

/** Bulut projesinin son kayıt işlemi */
export type CloudStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string };

export type ModeInfo =
  | { kind: 'local'; localSave: SaveState }
  | { kind: 'cloud'; dirty: boolean; status: CloudStatus };

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  // Tuval
  onNew: () => void;
  onExample: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onDelete: () => void;
  canDelete: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onShowMap: () => void;
  onExportPng: () => void;
  onPrint: () => void;
  // Düzen
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopy: () => void;
  onPaste: () => void;
  // Mevcut / gelecek durum
  activeState: MapState;
  hasFuture: boolean;
  onSwitchState: (target: MapState) => void;
  onRemoveFuture: () => void;
  // Kayıt modu ve bulut
  mode: ModeInfo;
  session: CloudSession;
  authBusy: boolean;
  onSave: () => void;
  onSaveCopy: () => void;
  onOpenProjects: () => void;
  onNewCloudProject: () => void;
  onCloseProject: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const time = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

function statusText(mode: ModeInfo): { text: string; tone: 'ok' | 'warn' | 'error' | 'muted' } {
  if (mode.kind === 'local') {
    const s = mode.localSave;
    if (s.kind === 'pending') return { text: 'Tarayıcıya kaydediliyor…', tone: 'muted' };
    if (s.kind === 'error') return { text: 'Tarayıcıya kaydedilemedi!', tone: 'error' };
    return { text: `Bu tarayıcıya kaydedildi (${time(s.at)}) · bulut kaydı değil`, tone: 'muted' };
  }
  const s = mode.status;
  if (s.kind === 'saving') return { text: 'Buluta kaydediliyor…', tone: 'muted' };
  if (s.kind === 'error') return { text: s.message, tone: 'error' };
  if (mode.dirty) return { text: 'Kaydedilmemiş değişiklikler var', tone: 'warn' };
  if (s.kind === 'saved') return { text: `Buluta kaydedildi (${time(s.at)})`, tone: 'ok' };
  return { text: 'Bulutla aynı', tone: 'ok' };
}

export function Toolbar(props: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { mode, session } = props;
  const isCloud = mode.kind === 'cloud';
  const status = statusText(mode);
  const user = session.user;

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // aynı dosya tekrar seçilebilsin
    if (file) props.onImportFile(file);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <div className="toolbar-group">
          <span className="brand">Akış Editörü</span>
          <span
            className={`mode-badge ${isCloud ? 'mode-cloud' : 'mode-local'}`}
            data-testid="kayit-modu"
            title={
              isCloud
                ? 'Bu çizim bulutta kayıtlı bir proje. Değişiklikler "Kaydet" ile buluta yazılır.'
                : 'Bu çizim yalnızca bu tarayıcıda duran bir yerel taslak; bulutta değil.'
            }
          >
            {isCloud ? '☁ Buluta kayıtlı proje' : '💾 Yerel taslak'}
          </span>
          <input
            className="name-input"
            value={props.name}
            maxLength={200}
            onChange={(e) => props.onNameChange(e.target.value)}
            aria-label={isCloud ? 'Proje adı' : 'Diyagram adı'}
            placeholder={isCloud ? 'Proje adı' : 'Diyagram adı'}
          />
        </div>

        {session.available && (
          <div className="toolbar-group">
            <button
              type="button"
              className={isCloud && mode.dirty ? 'primary' : undefined}
              onClick={props.onSave}
              disabled={isCloud && mode.status.kind === 'saving'}
              title={isCloud ? 'Değişiklikleri buluta kaydet (Ctrl/⌘+S)' : 'Bu taslağı buluta kaydet (Ctrl/⌘+S)'}
            >
              {isCloud ? 'Kaydet' : 'Buluta kaydet'}
            </button>
            {isCloud && (
              <button type="button" onClick={props.onSaveCopy} title="Şu anki çizimi yeni bir bulut projesi olarak kaydet">
                Kopya olarak kaydet
              </button>
            )}
            <button type="button" onClick={props.onOpenProjects} disabled={!user} title={user ? undefined : 'Önce giriş yapın'}>
              Projelerim
            </button>
            <button type="button" onClick={props.onNewCloudProject}>
              Yeni bulut proje
            </button>
            {isCloud && (
              <button type="button" onClick={props.onCloseProject} title="Bulut projesini kapatıp yerel taslağı aç">
                Yerel taslağa dön
              </button>
            )}
          </div>
        )}

        <div className={`save-status tone-${status.tone}`} role="status" data-testid="kayit-durumu">
          {status.text}
        </div>

        <div className="toolbar-group session">
          {!session.available && (
            <span className="muted small" title="Bulut kaydı için Supabase ayarlanmamış. README'deki kurulum adımlarına bakın.">
              Bulut kapalı
            </span>
          )}
          {session.available && session.kind === 'mock' && (
            <span className="mock-badge" title="Geliştirme modu: veriler gerçek sunucuya değil bu tarayıcıya yazılır.">
              SAHTE BULUT
            </span>
          )}
          {session.available && !session.ready && <span className="muted small">Oturum kontrol ediliyor…</span>}
          {session.available && session.ready && !user && (
            <button
              type="button"
              className="primary"
              onClick={props.onSignIn}
              disabled={props.authBusy}
              title="E-posta ya da şifre gerekmez: bu tarayıcıya bağlı bir misafir hesabı açılır."
            >
              {props.authBusy ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </button>
          )}
          {user && (
            <>
              <span
                className="user-label"
                data-testid="kullanici"
                title={
                  user.isAnonymous
                    ? `Misafir hesabı (kimlik: ${user.id}). Bu hesap yalnızca bu tarayıcıya bağlıdır.`
                    : `Giriş yapan: ${user.email ?? user.id}`
                }
              >
                {user.isAnonymous ? `Misafir · ${user.id.slice(0, 6)}` : user.email}
              </span>
              <button type="button" onClick={props.onSignOut} disabled={props.authBusy}>
                Çıkış yap
              </button>
            </>
          )}
        </div>
      </div>

      <div className="toolbar-row toolbar-row-tools">
        <div className="toolbar-group state-tabs" role="tablist" aria-label="Harita">
          <span className="group-label">Harita</span>
          <button
            type="button"
            role="tab"
            aria-selected={props.activeState === 'current'}
            className={props.activeState === 'current' ? 'is-active' : undefined}
            onClick={() => props.onSwitchState('current')}
            data-testid="sekme-mevcut"
          >
            Mevcut durum
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.activeState === 'future'}
            className={props.activeState === 'future' ? 'is-active' : undefined}
            onClick={() => props.onSwitchState('future')}
            title={props.hasFuture ? undefined : 'Hedef (gelecek durum) haritası oluştur'}
            data-testid="sekme-gelecek"
          >
            {props.hasFuture ? 'Gelecek durum' : '+ Gelecek durum'}
          </button>
          {props.activeState === 'future' && (
            <button type="button" className="danger-text" onClick={props.onRemoveFuture} title="Gelecek durum haritasını sil">
              Kaldır
            </button>
          )}
        </div>
        <div className="toolbar-group">
          <span className="group-label">Düzen</span>
          <button type="button" onClick={props.onUndo} disabled={!props.canUndo} title="Son değişikliği geri al (⌘/Ctrl+Z)" aria-label="Geri al" className="undo-btn" data-testid="geri-al">
            ↶ Geri al
          </button>
          <button type="button" onClick={props.onRedo} disabled={!props.canRedo} title="Geri alınanı yeniden uygula (⇧+⌘/Ctrl+Z ya da Ctrl+Y)" aria-label="İleri al" className="undo-btn" data-testid="ileri-al">
            ↷ İleri al
          </button>
          <button type="button" onClick={props.onCopy} disabled={!props.canDelete} title="Seçili şekilleri kopyala (⌘/Ctrl+C)">
            Kopyala
          </button>
          <button type="button" onClick={props.onPaste} title="Yapıştır (⌘/Ctrl+V); çoğalt: ⌘/Ctrl+D">
            Yapıştır
          </button>
        </div>
        <div className="toolbar-group">
          <span className="group-label">Tuval</span>
          <button type="button" onClick={props.onNew} title={isCloud ? 'Açık projenin içeriğini temizler' : 'Taslağı temizler'}>
            Temizle
          </button>
          <button type="button" onClick={props.onExample}>
            Örnek süreç
          </button>
        </div>
        <div className="toolbar-group">
          <span className="group-label">Dosya</span>
          <button type="button" onClick={() => fileInput.current?.click()}>
            JSON içe aktar
          </button>
          <button type="button" onClick={props.onExport}>
            JSON dışa aktar
          </button>
          <button type="button" onClick={props.onExportPng} title="Tüm çizimi PNG görsel olarak indir">
            PNG indir
          </button>
          <button type="button" onClick={props.onPrint} title="Yazdır ya da yazdırma penceresinden PDF olarak kaydet">
            Yazdır / PDF
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={onFile} data-testid="ice-aktar-dosya" />
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={props.onDelete} disabled={!props.canDelete} title="Seçili öğeleri sil (Delete)">
            Seçileni sil
          </button>
          <button type="button" onClick={props.onShowMap} title="Seçimi kaldırıp VSM genel verilerini ve özeti göster">
            VSM verileri / özet
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={props.onZoomOut} title="Uzaklaştır" aria-label="Uzaklaştır">
            −
          </button>
          <button type="button" onClick={props.onZoomIn} title="Yakınlaştır" aria-label="Yakınlaştır">
            +
          </button>
          <button type="button" onClick={props.onFit} title="Tüm çizimi ekrana sığdır">
            Sığdır
          </button>
        </div>
      </div>
    </header>
  );
}

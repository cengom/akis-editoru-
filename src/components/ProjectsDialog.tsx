import { useState } from 'react';
import type { CloudProjectSummary } from '../cloud';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  projects: CloudProjectSummary[] | null;
  loading: boolean;
  error: string | null;
  currentId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpen: (project: CloudProjectSummary) => void;
  onRename: (project: CloudProjectSummary, name: string) => Promise<boolean>;
  onDelete: (project: CloudProjectSummary) => void;
  onNew: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ProjectsDialog(props: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const startRename = (p: CloudProjectSummary) => {
    setEditingId(p.id);
    setDraftName(p.name);
  };
  const commitRename = async (p: CloudProjectSummary) => {
    const name = draftName.trim();
    if (!name || name === p.name) return setEditingId(null);
    setSavingName(true);
    const ok = await props.onRename(p, name);
    setSavingName(false);
    if (ok) setEditingId(null);
  };

  return (
    <Modal open={props.open} title="Projelerim" onClose={props.onClose} wide>
      <div className="projects-toolbar">
        <button type="button" className="primary" onClick={props.onNew}>
          + Yeni bulut proje
        </button>
        <button type="button" onClick={props.onRefresh} disabled={props.loading}>
          Yenile
        </button>
      </div>
      {props.error && (
        <p className="warning-box" role="alert">
          {props.error}
        </p>
      )}
      {props.loading && !props.projects && <p className="muted">Projeler yükleniyor…</p>}
      {props.projects && props.projects.length === 0 && (
        <p className="muted">Henüz bulut projeniz yok. "Yeni bulut proje" ile ilkini oluşturun.</p>
      )}
      {props.projects && props.projects.length > 0 && (
        <table className="projects-table" data-testid="proje-listesi">
          <thead>
            <tr>
              <th scope="col">Ad</th>
              <th scope="col">Son değişiklik</th>
              <th scope="col">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {props.projects.map((p) => (
              <tr key={p.id} className={p.id === props.currentId ? 'is-current' : undefined}>
                <td>
                  {editingId === p.id ? (
                    <form
                      className="rename-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void commitRename(p);
                      }}
                    >
                      <input
                        value={draftName}
                        maxLength={200}
                        onChange={(e) => setDraftName(e.target.value)}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        aria-label="Yeni ad"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                      />
                      <button type="submit" className="primary" disabled={savingName}>
                        Kaydet
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Vazgeç
                      </button>
                    </form>
                  ) : (
                    <>
                      <button type="button" className="link project-name" onClick={() => props.onOpen(p)}>
                        {p.name}
                      </button>
                      {p.id === props.currentId && <span className="badge">açık</span>}
                    </>
                  )}
                </td>
                <td className="muted small">{formatDate(p.updatedAt)}</td>
                <td className="row-actions">
                  {editingId !== p.id && (
                    <>
                      <button type="button" onClick={() => props.onOpen(p)}>
                        Aç
                      </button>
                      <button type="button" onClick={() => startRename(p)}>
                        Yeniden adlandır
                      </button>
                      <button type="button" className="danger-text" onClick={() => props.onDelete(p)}>
                        Sil
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

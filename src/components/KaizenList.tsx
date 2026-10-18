import type { ShapeNode } from '../model/types';
import { KAIZEN_STATUS_LABELS, emptyKaizen } from '../model/vsm';

/** Bugünün tarihi YYYY-AA-GG (yerel saat). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Haritadaki kaizen patlamalarının eylem listesi (tarihe göre sıralı). */
export function KaizenList({ kaizens, onSelectNode }: { kaizens: ShapeNode[]; onSelectNode: (id: string) => void }) {
  if (kaizens.length === 0) return null;
  const today = todayIso();
  const items = kaizens
    .map((n) => ({ id: n.id, title: n.data.title.trim() || 'Kaizen', ...(n.data.kaizen ?? emptyKaizen()) }))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const done = items.filter((i) => i.status === 'done').length;
  return (
    <section className="vsm-section" aria-label="Kaizen eylemleri" data-testid="kaizen-listesi">
      <h3>Kaizen eylemleri</h3>
      <p className="muted small">
        {items.length} eylem · {done} tamamlandı
      </p>
      <ul className="kaizen-list">
        {items.map((k) => {
          const late = k.status !== 'done' && !!k.dueDate && k.dueDate < today;
          return (
            <li key={k.id} className={`kz-${k.status}${late ? ' kz-late' : ''}`}>
              <button type="button" className="link" onClick={() => onSelectNode(k.id)}>
                {k.title}
              </button>
              <span className="kz-meta">
                <span className="kz-status">
                  {k.status === 'done' ? '✓ ' : late ? '⚠ ' : ''}
                  {KAIZEN_STATUS_LABELS[k.status]}
                  {late && ' · gecikti'}
                </span>
                {k.owner && <span> · {k.owner}</span>}
                {k.dueDate && <span> · {formatDate(k.dueDate)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

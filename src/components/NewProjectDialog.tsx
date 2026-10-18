import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

export type NewProjectSource = 'blank' | 'example' | 'current';

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, source: NewProjectSource) => void;
}

export function NewProjectDialog({ open, busy, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<NewProjectSource>('current');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(name.trim() || 'Adsız proje', source);
  };

  return (
    <Modal open={open} title="Yeni bulut proje" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Proje adı
          <input
            value={name}
            maxLength={200}
            placeholder="Adsız proje"
            onChange={(e) => setName(e.target.value)}
            autoFocus
            data-testid="yeni-proje-adi"
          />
        </label>
        <fieldset>
          <legend>Nasıl başlasın?</legend>
          <label className="radio">
            <input type="radio" name="kaynak" checked={source === 'current'} onChange={() => setSource('current')} />
            Şu anki tuvalden (ekrandaki çizim buluta kopyalanır)
          </label>
          <label className="radio">
            <input type="radio" name="kaynak" checked={source === 'blank'} onChange={() => setSource('blank')} />
            Boş tuval
          </label>
          <label className="radio">
            <input type="radio" name="kaynak" checked={source === 'example'} onChange={() => setSource('example')} />
            Örnek üretim süreci
          </label>
        </fieldset>
        <p className="muted small">Yerel taslağınız silinmez; "Yerel taslağa dön" ile geri açabilirsiniz.</p>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Oluştur ve aç'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

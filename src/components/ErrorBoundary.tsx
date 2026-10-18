import { Component, type ErrorInfo, type ReactNode } from 'react';
import { moveDrawingsAside, rawSavedDrawings } from '../model/storage';

interface State {
  error: Error | null;
  /** Kayıtlar yedeğe taşınamadıysa gösterilecek not */
  moveFailed: boolean;
}

/**
 * Uygulamada beklenmeyen bir hata olursa beyaz sayfa yerine bu ekran çıkar.
 * Hiçbir kaydı silmez: son kayıtlar indirilebilir; "Kaydı yedeğe al, yeniden başla" kayıtları yedek anahtara taşır.
 * Bu bileşen kasıtlı olarak sade tutuldu (uygulamanın geri kalanına bağımlı değil).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, moveFailed: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Akış Editörü hata ekranı:', error, info.componentStack);
  }

  private download(fileName: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private startBlank = () => {
    if (!window.confirm('Kayıtlı çizim silinmeyecek, tarayıcıda ayrı bir yedeğe taşınacak ve uygulama ilk açılıştaki gibi (örnek süreçle) açılacak. Devam edilsin mi?')) return;
    if (moveDrawingsAside()) window.location.reload();
    else this.setState({ moveFailed: true });
  };

  render() {
    const { error, moveFailed } = this.state;
    if (!error) return this.props.children;
    const saved = rawSavedDrawings();
    return (
      <main className="crash-screen" role="alert" data-testid="hata-ekrani">
        <div className="crash-card">
          <h1>Beklenmeyen bir hata oluştu</h1>
          <p>
            Uygulama bir sorunla karşılaştı ve devam edemedi. <strong>Çiziminiz silinmedi</strong>: son otomatik kayıt
            bu tarayıcıda duruyor.
          </p>
          <ol>
            <li>Önce sayfayı yenileyin; çoğu zaman sorun böyle geçer.</li>
            <li>Hata tekrar ederse son kaydı JSON dosyası olarak indirin (sonra "JSON içe aktar" ile açabilirsiniz).</li>
            <li>Hâlâ açılmıyorsa "Kaydı yedeğe al, yeniden başla" deyin; kayıt silinmez, ayrı bir yedeğe taşınır ve bu ekrandan indirilebilir.</li>
          </ol>
          <div className="crash-actions">
            <button type="button" className="primary" onClick={() => window.location.reload()} data-testid="hata-yenile">
              Sayfayı yenile
            </button>
            {saved.map((s) => (
              <button key={s.fileName + s.label} type="button" onClick={() => this.download(s.fileName, s.text)}>
                ⬇ {s.label} indir
              </button>
            ))}
            <button type="button" onClick={this.startBlank} data-testid="hata-bos-tuval">
              Kaydı yedeğe al, yeniden başla
            </button>
          </div>
          {saved.length === 0 && <p className="muted">Bu tarayıcıda kayıtlı çizim bulunamadı.</p>}
          {moveFailed && <p className="crash-warn">Kayıt yedeğe taşınamadı (tarayıcı depolaması dolu olabilir). Önce kaydı indirin.</p>}
          <details>
            <summary>Teknik ayrıntı</summary>
            <pre>{error.message || String(error)}</pre>
          </details>
        </div>
      </main>
    );
  }
}

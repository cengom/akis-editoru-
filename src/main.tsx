import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

/** Yalnızca geliştirmede: adres "?hata-testi" ile açılırsa hata ekranını denemek için bilerek hata verir. */
function DevCrashTest(): null {
  if (new URLSearchParams(window.location.search).has('hata-testi')) throw new Error('Hata ekranı denemesi (yalnızca geliştirme).');
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {import.meta.env.DEV && <DevCrashTest />}
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

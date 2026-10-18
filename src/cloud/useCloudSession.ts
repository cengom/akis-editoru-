import { useEffect, useState } from 'react';
import { cloud, type CloudUser } from './index';

export interface CloudSession {
  /** Bulut ayarlı mı (Supabase ortam değişkenleri ya da geliştirme için sahte bulut)? */
  available: boolean;
  kind: 'supabase' | 'mock' | null;
  /** İlk oturum kontrolü bitti mi? */
  ready: boolean;
  user: CloudUser | null;
}

/** Oturum durumunu izler: ilk açılışta mevcut oturumu okur, sonra değişiklikleri dinler. */
export function useCloudSession(): CloudSession {
  const [ready, setReady] = useState(!cloud);
  const [user, setUser] = useState<CloudUser | null>(null);

  useEffect(() => {
    if (!cloud) return;
    let active = true;
    cloud
      .getUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setReady(true));
    const unsubscribe = cloud.onAuthChange((u) => active && setUser(u));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { available: !!cloud, kind: cloud?.kind ?? null, ready, user };
}

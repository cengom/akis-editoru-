/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Yalnızca geliştirmede: "1" ise Supabase yerine tarayıcı içi sahte bulut kullanılır. */
  readonly VITE_CLOUD_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

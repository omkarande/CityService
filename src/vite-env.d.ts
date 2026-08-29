/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_API?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARTNER_WEB_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_OUTLET_PLAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

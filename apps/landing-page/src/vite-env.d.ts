/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARTNER_WEB_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

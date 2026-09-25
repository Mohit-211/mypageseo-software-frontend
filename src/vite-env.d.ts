/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://api.mypageseo.com/v1. Defaults to "/api". */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

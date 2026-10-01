/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://api.mypageseo.com/v1. Defaults to "/api". */
  readonly VITE_API_BASE_URL?: string;
  /** Map tile URL template for ranking maps. Defaults to OpenStreetMap. */
  readonly VITE_MAP_TILE_URL?: string;
  /** Attribution HTML for those tiles. */
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

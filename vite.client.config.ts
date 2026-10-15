import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The white-label client page (Phase 23): a second, standalone entry (`client.html`) built to `dist-client/`
 * and served on the neutral domain. It shares the app's components and theme, but none of its routes,
 * sign-in or product branding.
 *
 * The page lives at `/<token>` (neutral domain) or `/w/<token>` (API host) and reads `<page>/data`,
 * `<page>/pdf/<type>` and `<page>/logo` relative to itself. In development, `/demo` shows sample data and
 * `/<token>` proxies those calls to `VITE_CLIENT_PAGE_API` (default: the origin of `VITE_API_BASE_URL`).
 */

/** `/<token>` and `/w/<token>` (with an optional query) are the page itself. */
const PAGE_PATH = /^\/(?:w\/)?[A-Za-z0-9_-]{4,}\/?(?:\?.*)?$/;

/** Sends the page's own address to `client.html` (under `base`, as nginx does in production). */
const servePage =
  (base: string): Connect.NextHandleFunction =>
  (req, _res, next) => {
    if (req.url && PAGE_PATH.test(req.url)) req.url = `${base}client.html${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
    next();
  };

const clientPageRoutes = (): Plugin => {
  let base = "/";
  return {
    name: "client-page-routes",
    configResolved: (config) => void (base = config.base),
    configureServer: (server) => void server.middlewares.use(servePage(base)),
    configurePreviewServer: (server) => void server.middlewares.use(servePage(base)),
  };
};

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = env.VITE_CLIENT_PAGE_API || (env.VITE_API_BASE_URL ? new URL(env.VITE_API_BASE_URL).origin : "http://localhost:4000");
  // `/<token>/data` → `<api>/w/<token>/data` (and the PDFs and logo).
  const proxy = {
    "^/(?:w/)?[A-Za-z0-9_-]{4,}/(?:data|pdf|logo)": {
      target: api,
      changeOrigin: true,
      rewrite: (path: string) => (path.startsWith("/w/") ? path : `/w${path}`),
    },
  };
  return {
    plugins: [clientPageRoutes(), react(), tailwindcss()],
    // Built files are served under /_c/ (never a link token), so they can sit next to the API on its host.
    base: command === "build" || isPreview ? "/_c/" : "/",
    resolve: { tsconfigPaths: true },
    server: { port: 3001, proxy },
    preview: { port: 3001, proxy },
    build: {
      outDir: "dist-client",
      rolldownOptions: {
        input: "client.html",
        // Libraries in their own files, so returning visitors keep them cached across releases.
        output: {
          codeSplitting: {
            groups: [
              { name: "vendor-react", priority: 20, test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: "vendor-charts", priority: 10, test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit|lodash)[\\/]/ },
              { name: "vendor-ui", priority: 30, test: /node_modules[\\/](@radix-ui|lucide-react|@floating-ui|clsx|tailwind-merge|class-variance-authority)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});

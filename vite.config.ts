import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Large libraries in their own files: they change rarely, so browsers keep them cached across releases.
 *
 * Priorities matter: a group also captures the dependencies of what it matches, so without a
 * higher-priority home the tiny class helpers (clsx, tailwind-merge, class-variance-authority)
 * that every component imports landed in vendor-charts (recharts depends on clsx) and pulled
 * recharts + d3 (~100 kB gzip) onto the first load of every page, the login page included.
 */
const vendorGroups = [
  { name: "vendor-ui", test: /node_modules[\\/](@radix-ui|lucide-react|sonner|cmdk|vaul|clsx|tailwind-merge|class-variance-authority)[\\/]/, priority: 10 },
  { name: "vendor-react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 9 },
  { name: "vendor-query", test: /node_modules[\\/]@tanstack[\\/]/, priority: 8 },
  { name: "vendor-charts", test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit)[\\/]/ },
  { name: "vendor-maps", test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
  { name: "vendor-forms", test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/…` imports come from tsconfig "paths" (Vite resolves them natively).
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: vendorGroups },
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Large libraries in their own files: they change rarely, so browsers keep them cached across releases. */
const vendorGroups = [
  { name: "vendor-react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
  { name: "vendor-query", test: /node_modules[\\/]@tanstack[\\/]/ },
  { name: "vendor-charts", test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit)[\\/]/ },
  { name: "vendor-maps", test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
  { name: "vendor-ui", test: /node_modules[\\/](@radix-ui|lucide-react|sonner|cmdk|vaul)[\\/]/ },
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

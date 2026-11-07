import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Defaults let the app run outside Replit too (Replit sets these itself).
const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Where the Express API runs in local dev. On Replit the shared proxy handles /api.
const apiTarget = process.env.API_URL ?? "http://localhost:8080";

// Google AdSense: when VITE_ADSENSE_CLIENT (ca-pub-…) is set at build time, put the
// verification meta tag + AdSense script into every page's <head> and publish /ads.txt.
const adsenseClient = (process.env.VITE_ADSENSE_CLIENT ?? "").trim();
function adsense(): Plugin {
  return {
    name: "surituk-adsense",
    transformIndexHtml() {
      if (!/^ca-pub-\d+$/.test(adsenseClient)) return [];
      return [
        { tag: "meta", attrs: { name: "google-adsense-account", content: adsenseClient }, injectTo: "head" },
        { tag: "script", attrs: { async: true, crossorigin: "anonymous", src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}` }, injectTo: "head" },
      ];
    },
    generateBundle() {
      if (!/^ca-pub-\d+$/.test(adsenseClient)) return;
      this.emitFile({ type: "asset", fileName: "ads.txt", source: `google.com, ${adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    adsense(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: process.env.REPL_ID ? undefined : { "/api": { target: apiTarget, changeOrigin: true } },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: process.env.REPL_ID ? undefined : { "/api": { target: apiTarget, changeOrigin: true } },
  },
});

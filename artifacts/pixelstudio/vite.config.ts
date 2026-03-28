import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// ─── PORT ─────────────────────────────────────────────────────────────────────
const isBuild = process.argv.includes("build");
const rawPort = process.env.PORT || "5173";

const port = Number(rawPort);

if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── BASE_PATH ────────────────────────────────────────────────────────────────
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

    // ── PWA / Service Worker ───────────────────────────────────────────────────
    // In development, /public/sw.js is registered manually in main.tsx so the
    // offline-save-and-sync flow can be tested without a production build.
    // devOptions.enabled is therefore set to false to avoid a conflict.
    //
    // In production this plugin generates a full pre-cache manifest and injects
    // its own registration script into the HTML.  The generated SW:
    //   1. Pre-caches all compiled JS/CSS/HTML on first load (app shell)
    //   2. Caches API GET responses so existing data appears when offline
    //   3. Serves cached assets when the network is unavailable
    //   4. Falls back to index.html for any navigation request that misses
    //      cache, so React Router still controls SPA routing while offline
    //
    // Write operations (create client, etc.) are NOT intercepted by the SW —
    // they are queued in IndexedDB by the SyncProvider and replayed on reconnect.
    VitePWA({
      registerType: "autoUpdate",

      // Dev-mode SW is handled by /public/sw.js registered in main.tsx.
      // VitePWA only generates/registers the SW in production builds.
      devOptions: { enabled: false },

      includeAssets: ["icons/icon.svg"],

      manifest: {
        name:             "PixelStudio",
        short_name:       "PixelStudio",
        description:      "Photography studio management system",
        theme_color:      "#7c3aed",
        background_color: "#ffffff",
        display:          "standalone",
        scope:            "/",
        start_url:        "/",
        icons: [
          {
            src:     "icons/icon.svg",
            sizes:   "any",
            type:    "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },

      workbox: {
        // Pre-cache all compiled assets (JS chunks, CSS, fonts, icons)
        globPatterns: ["**/*.{js,css,html,svg,woff2,ico,png,webp}"],

        // SPA offline navigation: any page URL that isn't in the pre-cache
        // falls back to index.html so React Router handles it client-side.
        navigateFallback:         "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],

        runtimeCaching: [
          // ── API GET responses ──────────────────────────────────────────────
          // StaleWhileRevalidate: return cached data IMMEDIATELY (so the UI
          // appears even when offline), then update the cache in the background
          // once the network is available again.
          // Only GET requests are cached — write operations (POST/PATCH/DELETE)
          // are never intercepted; they either reach the server or get queued
          // in IndexedDB by the SyncProvider.
          {
            urlPattern: ({ url, request }) =>
              (url.pathname.startsWith("/api/clients")  ||
               url.pathname.startsWith("/api/gallery")  ||
               url.pathname.startsWith("/api/staff")    ||
               url.pathname.startsWith("/api/payments") ||
               url.pathname.startsWith("/api/dashboard")) &&
              request.method === "GET",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName:         "api-read-cache",
              expiration:        { maxEntries: 150, maxAgeSeconds: 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Uploaded client photos ─────────────────────────────────────────
          // CacheFirst: photos don't change after upload, so serve from cache
          // and only hit the network on a cache miss.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/"),
            handler:    "CacheFirst",
            options: {
              cacheName:         "uploads-cache",
              expiration:        { maxEntries: 500, maxAgeSeconds: 7 * 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),

    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
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
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

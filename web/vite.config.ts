import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Stable vendor chunks: libraries change far less often than app code, so splitting them
// lets returning users keep them cached across deploys. The charting stack is only pulled
// in by the pages that actually render charts (it is not part of the entry graph).
const CHART_LIBS = /node_modules\/(recharts|d3-[^/]+|victory-vendor|es-toolkit|decimal\.js-light|@reduxjs|react-redux|redux|reselect|immer|internmap|eventemitter3|tiny-invariant|clsx)\//;
const REACT_LIBS = /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//;

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (CHART_LIBS.test(id)) return "charts";
          if (REACT_LIBS.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "icons"; // one request instead of ~30 micro-chunks
          return undefined;
        },
      },
    },
  },
});

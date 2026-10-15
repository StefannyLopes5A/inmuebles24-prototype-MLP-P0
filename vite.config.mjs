import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { withNudgeUi } from "nudge-ui/vite";

export default withNudgeUi(defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
    exclude: ["maplibre-gl"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
}));

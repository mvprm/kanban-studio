import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // layout.tsx only loads fonts; the drag preview and drag handlers are covered by Playwright
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/app/layout.tsx"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "tests"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

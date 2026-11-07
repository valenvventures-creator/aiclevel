import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true, alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], exclude: ["**/*.int.test.ts", "node_modules/**"] },
      },
      {
        // Needs the Firebase emulators: run with `npm run test:integration`.
        resolve: { alias: { ...alias, "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) } },
        test: { name: "integration", environment: "node", include: ["src/**/*.int.test.ts", "tests/**/*.int.test.ts"], testTimeout: 20_000, pool: "forks", poolOptions: { forks: { singleFork: true } } },
      },
    ],
  },
});

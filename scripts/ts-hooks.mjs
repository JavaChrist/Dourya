/**
 * Lets plain Node (type stripping, Node >= 23.6) load the pure TypeScript
 * modules of src/: resolves the "@/" alias to src/ and the extensionless
 * relative imports to ".ts". Usage: node --import ./scripts/ts-hooks.mjs ...
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = new URL(spec.slice(2), src).href;
    const isRelative = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
    if (isRelative && !/\.[cm]?[jt]sx?$/.test(spec)) {
      const base = spec.startsWith("file:") ? spec : new URL(spec, context.parentURL).href;
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(fileURLToPath(base + ext))) return next(pathToFileURL(fileURLToPath(base + ext)).href, context);
      }
    }
    return next(spec, context);
  },
});

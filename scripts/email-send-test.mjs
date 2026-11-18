#!/usr/bin/env node
/**
 * DOURYA e-mail send test. Usage:
 *
 *   npm run email:test                                   dry run: config + render, nothing sent
 *   npm run email:test -- --only verify|reset            one template only
 *   npm run email:test -- --send --to <address>          real send through Resend, after a typed "oui"
 *
 * The environment is loaded like `next dev` does (local env files, never printed).
 * The script bundles scripts/lib/email-send-test.tsx with esbuild into
 * node_modules/.cache (git-ignored) so that the app's own templates and modules
 * are used, then deletes the bundle.
 */
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { loadEnvConfig } = require("@next/env");

const root = process.cwd();
loadEnvConfig(root, true, { info: () => {}, error: (...a) => console.error(...a) });

const dir = join(root, "node_modules", ".cache", "dourya");
const outfile = join(dir, `email-send-test-${process.pid}.mjs`);
mkdirSync(dir, { recursive: true });

let code = 1;
try {
  await build({
    entryPoints: [join(root, "scripts", "lib", "email-send-test.tsx")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    jsx: "automatic",
    packages: "external",
    tsconfig: join(root, "tsconfig.json"),
    logLevel: "error",
  });
  const { main } = await import(pathToFileURL(outfile).href);
  code = await main(process.argv.slice(2));
} catch (error) {
  // Only the message: never an object that could hold configuration values.
  console.error(`Échec du test d'e-mail : ${error instanceof Error ? error.message : "erreur inconnue"}`);
} finally {
  rmSync(outfile, { force: true });
}
process.exit(code);

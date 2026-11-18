import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const IMPORT = /(?:import|export)\s[^;]*?from\s+"([^"]+)"|import\s+"([^"]+)"/g;

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/** Every bare package imported, transitively, by a source file (type-only imports included, which is stricter). */
function packagesOf(entry: string): Set<string> {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const spec = m[1] ?? m[2];
      const local = resolve(file, spec);
      if (local) queue.push(local);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) packages.add(spec);
    }
  }
  return packages;
}

describe("Firebase Admin split", () => {
  it("keeps firebase-admin/auth out of the Resend webhook (ESM-only jose breaks it on Vercel)", () => {
    const packages = packagesOf(path.join(SRC, "app/api/webhooks/resend/route.ts"));
    expect(packages).toContain("firebase-admin/firestore");
    expect(packages).not.toContain("firebase-admin/auth");
  });

  it("keeps firebase-admin/auth out of the Firestore module", () => {
    expect(packagesOf(path.join(SRC, "lib/firebase/admin-db.ts"))).not.toContain("firebase-admin/auth");
  });
});

import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { getMetadata, ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-dourya", storage: { rules: readFileSync("storage.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadString(ref(ctx.storage(), "products/bougie.webp"), "img");
    await uploadString(ref(ctx.storage(), "private/facture.pdf"), "pdf");
  });
});
afterAll(() => env?.cleanup());

describe("storage.rules", () => {
  it("product images are public", async () => {
    await assertSucceeds(getMetadata(ref(env.unauthenticatedContext().storage(), "products/bougie.webp")));
  });

  it("other files are closed, even to a signed-in admin", async () => {
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), "private/facture.pdf")));
    await assertFails(getMetadata(ref(env.authenticatedContext("admin", { role: "admin" }).storage(), "private/facture.pdf")));
  });

  it("nobody uploads from the browser", async () => {
    await assertFails(uploadString(ref(env.unauthenticatedContext().storage(), "products/x.webp"), "x"));
    await assertFails(uploadString(ref(env.authenticatedContext("admin", { role: "admin" }).storage(), "products/x.webp"), "x"));
  });
});

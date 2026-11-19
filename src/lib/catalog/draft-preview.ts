import { TEST_PREVIEW_BRANCH } from "@/lib/checkout/test-preview";

/**
 * Draft preview of the catalogue, to check the real product photos before
 * publishing. Drafts are shown (with a "Brouillon" badge, never purchasable:
 * no price) only:
 * - on the Vercel preview of the `stripe-test` branch, or
 * - in local `next dev` (not on Vercel).
 * Production, other previews, local builds and tests never show them.
 * Pure (env passed in) so it can be unit-tested. Reads VERCEL_ENV,
 * VERCEL_GIT_COMMIT_REF, NODE_ENV.
 */
type Env = { readonly [key: string]: string | undefined };

export function isDraftPreview(env: Env): boolean {
  if (env.VERCEL_ENV === "preview") return env.VERCEL_GIT_COMMIT_REF === TEST_PREVIEW_BRANCH;
  return !env.VERCEL_ENV && env.NODE_ENV === "development";
}

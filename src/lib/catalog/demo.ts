/**
 * Demo content (isDemo: demo products, collections, home slides, Mail Club
 * text) is shown everywhere except on the production deployment (dourya.fr),
 * where it is removed: the demo product pages then return 404. Local dev,
 * builds, tests and every Vercel preview keep it.
 * Pure (env passed in) so it can be unit-tested. Reads VERCEL_ENV only.
 */
type Env = { readonly [key: string]: string | undefined };

export function isDemoShown(env: Env): boolean {
  return env.VERCEL_ENV !== "production";
}

/** The items as given when the demo is shown, else without the isDemo ones. */
export function withoutDemo<T extends { isDemo?: boolean }>(items: readonly T[], demoShown: boolean): T[] {
  return demoShown ? [...items] : items.filter((item) => !item.isDemo);
}

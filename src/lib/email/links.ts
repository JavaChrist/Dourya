/**
 * Firebase Admin generates links that point to the action handler configured in
 * the Firebase console (or to the emulator). Only the one-time code is kept and
 * the link is rebuilt on the DOURYA site, so the e-mails always open /auth/action,
 * whatever the console says. The continue URL is dropped: the page decides where
 * to go next (no open redirect).
 */
export const AUTH_ACTION_PATH = "/auth/action";

export type AuthActionMode = "verifyEmail" | "resetPassword";

const MODES: readonly AuthActionMode[] = ["verifyEmail", "resetPassword"];
const OOB_CODE = /^[A-Za-z0-9_-]{10,1024}$/;

export function isAuthActionMode(value: string | null | undefined): value is AuthActionMode {
  return MODES.includes(value as AuthActionMode);
}

export function isOobCode(value: string | null | undefined): value is string {
  return typeof value === "string" && OOB_CODE.test(value);
}

/** Returns the site link for a generated Firebase link, or null when it is not a usable action link. */
export function toSiteActionLink(generated: string, origin: string, expected: AuthActionMode): string | null {
  let url: URL;
  try {
    url = new URL(generated);
  } catch {
    return null;
  }
  const mode = url.searchParams.get("mode");
  const code = url.searchParams.get("oobCode");
  if (mode !== expected || !isOobCode(code)) return null;
  const link = new URL(AUTH_ACTION_PATH, origin);
  link.searchParams.set("mode", mode);
  link.searchParams.set("oobCode", code);
  return link.toString();
}

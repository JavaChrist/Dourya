/**
 * Helpers for the Firebase Auth emulator REST API (the same calls the browser SDK makes).
 * Only used by integration tests: the emulator host is set by `firebase emulators:exec`.
 */
export const PROJECT_ID = "demo-dourya";

function host(): string {
  const h = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!h) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is not set: run `npm run test:integration`.");
  return h;
}

const api = (path: string) => `http://${host()}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(api(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

export type Tokens = { idToken: string; localId: string };

export const signUp = (email: string, password: string) => post<Tokens>("accounts:signUp", { email, password, returnSecureToken: true });
export const signIn = (email: string, password: string) => post<Tokens>("accounts:signInWithPassword", { email, password, returnSecureToken: true });
export const sendVerifyEmail = (idToken: string) => post("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
export const sendPasswordReset = (email: string) => post("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email });
export const applyEmailVerification = (oobCode: string) => post("accounts:update", { oobCode });
export const resetPassword = (oobCode: string, newPassword: string) => post("accounts:resetPassword", { oobCode, newPassword });

type OobCode = { email: string; oobCode: string; requestType: string };

/** Last out-of-band code the emulator "sent" to this address (it does not send real e-mails). */
export async function lastOobCode(email: string, requestType: "VERIFY_EMAIL" | "PASSWORD_RESET"): Promise<string> {
  const res = await fetch(`http://${host()}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  const code = oobCodes.filter((c) => c.email === email && c.requestType === requestType).at(-1);
  if (!code) throw new Error(`No ${requestType} code for this address`);
  return code.oobCode;
}

export async function clearAuth(): Promise<void> {
  await fetch(`http://${host()}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
}

/** Revocation is stored with one-second precision: wait before and after revoking. */
export const nextSecond = () => new Promise((r) => setTimeout(r, 1100));

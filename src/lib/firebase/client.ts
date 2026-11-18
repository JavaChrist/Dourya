import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";
import { EMULATOR_PROJECT_ID, isPlaceholder } from "./shared";

/**
 * Firebase client SDK, used in the browser only to sign in and to send the
 * Firebase e-mails (verification, password reset). The session itself is a
 * server HttpOnly cookie: the client keeps no auth state (in-memory persistence).
 */
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

const config = emulatorHost
  ? { apiKey: "demo-key", authDomain: "localhost", projectId: EMULATOR_PROJECT_ID }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

export function isClientAuthConfigured(): boolean {
  return !!emulatorHost || (!isPlaceholder(config.apiKey) && !isPlaceholder(config.projectId));
}

let auth: Auth | undefined;

export function clientAuth(): Auth {
  if (auth) return auth;
  if (getApps().length > 0) {
    auth = getAuth(getApp());
  } else {
    const app = initializeApp(config);
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  }
  auth.languageCode = "fr";
  return auth;
}

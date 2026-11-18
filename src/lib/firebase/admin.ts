import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { EMULATOR_PROJECT_ID, isPlaceholder } from "./shared";

export class FirebaseConfigError extends Error {
  constructor() {
    super("Firebase Admin is not configured (see .env.example).");
    this.name = "FirebaseConfigError";
  }
}

function usesEmulators(): boolean {
  return !!(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
}

/** Firebase Admin, server only. Credentials come from server env vars, never from the client. */
function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (usesEmulators()) {
    if (process.env.VERCEL_ENV === "production") throw new Error("Firebase emulators cannot be used in production.");
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? EMULATOR_PROJECT_ID });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (isPlaceholder(projectId) || isPlaceholder(clientEmail) || isPlaceholder(privateKey)) throw new FirebaseConfigError();
  return initializeApp({ credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }), projectId });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());

#!/usr/bin/env node
/**
 * Admin role management. Usage:
 *
 *   npm run admin:role -- grant  <email>     give the admin role
 *   npm run admin:role -- revoke <email>     back to customer (sessions revoked)
 *   npm run admin:role -- show   <email>     show the current role
 *
 * Add --emulator to work on the local Firebase emulator (project demo-dourya).
 * Without it, the Admin SDK credentials are read from .env.local
 * (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY).
 * The script never prints a credential.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { setRole, showRole } from "./lib/admin-role.mjs";

const args = process.argv.slice(2);
const useEmulator = args.includes("--emulator");
const [command, email] = args.filter((a) => !a.startsWith("--"));

function usage(code = 1) {
  console.error("Usage: npm run admin:role -- <grant|revoke|show> <email> [--emulator]");
  process.exit(code);
}

if (!["grant", "revoke", "show"].includes(command) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage();

function init() {
  if (useEmulator) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-dourya" });
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-dourya" });
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Firebase Admin is not configured: fill FIREBASE_ADMIN_* in .env.local, or add --emulator.");
    process.exit(1);
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

const auth = getAuth(init());
const target = useEmulator || process.env.FIREBASE_AUTH_EMULATOR_HOST ? "emulator" : `project ${process.env.FIREBASE_ADMIN_PROJECT_ID}`;

try {
  if (command === "show") {
    const r = await showRole(auth, email);
    console.log(`[${target}] ${r.email}: role=${r.role}, email verified=${r.emailVerified ? "yes" : "no"}`);
  } else {
    const r = await setRole(auth, email, command === "grant" ? "admin" : "customer");
    console.log(
      r.changed
        ? `[${target}] ${r.email}: role is now ${r.role}. Open sessions were revoked; the user must sign in again.`
        : `[${target}] ${r.email}: already ${r.role}, nothing changed.`,
    );
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(code === "auth/user-not-found" ? "No account with this e-mail. The user must sign up first." : `Failed (${code}).`);
  process.exit(1);
}

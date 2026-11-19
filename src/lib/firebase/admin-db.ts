import "server-only";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreDatabaseId } from "@/lib/checkout/test-preview";
import { adminApp } from "./admin-app";

/**
 * Firestore Admin. Never imports firebase-admin/auth (see admin-app.ts).
 * Production always uses the "(default)" database; a preview may use the test
 * database `dourya-test` (FIRESTORE_DATABASE_ID), for every server read and
 * write (orders, stock, webhooks, rate limit, account data).
 */
export const adminDb = () => {
  const databaseId = firestoreDatabaseId(process.env);
  return databaseId ? getFirestore(adminApp(), databaseId) : getFirestore(adminApp());
};

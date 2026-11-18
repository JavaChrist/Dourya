import "server-only";
import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "./admin-app";

/** Firestore Admin. Never imports firebase-admin/auth (see admin-app.ts). */
export const adminDb = () => getFirestore(adminApp());

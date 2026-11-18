import "server-only";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "./admin-app";

/** Firebase Auth Admin (sessions, ID tokens, custom claims, action links). See admin-app.ts. */
export const adminAuth = () => getAuth(adminApp());

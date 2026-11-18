import "server-only";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { accountConfig } from "@/config/commerce";
import type { Order } from "@/lib/commerce-types";
import { adminDb } from "@/lib/firebase/admin";
import type { AddressInput } from "./validation";

/**
 * Account data, written by the server only (Admin SDK). Every function takes
 * the uid of the verified session: a customer can never pass another uid.
 *
 * users/{uid}                       profile, consents (no role: roles are custom claims)
 * users/{uid}/addresses/{id}        up to accountConfig.maxAddresses
 * orders/{id}                       customerUid set for account orders (Lot 4)
 * dataRequests/{id}                 export / deletion requests, handled by the admin
 */

export type Profile = {
  email: string;
  displayName: string;
  newsletter: { granted: boolean; updatedAt: string | null };
  createdAt: string | null;
};

export type SavedAddress = AddressInput & { id: string };

export type DataRequestType = "export" | "deletion";
export type DataRequest = {
  id: string;
  uid: string;
  email: string;
  type: DataRequestType;
  status: "pending" | "done";
  createdAt: string | null;
  handledAt: string | null;
};

function iso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

const users = () => adminDb().collection("users");

/** Creates the profile document on first sign-in (idempotent). */
export async function ensureProfile(uid: string, email: string): Promise<void> {
  const ref = users().doc(uid);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        email,
        displayName: "",
        consents: { newsletter: { granted: false, updatedAt: null } },
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (snap.get("email") !== email) {
      tx.update(ref, { email });
    }
  });
}

export async function getProfile(uid: string, email: string): Promise<Profile> {
  const data = (await users().doc(uid).get()).data() ?? {};
  return {
    email,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    newsletter: {
      granted: data.consents?.newsletter?.granted === true,
      updatedAt: iso(data.consents?.newsletter?.updatedAt),
    },
    createdAt: iso(data.createdAt),
  };
}

export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  await users().doc(uid).set({ displayName, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Consent is stored with its date (proof of consent). */
export async function setNewsletterConsent(uid: string, granted: boolean): Promise<void> {
  await users()
    .doc(uid)
    .set({ consents: { newsletter: { granted, updatedAt: FieldValue.serverTimestamp() } } }, { merge: true });
}

function toAddress(id: string, d: DocumentData): SavedAddress {
  return {
    id,
    ...(d.label ? { label: d.label } : {}),
    fullName: d.fullName,
    line1: d.line1,
    ...(d.line2 ? { line2: d.line2 } : {}),
    postalCode: d.postalCode,
    city: d.city,
    country: d.country,
  };
}

export async function listAddresses(uid: string): Promise<SavedAddress[]> {
  const snap = await users().doc(uid).collection("addresses").orderBy("createdAt").get();
  return snap.docs.map((d) => toAddress(d.id, d.data()));
}

export class AddressLimitError extends Error {}

export async function addAddress(uid: string, address: AddressInput): Promise<void> {
  const col = users().doc(uid).collection("addresses");
  await adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(col.limit(accountConfig.maxAddresses));
    if (existing.size >= accountConfig.maxAddresses) throw new AddressLimitError();
    tx.create(col.doc(), { ...address, createdAt: FieldValue.serverTimestamp() });
  });
}

/** Returns false when the address does not exist for this user. */
export async function updateAddress(uid: string, id: string, address: AddressInput): Promise<boolean> {
  const ref = users().doc(uid).collection("addresses").doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    tx.set(ref, { ...address, createdAt: snap.get("createdAt"), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function deleteAddress(uid: string, id: string): Promise<void> {
  await users().doc(uid).collection("addresses").doc(id).delete();
}

export type OrderSummary = Pick<Order, "id" | "status" | "totalCents"> & { createdAt: string | null; itemCount: number };

function toOrder(id: string, d: DocumentData): Order {
  return {
    id,
    customerUid: d.customerUid,
    email: d.email,
    lines: Array.isArray(d.lines) ? d.lines : [],
    shippingCents: d.shippingCents ?? 0,
    totalCents: d.totalCents ?? 0,
    status: d.status,
    shippingAddress: d.shippingAddress,
    createdAt: iso(d.createdAt) ?? "",
  };
}

export async function listOrders(uid: string): Promise<OrderSummary[]> {
  const snap = await adminDb().collection("orders").where("customerUid", "==", uid).orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map((doc) => {
    const o = toOrder(doc.id, doc.data());
    return { id: o.id, status: o.status, totalCents: o.totalCents, createdAt: o.createdAt || null, itemCount: o.lines.reduce((n, l) => n + l.quantity, 0) };
  });
}

/** Returns null when the order does not exist OR belongs to someone else (same answer: nothing is revealed). */
export async function getOrderForCustomer(uid: string, orderId: string): Promise<Order | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) return null;
  const snap = await adminDb().collection("orders").doc(orderId).get();
  if (!snap.exists || snap.get("customerUid") !== uid) return null;
  return toOrder(snap.id, snap.data()!);
}

const dataRequests = () => adminDb().collection("dataRequests");

function toDataRequest(id: string, d: DocumentData): DataRequest {
  return { id, uid: d.uid, email: d.email, type: d.type, status: d.status, createdAt: iso(d.createdAt), handledAt: iso(d.handledAt) };
}

/** One pending request per type and user: a second click does not duplicate it. */
export async function createDataRequest(uid: string, email: string, type: DataRequestType): Promise<"created" | "already_pending"> {
  const pending = await dataRequests().where("uid", "==", uid).where("type", "==", type).where("status", "==", "pending").limit(1).get();
  if (!pending.empty) return "already_pending";
  await dataRequests().add({ uid, email, type, status: "pending", createdAt: FieldValue.serverTimestamp() });
  return "created";
}

export async function listOwnDataRequests(uid: string): Promise<DataRequest[]> {
  const snap = await dataRequests().where("uid", "==", uid).orderBy("createdAt", "desc").limit(10).get();
  return snap.docs.map((d) => toDataRequest(d.id, d.data()));
}

/** Admin only (the caller checks the role). */
export async function listDataRequests(): Promise<DataRequest[]> {
  const snap = await dataRequests().orderBy("createdAt", "desc").limit(100).get();
  return snap.docs.map((d) => toDataRequest(d.id, d.data()));
}

/** Admin only (the caller checks the role). */
export async function markDataRequestDone(id: string, adminUid: string): Promise<boolean> {
  const ref = dataRequests().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ status: "done", handledAt: FieldValue.serverTimestamp(), handledBy: adminUid });
  return true;
}

function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

/** Everything stored about the user (GDPR right of access / portability). */
export async function exportUserData(uid: string, email: string) {
  const [profile, addresses, ordersSnap, requests] = await Promise.all([
    getProfile(uid, email),
    listAddresses(uid),
    adminDb().collection("orders").where("customerUid", "==", uid).get(),
    listOwnDataRequests(uid),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { uid, ...profile },
    addresses: addresses.map((a) => omit(a, "id")),
    orders: ordersSnap.docs.map((d) => toOrder(d.id, d.data())),
    dataRequests: requests.map((r) => omit(r, "uid")),
  };
}

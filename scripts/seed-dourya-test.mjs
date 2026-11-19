#!/usr/bin/env node
/**
 * Seeds the Firestore TEST database `dourya-test` with fictitious data for the
 * Stripe test preview (branch `stripe-test`):
 * - settings/shipping: one enabled zone (FR) and three test rates;
 * - inventory/<productId>__<variantId>: stock of the stocked demo variants.
 *
 * Always targets `dourya-test`, never "(default)". Existing inventory docs are
 * left as they are (they may hold reservations); settings/shipping is replaced.
 *
 * Usage: npm run seed:test            (writes)
 *        npm run seed:test -- --dry-run  (lists what would be written)
 * Credentials: FIREBASE_ADMIN_* from .env.local (never printed).
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const DATABASE_ID = "dourya-test";
const dryRun = process.argv.includes("--dry-run");

const shipping = {
  zones: [{ code: "FR", name: "France", enabled: true }],
  rates: [
    {
      id: "fr-lettre-test",
      enabled: true,
      zone: "FR",
      envelope: "standard",
      service: "letter",
      label: "Lettre (test)",
      carrier: "Transporteur test",
      priceCents: 150,
      packagingWeightGrams: 10,
      maxWeightGrams: 100,
      maxThicknessMm: 20,
      maxLengthMm: 324,
      maxWidthMm: 229,
      freeShippingEligible: false,
    },
    {
      id: "fr-lettre-suivie-test",
      enabled: true,
      zone: "FR",
      envelope: "bubble",
      service: "tracked",
      label: "Lettre suivie (test)",
      carrier: "Transporteur test",
      priceCents: 550,
      packagingWeightGrams: 20,
      maxWeightGrams: 500,
      maxThicknessMm: 30,
      maxLengthMm: 353,
      maxWidthMm: 250,
      freeShippingEligible: true,
    },
    {
      id: "fr-colis-suivi-test",
      enabled: true,
      zone: "FR",
      envelope: "cardboard",
      service: "tracked",
      label: "Colis suivi (test)",
      carrier: "Transporteur test",
      priceCents: 790,
      packagingWeightGrams: 80,
      maxWeightGrams: 2000,
      maxThicknessMm: 100,
      maxLengthMm: 450,
      maxWidthMm: 350,
      freeShippingEligible: true,
    },
  ],
  freeShippingThresholdCents: null,
};

/** Stocked demo variants (src/data/products.ts). */
const inventory = [
  { id: "demo-sticker__unit", stock: 3 },
  { id: "demo-planche-stickers__sheet", stock: 0 },
];

if (dryRun) {
  console.log(`[${DATABASE_ID}] settings/shipping: ${shipping.zones.length} zone(s), ${shipping.rates.length} rate(s)`);
  for (const i of inventory) console.log(`[${DATABASE_ID}] inventory/${i.id}: stock=${i.stock}, reserved=0 (only if missing)`);
  process.exit(0);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (process.env.FIRESTORE_EMULATOR_HOST || !projectId || !clientEmail || !privateKey) {
  console.error("Firebase Admin is not configured (FIREBASE_ADMIN_* in .env.local), or an emulator is set: nothing written.");
  process.exit(1);
}

const db = getFirestore(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }), DATABASE_ID);
const now = Timestamp.now();

try {
  await db.collection("settings").doc("shipping").set(shipping);
  console.log(`[${DATABASE_ID}] settings/shipping written`);
  for (const i of inventory) {
    const ref = db.collection("inventory").doc(i.id);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`[${DATABASE_ID}] inventory/${i.id} already exists, left as is`);
      continue;
    }
    await ref.create({ stock: i.stock, reserved: 0, updatedAt: now });
    console.log(`[${DATABASE_ID}] inventory/${i.id} created`);
  }
} catch (err) {
  // gRPC code only, never the raw message.
  console.error(`[${DATABASE_ID}] write failed, code=${err?.code ?? "unknown"}`);
  process.exit(1);
}

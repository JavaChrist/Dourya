#!/usr/bin/env node
/**
 * Imports the real DOURYA drafts (30 products from the 29 photo galleries, see
 * src/data/real-products.ts) into the stored catalogue of the TEST database
 * `dourya-test` (collection catalogProducts), for the catalogue admin on the
 * stripe-test preview.
 *
 * - Always `dourya-test`, never "(default)"; refused with an emulator set.
 * - Products already stored are skipped (admin edits are never overwritten);
 *   writes use create(), which fails rather than replace.
 * - Everything stays a draft; the WebP photos under /images/products/** are referenced.
 *
 * Usage: npm run catalog:import -- --dry-run   (prints the plan, writes nothing)
 *        npm run catalog:import                (writes)
 * Credentials: FIREBASE_ADMIN_* from .env.local (never printed). Errors: gRPC code only.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { realProducts } from "../src/data/real-products.ts";
import { planImport, toStoredProductDoc } from "../src/lib/catalog/import-plan.ts";

const DATABASE_ID = "dourya-test";
const COLLECTION = "catalogProducts";
const dryRun = process.argv.includes("--dry-run");

function connect() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\n/g, "\n");
  if (process.env.FIRESTORE_EMULATOR_HOST) return { error: "emulator-set" };
  if (!projectId || !clientEmail || !privateKey) return { error: "credentials-missing" };
  try {
    return { db: getFirestore(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }), DATABASE_ID) };
  } catch {
    return { error: "credentials-invalid" };
  }
}

const euros = (c) => (c === null ? "prix à fixer" : `${(c / 100).toFixed(2).replace(".", ",")} €`);

const { db, error } = connect();
let storedIds = new Set();
let readNote = "lecture de la base : OK";
if (db) {
  try {
    const snap = await db.collection(COLLECTION).select().get();
    storedIds = new Set(snap.docs.map((d) => d.id));
  } catch (err) {
    readNote = `lecture de la base impossible (code=${err?.code ?? "unknown"}) : plan calculé sur une base vide`;
    if (!dryRun) {
      console.error(`[${DATABASE_ID}] ${readNote}. Rien n'a été écrit.`);
      process.exit(1);
    }
  }
} else {
  readNote = `connexion impossible (${error}) : plan calculé sur une base vide`;
  if (!dryRun) {
    console.error(`[${DATABASE_ID}] ${readNote}. Rien n'a été écrit.`);
    process.exit(1);
  }
}

const plan = planImport(realProducts, storedIds);
console.log(`[${DATABASE_ID}/${COLLECTION}] ${dryRun ? "DRY-RUN, rien n'est écrit" : "IMPORT"} · ${readNote}`);
for (const [i, l] of plan.lines.entries()) {
  const cover = l.cover ? l.cover.split("/").slice(-2).join("/") : "aucune";
  console.log(`${String(i + 1).padStart(2)}. ${l.action === "create" ? "créer  " : "ignorer"} ${l.id.padEnd(36)} ${euros(l.priceCents).padStart(9)} · ${String(l.images).padStart(2)} photo(s) · ${l.categories.join(",")} · couverture ${cover}`);
}
console.log(`Total : ${plan.lines.length} fiche(s), ${plan.create} à créer, ${plan.skip} ignorée(s), statut brouillon.`);
if (plan.problems.length) {
  console.log("Points à vérifier :");
  for (const p of plan.problems) console.log(`- ${p}`);
}
if (plan.notes.length) {
  console.log("À noter (non bloquant) :");
  for (const n of plan.notes) console.log(`- ${n}`);
}
if (dryRun) process.exit(0);
if (plan.problems.length) {
  console.error("Points à vérifier : rien n'a été écrit.");
  process.exit(1);
}

const now = new Date().toISOString();
let written = 0;
for (const l of plan.lines.filter((x) => x.action === "create")) {
  const product = realProducts.find((p) => p.id === l.id);
  try {
    await db.collection(COLLECTION).doc(l.id).create(toStoredProductDoc(product, now));
    written++;
  } catch (err) {
    console.error(`[${DATABASE_ID}] ${l.id}: écriture refusée, code=${err?.code ?? "unknown"}`);
  }
}
console.log(`[${DATABASE_ID}] ${written} fiche(s) créée(s).`);

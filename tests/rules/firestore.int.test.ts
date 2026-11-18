import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import type { TokenOptions } from "@firebase/rules-unit-testing";

let env: RulesTestEnvironment;

const ALICE = { email: "alice@example.test", email_verified: true };
const BOB = { email: "bob@example.test", email_verified: true };
const ADMIN = { email: "admin@example.test", email_verified: true, role: "admin" };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-dourya", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { email: ALICE.email });
    await setDoc(doc(db, "users/alice/addresses/a1"), { city: "Paris" });
    await setDoc(doc(db, "users/bob"), { email: BOB.email });
    await setDoc(doc(db, "orders/o-alice"), { customerUid: "alice", totalCents: 1000 });
    await setDoc(doc(db, "orders/o-bob"), { customerUid: "bob", totalCents: 2000 });
    await setDoc(doc(db, "dataRequests/r1"), { uid: "alice", type: "deletion", status: "pending" });
    await setDoc(doc(db, "rateLimits/k1"), { count: 1 });
    await setDoc(doc(db, "emailLog/l1"), { type: "auth-verify-email", status: "sent" });
    await setDoc(doc(db, "emailSuppressions/h1"), { scope: "marketing", reason: "unsubscribe" });
    await setDoc(doc(db, "emailTemplates/auth-verify-email"), { enabled: true, subject: "Bonjour" });
  });
});

const as = (uid: string, claims: TokenOptions) => env.authenticatedContext(uid, claims).firestore();

describe("firestore.rules: profile and addresses", () => {
  it("a customer reads her own profile and addresses", async () => {
    await assertSucceeds(getDoc(doc(as("alice", ALICE), "users/alice")));
    await assertSucceeds(getDoc(doc(as("alice", ALICE), "users/alice/addresses/a1")));
  });

  it("a customer cannot read another customer's profile or addresses", async () => {
    await assertFails(getDoc(doc(as("bob", BOB), "users/alice")));
    await assertFails(getDoc(doc(as("bob", BOB), "users/alice/addresses/a1")));
  });

  it("an unverified account and a visitor read nothing", async () => {
    await assertFails(getDoc(doc(as("alice", { ...ALICE, email_verified: false }), "users/alice")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice")));
  });

  it("no client can write, not even the owner or an admin", async () => {
    await assertFails(setDoc(doc(as("alice", ALICE), "users/alice"), { email: "x" }));
    await assertFails(setDoc(doc(as("alice", ALICE), "users/alice"), { role: "admin" }));
    await assertFails(setDoc(doc(as("alice", ALICE), "users/alice/addresses/a2"), { city: "Lyon" }));
    await assertFails(setDoc(doc(as("admin", ADMIN), "users/alice"), { email: "x" }));
  });

  it("a fake role field in the profile does not give admin rights (only the token claim counts)", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users/bob"), { email: BOB.email, role: "admin" }));
    await assertFails(getDoc(doc(as("bob", BOB), "users/alice")));
  });
});

describe("firestore.rules: orders", () => {
  it("a customer reads her own order", async () => {
    await assertSucceeds(getDoc(doc(as("alice", ALICE), "orders/o-alice")));
  });

  it("reading another customer's order is refused", async () => {
    await assertFails(getDoc(doc(as("alice", ALICE), "orders/o-bob")));
  });

  it("listing is allowed only when limited to one's own orders", async () => {
    const db = as("alice", ALICE);
    await assertSucceeds(getDocs(query(collection(db, "orders"), where("customerUid", "==", "alice"))));
    await assertFails(getDocs(query(collection(db, "orders"), where("customerUid", "==", "bob"))));
    await assertFails(getDocs(collection(db, "orders")));
  });

  it("a customer cannot create or change an order", async () => {
    await assertFails(setDoc(doc(as("alice", ALICE), "orders/new"), { customerUid: "alice", totalCents: 1 }));
    await assertFails(setDoc(doc(as("alice", ALICE), "orders/o-alice"), { customerUid: "alice", totalCents: 1 }));
  });

  it("an admin reads every order", async () => {
    await assertSucceeds(getDoc(doc(as("admin", ADMIN), "orders/o-bob")));
    await assertSucceeds(getDocs(collection(as("admin", ADMIN), "orders")));
  });
});

describe("firestore.rules: server-only collections", () => {
  it("customers cannot read GDPR requests or rate-limit counters", async () => {
    await assertFails(getDoc(doc(as("alice", ALICE), "dataRequests/r1")));
    await assertFails(getDoc(doc(as("alice", ALICE), "rateLimits/k1")));
    await assertFails(setDoc(doc(as("alice", ALICE), "dataRequests/r2"), { uid: "alice" }));
  });

  it("an admin reads GDPR requests but not rate-limit counters", async () => {
    await assertSucceeds(getDoc(doc(as("admin", ADMIN), "dataRequests/r1")));
    await assertFails(getDoc(doc(as("admin", ADMIN), "rateLimits/k1")));
  });

  it("e-mail collections are closed to customers and admins (server only)", async () => {
    for (const path of ["emailLog/l1", "emailSuppressions/h1", "emailTemplates/auth-verify-email"]) {
      await assertFails(getDoc(doc(as("alice", ALICE), path)));
      await assertFails(getDoc(doc(as("admin", ADMIN), path)));
      await assertFails(setDoc(doc(as("admin", ADMIN), path), { a: 1 }));
    }
    await assertFails(setDoc(doc(as("alice", ALICE), "emailSuppressions/h2"), { reason: "unsubscribe" }));
  });

  it("an unknown collection is closed", async () => {
    await assertFails(getDoc(doc(as("admin", ADMIN), "anything/x")));
    await assertFails(setDoc(doc(as("alice", ALICE), "anything/x"), { a: 1 }));
  });
});

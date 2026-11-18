import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  addAddress,
  AddressLimitError,
  createDataRequest,
  exportUserData,
  getOrderForCustomer,
  listAddresses,
  listDataRequests,
  listOrders,
  listOwnDataRequests,
  markDataRequestDone,
} from "@/lib/account/repository";
import { adminDb } from "@/lib/firebase/admin-db";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { FirestoreRateLimitStore } from "@/lib/security/firestore-rate-limit-store";

const host = () => process.env.FIRESTORE_EMULATOR_HOST;

beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
  const orders = adminDb().collection("orders");
  await orders.doc("o-alice").set({ customerUid: "alice", status: "paid", totalCents: 1500, items: [], createdAt: Timestamp.now() });
  await orders.doc("o-bob").set({ customerUid: "bob", status: "paid", totalCents: 900, items: [], createdAt: Timestamp.now() });
});

const address = { label: "", fullName: "Alice Martin", line1: "1 rue de la Paix", line2: "", postalCode: "75002", city: "Paris", country: "FR" };

describe("orders: a customer sees only her own", () => {
  it("lists only her orders", async () => {
    expect((await listOrders("alice")).map((o) => o.id)).toEqual(["o-alice"]);
  });

  it("reading another customer's order returns nothing (the page answers 404)", async () => {
    expect(await getOrderForCustomer("alice", "o-bob")).toBeNull();
    expect(await getOrderForCustomer("alice", "inexistante")).toBeNull();
    expect((await getOrderForCustomer("alice", "o-alice"))?.id).toBe("o-alice");
  });

  it("the export contains only the user's data", async () => {
    const data = await exportUserData("alice", "alice@example.test");
    expect(data.orders.map((o) => o.id)).toEqual(["o-alice"]);
    expect(JSON.stringify(data)).not.toContain("o-bob");
  });
});

describe("addresses", () => {
  it("stops at the configured maximum", async () => {
    for (let i = 0; i < 5; i++) await addAddress("alice", address);
    await expect(addAddress("alice", address)).rejects.toBeInstanceOf(AddressLimitError);
    expect(await listAddresses("alice")).toHaveLength(5);
    expect(await listAddresses("bob")).toHaveLength(0);
  });
});

describe("GDPR requests", () => {
  it("one pending request per type, handled by an admin", async () => {
    expect(await createDataRequest("alice", "alice@example.test", "deletion")).toBe("created");
    expect(await createDataRequest("alice", "alice@example.test", "deletion")).toBe("already_pending");
    expect(await listOwnDataRequests("bob")).toHaveLength(0);

    const [request] = await listDataRequests();
    expect(await markDataRequestDone(request.id, "admin-uid")).toBe(true);
    expect((await listOwnDataRequests("alice"))[0].status).toBe("done");
    expect(await createDataRequest("alice", "alice@example.test", "deletion")).toBe("created");
  });
});

describe("rate limit in Firestore", () => {
  it("counts per key and refuses past the limit", async () => {
    const store = new FirestoreRateLimitStore();
    const rule = { limit: 2, windowMs: 60_000 };
    const now = Date.now();
    expect((await checkRateLimit(store, "session:customer", "ip-1", rule, now)).allowed).toBe(true);
    expect((await checkRateLimit(store, "session:customer", "ip-1", rule, now)).allowed).toBe(true);
    expect((await checkRateLimit(store, "session:customer", "ip-1", rule, now)).allowed).toBe(false);
    expect((await checkRateLimit(store, "session:customer", "ip-2", rule, now)).allowed).toBe(true);
    // The stored key is hashed: no IP in clear.
    const ids = (await adminDb().collection("rateLimits").get()).docs.map((d) => d.id);
    expect(ids.every((id) => /^[a-f0-9]{64}$/.test(id))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { OrderLineSnapshot } from "@/lib/orders/types";
import { addDays, canMoveTo, cleanName, isEmail, isLiveOrder, isOrderRef, orderEligibility, ownsOrder, selectLines } from "./eligibility";

// Fictitious data only.
const line = (over: Partial<OrderLineSnapshot> = {}): OrderLineSnapshot => ({
  productId: "p1",
  variantId: "v1",
  sku: "TEST-1",
  productName: "Produit test",
  variantName: "A5",
  unitPriceCents: 1000,
  quantity: 1,
  lineTotalCents: 1000,
  stockMode: "stocked",
  ...over,
});
const order = { customerUid: "uid_a", email: "Client@Example.test", paymentStatus: "paid" as const };

describe("ownsOrder", () => {
  it("accepts the same account or the same e-mail (any case, spaces)", () => {
    expect(ownsOrder(order, { uid: "uid_a" })).toBe(true);
    expect(ownsOrder(order, { email: "  client@example.TEST " })).toBe(true);
    expect(ownsOrder({ customerUid: null, email: "guest@example.test" }, { email: "guest@example.test" })).toBe(true);
  });
  it("refuses another account or another e-mail", () => {
    expect(ownsOrder(order, { uid: "uid_b" })).toBe(false);
    expect(ownsOrder(order, { email: "autre@example.test" })).toBe(false);
    expect(ownsOrder({ customerUid: null, email: "guest@example.test" }, { uid: "uid_a" })).toBe(false);
    expect(ownsOrder(order, {})).toBe(false);
  });
});

describe("orderEligibility", () => {
  it("accepts a paid or partially refunded order of the requester", () => {
    expect(orderEligibility(order, { uid: "uid_a" })).toBeNull();
    expect(orderEligibility({ ...order, paymentStatus: "partially_refunded" }, { uid: "uid_a" })).toBeNull();
  });
  it("gives the same answer for a missing order and someone else's order", () => {
    expect(orderEligibility(null, { uid: "uid_a" })).toBe("not_found");
    expect(orderEligibility(order, { email: "autre@example.test" })).toBe("not_found");
  });
  it("refuses an unpaid or refunded order", () => {
    for (const s of ["draft", "awaiting_payment", "cancelled", "expired", "failed"] as const) {
      expect(orderEligibility({ ...order, paymentStatus: s }, { uid: "uid_a" })).toBe("not_paid");
    }
    expect(orderEligibility({ ...order, paymentStatus: "refunded" }, { uid: "uid_a" })).toBe("refunded");
  });
});

describe("selectLines", () => {
  const lines = [line(), line({ productName: "Headband", personalisation: { label: "Prénom", text: "Léa", surchargeCents: 0 } })];
  it("keeps the picked lines and flags personalised items", () => {
    expect(selectLines(lines, ["1"])).toEqual([{ index: 1, productName: "Headband", variantName: "A5", quantity: 1, personalised: true }]);
    expect(selectLines(lines, ["0", "1", "0"])?.map((l) => l.index)).toEqual([0, 1]);
    expect(selectLines([line({ stockMode: "made_to_order" })], ["0"])?.[0].personalised).toBe(false);
  });
  it("refuses an empty pick or an index outside the order", () => {
    expect(selectLines(lines, [])).toBeNull();
    expect(selectLines(lines, ["2"])).toBeNull();
    expect(selectLines(lines, ["-1"])).toBeNull();
    expect(selectLines(lines, ["1.5"])).toBeNull();
    expect(selectLines(lines, ["abc"])).toBeNull();
  });
});

describe("inputs", () => {
  it("validates the order number, the e-mail and the name", () => {
    expect(isOrderRef("AbC_12-x")).toBe(true);
    expect(isOrderRef("a/b")).toBe(false);
    expect(isOrderRef("")).toBe(false);
    expect(isEmail("client@example.test")).toBe(true);
    expect(isEmail("pas-un-email")).toBe(false);
    expect(cleanName("  Client   Test ")).toBe("Client Test");
    expect(cleanName("x")).toBeNull();
    expect(cleanName("<b>x</b>")).toBeNull();
    expect(cleanName("a".repeat(81))).toBeNull();
  });
});

describe("helpers", () => {
  it("marks Stripe test orders as TEST", () => {
    expect(isLiveOrder({ paymentRef: "cs_test_1" })).toBe(false);
    expect(isLiveOrder({ paymentRef: "cs_live_1" })).toBe(true);
  });
  it("adds days and allows only the forward admin moves", () => {
    expect(addDays("2026-11-20T10:00:00.000Z", 14)).toBe("2026-12-04T10:00:00.000Z");
    expect(canMoveTo("received", "refunded")).toBe(true);
    expect(canMoveTo("received", "closed")).toBe(true);
    expect(canMoveTo("refunded", "closed")).toBe(true);
    expect(canMoveTo("closed", "received")).toBe(false);
    expect(canMoveTo("refunded", "received")).toBe(false);
    expect(canMoveTo("closed", "refunded")).toBe(false);
  });
});

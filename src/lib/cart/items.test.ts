import { describe, expect, it } from "vitest";
import { CART_LIMITS, lineKey, mergeCarts, sanitizeCartItems } from "./items";

describe("sanitizeCartItems", () => {
  it("keeps only ids, quantity and personalisation", () => {
    const [item] = sanitizeCartItems([{ productId: "p1", variantId: "v1", quantity: 2, priceCents: 1, evil: true }]);
    expect(item).toEqual({ productId: "p1", variantId: "v1", quantity: 2 });
  });

  it("skips malformed entries and unsafe ids", () => {
    expect(
      sanitizeCartItems([null, 3, "x", { productId: "../etc", variantId: "v", quantity: 1 }, { productId: "p", quantity: 1 }]),
    ).toEqual([]);
  });

  it("combines duplicate lines and caps quantities", () => {
    const items = sanitizeCartItems([
      { productId: "p1", variantId: "v1", quantity: 2 },
      { productId: "p1", variantId: "v1", quantity: 3 },
      { productId: "p2", variantId: "v1", quantity: 1000 },
    ]);
    expect(items).toEqual([
      { productId: "p1", variantId: "v1", quantity: 5 },
      { productId: "p2", variantId: "v1", quantity: CART_LIMITS.maxQuantity },
    ]);
  });

  it("keeps different personalisations as separate lines", () => {
    const items = sanitizeCartItems([
      { productId: "p1", variantId: "v1", quantity: 1, personalisation: "Léa" },
      { productId: "p1", variantId: "v1", quantity: 1, personalisation: " Léa " },
      { productId: "p1", variantId: "v1", quantity: 1, personalisation: "Max" },
    ]);
    expect(items.map((i) => [i.personalisation, i.quantity])).toEqual([
      ["Léa", 2],
      ["Max", 1],
    ]);
  });

  it("limits the number of lines", () => {
    const many = Array.from({ length: CART_LIMITS.maxLines + 10 }, (_, i) => ({ productId: `p${i}`, variantId: "v", quantity: 1 }));
    expect(sanitizeCartItems(many)).toHaveLength(CART_LIMITS.maxLines);
  });
});

describe("lineKey", () => {
  it("ignores spacing differences in the personalisation", () => {
    expect(lineKey({ productId: "p", variantId: "v", personalisation: " Léa  M " })).toBe(lineKey({ productId: "p", variantId: "v", personalisation: "Léa M" }));
  });
});

describe("mergeCarts", () => {
  const account = [
    { productId: "p1", variantId: "v1", quantity: 2 },
    { productId: "p2", variantId: "v1", quantity: 1 },
  ];
  const guest = [
    { productId: "p1", variantId: "v1", quantity: 3 },
    { productId: "p3", variantId: "v1", quantity: 1 },
  ];

  it("keeps every line and the highest quantity of shared lines", () => {
    expect(mergeCarts(account, guest)).toEqual([
      { productId: "p1", variantId: "v1", quantity: 3 },
      { productId: "p2", variantId: "v1", quantity: 1 },
      { productId: "p3", variantId: "v1", quantity: 1 },
    ]);
  });

  it("is idempotent: merging again changes nothing", () => {
    const once = mergeCarts(account, guest);
    expect(mergeCarts(once, guest)).toEqual(once);
    expect(mergeCarts(once, once)).toEqual(once);
  });

  it("survives invalid inputs", () => {
    expect(mergeCarts(undefined, guest)).toEqual(sanitizeCartItems(guest));
    expect(mergeCarts(account, "oops")).toEqual(sanitizeCartItems(account));
  });
});

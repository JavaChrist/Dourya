import { describe, expect, it } from "vitest";
import { products as demoProducts } from "@/data/products";
import { priceCart } from "./pricing";
import { product, variant } from "@/test/factories";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const opts = { now: NOW, checkoutEnabled: true, defaultMaxQuantityPerLine: 10 };

describe("priceCart: server-side prices", () => {
  it("ignores any price or total sent by the browser", () => {
    const cart = priceCart(
      [{ productId: "p1", variantId: "v1", quantity: 2, priceCents: 1, unitPriceCents: 1, lineTotalCents: 2 }],
      [product()],
      opts,
    );
    expect(cart.lines[0].unitPriceCents).toBe(1000);
    expect(cart.lines[0].lineTotalCents).toBe(2000);
    expect(cart.subtotalCents).toBe(2000);
    expect(cart.itemCount).toBe(2);
  });

  it("rejects input that is not a cart", () => {
    expect(priceCart("hack", [product()], opts).lines).toEqual([]);
    expect(priceCart({ items: [] }, [product()], opts).lines).toEqual([]);
  });

  it("prices each variant with its own price", () => {
    const p = product({ variants: [variant({ id: "a5", priceCents: 1000 }), variant({ id: "a3", priceCents: 2500 })] });
    const cart = priceCart(
      [
        { productId: "p1", variantId: "a5", quantity: 1 },
        { productId: "p1", variantId: "a3", quantity: 2 },
      ],
      [p],
      opts,
    );
    expect(cart.lines.map((l) => l.unitPriceCents)).toEqual([1000, 2500]);
    expect(cart.subtotalCents).toBe(6000);
  });

  it("shows the photo of the chosen model, else the cover", () => {
    const images = [1, 2, 3].map((n) => ({ src: `/p/${n}.jpg`, alt: `Photo ${n}`, width: 800, height: 800 }));
    const p = product({
      images,
      variants: [variant({ id: "m1", imageSrc: "/p/1.jpg" }), variant({ id: "m3", imageSrc: "/p/3.jpg" }), variant({ id: "m9", imageSrc: "/elsewhere.jpg" }), variant({ id: "plain" })],
    });
    const cart = priceCart(
      ["m3", "m1", "m9", "plain"].map((variantId) => ({ productId: "p1", variantId, quantity: 1 })),
      [p],
      opts,
    );
    expect(cart.lines.map((l) => l.image?.src)).toEqual(["/p/3.jpg", "/p/1.jpg", "/p/1.jpg", "/p/1.jpg"]);
  });

  it("reports unknown, inactive and unpriced variants as unavailable", () => {
    const p = product({ variants: [variant({ id: "off", active: false }), variant({ id: "tbd", priceCents: null })] });
    const cart = priceCart(
      [
        { productId: "p1", variantId: "nope", quantity: 1 },
        { productId: "p1", variantId: "off", quantity: 1 },
        { productId: "p1", variantId: "tbd", quantity: 1 },
      ],
      [p],
      opts,
    );
    expect(cart.lines.every((l) => l.status === "unavailable" && l.unitPriceCents === null)).toBe(true);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.hasBlockingIssue).toBe(true);
    expect(cart.checkoutAllowed).toBe(false);
  });

  it("refuses products that are not published or not listed", () => {
    const cart = priceCart(
      [
        { productId: "draft", variantId: "v1", quantity: 1 },
        { productId: "old", variantId: "v1", quantity: 1 },
        { productId: "ghost", variantId: "v1", quantity: 1 },
      ],
      [product({ id: "draft", status: "draft" }), product({ id: "old", status: "archived" })],
      opts,
    );
    expect(cart.lines.map((l) => l.status)).toEqual(["unavailable", "unavailable", "unavailable"]);
  });
});

describe("priceCart: stock and quantities", () => {
  const stocked = () => product({ variants: [variant({ stockMode: "stocked", stock: 3 })] });

  it("lowers the quantity to the stock left", () => {
    const line = priceCart([{ productId: "p1", variantId: "v1", quantity: 5 }], [stocked()], opts).lines[0];
    expect(line.status).toBe("adjusted");
    expect(line.quantity).toBe(3);
    expect(line.maxQuantity).toBe(3);
  });

  it("marks an out-of-stock variant as unavailable", () => {
    const p = product({ variants: [variant({ stockMode: "stocked", stock: 0 })] });
    const line = priceCart([{ productId: "p1", variantId: "v1", quantity: 1 }], [p], opts).lines[0];
    expect(line.status).toBe("unavailable");
    expect(line.message).toBe("Rupture de stock.");
  });

  it("shares the stock between lines of the same variant", () => {
    const p = product({
      variants: [variant({ stockMode: "stocked", stock: 3 })],
      personalisation: { enabled: true, label: "Prénom", maxLength: 12, surchargeCents: 200 },
    });
    const cart = priceCart(
      [
        { productId: "p1", variantId: "v1", quantity: 2 },
        { productId: "p1", variantId: "v1", quantity: 2, personalisation: "Léa" },
      ],
      [p],
      opts,
    );
    expect(cart.lines.map((l) => l.quantity)).toEqual([2, 1]);
    expect(cart.itemCount).toBe(3);
  });

  it("applies the per-line cap (product, then default)", () => {
    const capped = product({ id: "c", maxQuantityPerLine: 5 });
    const free = product({ id: "f" });
    const cart = priceCart(
      [
        { productId: "c", variantId: "v1", quantity: 9 },
        { productId: "f", variantId: "v1", quantity: 40 },
      ],
      [capped, free],
      opts,
    );
    expect(cart.lines.map((l) => l.quantity)).toEqual([5, 10]);
  });

  it("drops zero, negative and non-numeric quantities and floors decimals", () => {
    const cart = priceCart(
      [
        { productId: "p1", variantId: "v1", quantity: 0 },
        { productId: "p1", variantId: "v1", quantity: -3 },
        { productId: "p1", variantId: "v1", quantity: "4" },
        { productId: "p1", variantId: "v1", quantity: 2.9 },
      ],
      [product()],
      opts,
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);
  });
});

describe("priceCart: personalisation", () => {
  const withPerso = (over = {}) =>
    product({ personalisation: { enabled: true, label: "Prénom", maxLength: 12, surchargeCents: 200, ...over } });
  const item = (text: string, quantity = 1) => [{ productId: "p1", variantId: "v1", quantity, personalisation: text }];

  it("is refused when the product has none (disabled by default)", () => {
    const line = priceCart(item("Léa"), [product()], opts).lines[0];
    expect(line.status).toBe("invalid");
  });

  it("adds the surcharge and keeps a snapshot", () => {
    const line = priceCart(item("  Léa   Marie "), [withPerso()], opts).lines[0];
    expect(line.status).toBe("ok");
    expect(line.unitPriceCents).toBe(1200);
    expect(line.personalisation).toEqual({ label: "Prénom", text: "Léa Marie", surchargeCents: 200 });
  });

  it("is refused when disabled", () => {
    expect(priceCart(item("Léa"), [withPerso({ enabled: false })], opts).lines[0].status).toBe("invalid");
  });

  it("respects the availability window", () => {
    const before = withPerso({ availableFrom: "2026-12-01T00:00:00.000Z" });
    const after = withPerso({ availableUntil: "2026-11-01T00:00:00.000Z" });
    const inside = withPerso({ availableFrom: "2026-11-01T00:00:00.000Z", availableUntil: "2026-12-01T00:00:00.000Z" });
    expect(priceCart(item("Léa"), [before], opts).lines[0].status).toBe("invalid");
    expect(priceCart(item("Léa"), [after], opts).lines[0].status).toBe("invalid");
    expect(priceCart(item("Léa"), [inside], opts).lines[0].status).toBe("ok");
  });

  it("respects the variant restriction", () => {
    const line = priceCart(item("Léa"), [withPerso({ variantIds: ["other"] })], opts).lines[0];
    expect(line.status).toBe("invalid");
  });

  it("checks the length and the allowed characters", () => {
    expect(priceCart(item("Abcdefghijklm"), [withPerso()], opts).lines[0].status).toBe("invalid");
    expect(priceCart(item("<script>"), [withPerso()], opts).lines[0].status).toBe("invalid");
    expect(priceCart(item("Zoé & Max !"), [withPerso()], opts).lines[0].status).toBe("ok");
  });

  it("applies the quota across lines", () => {
    const p = withPerso({ quota: 3, quotaUsed: 1 });
    const cart = priceCart(
      [
        { productId: "p1", variantId: "v1", quantity: 1, personalisation: "Léa" },
        { productId: "p1", variantId: "v1", quantity: 5, personalisation: "Max" },
        { productId: "p1", variantId: "v1", quantity: 1, personalisation: "Tom" },
      ],
      [p],
      opts,
    );
    expect(cart.lines.map((l) => l.quantity)).toEqual([1, 1, 0]);
    expect(cart.lines[2].message).toContain("personnalisation");
  });
});

describe("priceCart: checkout", () => {
  it("is allowed only for real products when checkout is enabled", () => {
    const items = [{ productId: "p1", variantId: "v1", quantity: 1 }];
    expect(priceCart(items, [product()], opts).checkoutAllowed).toBe(true);
    expect(priceCart(items, [product()], { ...opts, checkoutEnabled: false }).checkoutAllowed).toBe(false);
    expect(priceCart([], [product()], opts).checkoutAllowed).toBe(false);
  });

  it("is never allowed with demo products", () => {
    const cart = priceCart([{ productId: "demo-print-a5", variantId: "a5", quantity: 1 }], demoProducts, opts);
    expect(cart.lines[0].status).toBe("ok");
    expect(cart.hasDemo).toBe(true);
    expect(cart.checkoutAllowed).toBe(false);
  });

  it("allows demo products only when the test preview says so", () => {
    const items = [{ productId: "demo-print-a5", variantId: "a5", quantity: 1 }];
    expect(priceCart(items, demoProducts, { ...opts, allowDemo: true }).checkoutAllowed).toBe(true);
    expect(priceCart(items, demoProducts, { ...opts, checkoutEnabled: false, allowDemo: true }).checkoutAllowed).toBe(false);
  });

  it("is blocked by a line in error", () => {
    const cart = priceCart(
      [
        { productId: "p1", variantId: "v1", quantity: 1 },
        { productId: "gone", variantId: "v1", quantity: 1 },
      ],
      [product()],
      opts,
    );
    expect(cart.subtotalCents).toBe(1000);
    expect(cart.checkoutAllowed).toBe(false);
  });
});

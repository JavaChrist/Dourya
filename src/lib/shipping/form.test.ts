import { describe, expect, it } from "vitest";
import { centsToEuros, eurosToCents, parseShippingForm } from "./form";

function rateFields(k: string, over: Record<string, string> = {}): Record<string, string> {
  return {
    [`${k}.id`]: "fr-suivi",
    [`${k}.zone`]: "FR",
    [`${k}.envelope`]: "bubble",
    [`${k}.service`]: "tracked",
    [`${k}.label`]: "Lettre suivie",
    [`${k}.carrier`]: "La Poste",
    [`${k}.price`]: "4,50",
    [`${k}.packagingWeight`]: "15",
    [`${k}.maxWeight`]: "250",
    [`${k}.maxThickness`]: "30",
    [`${k}.maxLength`]: "330",
    [`${k}.maxWidth`]: "240",
    [`${k}.enabled`]: "on",
    ...over,
  };
}

function formOf(fields: Record<string, string>, keys: string[] = []): FormData {
  const f = new FormData();
  for (const k of keys) f.append("rateKey", k);
  for (const [name, value] of Object.entries(fields)) f.append(name, value);
  return f;
}

describe("eurosToCents", () => {
  it("reads comma and dot decimals", () => {
    expect(eurosToCents("4,50")).toBe(450);
    expect(eurosToCents("4.5")).toBe(450);
    expect(eurosToCents("12")).toBe(1200);
    expect(eurosToCents("0")).toBe(0);
  });
  it("refuses what is not a price", () => {
    for (const bad of ["", "-1", "4,505", "abc", "1e3", "4,", "99999,99"]) expect(eurosToCents(bad)).toBeNull();
  });
  it("round-trips with centsToEuros", () => {
    expect(centsToEuros(450)).toBe("4,50");
    expect(centsToEuros(5)).toBe("0,05");
    expect(eurosToCents(centsToEuros(1299))).toBe(1299);
  });
});

describe("parseShippingForm", () => {
  it("reads zones, a rate and the threshold", () => {
    const r = parseShippingForm(formOf({ "zone.FR": "on", freeShippingThreshold: "50", ...rateFields("rate-a", { "rate-a.free": "on" }) }, ["rate-a"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.zones.find((z) => z.code === "FR")?.enabled).toBe(true);
    expect(r.value.zones.filter((z) => z.enabled)).toHaveLength(1);
    expect(r.value.freeShippingThresholdCents).toBe(5000);
    expect(r.value.rates).toEqual([
      {
        id: "fr-suivi",
        enabled: true,
        zone: "FR",
        envelope: "bubble",
        service: "tracked",
        label: "Lettre suivie",
        carrier: "La Poste",
        priceCents: 450,
        packagingWeightGrams: 15,
        maxWeightGrams: 250,
        maxThicknessMm: 30,
        maxLengthMm: 330,
        maxWidthMm: 240,
        freeShippingEligible: true,
      },
    ]);
  });

  it("empty threshold means no free shipping; no rate is fine", () => {
    const r = parseShippingForm(formOf({ freeShippingThreshold: "" }));
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ rates: [], freeShippingThresholdCents: null }) });
    if (r.ok) expect(r.value.zones.every((z) => !z.enabled)).toBe(true);
  });

  it("flags each invalid field of a rate, in French", () => {
    const r = parseShippingForm(
      formOf(rateFields("rate-a", { "rate-a.price": "4,555", "rate-a.label": "", "rate-a.maxWeight": "0", "rate-a.envelope": "box" }), ["rate-a"]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["rate-a.envelope", "rate-a.label", "rate-a.maxWeight", "rate-a.price"]);
    expect(r.errors["rate-a.price"]).toMatch(/euros/);
  });

  it("refuses a rate in an unknown zone", () => {
    const r = parseShippingForm(formOf(rateFields("rate-a", { "rate-a.zone": "DE" }), ["rate-a"]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["rate-a.zone"]).toBeDefined();
  });

  it("refuses two rates with the same id", () => {
    const r = parseShippingForm(formOf({ ...rateFields("rate-a"), ...rateFields("rate-b") }, ["rate-a", "rate-b"]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(["rate-b.id"]);
  });

  it("refuses a zero or invalid threshold and tampered rate keys", () => {
    const zero = parseShippingForm(formOf({ freeShippingThreshold: "0" }));
    expect(zero.ok).toBe(false);
    const keys = parseShippingForm(formOf({}, ["../x"]));
    expect(keys.ok).toBe(false);
    if (!keys.ok) expect(keys.errors.rates).toBeDefined();
  });

  it("keeps an unchecked rate disabled", () => {
    const r = parseShippingForm(formOf(rateFields("rate-a", { "rate-a.enabled": "" }), ["rate-a"]));
    expect(r.ok && r.value.rates[0].enabled).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { defaultShippingSettings } from "@/config/shipping";
import { adminDb } from "@/lib/firebase/admin-db";
import { getShippingSettings, saveShippingSettings, shippingSettingsUpdatedAt } from "@/lib/orders/repository";
import type { ShippingRate, ShippingSettings } from "@/lib/shipping/types";

// Fictitious rate on the emulators only: no real price is stored anywhere.
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
beforeEach(async () => {
  await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });
});

const rate: ShippingRate = {
  id: "rtest1",
  enabled: true,
  zone: "FR",
  envelope: "bubble",
  service: "tracked",
  label: "Tarif test",
  priceCents: 123,
  packagingWeightGrams: 10,
  maxWeightGrams: 100,
  maxThicknessMm: 20,
  maxLengthMm: 200,
  maxWidthMm: 150,
  freeShippingEligible: false,
};

const settings: ShippingSettings = { zones: defaultShippingSettings.zones, rates: [rate], freeShippingThresholdCents: 4000 };

describe("saveShippingSettings", () => {
  it("saves the whole document, reads it back, records who and when", async () => {
    expect(await shippingSettingsUpdatedAt()).toBeNull();
    await saveShippingSettings(settings, "admin-test", new Date("2026-11-20T10:00:00Z"));
    expect(await getShippingSettings()).toEqual(settings);
    expect(await shippingSettingsUpdatedAt()).toBe("2026-11-20T10:00:00.000Z");
    const doc = (await adminDb().collection("settings").doc("shipping").get()).data();
    expect(doc?.updatedBy).toBe("admin-test");
  });

  it("replaces previous rates instead of merging them", async () => {
    await saveShippingSettings(settings, "admin-test");
    await saveShippingSettings({ ...settings, rates: [], freeShippingThresholdCents: null }, "admin-test");
    const read = await getShippingSettings();
    expect(read.rates).toEqual([]);
    expect(read.freeShippingThresholdCents).toBeNull();
  });

  it("refuses an invalid rate and stores nothing", async () => {
    await expect(saveShippingSettings({ ...settings, rates: [{ ...rate, priceCents: -5 }] }, "admin-test")).rejects.toThrow("invalid_shipping_rate");
    await expect(saveShippingSettings({ ...settings, freeShippingThresholdCents: 0 }, "admin-test")).rejects.toThrow("invalid_shipping_threshold");
    expect((await adminDb().collection("settings").doc("shipping").get()).exists).toBe(false);
  });
});

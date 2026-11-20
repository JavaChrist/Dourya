import { afterEach, describe, expect, it, vi } from "vitest";
import { isMailClubTestAccount, mailClubSwitch } from "./switch";

// mailClubConfig.liveEnabled is false in the real config: flipped here only, per test.
const config = vi.hoisted(() => ({ live: false }));
vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return {
    ...actual,
    mailClubConfig: {
      ...actual.mailClubConfig,
      get liveEnabled() {
        return config.live;
      },
    },
  };
});
afterEach(() => {
  config.live = false;
});

// Fictitious uids only.
const UID = "testAccountUid0001";
const prod = { VERCEL_ENV: "production", MAIL_CLUB_TEST_MODE: "true", MAIL_CLUB_TEST_UID: UID };
const preview = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "stripe-test", CHECKOUT_ENABLED: "true", FIRESTORE_DATABASE_ID: "dourya-test" };
const CLOSED = { checkoutEnabled: false, allowDemoCheckoutInTestMode: false, test: false };
const TEST_OPEN = { checkoutEnabled: true, allowDemoCheckoutInTestMode: false, test: true };

describe("isMailClubTestAccount", () => {
  it("opens only when every condition holds", () => {
    expect(isMailClubTestAccount(prod, "test", UID)).toBe(true);
    expect(isMailClubTestAccount({ ...prod, MAIL_CLUB_TEST_UID: ` ${UID} ` }, "test", UID)).toBe(true);
  });
  it("stays closed when any condition is missing", () => {
    expect(isMailClubTestAccount(prod, "live", UID)).toBe(false);
    expect(isMailClubTestAccount(prod, null, UID)).toBe(false);
    expect(isMailClubTestAccount(prod, "test", "otherUser0000001")).toBe(false);
    expect(isMailClubTestAccount(prod, "test", null)).toBe(false);
    expect(isMailClubTestAccount({ ...prod, VERCEL_ENV: "preview" }, "test", UID)).toBe(false);
    expect(isMailClubTestAccount({ ...prod, VERCEL_ENV: undefined }, "test", UID)).toBe(false);
    for (const flag of [undefined, "", "false", "TRUE", "1", "yes"]) {
      expect(isMailClubTestAccount({ ...prod, MAIL_CLUB_TEST_MODE: flag }, "test", UID)).toBe(false);
    }
    for (const testUid of [undefined, "", "   ", "../x", "a b"]) {
      expect(isMailClubTestAccount({ ...prod, MAIL_CLUB_TEST_UID: testUid }, "test", testUid ?? null)).toBe(false);
    }
  });
});

describe("mailClubSwitch", () => {
  it("opens in TEST for the authorised account only, on dourya.fr", () => {
    expect(mailClubSwitch(prod, "test", UID)).toEqual(TEST_OPEN);
    expect(mailClubSwitch(prod, "test", "otherUser0000001")).toEqual(CLOSED);
    expect(mailClubSwitch(prod, "test", null)).toEqual(CLOSED);
  });
  it("a live key never opens the test path, and Live stays closed", () => {
    expect(mailClubSwitch(prod, "live", UID)).toEqual(CLOSED);
    expect(mailClubSwitch({ VERCEL_ENV: "production" }, "live", "anyUser000000001")).toEqual(CLOSED);
  });
  it("Live opens only with liveEnabled, a live key and production", () => {
    config.live = true;
    expect(mailClubSwitch({ VERCEL_ENV: "production" }, "live", null)).toEqual({ ...TEST_OPEN, test: false });
    expect(mailClubSwitch({ VERCEL_ENV: "production" }, "test", null)).toEqual(CLOSED);
    expect(mailClubSwitch({ VERCEL_ENV: "preview" }, "live", null)).toEqual(CLOSED);
  });
  it("keeps the stripe-test preview path (test key only)", () => {
    expect(mailClubSwitch(preview, "test", null)).toEqual(TEST_OPEN);
    expect(mailClubSwitch(preview, "live", null)).toEqual(CLOSED);
  });
});

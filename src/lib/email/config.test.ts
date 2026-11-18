import { describe, expect, it } from "vitest";
import { canSend, emailMode, readEmailConfig } from "./config";

const FULL = {
  EMAIL_FROM: "DOURYA <bonjour@exemple.test>",
  EMAIL_REPLY_TO: "contact@exemple.test",
  EMAIL_LEGAL_NAME: "Société Exemple",
  EMAIL_LEGAL_ADDRESS: "1 rue Fictive, 00000 Ville",
  RESEND_API_KEY: "re_test_fictif",
};

describe("emailMode", () => {
  it("defaults to firebase (custom e-mails off)", () => {
    expect(emailMode({})).toBe("firebase");
    expect(emailMode({ EMAIL_TRANSPORT: "nimporte" })).toBe("firebase");
  });
  it("reads test and resend", () => {
    expect(emailMode({ EMAIL_TRANSPORT: "test" })).toBe("test");
    expect(emailMode({ EMAIL_TRANSPORT: " Resend " })).toBe("resend");
  });
  it("never sends for real on the emulators", () => {
    expect(emailMode({ EMAIL_TRANSPORT: "resend", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" })).toBe("test");
    expect(emailMode({ EMAIL_TRANSPORT: "resend", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toBe("test");
  });
});

describe("readEmailConfig", () => {
  it("lists the missing variable names, never invents values", () => {
    const config = readEmailConfig({ EMAIL_TRANSPORT: "resend" });
    expect(config.missing).toEqual(["EMAIL_FROM", "EMAIL_REPLY_TO", "EMAIL_LEGAL_NAME", "EMAIL_LEGAL_ADDRESS", "RESEND_API_KEY"]);
    expect(config.from).toBe("");
    expect(canSend(config)).toBe(false);
  });
  it("sends with a complete configuration", () => {
    const config = readEmailConfig({ EMAIL_TRANSPORT: "resend", ...FULL });
    expect(config.missing).toEqual([]);
    expect(canSend(config)).toBe(true);
  });
  it("rejects placeholders and header injection", () => {
    const config = readEmailConfig({ EMAIL_TRANSPORT: "resend", ...FULL, EMAIL_FROM: "REPLACE_ME", EMAIL_REPLY_TO: "a@b.test\r\nBcc: x@y.test" });
    expect(config.missing).toContain("EMAIL_FROM");
    expect(config.missing).toContain("EMAIL_REPLY_TO");
  });
  it("test mode always renders, firebase mode never sends", () => {
    expect(canSend(readEmailConfig({ EMAIL_TRANSPORT: "test" }))).toBe(true);
    expect(canSend(readEmailConfig({ ...FULL }))).toBe(false);
  });
});

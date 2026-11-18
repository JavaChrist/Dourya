import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, emailHash, listUnsubscribeHeaders, verifyUnsubscribeToken } from "./unsubscribe";

const SECRET = "secret-de-test-fictif-0123456789abcdef";
const HASH = emailHash("Client@Exemple.test ");

describe("unsubscribe tokens", () => {
  it("hashes the normalised address (no address in clear)", () => {
    expect(HASH).toBe(emailHash("client@exemple.test"));
    expect(HASH).toMatch(/^[0-9a-f]{64}$/);
  });
  it("round-trips and carries no address", () => {
    const token = createUnsubscribeToken({ list: "newsletter", emailHash: HASH, uid: "uid123" }, SECRET);
    expect(token).not.toContain("exemple");
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ v: 1, list: "newsletter", emailHash: HASH, uid: "uid123" });
  });
  it("rejects a tampered token, another secret, junk", () => {
    const token = createUnsubscribeToken({ list: "newsletter", emailHash: HASH }, SECRET);
    const [data, sig] = token.split(".");
    const other = Buffer.from(JSON.stringify({ v: 1, l: "newsletter", h: emailHash("autre@exemple.test") })).toString("base64url");
    expect(verifyUnsubscribeToken(`${other}.${sig}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${data}.${sig}x`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}-autre`)).toBeNull();
    expect(verifyUnsubscribeToken("a".repeat(700), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(undefined, SECRET)).toBeNull();
  });
  it("refuses a short secret", () => {
    expect(() => createUnsubscribeToken({ list: "newsletter", emailHash: HASH }, "court")).toThrow();
    expect(verifyUnsubscribeToken("x.y", "court")).toBeNull();
  });
  it("builds RFC 8058 headers", () => {
    expect(listUnsubscribeHeaders("https://dourya.fr/api/email/desinscription?token=t")).toEqual({
      "List-Unsubscribe": "<https://dourya.fr/api/email/desinscription?token=t>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

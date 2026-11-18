import { describe, expect, it } from "vitest";
import { authorize, roleFromClaims, type SessionUser } from "./roles";

const customer: SessionUser = { uid: "c", email: "c@test.local", emailVerified: true, role: "customer" };
const admin: SessionUser = { ...customer, uid: "a", role: "admin" };

describe("roles", () => {
  it("reads the role from the custom claim only", () => {
    expect(roleFromClaims({ role: "admin" })).toBe("admin");
    expect(roleFromClaims({ role: "ADMIN" })).toBe("customer");
    expect(roleFromClaims({ admin: true })).toBe("customer");
    expect(roleFromClaims({})).toBe("customer");
  });
  it("authorizes by role", () => {
    expect(authorize(null, "customer")).toBe("unauthenticated");
    expect(authorize({ ...customer, emailVerified: false }, "customer")).toBe("unauthenticated");
    expect(authorize(customer, "customer")).toBe("ok");
    expect(authorize(customer, "admin")).toBe("forbidden");
    expect(authorize(admin, "admin")).toBe("ok");
    expect(authorize(admin, "customer")).toBe("ok");
  });
});

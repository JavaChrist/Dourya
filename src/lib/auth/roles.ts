import type { UserRole } from "@/lib/commerce-types";

/** The role comes only from the Firebase custom claim `role`, set by the admin script (never by the client). */
export function roleFromClaims(claims: Record<string, unknown>): UserRole {
  return claims.role === "admin" ? "admin" : "customer";
}

export type SessionUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
};

export type Access = "ok" | "unauthenticated" | "forbidden";

/** RBAC: an admin can do what a customer can; a customer never gets admin access. */
export function authorize(user: SessionUser | null, required: UserRole): Access {
  if (!user || !user.emailVerified) return "unauthenticated";
  if (required === "admin" && user.role !== "admin") return "forbidden";
  return "ok";
}

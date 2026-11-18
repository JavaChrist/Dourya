/**
 * Grants or removes the admin role (Firebase custom claim `role: "admin"`).
 * Shared by the CLI (scripts/admin-role.mjs) and the integration tests.
 * No identifier is hardcoded: the e-mail is always given by the operator.
 */

export const ROLES = /** @type {const} */ (["admin", "customer"]);

/**
 * @param {import("firebase-admin/auth").Auth} auth
 * @param {string} email
 * @param {"admin" | "customer"} role
 * @returns {Promise<{ uid: string; email: string; role: "admin" | "customer"; changed: boolean }>}
 */
export async function setRole(auth, email, role) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  const user = await auth.getUserByEmail(String(email).trim().toLowerCase());
  const current = user.customClaims?.role === "admin" ? "admin" : "customer";
  if (current === role) return { uid: user.uid, email: user.email ?? email, role, changed: false };

  // Keep any other claims, only touch `role`. "customer" is the default: the claim is removed.
  const others = { ...(user.customClaims ?? {}) };
  delete others.role;
  await auth.setCustomUserClaims(user.uid, role === "admin" ? { ...others, role: "admin" } : others);
  // Revoking ends every open session at once: on the next request the session cookie
  // is refused (verifySessionCookie with checkRevoked) and the user signs in again with the new role.
  await auth.revokeRefreshTokens(user.uid);
  return { uid: user.uid, email: user.email ?? email, role, changed: true };
}

/** @param {import("firebase-admin/auth").Auth} auth @param {string} email */
export async function showRole(auth, email) {
  const user = await auth.getUserByEmail(String(email).trim().toLowerCase());
  return {
    uid: user.uid,
    email: user.email ?? email,
    role: user.customClaims?.role === "admin" ? "admin" : "customer",
    emailVerified: user.emailVerified,
  };
}

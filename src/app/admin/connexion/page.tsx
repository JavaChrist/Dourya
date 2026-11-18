import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

/** Admin sign-in. There is no admin sign-up: the role is granted by the scripts/admin-role.mjs script. */
export default function AdminLoginPage() {
  return (
    <AuthShell title="Administration" intro="Accès réservé à l'équipe DOURYA.">
      <Suspense fallback={<div aria-busy="true" className="min-h-64" />}>
        <LoginForm scope="admin" />
      </Suspense>
    </AuthShell>
  );
}

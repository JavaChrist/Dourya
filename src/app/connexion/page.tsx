import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      intro="Connectez-vous pour suivre vos commandes et gérer vos adresses."
      footer={
        <p>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-bold text-link hover:underline">
            Créer un compte
          </Link>
        </p>
      }
    >
      {/* The form reads the URL (notices, next): kept in Suspense so the page shell stays static. */}
      <Suspense fallback={<div aria-busy="true" className="min-h-64" />}>
        <LoginForm scope="customer" />
      </Suspense>
    </AuthShell>
  );
}

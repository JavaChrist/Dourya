import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      intro="Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe."
      footer={
        <p>
          <Link href="/connexion" className="font-bold text-link hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <ResetForm />
    </AuthShell>
  );
}

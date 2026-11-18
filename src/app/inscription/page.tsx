import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default function SignupPage() {
  return (
    <AuthShell
      title="Créer un compte"
      intro="Un compte n'est pas obligatoire pour commander : il sert à retrouver vos commandes et vos adresses."
      footer={
        <p>
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-bold text-link hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}

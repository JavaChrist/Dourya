import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = { title: "Confirmez votre adresse e-mail", robots: { index: false } };

/** Same page whether the address was new or already used (nothing is revealed). */
export default function VerifyEmailPage() {
  return (
    <AuthShell title="Vérifiez vos e-mails">
      <div className="flex gap-3">
        <MailCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-pink-strong" />
        <div className="space-y-3 text-ink">
          <p>Si cette adresse peut être utilisée, un e-mail de confirmation vient de vous être envoyé.</p>
          <p>Cliquez sur le lien qu&apos;il contient, puis connectez-vous. Pensez à regarder dans les courriers indésirables.</p>
          <p className="text-sm text-ink-muted">
            Rien reçu après quelques minutes ? Connectez-vous : si l&apos;adresse n&apos;est pas encore confirmée, un nouveau lien vous sera envoyé.
          </p>
        </div>
      </div>
      <ButtonLink href="/connexion" className="mt-6 w-full">
        Aller à la connexion
      </ButtonLink>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Notice } from "@/components/auth/FormParts";
import { UnsubscribeForm } from "@/components/email/UnsubscribeForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe-service";

export const metadata: Metadata = {
  title: "Se désinscrire de la newsletter",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function UnsubscribeContent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : undefined;
  const payload = readUnsubscribeToken(value);
  if (payload === "unavailable") {
    return <Notice tone="error">La désinscription est momentanément indisponible. Réessayez plus tard.</Notice>;
  }
  if (!payload || !value) {
    return (
      <div className="space-y-5">
        <Notice tone="error">Ce lien de désinscription est incomplet ou n&apos;est pas valide.</Notice>
        <p className="text-sm text-ink-muted">Vous pouvez aussi gérer la newsletter depuis votre compte, rubrique Préférences.</p>
        <ButtonLink href="/mon-compte" className="w-full">
          Mon compte
        </ButtonLink>
      </div>
    );
  }
  return <UnsubscribeForm token={value} />;
}

export default function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return (
    <AuthShell title="Newsletter DOURYA" intro="Vous ne recevrez plus nos e-mails d'actualités et d'offres. Les e-mails liés à votre compte et à vos commandes restent envoyés.">
      <Suspense fallback={<p className="text-ink-muted">Chargement…</p>}>
        <UnsubscribeContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

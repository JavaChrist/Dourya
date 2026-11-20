import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/account/ui";
import { AdminHeader } from "@/components/admin/catalog/shared";
import { commerceConfig, mailClubConfig, paymentConfig, taxConfig } from "@/config/commerce";
import { PRODUCTION_SITE_URL, siteOrigin } from "@/config/site";
import { isReady, readinessChecks, type ReadinessCheck } from "@/lib/admin/readiness";
import { requireAdmin } from "@/lib/auth/dal";
import { getListedProducts } from "@/lib/catalog";
import { firestoreDatabaseId } from "@/lib/checkout/test-preview";
import { readEmailConfig } from "@/lib/email/config";
import { getShippingSettings } from "@/lib/orders/repository";
import { stripeKeyIssue, stripeKeyMode } from "@/lib/payments/stripe-client";
import { stripeWebhookSecret } from "@/lib/payments/stripe";

export const metadata: Metadata = { title: "Prêt à ouvrir" };

/** Read only: shows states and variable names, never a value. Changes nothing. */
async function ReadinessContent() {
  await requireAdmin();
  const [shipping, listed] = await Promise.all([getShippingSettings(), getListedProducts()]);
  const email = readEmailConfig();
  const checks = readinessChecks({
    vercelEnv: process.env.VERCEL_ENV,
    keyMode: stripeKeyMode(process.env.STRIPE_SECRET_KEY),
    keyIssue: stripeKeyIssue(process.env.STRIPE_SECRET_KEY),
    webhookSecretSet: stripeWebhookSecret() !== null,
    email: { mode: email.mode, missing: email.missing },
    allowLive: paymentConfig.allowLive,
    checkoutEnabled: commerceConfig.checkoutEnabled,
    mailClubLiveEnabled: mailClubConfig.liveEnabled,
    taxConfirmed: taxConfig.status !== null,
    shipping,
    listed,
    databaseId: firestoreDatabaseId(process.env),
    siteOrigin: siteOrigin(),
    productionOrigin: PRODUCTION_SITE_URL,
  });
  const ready = isReady(checks);
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  return (
    <>
      <AdminHeader title="Prêt à ouvrir" back={{ href: "/admin", label: "Administration" }} />
      <div className="mt-8 space-y-6">
        <Card title={ready ? "Tout est prêt" : `${required.filter((c) => !c.ok).length} point(s) à régler`}>
          <p className="text-ink-muted">
            Contrôle en lecture seule avant l&apos;ouverture de la vente sur dourya.fr. Cette page ne modifie rien et n&apos;affiche aucune clé : seulement des états et des noms de
            variables. Les deux derniers interrupteurs (paiement live, vente ouverte) ne se changent qu&apos;après votre accord.
          </p>
        </Card>
        <Card title="Obligatoire">
          <CheckList checks={required} />
        </Card>
        <Card title="Facultatif">
          <CheckList checks={optional} />
        </Card>
      </div>
    </>
  );
}

function CheckList({ checks }: { checks: ReadinessCheck[] }) {
  return (
    <ul className="divide-y divide-secondary/30">
      {checks.map((c) => (
        <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 text-ink">
            <p className="font-semibold">{c.label}</p>
            <p className="break-words text-sm text-ink-muted">{c.detail}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.ok ? "bg-surface-muted text-ink" : "bg-pink-strong text-white"}`}>{c.ok ? "OK" : "À faire"}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReadinessPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement…</p>}>
      <ReadinessContent />
    </Suspense>
  );
}

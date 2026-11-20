import type { StripeKeyIssue, StripeMode } from "@/lib/payments/stripe-client";
import type { ShippingSettings } from "@/lib/shipping/types";
import type { Product } from "@/lib/types";

/**
 * "Prêt à ouvrir" checklist: what must be true before real sales open on
 * dourya.fr. Pure function (no env, no Firestore), so it is unit tested. The
 * input carries states and names only: never a key, a secret or a customer.
 */

export type ReadinessInput = {
  vercelEnv: string | undefined;
  /** Mode of STRIPE_SECRET_KEY as written (before the production-only rule). */
  keyMode: StripeMode | null;
  /** Why the key was refused (category only, never a value). */
  keyIssue?: StripeKeyIssue | null;
  webhookSecretSet: boolean;
  email: { mode: "firebase" | "test" | "resend"; missing: string[] };
  allowLive: boolean;
  checkoutEnabled: boolean;
  mailClubLiveEnabled: boolean;
  taxConfirmed: boolean;
  shipping: Pick<ShippingSettings, "zones" | "rates">;
  /** Products currently listed for sale (published, visible category). */
  listed: Product[];
  /** undefined = "(default)". */
  databaseId: string | undefined;
  siteOrigin: string;
  productionOrigin: string;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** false: does not block the shop opening (e.g. the Mail Club). */
  required: boolean;
};

const KEY_ISSUE: Record<StripeKeyIssue, string> = {
  missing: "variable vide ou absente sur ce déploiement.",
  publishable: "clé publiable (pk_) au lieu de la clé secrète (sk_).",
  webhook_secret: "secret de webhook (whsec_) au lieu de la clé secrète (sk_).",
  quoted: "la valeur est entourée de guillemets.",
  inner_whitespace: "espace ou retour à la ligne dans la valeur.",
  unknown_prefix: "ne commence pas par sk_live_ ou rk_live_.",
  too_short: "valeur trop courte (clé tronquée ?).",
  unexpected_chars: "le préfixe est bon mais la suite contient des caractères inattendus.",
};

const sellable = (p: Product) =>
  !p.isDemo && p.variants.some((v) => v.active && v.priceCents !== null && (v.stockMode === "made_to_order" || (v.stock ?? 0) > 0));

export function readinessChecks(input: ReadinessInput): ReadinessCheck[] {
  const enabledZones = input.shipping.zones.filter((z) => z.enabled);
  const zonesWithRate = enabledZones.filter((z) => input.shipping.rates.some((r) => r.enabled && r.zone === z.code));
  const zonesWithoutRate = enabledZones.filter((z) => !zonesWithRate.includes(z));
  const real = input.listed.filter(sellable);
  const demo = input.listed.filter((p) => p.isDemo);
  const emailOk = input.email.mode === "resend" && input.email.missing.length === 0;

  return [
    {
      id: "deployment",
      label: "Déploiement de production",
      ok: input.vercelEnv === "production",
      detail: `VERCEL_ENV : ${input.vercelEnv ?? "absent (local)"}`,
      required: true,
    },
    {
      id: "stripe_key",
      label: "Clé Stripe live",
      ok: input.keyMode === "live",
      detail:
        input.keyMode === "live"
          ? "Clé live configurée."
          : input.keyMode === "test"
            ? "Clé de test : paiements fictifs uniquement."
            : input.keyIssue
              ? `Aucune clé valide : ${KEY_ISSUE[input.keyIssue]}`
              : "Aucune clé valide.",
      required: true,
    },
    {
      id: "webhook",
      label: "Secret du webhook Stripe",
      ok: input.webhookSecretSet,
      detail: input.webhookSecretSet ? "Configuré (à créer à nouveau pour le compte live)." : "Absent ou invalide.",
      required: true,
    },
    {
      id: "email",
      label: "E-mails transactionnels (Resend)",
      ok: emailOk,
      detail:
        input.email.mode !== "resend"
          ? `Transport : ${input.email.mode} (attendu : resend).`
          : input.email.missing.length > 0
            ? `Variables manquantes : ${input.email.missing.join(", ")}.`
            : "Resend configuré.",
      required: true,
    },
    {
      id: "tax",
      label: "Statut TVA confirmé",
      ok: input.taxConfirmed,
      detail: input.taxConfirmed ? "Mention de prix définie." : "taxConfig.status à confirmer.",
      required: true,
    },
    {
      id: "shipping",
      label: "Zones et tarifs d'expédition",
      ok: zonesWithRate.length > 0 && zonesWithoutRate.length === 0,
      detail: [
        zonesWithRate.length > 0 ? `Avec tarif : ${zonesWithRate.map((z) => z.code).join(", ")}.` : "Aucune zone ouverte avec un tarif actif.",
        ...(zonesWithoutRate.length > 0 ? [`Ouvertes sans tarif : ${zonesWithoutRate.map((z) => z.code).join(", ")}.`] : []),
      ].join(" "),
      required: true,
    },
    {
      id: "products",
      label: "Produits réels en vente",
      ok: real.length > 0,
      detail: `${real.length} produit(s) publié(s) avec un prix et du stock (ou fabriqué(s) à la commande).`,
      required: true,
    },
    {
      id: "demo",
      label: "Aucun produit de démo en vente",
      ok: demo.length === 0,
      detail: demo.length === 0 ? "Aucun." : `${demo.length} produit(s) de démo encore publié(s).`,
      required: true,
    },
    {
      id: "database",
      label: "Base Firestore de production",
      ok: input.databaseId === undefined,
      detail: `Base : ${input.databaseId ?? "(default)"}`,
      required: true,
    },
    {
      id: "site",
      label: "Adresse du site",
      ok: input.siteOrigin === input.productionOrigin,
      detail: input.siteOrigin,
      required: true,
    },
    {
      id: "allow_live",
      label: "Paiement live autorisé dans le code",
      ok: input.allowLive,
      detail: "paymentConfig.allowLive (dernier interrupteur, après accord).",
      required: true,
    },
    {
      id: "checkout",
      label: "Vente ouverte dans le code",
      ok: input.checkoutEnabled,
      detail: "commerceConfig.checkoutEnabled (dernier interrupteur, après accord).",
      required: true,
    },
    {
      id: "mail_club",
      label: "Mail Club en live",
      ok: input.mailClubLiveEnabled,
      detail: "mailClubConfig.liveEnabled : facultatif pour ouvrir la boutique.",
      required: false,
    },
  ];
}

/** Ready when every required check passes. */
export function isReady(checks: ReadinessCheck[]): boolean {
  return checks.every((c) => c.ok || !c.required);
}

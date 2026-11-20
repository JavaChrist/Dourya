import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarClock, Gift, Truck, XCircle } from "lucide-react";
import { mailClubConfig } from "@/config/commerce";
import { Notice } from "@/components/auth/FormParts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SubscribeForm } from "@/components/mail-club/SubscribeForm";
import { getSessionUser } from "@/lib/auth/dal";
import { checkoutSwitch } from "@/lib/checkout/test-preview";
import { formatPrice } from "@/lib/format";
import { LIVE_STATUSES } from "@/lib/payments/stripe-subscriptions";
import { getStripe, stripeMode } from "@/lib/payments/stripe";
import { catalogAdminEnabled } from "@/lib/catalog/admin-gate";
import { errorCode, logEvent } from "@/lib/log";
import { toPublicPackPhotoUrl } from "@/lib/subscriptions/pack-photo-url";
import { type MailClubPack, packMonthLabel, splitPublished } from "@/lib/subscriptions/packs";
import { listPacks } from "@/lib/subscriptions/packs-repository";
import { getUserSubscription } from "@/lib/subscriptions/repository";
import { mailClubGate } from "@/lib/subscriptions/service";

export const metadata: Metadata = { title: "Mail Club", alternates: { canonical: "/infos/mail-club" } };

const priceLabel = `${formatPrice(mailClubConfig.priceCents)} par mois`;

const points = [
  { icon: Gift, text: "Un pack surprise différent chaque mois." },
  { icon: Truck, text: "Livraison incluse dans le prix, en France." },
  { icon: CalendarClock, text: "Prélèvement chaque mois à la date anniversaire de votre abonnement." },
  { icon: XCircle, text: "Sans engagement : résiliable à tout moment depuis votre compte." },
];

/** Published packs; the page still works (subscription block) if the read fails. */
async function publishedPacks(): Promise<MailClubPack[]> {
  if (!catalogAdminEnabled(process.env)) return [];
  try {
    return await listPacks();
  } catch (error) {
    logEvent("mail_club_packs_read_error", { code: errorCode(error) });
    return [];
  }
}

function PackGallery({ pack }: { pack: MailClubPack }) {
  const [cover, ...rest] = pack.images;
  if (!cover) return null;
  return (
    <div className="mt-4 space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white ring-1 ring-secondary/30">
        <Image src={toPublicPackPhotoUrl(cover.src)} alt={cover.alt} fill sizes="(min-width: 768px) 720px, 100vw" className="object-contain" unoptimized priority />
      </div>
      {rest.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {rest.map((image) => (
            <li key={image.src} className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-secondary/30">
              <Image src={toPublicPackPhotoUrl(image.src)} alt={image.alt} fill sizes="(min-width: 640px) 170px, 30vw" className="object-contain" unoptimized />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviousPacks({ packs }: { packs: MailClubPack[] }) {
  if (packs.length === 0) return null;
  return (
    <section aria-labelledby="packs-precedents" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
      <h2 id="packs-precedents" className="font-display text-2xl font-semibold text-ink">
        Les packs précédents
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {packs.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-lg ring-1 ring-secondary/30">
            {p.images[0] && (
              <div className="relative aspect-[4/3] bg-white">
                <Image src={toPublicPackPhotoUrl(p.images[0].src)} alt={p.images[0].alt} fill sizes="(min-width: 640px) 340px, 100vw" className="object-contain" unoptimized />
              </div>
            )}
            <div className="space-y-1 p-4 text-ink">
              <p className="text-sm font-semibold text-pink-strong">{packMonthLabel(p.id)}</p>
              <h3 className="font-bold">{p.title}</h3>
              <p className="line-clamp-4 whitespace-pre-line text-sm">{p.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Packs and the customer's state: request-time data. */
async function MailClubLive() {
  await connection();
  const [packs, user] = await Promise.all([publishedPacks(), getSessionUser()]);
  const { current: pack, previous } = splitPublished(packs);
  const stripe = getStripe();
  const closed = mailClubGate(stripe, checkoutSwitch(process.env, stripeMode()));
  const current = user ? await getUserSubscription(user.uid) : null;
  const subscribed = current !== null && LIVE_STATUSES.includes(current.status);

  return (
    <>
      <section aria-labelledby="pack-du-mois" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
        <h2 id="pack-du-mois" className="font-display text-2xl font-semibold text-ink">
          Le pack du mois
        </h2>
        {pack ? (
          <>
            <div className="mt-3 space-y-2 text-ink">
              <p className="text-sm font-semibold text-pink-strong">{packMonthLabel(pack.id)}</p>
              <p className="font-bold">{pack.title}</p>
              {pack.description && <p className="whitespace-pre-line">{pack.description}</p>}
            </div>
            <PackGallery pack={pack} />
          </>
        ) : (
          <p className="mt-3 text-ink-muted">Le contenu du prochain pack sera annoncé bientôt.</p>
        )}
      </section>

      <section aria-labelledby="abonnement" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
        <h2 id="abonnement" className="font-display text-2xl font-semibold text-ink">
          M&apos;abonner
        </h2>
        <div className="mt-4">
          {closed ? (
            <Notice tone="info">L&apos;abonnement en ligne ouvrira prochainement.</Notice>
          ) : subscribed ? (
            <div className="space-y-4">
              <Notice tone="success">Vous êtes abonné au Mail Club.</Notice>
              <ButtonLink href="/mon-compte/abonnement">Voir mon abonnement</ButtonLink>
            </div>
          ) : user ? (
            <SubscribeForm priceLabel={priceLabel} />
          ) : (
            <div className="space-y-4">
              <p className="text-ink">Connectez-vous ou créez un compte pour vous abonner : vous pourrez suivre et résilier votre abonnement depuis votre compte.</p>
              <ButtonLink href="/connexion?next=/infos/mail-club">Se connecter</ButtonLink>
            </div>
          )}
        </div>
      </section>

      <PreviousPacks packs={previous} />
    </>
  );
}

export default function MailClubPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Le Mail Club DOURYA</h1>
      <p className="mt-4 text-lg text-ink">
        <strong>{priceLabel}</strong>, livraison incluse.
      </p>
      <ul className="mt-6 space-y-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-ink">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-pink-strong" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 space-y-6">
        <Suspense fallback={<div aria-busy="true" className="min-h-64" />}>
          <MailClubLive />
        </Suspense>
      </div>
    </div>
  );
}

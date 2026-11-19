"use client";

import Link from "next/link";
import { AlertTriangle, Lock, RefreshCw, ShoppingBag, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { checkoutSummaryAction, placeOrderAction, type CheckoutSummary } from "@/app/commande/actions";
import { Field, Notice, inputClass } from "@/components/auth/FormParts";
import { useCart } from "@/components/cart/CartProvider";
import { accountConfig } from "@/config/commerce";
import type { FieldErrors } from "@/lib/account/validation";
import { formatPrice } from "@/lib/format";

const ATTEMPT_STORAGE = "dourya.checkout.attempt";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; summary: CheckoutSummary };

/**
 * One attempt key per cart + contact + address + shipping + total, kept in
 * sessionStorage: a double click or a reload resends the same key (same
 * order, same payment); any change gives a new key.
 */
function attemptKeyFor(signature: string): string {
  try {
    const stored = JSON.parse(sessionStorage.getItem(ATTEMPT_STORAGE) ?? "null") as { signature?: string; key?: string } | null;
    if (stored?.signature === signature && stored.key) return stored.key;
  } catch {
    // sessionStorage unavailable: a new key per click, the button is disabled while pending anyway.
  }
  const key = crypto.randomUUID();
  try {
    sessionStorage.setItem(ATTEMPT_STORAGE, JSON.stringify({ signature, key }));
  } catch {
    // ignored, see above
  }
  return key;
}

function forgetAttempt() {
  try {
    sessionStorage.removeItem(ATTEMPT_STORAGE);
  } catch {
    // ignored
  }
}

export function CheckoutForm({ defaultEmail }: { defaultEmail: string }) {
  const { items, ready } = useCart();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [country, setCountry] = useState<string>(accountConfig.addressCountries[0]?.code ?? "FR");
  const [rateId, setRateId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const summary = await checkoutSummaryAction(items, country);
      if (id !== requestId.current) return;
      setState({ kind: "ready", summary });
      setRateId((current) => (summary.options.some((o) => o.rateId === current) ? current : (summary.options[0]?.rateId ?? "")));
    } catch {
      if (id === requestId.current) setState({ kind: "error" });
    }
  }, [items, country]);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the server answers, never synchronously
    void load();
  }, [ready, load]);

  if (!ready || state.kind === "loading") return <p className="mt-8 text-ink-muted" role="status">Préparation de la commande…</p>;

  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-lg border-2 border-dashed border-secondary/50 px-6 py-14 text-center">
        <ShoppingBag aria-hidden className="size-10 text-pink-strong" />
        <p className="mt-3 font-display text-2xl font-semibold text-ink">Votre panier est vide</p>
        <Link href="/boutique" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink">
          Découvrir la boutique
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-8 rounded-lg bg-surface-muted px-6 py-8 text-center" role="alert">
        <p className="font-semibold text-ink">Le récapitulatif n&apos;a pas pu être calculé. Vérifiez votre connexion.</p>
        <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-button px-6 font-semibold text-button-ink">
          <RefreshCw aria-hidden className="size-4" />
          Réessayer
        </button>
      </div>
    );
  }

  const { summary } = state;
  const option = summary.options.find((o) => o.rateId === rateId);
  const totalCents = option ? summary.subtotalCents + option.priceCents : null;
  const canPay = !summary.closedReason && !summary.cartChanged && !summary.shippingProblem && totalCents !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canPay || totalCents === null) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const email = text("email");
    const address = { fullName: text("fullName"), line1: text("line1"), line2: text("line2"), postalCode: text("postalCode"), city: text("city"), country };
    const acceptTerms = form.get("acceptTerms") === "on";
    const attemptKey = attemptKeyFor(JSON.stringify([items, email.trim().toLowerCase(), address, rateId, totalCents]));

    setPending(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await placeOrderAction({ attemptKey, items, email, address, rateId, acceptTerms, expectedTotalCents: totalCents });
      if (result.ok) {
        window.location.assign(result.url);
        return; // keep the button disabled while the browser leaves
      }
      if (result.resetAttempt) forgetAttempt();
      setMessage(result.message);
      setErrors(result.fieldErrors ?? {});
      if (result.refresh) void load();
    } catch {
      setMessage("La commande n'a pas pu être envoyée. Vérifiez votre connexion puis réessayez.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-6">
        <section aria-labelledby="checkout-contact" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
          <h2 id="checkout-contact" className="font-display text-2xl font-semibold text-ink">Contact</h2>
          <div className="mt-4">
            <Field id="email" label="Adresse e-mail" type="email" autoComplete="email" required defaultValue={defaultEmail} error={errors.email} hint="Pour la confirmation et le suivi de la commande." />
          </div>
        </section>

        <section aria-labelledby="checkout-address" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
          <h2 id="checkout-address" className="font-display text-2xl font-semibold text-ink">Adresse de livraison</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="fullName" label="Nom du destinataire" autoComplete="name" required error={errors.fullName} />
            </div>
            <div className="sm:col-span-2">
              <Field id="line1" label="Adresse" autoComplete="address-line1" required error={errors.line1} />
            </div>
            <div className="sm:col-span-2">
              <Field id="line2" label="Complément (facultatif)" autoComplete="address-line2" error={errors.line2} />
            </div>
            <Field id="postalCode" label="Code postal" autoComplete="postal-code" inputMode="numeric" required error={errors.postalCode} />
            <Field id="city" label="Ville" autoComplete="address-level2" required error={errors.city} />
            <div className="sm:col-span-2">
              <label htmlFor="country" className="block text-sm font-bold text-ink">Pays</label>
              <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" className={inputClass}>
                {accountConfig.addressCountries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {errors.country && <p className="mt-1 text-sm font-bold text-pink-strong">{errors.country}</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="checkout-shipping" className="rounded-lg bg-white p-5 ring-1 ring-secondary/30 sm:p-6">
          <h2 id="checkout-shipping" className="font-display text-2xl font-semibold text-ink">Livraison</h2>
          {summary.shippingProblem ? (
            <div className="mt-4">
              <Notice tone="info">{summary.shippingProblem}</Notice>
            </div>
          ) : (
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Mode de livraison</legend>
              {summary.options.map((o) => (
                <label key={o.rateId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 border-secondary/40 px-4 py-2 has-[:checked]:border-ink">
                  <input type="radio" name="rateId" value={o.rateId} checked={rateId === o.rateId} onChange={() => setRateId(o.rateId)} className="size-4 accent-pink-strong" />
                  <Truck aria-hidden className="size-4 shrink-0 text-pink-strong" />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">{o.label}</span>
                    <span className="block text-sm text-ink-muted">{o.service === "tracked" ? "Avec numéro de suivi" : "Sans suivi"}{o.carrier ? ` · ${o.carrier}` : ""}</span>
                  </span>
                  <span className="font-bold">{o.free ? "Offerte" : formatPrice(o.priceCents)}</span>
                </label>
              ))}
              {errors.rateId && <p className="text-sm font-bold text-pink-strong">{errors.rateId}</p>}
            </fieldset>
          )}
        </section>
      </div>

      <aside aria-labelledby="checkout-summary" className="rounded-lg bg-surface-muted p-5 lg:sticky lg:top-28">
        <h2 id="checkout-summary" className="font-display text-2xl font-semibold text-ink">Récapitulatif</h2>
        <ul className="mt-4 space-y-3">
          {summary.lines.map((line) => (
            <li key={line.key} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{line.productName ?? "Produit retiré"} {line.quantity > 0 && <>× {line.quantity}</>}</span>
                {line.variantName && <span className="block text-ink-muted">{line.variantName}</span>}
                {line.personalisation && <span className="block text-ink-muted">{line.personalisation.label} : « {line.personalisation.text} »</span>}
                {line.message && <span className="block font-semibold text-pink-strong">{line.message}</span>}
              </span>
              <span className="shrink-0 font-bold">{line.unitPriceCents !== null ? formatPrice(line.lineTotalCents) : "—"}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-secondary/40 pt-3">
          <div className="flex justify-between gap-4">
            <dt>Sous-total</dt>
            <dd className="font-bold">{formatPrice(summary.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Livraison</dt>
            <dd className="font-bold">{option ? (option.free ? "Offerte" : formatPrice(option.priceCents)) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-secondary/40 pt-2 text-lg">
            <dt className="font-display font-semibold">Total</dt>
            <dd className="font-bold">{totalCents !== null ? formatPrice(totalCents) : "—"}</dd>
          </div>
        </dl>

        {summary.cartChanged && (
          <p className="mt-4 flex gap-2 rounded-md bg-white px-3 py-2 text-sm text-ink">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-pink-strong" />
            <span>
              Votre panier a changé. <Link href="/panier" className="font-bold text-link underline">Vérifiez-le</Link> avant de payer.
            </span>
          </p>
        )}

        <label className="mt-4 flex gap-3 text-sm text-ink">
          <input type="checkbox" name="acceptTerms" required aria-invalid={errors.acceptTerms ? true : undefined} aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined} className="mt-0.5 size-4 shrink-0 accent-pink-strong" />
          <span>
            J&apos;ai lu et j&apos;accepte les{" "}
            <Link href="/infos/cgv" target="_blank" className="font-bold text-link underline">conditions générales de vente</Link>.
          </span>
        </label>
        {errors.acceptTerms && <p id="acceptTerms-error" className="mt-1 text-sm font-bold text-pink-strong">{errors.acceptTerms}</p>}

        {message && (
          <div className="mt-4">
            <Notice tone="error">{message}</Notice>
          </div>
        )}

        <button
          type="submit"
          disabled={!canPay || pending}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-button px-6 font-display text-lg font-semibold text-button-ink shadow-[0_3px_0_rgba(43,18,32,0.25)] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/60 disabled:shadow-none"
        >
          <Lock aria-hidden className="size-5" />
          {pending ? "Redirection vers le paiement…" : "Payer par carte"}
        </button>
        {summary.closedReason ? (
          <p className="mt-2 text-center text-xs text-ink-muted">{summary.closedReason}</p>
        ) : (
          <p className="mt-2 text-center text-xs text-ink-muted">Paiement sécurisé par carte sur la page de notre prestataire Stripe.</p>
        )}
      </aside>
    </form>
  );
}

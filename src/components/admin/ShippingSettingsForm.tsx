"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveShippingAction } from "@/app/admin/expedition/actions";
import type { FormState } from "@/app/mon-compte/actions";
import { Card, FormMessage, primaryButton, secondaryButton } from "@/components/account/ui";
import { inputClass } from "@/components/auth/FormParts";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ENVELOPES, MAX_RATES, SERVICES, centsToEuros } from "@/lib/shipping/form";
import type { ShippingSettings } from "@/lib/shipping/types";

const idle: FormState = { status: "idle" };

type Row = {
  key: string;
  id: string;
  zone: string;
  envelope: string;
  service: string;
  label: string;
  carrier: string;
  price: string;
  packagingWeight: string;
  maxWeight: string;
  maxThickness: string;
  maxLength: string;
  maxWidth: string;
  enabled: boolean;
  free: boolean;
};

const token = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/** Fields are controlled so a refused save keeps what was typed. */
export function ShippingSettingsForm({ settings }: { settings: ShippingSettings }) {
  const [state, action, pending] = useActionState(saveShippingAction, idle);
  const [ask, dialog] = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [zones, setZones] = useState(() => Object.fromEntries(settings.zones.map((z) => [z.code, z.enabled])));
  const [threshold, setThreshold] = useState(settings.freeShippingThresholdCents === null ? "" : centsToEuros(settings.freeShippingThresholdCents));
  const [rows, setRows] = useState<Row[]>(() =>
    settings.rates.map((r, i) => ({
      key: `rate-s${i}`,
      id: r.id,
      zone: r.zone,
      envelope: r.envelope,
      service: r.service,
      label: r.label,
      carrier: r.carrier ?? "",
      price: centsToEuros(r.priceCents),
      packagingWeight: String(r.packagingWeightGrams),
      maxWeight: String(r.maxWeightGrams),
      maxThickness: String(r.maxThicknessMm),
      maxLength: String(r.maxLengthMm),
      maxWidth: String(r.maxWidthMm),
      enabled: r.enabled,
      free: r.freeShippingEligible,
    })),
  );
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  const update = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((all) => [
      ...all,
      {
        key: `rate-n${token()}`,
        id: `r${token()}`,
        zone: "FR",
        envelope: "",
        service: "",
        label: "",
        carrier: "",
        price: "",
        packagingWeight: "",
        maxWeight: "",
        maxThickness: "",
        maxLength: "",
        maxWidth: "",
        enabled: true,
        free: false,
      },
    ]);
  const remove = async (row: Row) => {
    const ok = await ask({
      title: "Supprimer ce tarif ?",
      message: `« ${row.label || "Tarif sans libellé"} » sera retiré du formulaire. Rien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (ok) setRows((all) => all.filter((r) => r.key !== row.key));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    const active = rows.filter((r) => r.enabled && zones[r.zone]).length;
    const ok = await ask({
      title: "Enregistrer l'expédition ?",
      message: `Zones ouvertes : ${settings.zones.filter((z) => zones[z.code]).map((z) => z.name).join(", ") || "aucune"}. ${active} tarif(s) actif(s) dans une zone ouverte. Ces réglages remplacent les précédents et serviront au panier dès l'ouverture du paiement.`,
      confirmLabel: "Enregistrer",
    });
    if (ok) {
      confirmed.current = true;
      form.current?.requestSubmit();
    }
  };

  const err = (name: string) => errors[name];
  const field = (row: Row, name: keyof Row, label: string, opts: { hint?: string; inputMode?: "decimal" | "numeric"; maxLength?: number } = {}) => {
    const n = `${row.key}.${name}`;
    const e = err(n);
    return (
      <label className="text-sm font-semibold text-ink">
        {label}
        {opts.hint && <span className="font-normal text-ink-muted"> ({opts.hint})</span>}
        <input
          name={n}
          value={row[name] as string}
          onChange={(ev) => update(row.key, { [name]: ev.target.value })}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength ?? 12}
          autoComplete="off"
          aria-invalid={e ? true : undefined}
          aria-describedby={e ? `${n}-error` : undefined}
          className={`${inputClass} px-3 text-sm`}
        />
        {e && (
          <span id={`${n}-error`} className="mt-1 block text-xs font-normal text-pink-strong">
            {e}
          </span>
        )}
      </label>
    );
  };
  const select = (row: Row, name: "zone" | "envelope" | "service", label: string, options: { value: string; label: string }[]) => {
    const n = `${row.key}.${name}`;
    const e = err(n);
    return (
      <label className="text-sm font-semibold text-ink">
        {label}
        <select
          name={n}
          value={row[name]}
          onChange={(ev) => update(row.key, { [name]: ev.target.value })}
          aria-invalid={e ? true : undefined}
          className={`${inputClass} px-3 text-sm`}
        >
          {name !== "zone" && <option value="">Choisir…</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {e && <span className="mt-1 block text-xs font-normal text-pink-strong">{e}</span>}
      </label>
    );
  };

  return (
    <form ref={form} action={action} onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <FormMessage state={state} />

      <Card title="Zones">
        <p className="text-ink-muted">Une zone fermée n&apos;est pas proposée au client, même si elle a des tarifs.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {settings.zones.map((z) => (
            <label key={z.code} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-secondary/40 bg-white px-4 text-ink has-[:checked]:border-ink">
              <input
                type="checkbox"
                name={`zone.${z.code}`}
                checked={zones[z.code] ?? false}
                onChange={(ev) => setZones((all) => ({ ...all, [z.code]: ev.target.checked }))}
                className="size-5 accent-pink-strong"
              />
              {z.name} <span className="text-xs text-ink-muted">({z.code})</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Tarifs">
        <p className="text-ink-muted">Prix en euros (par exemple 4,50), poids en grammes, dimensions en millimètres. Le poids de l&apos;emballage s&apos;ajoute à celui des articles.</p>
        {err("rates") && <p className="mt-2 text-sm text-pink-strong">{err("rates")}</p>}
        {rows.length === 0 && <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-ink">Aucun tarif. Sans tarif actif, aucune livraison n&apos;est proposée.</p>}
        <div className="mt-4 space-y-4">
          {rows.map((row, i) => (
            <fieldset key={row.key} className="rounded-2xl border-2 border-secondary/30 p-4">
              <legend className="px-2 font-semibold text-ink">
                Tarif {i + 1}
                {row.label ? ` : ${row.label}` : ""}
              </legend>
              <input type="hidden" name="rateKey" value={row.key} />
              <input type="hidden" name={`${row.key}.id`} value={row.id} />
              {err(`${row.key}.id`) && <p className="mb-2 text-sm text-pink-strong">{err(`${row.key}.id`)}</p>}
              <div className="grid gap-3 sm:grid-cols-3">
                {select(row, "zone", "Zone", settings.zones.map((z) => ({ value: z.code, label: z.name })))}
                {select(row, "envelope", "Enveloppe", ENVELOPES)}
                {select(row, "service", "Service", SERVICES)}
                {field(row, "label", "Libellé client", { maxLength: 60 })}
                {field(row, "carrier", "Transporteur", { hint: "facultatif", maxLength: 40 })}
                {field(row, "price", "Prix", { hint: "€", inputMode: "decimal" })}
                {field(row, "packagingWeight", "Poids emballage", { hint: "g", inputMode: "numeric" })}
                {field(row, "maxWeight", "Poids max", { hint: "g", inputMode: "numeric" })}
                {field(row, "maxThickness", "Épaisseur max", { hint: "mm", inputMode: "numeric" })}
                {field(row, "maxLength", "Longueur max", { hint: "mm", inputMode: "numeric" })}
                {field(row, "maxWidth", "Largeur max", { hint: "mm", inputMode: "numeric" })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name={`${row.key}.enabled`} checked={row.enabled} onChange={(ev) => update(row.key, { enabled: ev.target.checked })} className="size-5 accent-pink-strong" />
                  Tarif actif
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name={`${row.key}.free`} checked={row.free} onChange={(ev) => update(row.key, { free: ev.target.checked })} className="size-5 accent-pink-strong" />
                  Offert au-dessus du seuil
                </label>
                <button type="button" onClick={() => void remove(row)} className={`${secondaryButton} ml-auto`}>
                  <Trash2 aria-hidden className="size-4" />
                  Supprimer
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        {rows.length < MAX_RATES && (
          <button type="button" onClick={add} className={`${secondaryButton} mt-4`}>
            <Plus aria-hidden className="size-4" />
            Ajouter un tarif
          </button>
        )}
      </Card>

      <Card title="Livraison offerte">
        <label className="block max-w-xs text-sm font-semibold text-ink">
          Seuil du panier <span className="font-normal text-ink-muted">(€, vide = jamais offerte)</span>
          <input
            name="freeShippingThreshold"
            value={threshold}
            onChange={(ev) => setThreshold(ev.target.value)}
            inputMode="decimal"
            maxLength={9}
            autoComplete="off"
            aria-invalid={err("freeShippingThreshold") ? true : undefined}
            className={`${inputClass} px-3 text-sm`}
          />
          {err("freeShippingThreshold") && <span className="mt-1 block text-xs font-normal text-pink-strong">{err("freeShippingThreshold")}</span>}
        </label>
        <p className="mt-2 text-sm text-ink-muted">Seuls les tarifs cochés « Offert au-dessus du seuil » deviennent gratuits.</p>
      </Card>

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {dialog}
    </form>
  );
}

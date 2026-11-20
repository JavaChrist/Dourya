"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/app/mon-compte/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { errorCode, logEvent } from "@/lib/log";
import { notifyOrder } from "@/lib/notifications/service";
import { CARRIERS } from "@/lib/orders/carriers";
import { setFulfilmentStatus } from "@/lib/orders/repository";
import type { FulfilmentStatus, TrackingInfo } from "@/lib/orders/types";
import { allowAction } from "@/lib/security/limit";

const TARGETS: readonly FulfilmentStatus[] = ["preparing", "ready", "shipped", "delivered", "returned"];
const ORDER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TRACKING_NUMBER = /^[A-Za-z0-9-]{6,40}$/;

const REASONS: Record<string, string> = {
  tracking_required: "Ce mode d'envoi est suivi : indiquez le numéro de suivi.",
  delivery_proof_required: "Confirmez la livraison.",
  fulfilment_not_started: "Cette commande n'est pas payée.",
};

function readTracking(formData: FormData): TrackingInfo | null | "invalid" {
  const carrier = formData.get("carrier");
  const number = String(formData.get("trackingNumber") ?? "").replace(/\s+/g, "").toUpperCase();
  const rawUrl = String(formData.get("trackingUrl") ?? "").trim();
  if (!number) return null;
  if (typeof carrier !== "string" || !(CARRIERS as readonly string[]).includes(carrier) || !TRACKING_NUMBER.test(number)) return "invalid";
  let url: string | undefined;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:" || rawUrl.length > 300) return "invalid";
      url = parsed.toString();
    } catch {
      return "invalid";
    }
  }
  return { carrier, number, ...(url ? { url } : {}) };
}

/**
 * Admin fulfilment move. The admin role is checked again here. Marking an
 * order shipped sends the « Commande expédiée » e-mail once (never twice,
 * whatever the number of clicks).
 */
export async function setFulfilmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await allowAction("account:write", admin.uid))) return { status: "error", message: "Trop d'actions d'affilée. Réessayez dans quelques minutes." };
  const id = formData.get("id");
  const to = formData.get("to");
  if (typeof id !== "string" || !ORDER_ID.test(id) || typeof to !== "string" || !TARGETS.includes(to as FulfilmentStatus)) {
    return { status: "error", message: "Commande introuvable." };
  }
  const target = to as FulfilmentStatus;
  const tracking = target === "shipped" ? readTracking(formData) : null;
  if (tracking === "invalid") return { status: "error", message: "Transporteur ou numéro de suivi invalide (lettres et chiffres, lien en https)." };
  const proof = target === "delivered" ? (formData.get("proof") === "tracking" ? ({ kind: "tracking" } as const) : ({ kind: "manual_confirmation", adminUid: admin.uid } as const)) : undefined;
  const now = new Date();
  try {
    const result = await setFulfilmentStatus(id, target, { adminUid: admin.uid, tracking: tracking ?? undefined, proof }, now);
    if (result.kind === "not_found") return { status: "error", message: "Commande introuvable." };
    if (result.kind === "refused") return { status: "error", message: REASONS[result.reason] ?? "Ce changement n'est pas possible pour cette commande." };
    logEvent("order_fulfilment", { to: target, result: result.kind });
  } catch (error) {
    logEvent("order_fulfilment_error", { code: errorCode(error) });
    return { status: "error", message: "L'enregistrement n'a pas abouti." };
  }
  if (target === "shipped" || target === "delivered") await notifyOrder(id, now);
  refresh();
  return { status: "ok", message: "Commande mise à jour." };
}

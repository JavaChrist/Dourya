"use server";

import { getSessionUser } from "@/lib/auth/dal";
import { allowAction } from "@/lib/security/limit";
import { cleanName, isEmail, isOrderRef, normaliseEmail, type Requester, type WithdrawalLine } from "@/lib/withdrawals/eligibility";
import { lookupOrderForWithdrawal } from "@/lib/withdrawals/repository";
import { submitOrderWithdrawal } from "@/lib/withdrawals/service";

/**
 * Public withdrawal form (CGV article 7). Step 1 finds the order from its
 * number and the order's e-mail (or the signed-in account); step 2 records the
 * withdrawal. Ownership is checked again at step 2: the hidden fields prove
 * nothing. A missing order and someone else's order get the same message.
 */

export type FoundOrder = { id: string; email: string; createdAt: string | null; lines: WithdrawalLine[] };

export type LookupState = { status: "idle" } | { status: "error"; message: string } | { status: "found"; order: FoundOrder } | { status: "already"; orderId: string };

export type SubmitState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; receivedAt: string; orderId: string };

const NOT_FOUND = "Nous ne trouvons pas de commande payée avec ce numéro et cette adresse e-mail. Vérifiez-les ou écrivez à contact@dourya.fr.";
const RATE_LIMITED = "Trop de tentatives. Réessayez dans quelques minutes.";
const REASON_MESSAGE = {
  not_found: NOT_FOUND,
  not_paid: "Cette commande n'a pas été payée : il n'y a rien à rétracter.",
  refunded: "Cette commande a déjà été remboursée.",
  invalid_lines: "Choisissez au moins un article.",
} as const;

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};

async function requester(email: string): Promise<Requester> {
  const user = await getSessionUser();
  return { uid: user?.uid ?? null, email: email || null };
}

export async function lookupWithdrawalAction(_prev: LookupState, form: FormData): Promise<LookupState> {
  const orderId = text(form, "commande");
  const email = normaliseEmail(text(form, "email"));
  if (!isOrderRef(orderId) || (email && !isEmail(email))) return { status: "error", message: NOT_FOUND };
  const who = await requester(email);
  if (!who.uid && !who.email) return { status: "error", message: NOT_FOUND };
  if (!(await allowAction("withdrawal:lookup"))) return { status: "error", message: RATE_LIMITED };
  const result = await lookupOrderForWithdrawal(orderId, who);
  if (result.kind !== "ok") return { status: "error", message: REASON_MESSAGE[result.kind] };
  if (result.order.alreadyRequested) return { status: "already", orderId };
  return { status: "found", order: { id: orderId, email, createdAt: result.order.createdAt, lines: result.order.lines } };
}

export async function submitWithdrawalAction(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const orderId = text(form, "commande");
  const email = normaliseEmail(text(form, "email"));
  const name = cleanName(form.get("name"));
  if (!name) return { status: "error", message: "Indiquez votre nom et prénom (2 à 80 caractères)." };
  if (!isOrderRef(orderId) || (email && !isEmail(email))) return { status: "error", message: NOT_FOUND };
  const who = await requester(email);
  if (!who.uid && !who.email) return { status: "error", message: NOT_FOUND };
  if (!(await allowAction("withdrawal:submit", who.uid ?? undefined))) return { status: "error", message: RATE_LIMITED };
  const result = await submitOrderWithdrawal({ orderId, who, name, lineIndexes: form.getAll("lines"), now: new Date() });
  if (result.kind === "created" || result.kind === "already") return { status: "done", receivedAt: result.withdrawal.receivedAt, orderId };
  return { status: "error", message: REASON_MESSAGE[result.kind] };
}

"use server";

import { unsubscribe, type UnsubscribeResult } from "@/lib/email/unsubscribe-service";

export type UnsubscribeState = { status: "idle" } | { status: UnsubscribeResult };

/** Confirmation button of the unsubscribe page: the GET request alone never changes anything. */
export async function confirmUnsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  return { status: await unsubscribe(formData.get("token"), "unsubscribe-link") };
}

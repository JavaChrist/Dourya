import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getSessionUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

async function CheckoutContent() {
  const user = await getSessionUser();
  return <CheckoutForm defaultEmail={user?.email ?? ""} />;
}

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Commande</h1>
      <Suspense fallback={<p className="mt-8 text-ink-muted" role="status">Préparation de la commande…</p>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}

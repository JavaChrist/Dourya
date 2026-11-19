import Image from "next/image";
import { CreditCard } from "lucide-react";
import type { PaymentMethodBadge } from "@/lib/checkout/payment-methods";

/**
 * Payment methods shown under the checkout button. Card uses a generic icon;
 * Apple Pay and Google Pay use their OFFICIAL marks once the files are in
 * public/ (see paymentConfig.display), and their name as text until then.
 */
export function PaymentMethods({ methods }: { methods: PaymentMethodBadge[] }) {
  if (methods.length === 0) return null;
  return (
    <ul aria-label="Moyens de paiement acceptés" className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {methods.map((m) => (
        <li key={m.id}>
          {m.logo ? (
            <Image src={m.logo} alt={m.label} width={38} height={24} className="h-6 w-auto" />
          ) : (
            <span className="inline-flex h-6 items-center gap-1 rounded border border-secondary/50 bg-white px-2 text-xs font-semibold text-ink">
              {m.id === "card" && <CreditCard aria-hidden className="size-3.5 text-pink-strong" />}
              {m.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

import type { Metadata } from "next";
import { InfoPlaceholder } from "@/components/ui/InfoPlaceholder";

export const metadata: Metadata = { title: "Panier" };

export default function CartPage() {
  return (
    <InfoPlaceholder title="Panier">
      <p>Le panier arrive au lot 2, le paiement Mollie au lot 4.</p>
      <p>Aucune commande ni aucun paiement n&apos;est possible pour le moment.</p>
    </InfoPlaceholder>
  );
}

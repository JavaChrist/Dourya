import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressBook } from "@/components/account/AddressBook";
import { Card } from "@/components/account/ui";
import { accountConfig } from "@/config/commerce";
import { listAddresses } from "@/lib/account/repository";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Adresses" };

async function AddressesContent() {
  const user = await requireUser("/mon-compte/adresses");
  const addresses = await listAddresses(user.uid);
  return <AddressBook addresses={addresses} countries={accountConfig.addressCountries} max={accountConfig.maxAddresses} />;
}

export default function AddressesPage() {
  return (
    <Card title="Adresses de livraison">
      <Suspense fallback={<p role="status" className="text-ink-muted">Chargement des adresses…</p>}>
        <AddressesContent />
      </Suspense>
    </Card>
  );
}

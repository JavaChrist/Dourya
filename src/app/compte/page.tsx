import type { Metadata } from "next";
import { InfoPlaceholder } from "@/components/ui/InfoPlaceholder";

export const metadata: Metadata = { title: "Mon compte" };

export default function AccountPage() {
  return (
    <InfoPlaceholder title="Mon compte">
      <p>La connexion et l&apos;espace client arrivent au lot 3.</p>
    </InfoPlaceholder>
  );
}

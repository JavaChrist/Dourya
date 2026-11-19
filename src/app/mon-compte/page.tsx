import { Suspense } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, MonitorSmartphone } from "lucide-react";
import { ConsentForm, ProfileForm } from "@/components/account/ProfileForms";
import { Card, formatDate, secondaryButton } from "@/components/account/ui";
import { getProfile } from "@/lib/account/repository";
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/dal";

async function ProfileContent() {
  const user = await requireUser("/mon-compte");
  const profile = await getProfile(user.uid, user.email);
  return (
    <div className="space-y-6">
      {user.role === "admin" && (
        <Card title="Administration">
          <p className="text-ink-muted">Ce compte a accès à l&apos;administration de la boutique.</p>
          <Link href="/admin" className={`${secondaryButton} mt-4`}>
            <LayoutDashboard aria-hidden className="size-4" />
            Ouvrir l&apos;administration
          </Link>
        </Card>
      )}
      <Card title="Profil">
        <ProfileForm email={profile.email} displayName={profile.displayName} />
        {profile.createdAt && <p className="mt-4 text-sm text-ink-muted">Compte créé le {formatDate(profile.createdAt)}.</p>}
      </Card>
      <Card title="Préférences et consentements">
        <ConsentForm granted={profile.newsletter.granted} updatedAt={profile.newsletter.updatedAt} />
      </Card>
      <Card title="Connexion">
        <div className="flex flex-wrap gap-3">
          <form action={signOutAction}>
            <button type="submit" className={secondaryButton}>
              <LogOut aria-hidden className="size-4" />
              Se déconnecter
            </button>
          </form>
          <form action={signOutEverywhereAction}>
            <button type="submit" className={secondaryButton}>
              <MonitorSmartphone aria-hidden className="size-4" />
              Se déconnecter de tous les appareils
            </button>
          </form>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          Pour changer de mot de passe, déconnectez-vous puis utilisez « Mot de passe oublié » sur la page de connexion.
        </p>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p role="status" className="text-ink-muted">Chargement du compte…</p>}>
      <ProfileContent />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthActionHandler } from "@/components/auth/AuthActionHandler";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Votre compte DOURYA",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Opens the links of the account e-mails (address confirmation, new password).
 * The one-time code is read once, then removed from the address bar.
 */
export default function AuthActionPage() {
  return (
    <AuthShell title="Votre compte">
      <Suspense fallback={<p className="text-ink-muted">Chargement…</p>}>
        <AuthActionHandler />
      </Suspense>
    </AuthShell>
  );
}

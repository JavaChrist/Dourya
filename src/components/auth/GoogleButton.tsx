"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { LoaderCircle } from "lucide-react";
import { startSessionAction } from "@/lib/auth/actions";
import { clientAuth } from "@/lib/firebase/client";
import { googleSignInErrorMessage } from "@/lib/firebase/auth-errors";
import { Notice } from "./FormParts";

const SERVER_ERRORS = {
  credentials: "La connexion avec Google n'a pas abouti. Réessayez plus tard.",
  stale: "La connexion a pris trop de temps. Réessayez.",
  unverified: "Votre adresse Google n'est pas vérifiée. Utilisez votre e-mail et votre mot de passe.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  unavailable: "Le service est momentanément indisponible. Réessayez plus tard.",
} as const;

/** Google "G" mark, as Google's sign-in branding rules require (no Lucide equivalent). */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Continue with Google" for the customer area. The popup gives a Google ID token,
 * the server turns it into the same HttpOnly session as a password sign-in,
 * then the browser signs out of Firebase (it keeps no token).
 * A first Google sign-in creates the account; the profile is created by the server.
 */
export function GoogleButton({ next, disabled }: { next?: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const auth = clientAuth();
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const result = await startSessionAction(await credential.user.getIdToken(), "customer", next);
      await signOut(auth);
      if (!result.ok) {
        setError(SERVER_ERRORS[result.error]);
        setPending(false);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    } catch (err) {
      await signOut(auth).catch(() => undefined);
      setError(googleSignInErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Notice tone="error">{error}</Notice>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending || disabled}
        aria-disabled={pending || disabled}
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border-2 border-secondary/40 bg-white px-6 font-bold text-ink transition hover:border-ink disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <GoogleMark />}
        {pending ? "Connexion…" : "Continuer avec Google"}
      </button>
    </div>
  );
}

/** "ou" separator between the Google button and the e-mail form. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-muted" role="separator" aria-label="ou">
      <span className="h-px flex-1 bg-secondary/40" />
      <span aria-hidden>ou</span>
      <span className="h-px flex-1 bg-secondary/40" />
    </div>
  );
}

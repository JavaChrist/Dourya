"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { startSessionAction } from "@/lib/auth/actions";
import type { SessionScope } from "@/lib/auth/config";
import { clientAuth, isClientAuthConfigured } from "@/lib/firebase/client";
import { signInErrorMessage, siteUrl } from "@/lib/firebase/auth-errors";
import { ConfigMissing, Field, Notice, SubmitButton } from "./FormParts";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { PasswordField } from "./PasswordField";
import { useResetOnLeave } from "./useResetOnLeave";

const NOTICES: Record<string, { tone: "info" | "success"; text: string }> = {
  "session-expiree": { tone: "info", text: "Votre session a expiré. Connectez-vous à nouveau." },
  deconnecte: { tone: "success", text: "Déconnexion effectuée." },
};

const SERVER_ERRORS = {
  credentials: "Adresse e-mail ou mot de passe incorrect.",
  stale: "La connexion a pris trop de temps. Réessayez.",
  unverified: "Votre adresse e-mail n'est pas encore confirmée.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  unavailable: "Le service est momentanément indisponible. Réessayez plus tard.",
} as const;

const VERIFICATION_NOTICES = {
  sent: "Votre adresse e-mail n'est pas encore confirmée. Nous venons de vous renvoyer le lien de confirmation.",
  use_firebase: "Votre adresse e-mail n'est pas encore confirmée. Nous venons de vous renvoyer le lien de confirmation.",
  rate_limited: "Votre adresse e-mail n'est pas encore confirmée. Un lien vous a déjà été envoyé récemment : vérifiez votre boîte de réception et les courriers indésirables.",
  failed: "Votre adresse e-mail n'est pas encore confirmée. Le renvoi du lien n'a pas abouti : réessayez dans quelques minutes.",
} as const;

/**
 * Sign-in: Firebase checks the password in the browser, then the server turns
 * the fresh ID token into an HttpOnly session cookie. The browser keeps no token.
 */
export function LoginForm({ scope }: { scope: SessionScope }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const formRef = useResetOnLeave(() => {
    setPending(false);
    setError(null);
    setInfo(null);
  });

  const reason = params.get("raison");
  const notice = reason ? NOTICES[reason] : undefined;
  const verified = params.get("email-verifie") === "1";
  const reset = params.get("mdp-reinitialise") === "1";

  if (!isClientAuthConfigured()) return <ConfigMissing />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError("Indiquez votre adresse e-mail et votre mot de passe.");
      return;
    }
    setPending(true);
    const auth = clientAuth();
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const result = await startSessionAction(idToken, scope, params.get("next") ?? undefined);
      if (!result.ok && result.error === "unverified") {
        if (result.verification === "use_firebase") {
          await sendEmailVerification(credential.user, { url: siteUrl("/connexion?email-verifie=1") }).catch(() => undefined);
        }
        await signOut(auth);
        setInfo(VERIFICATION_NOTICES[result.verification]);
        setPending(false);
        return;
      }
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
      setError(signInErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {verified && <Notice tone="success">Adresse e-mail confirmée. Vous pouvez vous connecter.</Notice>}
      {reset && <Notice tone="success">Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="info">{info}</Notice>}
      {scope === "customer" && (
        <>
          <GoogleButton next={params.get("next") ?? undefined} disabled={pending} />
          <OrDivider />
        </>
      )}

      <Field id="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      <PasswordField id="password" label="Mot de passe" autoComplete="current-password" required maxLength={128} />
      {scope === "customer" && (
        <p className="text-sm">
          <Link href="/mot-de-passe-oublie" className="font-bold text-link hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>
      )}
      <SubmitButton pending={pending} pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  );
}

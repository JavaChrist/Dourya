"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { clientAuth, isClientAuthConfigured } from "@/lib/firebase/client";
import { isCode, siteUrl } from "@/lib/firebase/auth-errors";
import { ConfigMissing, Field, Notice, SubmitButton } from "./FormParts";
import { useResetOnLeave } from "./useResetOnLeave";

/** Password reset request. The answer is the same whether the address has an account or not. */
export function ResetForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useResetOnLeave(() => {
    setPending(false);
    setSent(false);
    setError(null);
  });

  if (!isClientAuthConfigured()) return <ConfigMissing />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Indiquez une adresse e-mail valide.");
      return;
    }
    setPending(true);
    try {
      await sendPasswordResetEmail(clientAuth(), email, { url: siteUrl("/connexion?mdp-reinitialise=1") });
      setSent(true);
    } catch (err) {
      if (isCode(err, "auth/too-many-requests")) setError("Trop de demandes. Réessayez dans quelques minutes.");
      else if (isCode(err, "auth/network-request-failed")) setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
      // Any other error (including an unknown address) shows the neutral confirmation.
      else setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <Notice tone="success">
        Si un compte existe pour cette adresse, un e-mail avec un lien de réinitialisation vient d&apos;être envoyé. Pensez à regarder dans les
        courriers indésirables.
      </Notice>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      <SubmitButton pending={pending} pendingLabel="Envoi…">
        Recevoir le lien
      </SubmitButton>
    </form>
  );
}

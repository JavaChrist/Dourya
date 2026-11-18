"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { sendVerificationEmailAction } from "@/lib/auth/email-actions";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "@/lib/account/validation";
import { clientAuth, isClientAuthConfigured } from "@/lib/firebase/client";
import { isCode, siteUrl } from "@/lib/firebase/auth-errors";
import { ConfigMissing, Field, Notice, SubmitButton } from "./FormParts";
import { useResetOnLeave } from "./useResetOnLeave";

type Errors = { email?: string; password?: string; confirm?: string; form?: string };

/**
 * Sign-up with e-mail and password. Whatever happens with the e-mail (new or
 * already used), the visitor lands on the same "check your inbox" page:
 * the form never reveals whether an address already has an account.
 */
export function SignupForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useResetOnLeave(() => {
    setPending(false);
    setErrors({});
  });

  if (!isClientAuthConfigured()) return <ConfigMissing />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) next.email = "Indiquez une adresse e-mail valide.";
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    else if (password !== confirm) next.confirm = "Les deux mots de passe ne sont pas identiques.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const auth = clientAuth();
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // The server sends the DOURYA e-mail; while custom e-mails are off it answers
      // "use_firebase" and the Firebase e-mail is sent from here, as before.
      const sent = await sendVerificationEmailAction(await credential.user.getIdToken()).catch(() => ({ status: "use_firebase" as const }));
      if (sent.status === "use_firebase") {
        await sendEmailVerification(credential.user, { url: siteUrl("/connexion?email-verifie=1") }).catch(() => undefined);
      }
      await signOut(auth);
      router.push("/verification-email");
    } catch (err) {
      await signOut(auth).catch(() => undefined);
      if (isCode(err, "auth/email-already-in-use")) {
        router.push("/verification-email");
        return;
      }
      if (isCode(err, "auth/weak-password")) setErrors({ password: "Mot de passe trop simple. Choisissez-en un plus long." });
      else if (isCode(err, "auth/too-many-requests")) setErrors({ form: "Trop de tentatives. Réessayez dans quelques minutes." });
      else if (isCode(err, "auth/network-request-failed")) setErrors({ form: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
      else setErrors({ form: "La création du compte n'a pas abouti. Réessayez plus tard." });
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <Field id="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" required maxLength={254} error={errors.email} />
      <Field
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={`${PASSWORD_MIN} caractères minimum. Une phrase de passe est idéale.`}
        error={errors.password}
      />
      <Field id="confirm" label="Confirmer le mot de passe" type="password" autoComplete="new-password" required maxLength={PASSWORD_MAX} error={errors.confirm} />
      <p className="text-sm text-ink-muted">
        Vos données servent à gérer votre compte et vos commandes. Voir la{" "}
        <Link href="/infos/confidentialite" className="font-bold text-link hover:underline">
          politique de confidentialité
        </Link>
        .
      </p>
      <SubmitButton pending={pending} pendingLabel="Création…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}

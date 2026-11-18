"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "@/lib/account/validation";
import { AUTH_ACTION_PATH, isAuthActionMode, isOobCode, type AuthActionMode } from "@/lib/email/links";
import { clientAuth, isClientAuthConfigured } from "@/lib/firebase/client";
import { isCode } from "@/lib/firebase/auth-errors";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ConfigMissing, Notice, SubmitButton } from "./FormParts";
import { PasswordField } from "./PasswordField";

type Action = { mode: AuthActionMode; code: string } | null;

type State =
  | { step: "checking" }
  | { step: "invalid" }
  | { step: "verified" }
  | { step: "choose-password" }
  | { step: "password-changed" };

/** Expired, already used or altered code: the same neutral message in every case. */
function InvalidLink({ mode }: { mode?: AuthActionMode }) {
  return (
    <div className="space-y-5">
      <Notice tone="error">Ce lien n&apos;est plus valide : il a expiré, a déjà servi ou est incomplet.</Notice>
      {mode === "resetPassword" ? (
        <ButtonLink href="/mot-de-passe-oublie" className="w-full">
          Demander un nouveau lien
        </ButtonLink>
      ) : (
        <>
          <p className="text-sm text-ink-muted">Connectez-vous : si votre adresse n&apos;est pas encore confirmée, un nouveau lien vous sera envoyé.</p>
          <ButtonLink href="/connexion" className="w-full">
            Aller à la connexion
          </ButtonLink>
        </>
      )}
    </div>
  );
}

export function AuthActionHandler() {
  const params = useSearchParams();
  // Read once: the code is then removed from the URL (history, screenshots, referrer).
  const [action] = useState<Action>(() => {
    const mode = params.get("mode");
    const code = params.get("oobCode");
    return isAuthActionMode(mode) && isOobCode(code) ? { mode, code } : null;
  });
  const [state, setState] = useState<State>(() => (action && isClientAuthConfigured() ? { step: "checking" } : { step: "invalid" }));
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (window.location.search) window.history.replaceState(null, "", AUTH_ACTION_PATH);
    if (!action || !isClientAuthConfigured()) return;
    const auth = clientAuth();
    const run =
      action.mode === "verifyEmail"
        ? applyActionCode(auth, action.code).then(() => setState({ step: "verified" }))
        : verifyPasswordResetCode(auth, action.code).then(() => setState({ step: "choose-password" }));
    run.catch(() => setState({ step: "invalid" }));
  }, [action]);

  if (!isClientAuthConfigured()) return <ConfigMissing />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!action) return;
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const problem = passwordProblem(password);
    if (problem) return setErrors({ password: problem });
    if (password !== confirm) return setErrors({ confirm: "Les deux mots de passe ne sont pas identiques." });
    setErrors({});
    setPending(true);
    try {
      await confirmPasswordReset(clientAuth(), action.code, password);
      formEl.reset();
      setState({ step: "password-changed" });
    } catch (err) {
      if (isCode(err, "auth/weak-password")) setErrors({ password: "Mot de passe trop simple. Choisissez-en un plus long." });
      else if (isCode(err, "auth/network-request-failed")) setErrors({ form: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
      else setState({ step: "invalid" });
    } finally {
      setPending(false);
    }
  }

  switch (state.step) {
    case "checking":
      return (
        <p role="status" className="flex items-center gap-2 text-ink-muted">
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
          Vérification du lien…
        </p>
      );
    case "invalid":
      return <InvalidLink mode={action?.mode} />;
    case "verified":
      return (
        <div className="space-y-5">
          <Notice tone="success">Adresse e-mail confirmée. Votre compte DOURYA est activé.</Notice>
          <ButtonLink href="/connexion?email-verifie=1" className="w-full">
            Se connecter
          </ButtonLink>
        </div>
      );
    case "password-changed":
      return (
        <div className="space-y-5">
          <Notice tone="success">Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.</Notice>
          <ButtonLink href="/connexion?mdp-reinitialise=1" className="w-full">
            Se connecter
          </ButtonLink>
        </div>
      );
    case "choose-password":
      return (
        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
          <p className="text-ink">Choisissez un nouveau mot de passe pour votre compte.</p>
          {errors.form && <Notice tone="error">{errors.form}</Notice>}
          <PasswordField
            id="password"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            hint={`${PASSWORD_MIN} caractères minimum. Une phrase de passe est idéale.`}
            error={errors.password}
          />
          <PasswordField id="confirm" label="Confirmer le mot de passe" autoComplete="new-password" required maxLength={PASSWORD_MAX} error={errors.confirm} />
          <SubmitButton pending={pending} pendingLabel="Enregistrement…">
            Enregistrer le mot de passe
          </SubmitButton>
        </form>
      );
  }
}

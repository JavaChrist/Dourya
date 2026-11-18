"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { inputClass } from "./FormParts";

/**
 * Password input with a show / hide button. The button is type="button" so it
 * never submits the form, and aria-pressed tells screen readers its state.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  ...input
}: { id: string; label: string; hint?: ReactNode; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const Icon = visible ? EyeOff : Eye;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} pr-12`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-controls={id}
          className="absolute inset-y-0 right-1 mt-1.5 flex w-10 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink"
        >
          <Icon aria-hidden className="size-5" />
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-bold text-pink-strong">
          {error}
        </p>
      )}
    </div>
  );
}

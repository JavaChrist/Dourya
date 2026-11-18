import { Resend } from "resend";

/** A rendered e-mail ready to hand to a transport. */
export type OutgoingEmail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Resend tags: ASCII letters, digits, "_" and "-" only. */
  tags?: { name: string; value: string }[];
  /** Same key = same e-mail: a retry never sends twice (Resend keeps keys 24 h). */
  idempotencyKey?: string;
};

export type EmailErrorCode = "rate_limited" | "rejected" | "unavailable";

export type TransportResult = { ok: true; id: string } | { ok: false; error: EmailErrorCode; retryable: boolean };

export interface EmailTransport {
  readonly name: "resend" | "test";
  send(email: OutgoingEmail): Promise<TransportResult>;
}

/** Maps a Resend API error (or a network failure, statusCode null) to a short code. */
export function mapResendError(error: { statusCode?: number | null; name?: string } | null | undefined): { error: EmailErrorCode; retryable: boolean } {
  const status = error?.statusCode ?? null;
  if (status === 429) return { error: "rate_limited", retryable: true };
  if (status === 409 && error?.name === "concurrent_idempotent_requests") return { error: "unavailable", retryable: true };
  if (status === null || status >= 500) return { error: "unavailable", retryable: true };
  return { error: "rejected", retryable: false };
}

export class ResendTransport implements EmailTransport {
  readonly name = "resend" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail): Promise<TransportResult> {
    try {
      const { data, error } = await this.client.emails.send(
        {
          from: email.from,
          to: email.to,
          replyTo: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
          tags: email.tags,
        },
        email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
      );
      if (error || !data) return { ok: false, ...mapResendError(error) };
      return { ok: true, id: data.id };
    } catch {
      return { ok: false, error: "unavailable", retryable: true };
    }
  }
}

/**
 * Test transport: keeps the last e-mails in memory and sends nothing.
 * Used in dev, on the emulators and in the tests (EMAIL_TRANSPORT=test).
 */
export class MemoryTransport implements EmailTransport {
  readonly name = "test" as const;
  readonly sent: (OutgoingEmail & { id: string })[] = [];
  private readonly seen = new Map<string, string>();
  private counter = 0;

  constructor(private readonly max = 50) {}

  async send(email: OutgoingEmail): Promise<TransportResult> {
    const previous = email.idempotencyKey ? this.seen.get(email.idempotencyKey) : undefined;
    if (previous) return { ok: true, id: previous };
    const id = `test-${++this.counter}`;
    if (email.idempotencyKey) this.seen.set(email.idempotencyKey, id);
    this.sent.push({ ...email, id });
    if (this.sent.length > this.max) this.sent.splice(0, this.sent.length - this.max);
    return { ok: true, id };
  }

  clear(): void {
    this.sent.length = 0;
    this.seen.clear();
  }
}

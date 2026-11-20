import { Button, Link, Text } from "@react-email/components";
import { PaddedSection, buttonStyle, linkStyle, smallTextStyle, textStyle } from "./EmailLayout";
import { colors } from "./theme";

/** Blocks shared by the order and Mail Club e-mails (templates 3 to 7). */

/** Padding on the <td> (PaddedSection): Outlook ignores it on a <table>. */
export const BOX = { padding: "12px 16px", style: { backgroundColor: colors.blush, borderRadius: "12px" } };

export const tight = { ...textStyle, margin: "2px 0" } as const;

export type EmailLine = { label: string; quantity: number; totalLabel?: string };

export function LinesBox({ lines, totals }: { lines: EmailLine[]; totals?: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <PaddedSection {...BOX}>
      {lines.map((l, i) => (
        <Text key={i} style={tight}>
          {l.quantity} × {l.label}
          {l.totalLabel ? ` : ${l.totalLabel}` : ""}
        </Text>
      ))}
      {totals?.map((t) => (
        <Text key={t.label} style={{ ...tight, ...(t.strong ? { fontWeight: 800 } : {}) }}>
          {t.label} : {t.value}
        </Text>
      ))}
    </PaddedSection>
  );
}

export function AddressBox({ lines }: { lines: string[] }) {
  return (
    <PaddedSection {...BOX}>
      {lines.map((l, i) => (
        <Text key={i} style={tight}>
          {l}
        </Text>
      ))}
    </PaddedSection>
  );
}

export function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <PaddedSection padding="8px 0 24px" style={{ textAlign: "center" }}>
      <Button href={href} style={buttonStyle}>
        {label}
      </Button>
    </PaddedSection>
  );
}

export function HelpLine() {
  return <Text style={smallTextStyle}>Une question ? Répondez simplement à cet e-mail ou écrivez à contact@dourya.fr.</Text>;
}

export function SiteLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} style={linkStyle}>
      {children}
    </Link>
  );
}

export const HELP_TEXT = "Une question ? Répondez simplement à cet e-mail ou écrivez à contact@dourya.fr.";

export const lineText = (l: EmailLine) => `- ${l.quantity} × ${l.label}${l.totalLabel ? ` : ${l.totalLabel}` : ""}`;

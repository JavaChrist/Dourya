import { Heading, Text } from "@react-email/components";
import { EmailLayout, headingStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { ActionButton, HELP_TEXT, HelpLine } from "./_components/blocks";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/**
 * Template 7: cancellation confirmed (CGV article 5: DOURYA confirms the
 * request and its effective date by e-mail).
 */
export type MailClubCancelledProps = BaseEmailProps & {
  /** Date the request was recorded, already formatted. */
  requestedAtLabel: string;
  /** End of the paid month, already formatted, or null when Stripe did not say. */
  endLabel: string | null;
  manageUrl: string;
};

export const mailClubCancelledDefaults = {
  subject: "Résiliation de votre Mail Club confirmée",
  preheader: "Plus aucun prélèvement : votre dernier pack reste envoyé.",
};

const REASON = "Vous recevez cet e-mail car une résiliation du Dopamine Mail Club a été demandée depuis votre compte dourya.fr.";

const effect = (p: MailClubCancelledProps) =>
  `Nous avons bien reçu votre demande de résiliation le ${p.requestedAtLabel}. Elle prend effet à la fin du mois déjà payé${
    p.endLabel ? `, le ${p.endLabel}` : ""
  } : aucun nouveau prélèvement ne sera effectué.`;

const LAST = "Le pack de la période déjà réglée vous est envoyé normalement.";

export default function MailClubCancelled(props: MailClubCancelledProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Résiliation confirmée
      </Heading>
      <Text style={textStyle}>Bonjour,</Text>
      <Text style={textStyle}>{effect(props)}</Text>
      <Text style={textStyle}>{LAST}</Text>
      <ActionButton href={props.manageUrl} label="Voir mon abonnement" />
      <Text style={smallTextStyle}>Merci d&apos;avoir fait partie du Mail Club. Vous pourrez vous réabonner quand vous le souhaitez.</Text>
      <HelpLine />
    </EmailLayout>
  );
}

export function mailClubCancelledText(props: MailClubCancelledProps): string {
  return [
    "Résiliation confirmée",
    "",
    "Bonjour,",
    "",
    effect(props),
    "",
    LAST,
    "",
    `Voir mon abonnement : ${props.manageUrl}`,
    "",
    "Merci d'avoir fait partie du Mail Club. Vous pourrez vous réabonner quand vous le souhaitez.",
    "",
    HELP_TEXT,
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

MailClubCancelled.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: mailClubCancelledDefaults.preheader,
  requestedAtLabel: "20 novembre 2026",
  endLabel: "20 décembre 2026",
  manageUrl: "http://localhost:3000/mon-compte/abonnement",
} satisfies MailClubCancelledProps;

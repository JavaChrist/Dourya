import { Heading, Text } from "@react-email/components";
import { EmailLayout, headingStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { HELP_TEXT, HelpLine } from "./_components/blocks";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/** Template 5: a refund was made in Stripe (charge.refunded, re-read at Stripe). */
export type OrderRefundedProps = BaseEmailProps & {
  name: string;
  orderId: string;
  /** This refund. */
  amountLabel: string;
  /** Everything refunded so far on this order. */
  totalRefundedLabel: string;
  full: boolean;
};

export const orderRefundedDefaults = {
  subject: "Votre remboursement DOURYA",
  preheader: "Un remboursement vient d'être effectué sur votre commande.",
};

const REASON = "Vous recevez cet e-mail car une commande a été passée sur dourya.fr avec cette adresse.";

const summary = (p: OrderRefundedProps) =>
  p.full
    ? `Votre commande n° ${p.orderId} a été remboursée : ${p.amountLabel}.`
    : `Un remboursement de ${p.amountLabel} a été effectué sur votre commande n° ${p.orderId} (total remboursé : ${p.totalRefundedLabel}).`;

const DELAY = "Le montant est recrédité sur le moyen de paiement utilisé. Selon votre banque, il apparaît sur votre compte sous 5 à 10 jours.";

export default function OrderRefunded(props: OrderRefundedProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Remboursement effectué
      </Heading>
      <Text style={textStyle}>Bonjour {props.name},</Text>
      <Text style={textStyle}>{summary(props)}</Text>
      <Text style={smallTextStyle}>{DELAY}</Text>
      <HelpLine />
    </EmailLayout>
  );
}

export function orderRefundedText(props: OrderRefundedProps): string {
  return [
    "Remboursement effectué",
    "",
    `Bonjour ${props.name},`,
    "",
    summary(props),
    "",
    DELAY,
    "",
    HELP_TEXT,
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

OrderRefunded.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: orderRefundedDefaults.preheader,
  name: "Client Exemple",
  orderId: "EXEMPLE-FICTIF",
  amountLabel: "9,90 €",
  totalRefundedLabel: "9,90 €",
  full: false,
} satisfies OrderRefundedProps;

import { Heading, Text } from "@react-email/components";
import { EmailLayout, headingStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { ActionButton, AddressBox, HELP_TEXT, HelpLine, SiteLink } from "./_components/blocks";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/**
 * Template 6: Mail Club subscription confirmed (first payment confirmed by
 * Stripe). Confirmation of the contract on a durable medium: price,
 * renewal, cancellation, withdrawal, CGV.
 */
export type MailClubStartedProps = BaseEmailProps & {
  priceLabel: string;
  /** Next monthly charge, already formatted, or null when Stripe did not say. */
  nextChargeLabel: string | null;
  address: string[];
  manageUrl: string;
};

export const mailClubStartedDefaults = {
  subject: "Bienvenue dans le Dopamine Mail Club",
  preheader: "Votre abonnement mensuel est confirmé.",
};

const REASON = "Vous recevez cet e-mail car un abonnement au Dopamine Mail Club a été souscrit sur dourya.fr avec cette adresse.";

const renewal = (p: MailClubStartedProps) =>
  `Votre abonnement mensuel à ${p.priceLabel} par mois, livraison incluse, est actif. Il est reconduit chaque mois à la date anniversaire${
    p.nextChargeLabel ? ` (prochain prélèvement le ${p.nextChargeLabel})` : ""
  }.`;

const CANCEL = "Vous pouvez le résilier à tout moment, sans frais, depuis Mon compte → Abonnement : la résiliation prend effet à la fin du mois déjà payé.";
const WITHDRAW = "Vous pouvez aussi vous rétracter dans les 14 jours suivant la réception de votre premier pack, depuis la même page.";

export default function MailClubStarted(props: MailClubStartedProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Bienvenue dans le Mail Club !
      </Heading>
      <Text style={textStyle}>Bonjour,</Text>
      <Text style={textStyle}>{renewal(props)}</Text>
      <Text style={textStyle}>Votre pack sera envoyé à :</Text>
      <AddressBox lines={props.address} />
      <ActionButton href={props.manageUrl} label="Gérer mon abonnement" />
      <Text style={smallTextStyle}>{CANCEL}</Text>
      <Text style={smallTextStyle}>
        {WITHDRAW} Nos conditions générales de vente : <SiteLink href={`${props.origin}/infos/cgv`}>dourya.fr/infos/cgv</SiteLink>.
      </Text>
      <HelpLine />
    </EmailLayout>
  );
}

export function mailClubStartedText(props: MailClubStartedProps): string {
  return [
    "Bienvenue dans le Mail Club !",
    "",
    "Bonjour,",
    "",
    renewal(props),
    "",
    "Votre pack sera envoyé à :",
    ...props.address,
    "",
    `Gérer mon abonnement : ${props.manageUrl}`,
    "",
    CANCEL,
    WITHDRAW,
    `Nos conditions générales de vente : ${props.origin}/infos/cgv`,
    "",
    HELP_TEXT,
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

MailClubStarted.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: mailClubStartedDefaults.preheader,
  priceLabel: "11,95 €",
  nextChargeLabel: "20 décembre 2026",
  address: ["Client Exemple", "1 rue Fictive", "00000 Ville", "France"],
  manageUrl: "http://localhost:3000/mon-compte/abonnement",
} satisfies MailClubStartedProps;

import { Heading, Text } from "@react-email/components";
import { EmailLayout, PaddedSection, headingStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { colors } from "./_components/theme";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/**
 * Acknowledgement of an online withdrawal (CGV article 7, L. 221-21: the
 * professional acknowledges a withdrawal made online "sans délai", on a
 * durable medium). Transactional: never blocked by a marketing unsubscribe.
 * Sent to the customer, with a copy to DOURYA.
 */
export type WithdrawalEmailProps = BaseEmailProps & {
  name: string;
  /** "commande n° …" or "abonnement Dopamine Mail Club". */
  reference: string;
  /** Date and time of the request, Europe/Paris, already formatted. */
  receivedAtLabel: string;
  items: { label: string; personalised: boolean }[];
  /** Goods to send back (order). The Mail Club has nothing to return. */
  returnGoods: boolean;
  /** Last day to send the goods back, already formatted. */
  returnByLabel: string;
  /** Mail Club: the subscription was stopped at once. */
  subscriptionStopped: boolean;
};

export const RETURN_ADDRESS = ["Lizzie Grohens, DOURYA", "5, rue Maurice Fonvieille", "31120 Portet-sur-Garonne", "France"];

export const withdrawalReceivedDefaults = {
  subject: "Votre demande de rétractation DOURYA est bien reçue",
  preheader: "Accusé de réception de votre rétractation, avec l'adresse de retour.",
};

const REASON = "Vous recevez cet e-mail car une demande de rétractation a été envoyée depuis dourya.fr avec cette adresse.";

/** Padding on the <td> (PaddedSection): Outlook ignores it on a <table>. */
const BOX = { padding: "12px 16px", style: { backgroundColor: colors.blush, borderRadius: "12px" } };

export default function WithdrawalReceived(props: WithdrawalEmailProps) {
  const personalised = props.items.some((i) => i.personalised);
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Rétractation bien reçue
      </Heading>
      <Text style={textStyle}>Bonjour {props.name},</Text>
      <Text style={textStyle}>
        Nous accusons réception de votre demande de rétractation pour votre {props.reference}, reçue le {props.receivedAtLabel}.
      </Text>
      <Text style={textStyle}>Articles concernés :</Text>
      <PaddedSection {...BOX}>
        {props.items.map((item, i) => (
          <Text key={i} style={{ ...textStyle, margin: "4px 0" }}>
            • {item.label}
            {item.personalised ? " (article personnalisé)" : ""}
          </Text>
        ))}
      </PaddedSection>
      {props.returnGoods && (
        <>
          <Text style={textStyle}>Merci de renvoyer ces articles, à vos frais, au plus tard le {props.returnByLabel} (14 jours), à l&apos;adresse suivante :</Text>
          <PaddedSection {...BOX}>
            {RETURN_ADDRESS.map((l) => (
              <Text key={l} style={{ ...textStyle, margin: "2px 0" }}>
                {l}
              </Text>
            ))}
          </PaddedSection>
          <Text style={textStyle}>
            Les articles doivent être retournés complets et en bon état. Nous vous rembourserons, par le moyen de paiement utilisé, au plus tard 14 jours après
            réception de votre demande ; le remboursement peut être différé jusqu&apos;à la réception des articles ou de la preuve de leur expédition.
          </Text>
        </>
      )}
      {props.subscriptionStopped && (
        <Text style={textStyle}>Votre abonnement est arrêté : aucun nouveau prélèvement ne sera effectué. Nous revenons vers vous pour le remboursement.</Text>
      )}
      {personalised && (
        <Text style={smallTextStyle}>
          Un article personnalisé selon vos indications est exclu du droit de rétractation (article L. 221-28 du Code de la consommation). Nous vérifions votre
          demande et revenons vers vous.
        </Text>
      )}
      <Text style={smallTextStyle}>Une question ? Répondez simplement à cet e-mail ou écrivez à contact@dourya.fr.</Text>
    </EmailLayout>
  );
}

export function withdrawalReceivedText(props: WithdrawalEmailProps): string {
  const personalised = props.items.some((i) => i.personalised);
  return [
    "Rétractation bien reçue",
    "",
    `Bonjour ${props.name},`,
    "",
    `Nous accusons réception de votre demande de rétractation pour votre ${props.reference}, reçue le ${props.receivedAtLabel}.`,
    "",
    "Articles concernés :",
    ...props.items.map((i) => `- ${i.label}${i.personalised ? " (article personnalisé)" : ""}`),
    "",
    ...(props.returnGoods
      ? [
          `Merci de renvoyer ces articles, à vos frais, au plus tard le ${props.returnByLabel} (14 jours), à l'adresse suivante :`,
          ...RETURN_ADDRESS,
          "",
          "Les articles doivent être retournés complets et en bon état. Nous vous rembourserons, par le moyen de paiement utilisé, au plus tard 14 jours après réception de votre demande ; le remboursement peut être différé jusqu'à la réception des articles ou de la preuve de leur expédition.",
          "",
        ]
      : []),
    ...(props.subscriptionStopped ? ["Votre abonnement est arrêté : aucun nouveau prélèvement ne sera effectué. Nous revenons vers vous pour le remboursement.", ""] : []),
    ...(personalised
      ? [
          "Un article personnalisé selon vos indications est exclu du droit de rétractation (article L. 221-28 du Code de la consommation). Nous vérifions votre demande et revenons vers vous.",
          "",
        ]
      : []),
    "Une question ? Répondez simplement à cet e-mail ou écrivez à contact@dourya.fr.",
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

/** Fake data for the React Email preview (npm run email:preview). */
WithdrawalReceived.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: withdrawalReceivedDefaults.preheader,
  name: "Client Exemple",
  reference: "commande n° EXEMPLE-FICTIF",
  receivedAtLabel: "20 novembre 2026 à 10:30",
  items: [
    { label: "Carnet A5 × 1", personalised: false },
    { label: "Headband prénom × 1", personalised: true },
  ],
  returnGoods: true,
  returnByLabel: "4 décembre 2026",
  subscriptionStopped: false,
} satisfies WithdrawalEmailProps;

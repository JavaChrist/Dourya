import { Heading, Text } from "@react-email/components";
import { EmailLayout, headingStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { ActionButton, AddressBox, HELP_TEXT, HelpLine, LinesBox, SiteLink, lineText, type EmailLine } from "./_components/blocks";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/**
 * Template 3: order confirmation, sent once the payment is confirmed by Stripe
 * (re-read at Stripe, never from the browser). It is the confirmation of the
 * contract on a durable medium (L. 221-13): order details, CGV, withdrawal.
 */
export type OrderConfirmedProps = BaseEmailProps & {
  name: string;
  orderId: string;
  orderDateLabel: string;
  lines: EmailLine[];
  subtotalLabel: string;
  shippingLabel: string;
  shippingPriceLabel: string;
  totalLabel: string;
  address: string[];
  /** Made-to-order items: produced before shipping. */
  madeToOrder: boolean;
  /** Customer area link, or null for a guest order. */
  orderUrl: string | null;
};

export const orderConfirmedDefaults = {
  subject: "Votre commande DOURYA est confirmée",
  preheader: "Paiement reçu : voici le récapitulatif de votre commande.",
};

const REASON = "Vous recevez cet e-mail car une commande a été passée sur dourya.fr avec cette adresse.";

const delay = (p: OrderConfirmedProps) =>
  p.madeToOrder
    ? "Votre commande contient un article fabriqué à la demande : nous le réalisons, puis l'expédions dans le délai indiqué sur sa fiche."
    : "Votre commande est expédiée par La Poste sous deux jours ouvrés. Vous recevrez un e-mail au départ du colis.";

export default function OrderConfirmed(props: OrderConfirmedProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Merci pour votre commande !
      </Heading>
      <Text style={textStyle}>Bonjour {props.name},</Text>
      <Text style={textStyle}>
        Nous avons bien reçu votre paiement. Votre commande n° {props.orderId} du {props.orderDateLabel} est confirmée.
      </Text>
      <LinesBox
        lines={props.lines}
        totals={[
          { label: "Sous-total", value: props.subtotalLabel },
          { label: `Livraison (${props.shippingLabel})`, value: props.shippingPriceLabel },
          { label: "Total payé TTC", value: props.totalLabel, strong: true },
        ]}
      />
      <Text style={{ ...textStyle, marginTop: "16px" }}>Adresse de livraison :</Text>
      <AddressBox lines={props.address} />
      <Text style={{ ...textStyle, marginTop: "16px" }}>{delay(props)}</Text>
      {props.orderUrl && <ActionButton href={props.orderUrl} label="Suivre ma commande" />}
      <Text style={smallTextStyle}>
        Vous disposez de 14 jours après réception pour vous rétracter, sauf pour les articles personnalisés selon vos indications :{" "}
        <SiteLink href={`${props.origin}/retractation`}>formulaire de rétractation en ligne</SiteLink>. Nos conditions générales de vente :{" "}
        <SiteLink href={`${props.origin}/infos/cgv`}>dourya.fr/infos/cgv</SiteLink>.
      </Text>
      <HelpLine />
    </EmailLayout>
  );
}

export function orderConfirmedText(props: OrderConfirmedProps): string {
  return [
    "Merci pour votre commande !",
    "",
    `Bonjour ${props.name},`,
    "",
    `Nous avons bien reçu votre paiement. Votre commande n° ${props.orderId} du ${props.orderDateLabel} est confirmée.`,
    "",
    ...props.lines.map(lineText),
    `Sous-total : ${props.subtotalLabel}`,
    `Livraison (${props.shippingLabel}) : ${props.shippingPriceLabel}`,
    `Total payé TTC : ${props.totalLabel}`,
    "",
    "Adresse de livraison :",
    ...props.address,
    "",
    delay(props),
    ...(props.orderUrl ? ["", `Suivre ma commande : ${props.orderUrl}`] : []),
    "",
    `Vous disposez de 14 jours après réception pour vous rétracter, sauf pour les articles personnalisés selon vos indications : ${props.origin}/retractation`,
    `Nos conditions générales de vente : ${props.origin}/infos/cgv`,
    "",
    HELP_TEXT,
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

/** Fake data for the React Email preview (npm run email:preview). */
OrderConfirmed.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: orderConfirmedDefaults.preheader,
  name: "Client Exemple",
  orderId: "EXEMPLE-FICTIF",
  orderDateLabel: "20 novembre 2026",
  lines: [
    { label: "Carnet A5", quantity: 1, totalLabel: "9,90 €" },
    { label: "Headband (Rose)", quantity: 2, totalLabel: "19,80 €" },
  ],
  subtotalLabel: "29,70 €",
  shippingLabel: "Lettre suivie",
  shippingPriceLabel: "3,50 €",
  totalLabel: "33,20 €",
  address: ["Client Exemple", "1 rue Fictive", "00000 Ville", "France"],
  madeToOrder: false,
  orderUrl: "http://localhost:3000/mon-compte/commandes/EXEMPLE-FICTIF",
} satisfies OrderConfirmedProps;

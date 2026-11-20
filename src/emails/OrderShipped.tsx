import { Heading, Text } from "@react-email/components";
import { EmailLayout, headingStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { ActionButton, AddressBox, HELP_TEXT, HelpLine, LinesBox, lineText, type EmailLine } from "./_components/blocks";
import { previewLegal, type BaseEmailProps } from "./_components/types";

/** Template 4: the parcel has left (admin marks the order "shipped"). */
export type OrderShippedProps = BaseEmailProps & {
  name: string;
  orderId: string;
  lines: EmailLine[];
  address: string[];
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  orderUrl: string | null;
};

export const orderShippedDefaults = {
  subject: "Votre commande DOURYA est en route",
  preheader: "Votre colis vient de partir.",
};

const REASON = "Vous recevez cet e-mail car une commande a été passée sur dourya.fr avec cette adresse.";

const trackingLine = (p: OrderShippedProps) =>
  p.trackingNumber ? `Numéro de suivi${p.carrier ? ` ${p.carrier}` : ""} : ${p.trackingNumber}` : "Cet envoi n'a pas de numéro de suivi.";

export default function OrderShipped(props: OrderShippedProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Votre colis est en route
      </Heading>
      <Text style={textStyle}>Bonjour {props.name},</Text>
      <Text style={textStyle}>Bonne nouvelle : votre commande n° {props.orderId} vient d&apos;être expédiée.</Text>
      <LinesBox lines={props.lines} />
      <Text style={{ ...textStyle, marginTop: "16px" }}>{trackingLine(props)}</Text>
      {props.trackingUrl && <ActionButton href={props.trackingUrl} label="Suivre mon colis" />}
      <Text style={textStyle}>Livraison à :</Text>
      <AddressBox lines={props.address} />
      {props.orderUrl && !props.trackingUrl && <ActionButton href={props.orderUrl} label="Voir ma commande" />}
      <Text style={{ ...textStyle, marginTop: "16px" }}>Le délai de rétractation de 14 jours court à partir de la réception du colis.</Text>
      <HelpLine />
    </EmailLayout>
  );
}

export function orderShippedText(props: OrderShippedProps): string {
  return [
    "Votre colis est en route",
    "",
    `Bonjour ${props.name},`,
    "",
    `Bonne nouvelle : votre commande n° ${props.orderId} vient d'être expédiée.`,
    "",
    ...props.lines.map(lineText),
    "",
    trackingLine(props),
    ...(props.trackingUrl ? [`Suivre mon colis : ${props.trackingUrl}`] : []),
    "",
    "Livraison à :",
    ...props.address,
    ...(props.orderUrl ? ["", `Voir ma commande : ${props.orderUrl}`] : []),
    "",
    "Le délai de rétractation de 14 jours court à partir de la réception du colis.",
    "",
    HELP_TEXT,
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

OrderShipped.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: orderShippedDefaults.preheader,
  name: "Client Exemple",
  orderId: "EXEMPLE-FICTIF",
  lines: [{ label: "Carnet A5", quantity: 1 }],
  address: ["Client Exemple", "1 rue Fictive", "00000 Ville", "France"],
  carrier: "La Poste",
  trackingNumber: "1A00000000000",
  trackingUrl: "https://www.laposte.fr/outils/suivre-vos-envois?code=1A00000000000",
  orderUrl: "http://localhost:3000/mon-compte/commandes/EXEMPLE-FICTIF",
} satisfies OrderShippedProps;

import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout, PaddedSection, buttonStyle, headingStyle, linkStyle, linkTextStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { previewLegal, type ActionEmailProps } from "./_components/types";

/** Template 1: welcome + e-mail address confirmation (security e-mail). */
export const verifyEmailDefaults = {
  subject: "Confirmez votre adresse e-mail DOURYA",
  preheader: "Un clic pour activer votre compte DOURYA.",
};

const REASON = "Vous recevez cet e-mail car un compte DOURYA a été créé avec cette adresse.";

export default function VerifyEmail(props: ActionEmailProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Bienvenue chez DOURYA
      </Heading>
      <Text style={textStyle}>Merci d&apos;avoir créé votre compte. Pour l&apos;activer, confirmez votre adresse e-mail.</Text>
      <PaddedSection padding="8px 0 24px" style={{ textAlign: "center" }}>
        <Button href={props.actionUrl} style={buttonStyle}>
          Confirmer mon adresse
        </Button>
      </PaddedSection>
      <Text style={smallTextStyle}>Ce lien ne sert qu&apos;une fois et expire après un délai limité.</Text>
      <Text style={linkTextStyle}>
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
        <Link href={props.actionUrl} style={linkStyle}>
          {props.actionUrl}
        </Link>
      </Text>
      <Text style={smallTextStyle}>Vous n&apos;êtes pas à l&apos;origine de cette inscription ? Ignorez simplement cet e-mail.</Text>
    </EmailLayout>
  );
}

export function verifyEmailText(props: ActionEmailProps): string {
  return [
    "Bienvenue chez DOURYA",
    "",
    "Merci d'avoir créé votre compte. Pour l'activer, confirmez votre adresse e-mail en ouvrant ce lien :",
    props.actionUrl,
    "",
    "Ce lien ne sert qu'une fois et expire après un délai limité.",
    "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet e-mail.",
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

/** Fake data for the React Email preview (npm run email:preview). */
VerifyEmail.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: verifyEmailDefaults.preheader,
  actionUrl: "http://localhost:3000/auth/action?mode=verifyEmail&oobCode=EXEMPLE-FICTIF",
} satisfies ActionEmailProps;

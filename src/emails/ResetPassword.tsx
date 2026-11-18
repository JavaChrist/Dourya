import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { EmailLayout, buttonStyle, headingStyle, linkStyle, smallTextStyle, textFooter, textStyle } from "./_components/EmailLayout";
import { previewLegal, type ActionEmailProps } from "./_components/types";

/** Template 2: password reset (security e-mail). */
export const resetPasswordDefaults = {
  subject: "Réinitialisez votre mot de passe DOURYA",
  preheader: "Choisissez un nouveau mot de passe pour votre compte DOURYA.",
};

const REASON = "Vous recevez cet e-mail car une réinitialisation du mot de passe a été demandée pour cette adresse.";

export default function ResetPassword(props: ActionEmailProps) {
  return (
    <EmailLayout {...props} unsubscribeUrl={undefined} reason={REASON}>
      <Heading as="h1" style={headingStyle}>
        Nouveau mot de passe
      </Heading>
      <Text style={textStyle}>Vous avez demandé à choisir un nouveau mot de passe pour votre compte DOURYA.</Text>
      <Section style={{ textAlign: "center", padding: "8px 0 24px" }}>
        <Button href={props.actionUrl} style={buttonStyle}>
          Choisir un nouveau mot de passe
        </Button>
      </Section>
      <Text style={smallTextStyle}>Ce lien ne sert qu&apos;une fois et expire après un délai limité.</Text>
      <Text style={smallTextStyle}>
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
        <Link href={props.actionUrl} style={linkStyle}>
          {props.actionUrl}
        </Link>
      </Text>
      <Text style={smallTextStyle}>
        Vous n&apos;êtes pas à l&apos;origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste inchangé. DOURYA ne vous
        demandera jamais votre mot de passe par e-mail.
      </Text>
    </EmailLayout>
  );
}

export function resetPasswordText(props: ActionEmailProps): string {
  return [
    "Nouveau mot de passe",
    "",
    "Vous avez demandé à choisir un nouveau mot de passe pour votre compte DOURYA. Ouvrez ce lien :",
    props.actionUrl,
    "",
    "Ce lien ne sert qu'une fois et expire après un délai limité.",
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste inchangé.",
    "DOURYA ne vous demandera jamais votre mot de passe par e-mail.",
    "",
    textFooter({ ...props, unsubscribeUrl: undefined }, REASON),
  ].join("\n");
}

/** Fake data for the React Email preview (npm run email:preview). */
ResetPassword.PreviewProps = {
  origin: "http://localhost:3000",
  legal: previewLegal,
  preheader: resetPasswordDefaults.preheader,
  actionUrl: "http://localhost:3000/auth/action?mode=resetPassword&oobCode=EXEMPLE-FICTIF",
} satisfies ActionEmailProps;

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * General terms of sale. Source text: docs/CGV-DOURYA.md (keep both in sync).
 * Static page: no data, no request-time API.
 */
export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/infos/cgv" },
};

const VERSION = "20 novembre 2026";
const CONTACT = "contact@dourya.fr";
const ADDRESS = "5, rue Maurice Fonvieille, 31120 Portet-sur-Garonne, France";

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 font-display text-2xl font-semibold text-pink-strong">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 text-lg font-semibold text-ink">{children}</h3>;
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className="font-semibold text-pink-strong underline underline-offset-2">
      {CONTACT}
    </a>
  );
}

function Internal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-pink-strong underline underline-offset-2">
      {children}
    </Link>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-pink-strong underline underline-offset-2">
      {children}
    </a>
  );
}

export default function CgvPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-pink-strong">Conditions générales de vente</h1>
      <p className="mt-3 text-sm text-ink/70">Version du {VERSION}</p>

      <div className="mt-6 space-y-4 leading-relaxed text-ink">
        <H2 id="vendeur">1. Vendeur</H2>
        <p>
          DOURYA est le nom commercial de Lizzie Grohens, entrepreneure individuelle, domiciliée au {ADDRESS}. Le
          contact pour les commandes, les réclamations et les garanties est <Mail />.
        </p>

        <H2 id="champ">2. Champ d’application</H2>
        <p>
          Les présentes CGV s’appliquent aux commandes de produits et aux souscriptions à l’abonnement mensuel Dopamine
          Mail Club effectuées par des consommateurs sur dourya.fr, à compter de l’ouverture des ventes. Le client
          accepte les CGV avant de confirmer sa commande ou sa souscription. La version applicable est celle qu’il
          accepte à cette date.
        </p>

        <H2 id="produits-prix">3. Produits et prix</H2>
        <p>
          Les fiches produits présentent les caractéristiques essentielles des articles. De légères variations de
          teinte sont possibles pour les créations artisanales, dans la mesure où elles ne modifient pas les
          caractéristiques annoncées.
        </p>
        <p>
          Les prix sont indiqués en euros. TVA non applicable en raison de la franchise en base de TVA. Pour les achats
          Boutique, les frais et le délai de livraison sont communiqués avant la validation de la commande. Le prix
          applicable est celui présenté au client au moment où il confirme sa commande.
        </p>

        <H2 id="commande">4. Commande et paiement Boutique</H2>
        <p>
          Le client sélectionne ses articles, vérifie le détail et le total de son panier ainsi que ses coordonnées de
          livraison, puis corrige les éventuelles erreurs avant de confirmer sa commande. Il accepte les CGV et confirme
          son obligation de paiement avant d’accéder à la page de paiement hébergée par Stripe.
        </p>
        <p>
          Le paiement s’effectue par carte bancaire, Apple Pay ou Google Pay selon les options disponibles au moment du
          paiement et la compatibilité de l’appareil. DOURYA ne reçoit ni ne conserve le numéro complet de la carte ni
          son cryptogramme.
        </p>
        <p>La commande est confirmée après acceptation du paiement. DOURYA adresse au client un e-mail récapitulatif.</p>

        <H2 id="mail-club">5. Dopamine Mail Club</H2>
        <H3>5.1 Contenu</H3>
        <p>
          L’abonnement comprend un pack différent chaque mois. Le contenu du pack du mois est présenté sur la{" "}
          <Internal href="/infos/mail-club">page du Mail Club</Internal>.
        </p>

        <H3>5.2 Prix et paiement</H3>
        <p>
          L’abonnement coûte <strong>11,95 € par mois</strong>, livraison comprise en France métropolitaine. Le premier
          paiement intervient à la souscription. Sauf résiliation, les échéances suivantes sont débitées
          automatiquement chaque mois sur le moyen de paiement enregistré chez Stripe, à la date indiquée dans le
          récapitulatif d’abonnement. Les moyens de paiement sont ceux proposés lors de la souscription.
        </p>
        <p>
          DOURYA informe l’abonné à l’avance de toute modification du prix applicable à une prochaine échéance, afin
          qu’il puisse résilier avant sa prise d’effet.
        </p>

        <H3>5.3 Durée</H3>
        <p>L’abonnement est conclu pour une durée indéterminée, sans durée minimale d’engagement.</p>

        <H3>5.4 Résiliation</H3>
        <p>
          L’abonné peut résilier à tout moment, sans frais ni justification, depuis{" "}
          <Internal href="/mon-compte/abonnement">Mon compte → Abonnement</Internal>. La résiliation prend effet à la
          fin de la période mensuelle en cours. Aucun paiement de renouvellement n’est dû après cette date. Le pack
          correspondant à la période déjà réglée est expédié selon le calendrier prévu. DOURYA confirme la réception de
          la demande et sa date d’effet par e-mail.
        </p>

        <H3>5.5 Échec de paiement</H3>
        <p>
          Si un paiement mensuel échoue, Stripe peut effectuer de nouvelles tentatives de paiement. DOURYA expédie le
          pack de la période concernée après confirmation du règlement.
        </p>

        <H3>5.6 Calendrier et expédition des packs</H3>
        <p>
          Les commandes réglées du <strong>16 du mois précédent au 15 du mois en cours inclus</strong> correspondent au
          pack du mois en cours. La période se termine à <strong>23 h 59, heure de Paris</strong>, le 15. À partir du 16
          à 0 h 00, les commandes correspondent au pack du mois suivant.
        </p>
        <p>
          Les expéditions commencent le <strong>1ᵉʳ du mois du pack</strong>. Les dernières commandes de la période sont
          expédiées <strong>au plus tard cinq jours ouvrés après le 15</strong>. Par exemple, le pack de décembre
          correspond aux commandes réglées du 16 novembre au 15 décembre inclus. Une commande réglée le 16 décembre
          correspond au pack de janvier. En France métropolitaine, le délai indicatif d’acheminement en Lettre verte est
          de trois jours ouvrables après l’expédition.
        </p>

        <H2 id="livraison">6. Livraison</H2>
        <p>
          Les commandes Boutique sont expédiées par La Poste sous <strong>deux jours ouvrés</strong> après confirmation
          du paiement. Lorsqu’un article sur mesure nécessite un délai de fabrication, le délai applicable est indiqué
          avant la commande.
        </p>
        <p>
          La Boutique livre en France métropolitaine, dans les destinations d’outre-mer desservies, en Belgique, au
          Luxembourg et en Suisse. Le Mail Club est livré uniquement en France métropolitaine. L’offre postale utilisée
          dépend du poids emballé, du format et de la destination.
        </p>
        <p>
          Pour la Boutique, si la destination ou les caractéristiques de l’envoi ne permettent pas de calculer un tarif
          standard, le client peut demander un devis à <Mail />. Le devis précise le montant des frais de port et le
          délai de livraison. Le client peut accepter cette proposition avant de payer. Les envois de marchandises vers
          l’outre-mer et la Suisse font l’objet des formalités douanières applicables. Des taxes ou des frais
          d’importation peuvent s’appliquer selon la destination.
        </p>
        <p>
          Si le délai de livraison annoncé est dépassé, le client peut demander par écrit à DOURYA d’effectuer la
          livraison dans un délai supplémentaire raisonnable. Si DOURYA ne livre pas dans ce délai, le client peut
          résoudre le contrat dans les conditions prévues à l’article L. 216-6 du Code de la consommation. Cet article
          prévoit également des cas de résolution immédiate.
        </p>
        <p>
          À réception, le client est invité à signaler tout emballage endommagé, article manquant ou autre anomalie à{" "}
          <Mail />. Ce signalement ne limite pas ses droits légaux.
        </p>

        <H2 id="retractation">7. Droit de rétractation</H2>
        <p>
          Le client consommateur dispose de <strong>14 jours</strong> pour se rétracter sans avoir à motiver sa
          décision. Le délai court à compter de la réception du produit ou, pour plusieurs biens d’une même commande
          livrés séparément, du dernier bien. Pour le Mail Club, il court à compter de la réception du{" "}
          <strong>premier pack</strong>. La résiliation de l’abonnement est également possible selon l’article 5.4.
        </p>
        <p>
          Le client peut exercer son droit à l’aide de la fonctionnalité de rétractation en ligne de DOURYA, du
          formulaire type en annexe ou d’une déclaration sans ambiguïté adressée à <Mail />. Il renvoie les produits au
          plus tard <strong>14 jours après avoir communiqué sa décision</strong>, à Lizzie Grohens, DOURYA, {ADDRESS}.
          Les <strong>frais directs de retour en cas de rétractation</strong> sont à la charge du client.
        </p>
        <p>
          DOURYA rembourse les sommes versées, y compris les frais de livraison standard, dans les 14 jours suivant la
          notification de la rétractation. Le remboursement s’effectue avec le moyen de paiement initial, sauf accord
          exprès du client pour un autre moyen sans frais. DOURYA peut différer le remboursement jusqu’à la récupération
          du bien ou jusqu’à la présentation d’une preuve de son expédition, selon l’événement qui intervient en
          premier.
        </p>
        <p>
          Conformément à l’article L. 221-28 du Code de la consommation, le droit de rétractation ne s’applique pas aux
          biens confectionnés selon les spécifications du client ou nettement personnalisés, notamment les headbands sur
          mesure et les articles vestimentaires personnalisés à sa demande. Les garanties légales restent applicables.
        </p>

        <H2 id="garanties">8. Garanties légales</H2>
        <p>
          Lizzie Grohens répond de la garantie légale de conformité prévue par le Code de la consommation et de la
          garantie des vices cachés prévue par le Code civil. Le client peut demander leur mise en œuvre à <Mail /> ou
          par courrier au {ADDRESS}.
        </p>
        <H3>Information sur les garanties légales</H3>
        <div className="space-y-3 rounded-md border-2 border-secondary bg-surface-muted p-5">
          <p>
            Pour les produits neufs, le consommateur peut invoquer la garantie légale de conformité pendant deux ans à
            compter de la délivrance. Pendant cette période, il doit établir l’existence du défaut. La date à laquelle
            le défaut est apparu bénéficie de la présomption prévue par la loi.
          </p>
          <p>
            Le consommateur peut demander la réparation ou le remplacement du bien, sans frais et dans un délai maximal
            de trente jours suivant sa demande. La garantie est prolongée de six mois si le bien est réparé. Si le
            consommateur demande une réparation et que le vendeur procède au remplacement, un nouveau délai de deux ans
            court à compter de la délivrance du bien de remplacement.
          </p>
          <p>
            Dans les cas prévus par la loi, notamment si la mise en conformité est refusée, tarde au-delà de trente
            jours, occasionne un inconvénient majeur ou échoue, le consommateur peut obtenir une réduction du prix ou la
            résolution de la vente avec restitution du bien. Ces recours peuvent être exercés immédiatement si le défaut
            est suffisamment grave. Un défaut mineur ne permet pas de résoudre la vente. La période d’immobilisation du
            bien suspend la garantie restant à courir jusqu’à la remise du bien réparé ou remplacé.
          </p>
          <p>
            La garantie des vices cachés peut être exercée dans les deux ans suivant la découverte du vice. Le
            consommateur peut garder le bien et obtenir une réduction du prix, ou le restituer et obtenir le
            remboursement du prix.
          </p>
        </div>
        <p className="text-sm">
          <External href="https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000045981314/">
            Modèle réglementaire — annexe à l’article D. 211-2 du Code de la consommation, encadré A
          </External>
        </p>

        <H2 id="donnees">9. Données personnelles</H2>
        <p>
          Les informations relatives au compte, aux commandes et à l’adresse de livraison servent notamment à traiter
          les achats et à gérer l’abonnement. Le détail figure dans la{" "}
          <Internal href="/infos/confidentialite">politique de confidentialité de DOURYA</Internal>.
        </p>

        <H2 id="mediation">10. Réclamations, médiation et droit applicable</H2>
        <p>
          Le client peut adresser une réclamation écrite à <Mail />. Si la réclamation ne permet pas de résoudre le
          litige, le consommateur peut saisir gratuitement{" "}
          <strong>Médiation Consommation Développement (MED CONSO DEV)</strong>, dans un délai d’un an à compter de sa
          réclamation écrite, conformément aux articles L. 612-1 et suivants du Code de la consommation.
        </p>
        <p>
          La demande peut être déposée via le{" "}
          <External href="https://www.medconsodev.eu/mediation-consommation-demande.php">
            formulaire de saisine du médiateur
          </External>{" "}
          ou par courrier à{" "}
          <strong>
            Médiation Consommation Développement, c/o Centre d’Affaires Stéphanois SAS, immeuble L’Horizon – Esplanade
            de France, 3, rue J. Constant Milleret, 42000 Saint-Étienne, France
          </strong>
          .
        </p>
        <p>
          Les présentes CGV sont soumises au droit français, sous réserve des dispositions impératives de protection du
          consommateur applicables au client.
        </p>

        <H2 id="formulaire-retractation">Annexe — Formulaire de rétractation</H2>
        <p>
          À adresser à <strong>Lizzie Grohens, DOURYA, {ADDRESS}</strong>, ou à <Mail />.
        </p>
        <div className="space-y-3 rounded-md border-2 border-dashed border-secondary p-5">
          <p>Je vous notifie ma rétractation du contrat portant sur la vente du bien ou l’abonnement désigné ci-dessous.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Produit ou abonnement et référence de la commande</li>
            <li>Date de commande et date de réception</li>
            <li>Nom et adresse du consommateur</li>
            <li>Date</li>
            <li>Signature du consommateur, uniquement si le formulaire est envoyé sur papier</li>
          </ul>
        </div>
      </div>

      <div className="mt-12">
        <ButtonLink href="/" variant="alt" className="border-2 border-secondary">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
    </article>
  );
}

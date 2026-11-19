# DOURYA — Architecture

## Lancer en local

```
npm install
npm run dev               # http://localhost:3000 (Firebase réel, clés dans .env.local)
npm run dev:emulators     # http://localhost:3000 sur les émulateurs Firebase (demo-dourya), UI sur :4000
npm run build             # vérification de production
npm test                  # tests unitaires Vitest
npm run test:integration  # règles Firestore/Storage, sessions, rôles, données client (lance les émulateurs)
npm run lint
npm run typecheck
```

Émulateurs : `firebase-tools` installé globalement (`npm i -g firebase-tools`) et Java 21+.
`scripts/emulators.mjs` lance `firebase emulators:exec --project demo-dourya --only auth,firestore,storage`.
Sous Windows, il déplace le dossier des sockets Java dans `.emulators-tmp/` (sinon l'émulateur Firestore
s'arrête sur « Unable to establish loopback connection » quand le chemin temporaire est trop long).
Les liens des e-mails (confirmation, réinitialisation) se lisent sur l'UI des émulateurs ou via
`http://127.0.0.1:9099/emulator/v1/projects/demo-dourya/oobCodes`.

## Où modifier quoi

| Besoin | Fichier |
|---|---|
| Couleurs, rayons, polices, fonds de section | `src/app/globals.css` (variables `--brand-*` et `--dy-*`) |
| Bandeau promo, carrousels, Mail Club, fonds des sections | `src/data/home.ts` |
| Catégories (ajouter, masquer, réordonner) | `src/data/categories.ts` (`visible`, `order`) |
| Produits (démo, prix fictifs) | `src/data/products.ts` |
| Collections | `src/data/collections.ts` |
| Plafond de quantité, mention de prix / TVA (aucun statut imposé) | `src/config/commerce.ts` |
| Navigation, contact, réseaux, pages légales | `src/config/site.ts` |

Les composants ne contiennent ni texte de contenu ni couleur codée en dur : ils lisent ces fichiers.

## Assets de marque

- Originaux intacts : `public/branding/`
- Versions web : `public/brand/` (`logo.png`, `logo-full.png`, `bg-grid.webp`, `bg-sparkle.webp`), icône `src/app/icon.png`

## Structure

```
src/
  app/
    boutique/              catalogue complet (recherche, filtres, tri, pagination via l'URL)
    categories/[slug]/     liste d'une catégorie visible
    collections/[slug]/    liste d'une collection
    produits/[slug]/       fiche produit (galerie + zoom, variantes, quantité, personnalisation)
    panier/                page panier + actions.ts (priceCartAction, recalcul serveur)
    infos/[slug], recherche, compte, api/version
  components/
    catalog/      ShopListing, ProductCard, ListingHero, ProductGallery, AddToCart
    cart/         CartProvider (identifiants + quantités en localStorage `dourya-cart-v2`), CartView
    layout/ home/ ui/   composants du lot 1
  config/         site.ts, commerce.ts
  data/           contenus de démo (remplaçables par Firestore)
  lib/
    catalog/
      repository.ts          interface CatalogRepository (aucune dépendance Firestore)
      fixture-repository.ts  implémentation sur src/data (à remplacer par Firestore)
      visibility.ts          règles : brouillon, archivé, catégorie masquée, stock, disponibilité
      query.ts               recherche (sans accents), filtres, tris, pagination, parse des paramètres
      visuals.ts, search.ts  visuels produit, entrées de la recherche du header
      index.ts               point d'accès unique utilisé par les pages
    cart/
      items.ts    nettoyage du panier local, clé de ligne, fusion (max, idempotente)
      pricing.ts  calcul serveur : prix, stock, plafonds, personnalisation, droit au paiement
      types.ts
  test/factories.ts   fabriques de données de test
```

## Comptes et authentification (lot 3)

- **Parcours** : `/inscription`, `/connexion`, `/mot-de-passe-oublie`, `/verification-email`, `/mon-compte` (profil, préférences, adresses, commandes, mes données), `/admin/connexion` puis `/admin`. Pas d'inscription admin.
- **Session** : le navigateur se connecte avec Firebase Auth (persistance en mémoire), envoie l'ID token à `startSessionAction`, puis se déconnecte côté client. Le serveur vérifie le token (révocation, connexion de moins de 5 min, e-mail confirmé, rôle pour l'admin) et pose un cookie de session HttpOnly de 5 jours : `__Host-dourya_session` en production, `dourya_session` en local.
- **Contrôle d'accès** : `src/lib/auth/dal.ts` (`requireUser`, `requireAdmin`) est le seul point qui lit la session, vérifiée à chaque requête avec `checkRevoked`. `src/proxy.ts` ne fait qu'une redirection optimiste. Le rôle vient uniquement du custom claim `role: "admin"`, jamais d'un champ Firestore. Un client sur `/admin` reçoit une 404.
- **CSRF** : les écritures passent par des Server Actions (contrôle d'origine de Next). L'export `/mon-compte/export` est un GET sans effet de bord.
- **Limitation de débit** : compteur Firestore `rateLimits/{sha256}` écrit par l'Admin SDK (`src/lib/security/`), clés hachées.
- **Messages** : connexion, inscription et mot de passe oublié ne révèlent jamais si une adresse a un compte.
- **Données personnelles** : export JSON immédiat. La demande de suppression est enregistrée dans `dataRequests` et traitée à la main depuis `/admin` (« Marquer comme traitée »).
- **Commande sans compte** : `guestCheckoutEnabled` dans `src/config/commerce.ts`.
- **Règles** : `firestore.rules` et `storage.rules` en moindre privilège, aucune écriture client. Index : `firestore.indexes.json`.

### Donner ou retirer le rôle admin

```
npm run admin:role -- grant <email>              # projet réel (FIREBASE_ADMIN_* dans .env.local)
npm run admin:role -- revoke <email>
npm run admin:role -- show <email>
npm run admin:role -- grant <email> --emulator   # émulateurs en cours (demo-dourya)
```

Le compte doit exister (inscription faite). Le changement de rôle révoque les sessions ouvertes : la personne se reconnecte. Le script n'affiche aucune clé.

### Mise en place Firebase (projet réel, une fois)

1. Authentication : activer le fournisseur « E-mail / mot de passe ».
2. Authentication > Paramètres > Domaines autorisés : ajouter le domaine de production (et celui de prévisualisation Vercel si utilisé).
3. Authentication > Modèles : langue française pour les e-mails de confirmation et de réinitialisation.
4. Firestore : créer la base (mode production).
5. Déployer règles et index : `firebase deploy --only firestore:rules,firestore:indexes,storage`.
6. TTL sur les compteurs : `gcloud firestore fields ttls update expiresAt --collection-group=rateLimits --enable-ttl` (ou console Firestore > TTL).
7. Donner le rôle admin au premier compte avec `npm run admin:role -- grant <email>`.

## E-mails DOURYA (lot 3 bis)

- Envoi côté serveur uniquement (`src/lib/email/`, `server-only`), via Resend. Modèles React Email dans `src/emails/` (logo officiel `public/brand/logo-full.png`, couleurs DOURYA). Aperçu local : `npm run email:preview` (port 3030, données fictives).
- `EMAIL_TRANSPORT` choisit l'expéditeur :
  - absent ou `firebase` (défaut) : rien ne change, Firebase envoie ses propres e-mails depuis le navigateur.
  - `test` : e-mails rendus et gardés en mémoire, jamais envoyés (dev, émulateurs, tests).
  - `resend` : envoi réel. Forcé à `test` sur les émulateurs. Rien n'est envoyé tant que `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_LEGAL_NAME` ou `EMAIL_LEGAL_ADDRESS` manque (aucune valeur inventée).
- Modèles livrés : 1 bienvenue / confirmation d'adresse, 2 réinitialisation du mot de passe. Les e-mails de commande (3 à 7) arrivent au lot 4, la newsletter (8) plus tard.
- Liens : générés par Firebase Admin (`generateEmailVerificationLink`, `generatePasswordResetLink`), puis réécrits vers `/auth/action?mode=…&oobCode=…` sur `NEXT_PUBLIC_SITE_URL`. La page lit le code une fois, puis le retire de la barre d'adresse. `Referrer-Policy: no-referrer` et `noindex` sur `/auth/action`, `/desinscription` et `/api/email/*`.
- Limites d'envoi : confirmation 3/h par compte et 10/h par IP ; réinitialisation 3/h par adresse et 5/15 min par IP ; désinscription 30/15 min par IP. La réinitialisation répond toujours la même chose, que l'adresse ait un compte ou non.
- Journaux : `emailLog` (Firestore, admin SDK seul) garde le type, la catégorie, le statut et un hash de l'adresse, jamais l'adresse, le lien ou le code. Champ `expiresAt` pour une politique TTL de 90 jours. En dev, `logging` dans `next.config.ts` masque les arguments des Server Actions et les requêtes des liens d'e-mail.
- Désinscription (marketing uniquement) : jeton HMAC (`EMAIL_UNSUBSCRIBE_SECRET`, 32 caractères minimum), page `/desinscription` (l'ouverture ne fait rien, il faut confirmer) et one-click RFC 8058 (`POST /api/email/desinscription`, en-têtes `List-Unsubscribe` sur les e-mails marketing seulement). Effet : entrée `emailSuppressions` et consentement newsletter retiré (`source` : `unsubscribe-link` ou `one-click`). Une nouvelle inscription depuis le compte lève la désinscription, jamais un rebond ou une plainte.
- Les e-mails de sécurité et transactionnels ne consultent jamais la liste de suppression : une désinscription marketing ne les bloque pas.
- Webhook Resend : `POST /api/webhooks/resend`, signature vérifiée (`RESEND_WEBHOOK_SECRET`, en-têtes `svix-*`). Rebond définitif → `bounce`, plainte → `complaint`, suppression côté Resend → `provider`. Erreur de stockage : 500 pour que Resend réessaie. Sans `RESEND_WEBHOOK_SECRET` ou `RESEND_API_KEY` : 503. Tests unitaires : `src/app/api/webhooks/resend/route.test.ts` (payloads signés à la manière Standard Webhooks, secret fictif). Vérification en production après déploiement : GET → 405, POST sans signature → 400.
- Firebase Admin en trois modules : `src/lib/firebase/admin-app.ts` (app et identifiants), `admin-db.ts` (Firestore) et `admin-auth.ts` (Auth). Les fonctions Vercel tournent avec `require(esm)` désactivé (vercel/vercel#17770) : `firebase-admin/auth` → `jwks-rsa` 4 → `jose` 6 (ESM seul) y échoue avec ERR_REQUIRE_ESM (firebase/firebase-admin-node#3181). Le webhook et le store n’importent que `admin-db.ts` ; `src/lib/firebase/admin-split.test.ts` le vérifie. `transpilePackages: ["firebase-admin"]` dans `next.config.ts` embarque firebase-admin et ses dépendances dans le bundle, pour que les parcours Auth fonctionnent aussi. Reproduction locale du réglage Vercel : `NODE_OPTIONS=--no-experimental-require-module next start`.
  - Événements à cocher dans Resend : `email.bounced`, `email.complained`, `email.suppressed` (suppressions), `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed` (suivi dans `emailLog`). Inutiles : `email.opened`, `email.clicked`, `contact.*`, `domain.*`.
- Test d'envoi : `npm run email:test` vérifie la configuration `resend` (noms et statuts seulement), rend les e-mails 1 et 2 avec un lien fictif et contrôle le rendu et les mentions légales (nom, adresse avec code postal et ville, SIREN/SIRET facultatif au bon format) ; rien n'est envoyé. `npm run email:test -- --send --to <adresse>` envoie pour de vrai (sujet préfixé `[TEST]`, tag `test=true`), seulement si la configuration est complète, hors émulateurs, après avoir tapé « oui ». Le lien reste fictif : il ouvre la page « lien plus valide ». Le parcours complet (vrai lien Firebase) se teste ensuite en local avec `EMAIL_TRANSPORT=resend`.
- Admin (préparé) : un document `emailTemplates/{type}` (`enabled`, `subject`, `preheader`) remplace le sujet et le pré-en-tête par défaut. Pas encore d'écran d'édition. `emailLog`, `emailSuppressions` et `emailTemplates` sont fermés aux clients par `firestore.rules`.
- Mise en service (une fois) : domaine d'envoi vérifié dans Resend (DNS), variables dans Vercel, TTL Firestore `gcloud firestore fields ttls update expiresAt --collection-group=emailLog --enable-ttl`, webhook Resend vers `https://dourya.fr/api/webhooks/resend`, puis `EMAIL_TRANSPORT=resend`.

## Panier et prix

- Le navigateur ne stocke que `productId`, `variantId`, `quantity` et le texte de personnalisation. Tout prix envoyé par le navigateur est ignoré.
- `priceCartAction` recalcule chaque ligne côté serveur : produit publié, variante active et tarifée, stock, plafond par ligne, fenêtre et règles de personnalisation. Les quantités réduites par le serveur sont réappliquées au panier local.
- Le paiement reste bloqué tant que le panier contient un produit de démo ou une ligne en erreur. Les frais de livraison sont calculés côté serveur par `quoteShipping` (lot 4.1), à partir des grilles saisies par l'admin.
- Personnalisation désactivée par défaut ; activable par produit (`personalisation.enabled`), par variante (`variantIds`) et par période (`availableFrom` / `availableUntil`).

## Domaines et référencement

- Domaine principal : `https://dourya.fr`. `www.dourya.fr`, `dourya.shop` et `www.dourya.shop` redirigent en 308 vers lui (Vercel, DNS IONOS).
- `NEXT_PUBLIC_SITE_URL` (à `https://dourya.fr` dans Vercel Production) est lue par `siteOrigin()` dans `src/config/site.ts`. Valeur absente ou invalide : `https://dourya.fr` en build de production, `http://localhost:3000` en développement. Variable inlinée au build : la changer demande un redéploiement.
- Elle sert à `metadataBase` (layout racine), aux URL canoniques (accueil, boutique, catégories, collections, produits, pages infos), à `/robots.txt` (`src/app/robots.ts`), à `/sitemap.xml` (`src/app/sitemap.ts`) et aux liens des e-mails (Firebase et DOURYA).
- `robots.txt` bloque compte, admin, connexion, panier, recherche et API. Sur une prévisualisation Vercel, il bloque tout.
- Le sitemap liste uniquement les pages publiques : produits listés, catégories et collections visibles, pages infos.

## Redirections (308, `next.config.ts`)

| Ancienne URL | Nouvelle URL |
|---|---|
| `/categorie/:slug` | `/categories/:slug` |
| `/produit/:slug` | `/produits/:slug` |
| `/categorie`, `/produit` | `/boutique` |

## Points connus

- Avec le prérendu partiel de Next 16, une page introuvable (`notFound()` dans un `Suspense`) affiche la page 404 avec `noindex`, mais le statut HTTP reste 200.
- Avec Cache Components, une page quittée reste montée dans une `<Activity>` cachée : son état revient au retour. Les formulaires de connexion, d'inscription et de mot de passe oublié se vident quand on les quitte (`src/components/auth/useResetOnLeave.ts`).
- La vérification de session appelle `connection()` : elle n'est jamais faite pendant un préchargement, toujours à la requête.
- Le compteur du header additionne toutes les unités du panier local, y compris les lignes indisponibles (la page panier les signale et les fait retirer).

## Lots suivants (préparé, non développé)

- **Firebase** : une implémentation Firestore de `CatalogRepository` remplacera `fixture-repository.ts`, sans changer les composants. Auth Firebase en place (lot 3).
- **Mollie** (lot 4, remplace Stripe) : API REST appelée côté serveur uniquement (clé secrète `MOLLIE_API_KEY`), sans SDK. Paiement créé de façon idempotente à partir du panier recalculé, montants en centimes EUR. Le webhook ne contient qu'un identifiant : le paiement est relu chez Mollie à chaque notification, et seul ce relevé change la commande. Carte bancaire ; Apple Pay et Google Pay seulement s'ils sont activés sur le compte Mollie (`paymentConfig`).
  - Lot 4.1 (fait) : modèle `src/lib/orders/types.ts`, transitions `src/lib/orders/transitions.ts` (paiement et préparation séparés, webhook répété sans effet, jamais de retour arrière après paiement, paiement tardif accepté et signalé), lecture d'un paiement Mollie `src/lib/orders/mollie-status.ts` (montant, devise et commande vérifiés), livraison `src/config/shipping.ts` + `src/lib/shipping/quote.ts` (zones, grilles par poids, épaisseur, format, enveloppe et service, seuil de gratuité optionnel). Aucune grille saisie : aucun mode de livraison proposé, paiement bloqué.
  - Lot 4.2 (fait) : `src/lib/orders/repository.ts` (Admin SDK, transactions). Collections serveur uniquement : `orders/{id}` + `orders/{id}/events` (journal), `inventory/{clé}` (`stock`, `reserved` ; disponible = stock − réservé), `checkoutAttempts/{clé}` (anti double clic : même clé + même contenu = même commande, contenu modifié = refus), `settings/shipping` (grilles saisies, sinon valeurs par défaut sans tarif). Le stock est réservé à la création (30 min), vendu au paiement, rendu en cas d'échec, d'expiration ou d'annulation. `releaseExpiredReservations` relit Mollie avant de libérer un paiement en attente. Index : `paymentStatus + reservationExpiresAt`, `paymentStatus + createdAt`, `fulfilmentStatus + createdAt`.
- **Vercel** : `VERCEL_GIT_COMMIT_SHA` sert d'identifiant de version pour la modale « Nouvelle version disponible ».
- Variables (valeurs uniquement dans `.env.local` et Vercel ; `NEXT_PUBLIC_FIREBASE_*` et `FIREBASE_ADMIN_*` lues depuis le lot 3, e-mails au lot 3 bis, Mollie au lot 4) :
  - Publiques : `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_SITE_URL`
  - Secrètes, serveur uniquement : `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, `MOLLIE_API_KEY` (lot 4.3). `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ne sont plus lues
  - Configuration e-mail, serveur uniquement : `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_LEGAL_NAME`, `EMAIL_LEGAL_ADDRESS`, `EMAIL_LEGAL_REGISTRATION` (optionnelle)

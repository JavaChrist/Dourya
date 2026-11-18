# DOURYA — Architecture

## Lancer en local

```
npm install
npm run dev     # http://localhost:3000
npm run build   # vérification de production
npm test        # tests Vitest (prix serveur, variantes, stock, quantités, fusion panier)
npm run lint
npm run typecheck
```

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

## Panier et prix

- Le navigateur ne stocke que `productId`, `variantId`, `quantity` et le texte de personnalisation. Tout prix envoyé par le navigateur est ignoré.
- `priceCartAction` recalcule chaque ligne côté serveur : produit publié, variante active et tarifée, stock, plafond par ligne, fenêtre et règles de personnalisation. Les quantités réduites par le serveur sont réappliquées au panier local.
- Le paiement reste bloqué tant que le panier contient un produit de démo ou une ligne en erreur. Aucun frais de livraison n'est calculé (lot 4).
- Personnalisation désactivée par défaut ; activable par produit (`personalisation.enabled`), par variante (`variantIds`) et par période (`availableFrom` / `availableUntil`).

## Redirections (308, `next.config.ts`)

| Ancienne URL | Nouvelle URL |
|---|---|
| `/categorie/:slug` | `/categories/:slug` |
| `/produit/:slug` | `/produits/:slug` |
| `/categorie`, `/produit` | `/boutique` |

## Points connus

- Avec le prérendu partiel de Next 16, une page introuvable (`notFound()` dans un `Suspense`) affiche la page 404 avec `noindex`, mais le statut HTTP reste 200.
- Le compteur du header additionne toutes les unités du panier local, y compris les lignes indisponibles (la page panier les signale et les fait retirer).

## Lots suivants (préparé, non développé)

- **Firebase** : une implémentation Firestore de `CatalogRepository` remplacera `fixture-repository.ts`, sans changer les composants. Auth Firebase pour clients et admins (lot 3).
- **Stripe** (remplace Mollie, décision du 2026-11-18) : Stripe Checkout hébergé, session créée uniquement côté serveur à partir du panier recalculé (jamais d'un prix navigateur). Carte bancaire, Apple Pay et Google Pay sur les appareils compatibles (activés dans le tableau de bord Stripe, rien à coder côté client). La commande n'est confirmée que par le webhook signé (`checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`), jamais par la page de retour. Historique des transactions et données financières de l'admin alimentés par ces événements. Aucune intégration avant le lot Paiement.
- **Vercel** : `VERCEL_GIT_COMMIT_SHA` sert d'identifiant de version pour la modale « Nouvelle version disponible ».
- Variables réservées (aucune utilisée au lot 1, valeurs uniquement dans `.env.local` et Vercel) :
  - Publiques : `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_SITE_URL`
  - Secrètes, serveur uniquement : `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Publique optionnelle : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, seulement si l'intégration retenue l'exige (inutile avec Checkout hébergé)

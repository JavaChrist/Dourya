# DOURYA — Architecture

## Lancer en local

```
npm install
npm run dev     # http://localhost:3000
npm run build   # vérification de production
```

## Où modifier quoi

| Besoin | Fichier |
|---|---|
| Couleurs, rayons, polices, fonds de section | `src/app/globals.css` (variables `--brand-*` et `--dy-*`) |
| Bandeau promo, carrousels, Mail Club, fonds des sections | `src/data/home.ts` |
| Catégories (ajouter, masquer, réordonner) | `src/data/categories.ts` (`visible`, `order`) |
| Produits (démo) | `src/data/products.ts` |
| Navigation, contact, réseaux, pages légales | `src/config/site.ts` |

Les composants ne contiennent ni texte de contenu ni couleur codée en dur : ils lisent ces fichiers.

## Assets de marque

- Originaux intacts : `public/branding/`
- Versions web : `public/brand/` (`logo.png`, `logo-full.png`, `bg-grid.webp`, `bg-sparkle.webp`), icône `src/app/icon.png`

## Structure

```
src/
  app/            routes (accueil, categorie/[slug], produit/[slug], infos/[slug], recherche, compte, panier, api/version)
  components/
    layout/       Header, SearchBox, PromoBanner, Footer, UpdateNotifier
    home/         HeroCarousel, ManualCarousel, MailClub, CategoryGrid
    ui/           Section, ButtonLink, SlideVisual, DemoBadge, CategoryIcon, Logo, InfoPlaceholder
    cart/         CartProvider (compteur local, sans commande)
  config/site.ts  réglages du site
  data/           contenus (remplaçables par Firestore)
  lib/
    catalog.ts         accès au catalogue (point unique à brancher sur Firestore)
    types.ts           types de contenu
    commerce-types.ts  types préparés : clients, commandes, thème
```

## Lots suivants (préparé, non développé)

- **Firebase** : `src/lib/catalog.ts` deviendra des requêtes Firestore, sans changer les composants. Auth Firebase pour clients et admins (lot 3).
- **Mollie** : paiements créés uniquement côté serveur (route handlers), webhook pour le statut. Clé dans `MOLLIE_API_KEY` (jamais `NEXT_PUBLIC_`).
- **Vercel** : `VERCEL_GIT_COMMIT_SHA` sert d'identifiant de version pour la modale « Nouvelle version disponible ».
- Variables réservées (aucune utilisée au lot 1, valeurs uniquement dans `.env.local` et Vercel) :
  - Publiques : `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_SITE_URL`
  - Secrètes, serveur uniquement : `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `MOLLIE_API_KEY`

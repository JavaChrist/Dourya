# PROJET DOURYA — LOT 1
## Création de la maquette fonctionnelle de la boutique

Tu es un développeur senior Next.js, TypeScript et Tailwind CSS, spécialisé dans les boutiques e-commerce modernes, les interfaces responsive et les dashboards administrateurs.

Tu travailles sur **DOURYA**, une marque indépendante d'illustrations et de créations originales.

**Objectif de ce premier lot :** construire une page d'accueil fonctionnelle, fidèle à l'identité graphique de la marque, sans encore intégrer les paiements ni les fonctionnalités commerciales côté serveur.

**Ne pas développer les autres lots sans validation.**

---

## 1. Présentation de la marque

Nom : **DOURYA**

Produits :
- Prints illustrés
- Stickers
- Porte-clés (Keychains)
- Headbands, catégorie à confirmer avant activation

La créatrice réalise elle-même ses illustrations et imprime ses prints et stickers. Les porte-clés sont fabriqués par un prestataire.

La boutique est destinée principalement à une clientèle francophone.

### Identité visuelle officielle

- Rose principal : `#FF3C72`
- Rose secondaire : `#FF739A`
- Blanc : `#FFFFFF`
- Jaune accent : `#FFE167`

Le noir peut servir de couleur de contraste si nécessaire, sans devenir une couleur principale imposée.

### Assets fournis

Les fichiers transmis comprennent :
1. Logo DOURYA complet avec la ligne de produits.
2. Logo DOURYA seul.
3. Fond quadrillé rose.
4. Fond quadrillé rose avec étoiles et paillettes.

Utiliser exclusivement les véritables assets fournis pour l'identité de marque.

Ne pas recréer les logos, ne pas modifier leur typographie et ne pas générer de nouveaux motifs à leur place.

Préserver les fichiers originaux. Créer des versions web optimisées si nécessaire.

Si les fichiers ne sont pas présents dans le projet, demander leur emplacement avant de commencer.

---

## 2. Stack technique

- Next.js avec App Router
- TypeScript strict
- Tailwind CSS
- Composants réutilisables
- Icônes Lucide
- Images optimisées
- Architecture responsive et accessible

Préparer une structure compatible avec les futures intégrations Firebase, Mollie et Vercel, sans les configurer dans ce lot.

Ne pas ajouter de dépendances inutiles.

## 3. Structure de la page d'accueil

Respecter précisément cet ordre.

### A. Header

- Logo DOURYA
- Navigation principale
- Recherche de produits
- Icône compte client
- Icône panier avec compteur
- Menu mobile responsive
- Header adapté aux écrans tactiles

### B. Bandeau promotionnel défilant

- Messages promotionnels configurables
- Défilement automatique
- Possibilité de plusieurs messages
- Liens facultatifs vers des produits ou collections
- Animation fluide
- Respect de `prefers-reduced-motion`

### C. Premier carrousel — automatique

- Images grand format
- Défilement automatique
- Vitesse configurable
- Pagination
- Possibilité de mettre en pause
- Images cliquables vers produits, catégories ou collections
- Adaptation mobile

### D. Deuxième carrousel — manuel

- Navigation par flèches gauche et droite
- Aucune rotation automatique
- Images configurables
- Compatible avec le glissement tactile
- Liens facultatifs

### E. Section Mail Club

Créer un bloc promotionnel comprenant :
- Une image
- Un titre
- Une description
- Un bouton d'action
- Un lien vers une fiche produit ou une page spécifique

Le contenu doit être configurable.

### F. Section Catégories

Présenter les catégories sous forme d'icônes ou d'images illustrées.

Prévoir initialement :
- Prints
- Stickers
- Porte-clés

L'architecture doit permettre d'ajouter, masquer, réordonner ou supprimer des catégories sans modifier le code.

Chaque catégorie renvoie vers sa page dédiée.

### G. Footer

- Logo
- Navigation
- Contact
- Réseaux sociaux
- Mentions légales
- CGV
- Politique de confidentialité
- Livraison et retours

Ne pas inventer les coordonnées, les liens sociaux ou les informations légales.

---

## 4. Direction artistique

Créer une boutique créative, expressive, moderne et joyeuse.

Les deux fonds originaux DOURYA doivent être utilisés intelligemment :

**Fond quadrillé simple**
- Sections permanentes
- Zones décoratives
- Arrière-plans de certaines rubriques

**Fond quadrillé pailleté**
- Mises en avant
- Promotions
- Collections spéciales

Éviter de surcharger visuellement la page.

Les produits et illustrations doivent rester au centre de l'attention.

Le logo blanc doit rester parfaitement lisible.

Vérifier les contrastes, notamment pour les boutons jaunes et les textes blancs sur fond rose clair.

## 5. Préparer la personnalisation du thème

Créer un système de variables CSS permettant de modifier ultérieurement :
- Couleur principale
- Couleur secondaire
- Couleur des boutons
- Couleur des textes
- Couleur des fonds
- Rayon des bordures
- Typographie
- Image de fond de chaque section

Ne pas coder les couleurs en dur dans tous les composants.

Prévoir la possibilité de sélectionner un fond graphique ou une couleur unie pour chaque section.

## 6. Données de démonstration

Créer quelques produits fictifs pour tester les interfaces.

Ne pas présenter ces produits comme des créations réelles de DOURYA.

Ne pas inventer des prix officiels.

Utiliser des visuels de remplacement clairement identifiés si les photos des produits ne sont pas encore disponibles.

Les données doivent être séparées des composants pour faciliter leur remplacement.

## 7. Préparer l'architecture future

Anticiper sans développer :
- Authentification administrateur et client
- Gestion des produits et variantes
- Collections et catégories
- Panier et commandes
- Paiement Mollie
- Apple Pay et Google Pay via Mollie selon disponibilité
- Livraison postale
- Dashboard commercial
- Statistiques de fréquentation
- Personnalisation temporaire des produits
- Bibliothèque de médias
- Gestion du thème

Ne pas simuler un paiement réel ni une commande confirmée.

## 8. Qualité et vérifications

- TypeScript sans erreur
- Responsive mobile, tablette, desktop
- Navigation clavier
- Contrastes accessibles
- Images optimisées
- Pas de débordement horizontal
- Animations respectueuses des préférences utilisateur
- Composants maintenables
- Aucun secret exposé côté client

## 9. Livraison attendue

À la fin du lot :
1. Présenter la structure des fichiers créés.
2. Résumer les fonctionnalités réalisées.
3. Préciser les fichiers graphiques utilisés.
4. Indiquer les fonctionnalités encore simulées.
5. Fournir les commandes nécessaires pour lancer le projet localement.
6. Vérifier le build et signaler toute erreur.
7. Attendre la validation avant de commencer le lot suivant.

**Important : commencer par examiner le dépôt existant. Ne pas écraser des fichiers ou configurations sans nécessité.**

Le résultat attendu est une première version visuelle et navigable de la boutique DOURYA, fidèle à son identité de marque.

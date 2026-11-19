# Fiches produits : à valider avec Lizzie avant publication

30 fiches réelles sont en **brouillon** (`src/data/real-products.ts`) : une par galerie
photo (29) et le pack complet de prints Twilight. Elles s'affichent uniquement sur la
préversion `stripe-test` et en local (`next dev`), avec le badge « Brouillon ». Sur
dourya.fr, rien ne change : elles restent invisibles. La vente est fermée partout
(brouillon et stock non renseigné : « Stock à valider »).

Préversion : https://dourya-git-stripe-test-javachrist-projects.vercel.app/boutique

## 1. Prix appliqués (grille validée, en centimes)

| Produit | Fiches | Prix |
|---|---|---:|
| Sticker à l'unité | Doudou lapin, Fée, Milk, Nokio, Téléphone à clapet | 195 |
| Pack de stickers | Bookish, Coquette, Doggo, Notendo, Papillons, Poiscailles, Twilight, Witchy | 695 |
| Print à l'unité | Chat Roi 1 à 3, Doggo 1 et 2, Gros Dodo, Grozyeux 1 et 2, Twilight à l'unité | 695 |
| Pack complet de prints Twilight | `pack-prints-twilight` (mêmes photos que le print Twilight) | 2995 |
| Porte-clés standard | Bestiole, Nokio | 595 |
| Blindbox LaLa | `blindbox-lala` (galerie : les modèles possibles) | 650 |
| Blindbox Chaton mystère | `blindbox-chaton-mystere` (galerie : les modèles possibles) | 195 |
| Headband | Headband 1 et 2 | 995 |
| Dopamine MailClub | `dopamine-mailclub` | 1195 |

## 2. Photos principales

Photos principales reprises de `galeries.json` : 29 couvertures trouvées sur 29,
aucune correspondance manquante. Quatre galeries changent de photo principale :

| Fiche | Nouvelle photo principale |
|---|---|
| Headband 1 | IMG_6862 |
| Headband 2 | IMG_6863 |
| Blindbox LaLa | IMG_6735 |
| Blindbox Chaton mystère | IMG_6817 |

Pour les 25 autres, la couverture proposée était déjà la première photo. Le pack
complet de prints Twilight reprend la couverture du print Twilight (IMG_6793).

Pour réappliquer (par exemple après un nouvel import des photos, qui remet l'ordre
par nom de fichier) :

    node scripts/gallery-covers.mjs "C:\Users\JavaChrist\Desktop\galeries.json"

## 3. Décisions à prendre avec Lizzie

1. **Pack complet de prints Twilight** : quels prints exactement ? Combien ? Tous les
   visuels en photo ? Faut-il des photos propres au pack ?
2. **Print Twilight à l'unité** : une seule fiche avec un choix de visuel (variantes),
   ou une fiche par visuel ? Aujourd'hui : une fiche, une variante « À l'unité ».
3. **Variantes ou fiches séparées** : Chat Roi 1 / 2 / 3, Doggo 1 / 2, Grozyeux 1 / 2,
   Headband 1 / 2. Aujourd'hui : une fiche par dossier.
4. **Stocks** : stock limité (quantité par fiche) ou fabriqué à la demande ? Pour les
   blindbox, stock global ou par modèle ?
5. **Dopamine MailClub** : formule (contenu du colis, fréquence, achat unique ou
   abonnement), photo principale. Le dossier mélange un montage et des captures.
6. **Blindbox** : LaLa reste-t-elle dans « Porte-clés » et Chaton mystère dans
   « Stickers » ? Le texte « un modèle parmi ceux en photo » convient-il ?
7. **Photos peut-être mal rangées** (numéro hors de la série du dossier) :
   - Print Twilight contient IMG_6827 et IMG_6829, entre Chat Roi 3 (IMG_6828) et
     Chat Roi 2 (IMG_6830) ;
   - Pack Doggo contient IMG_6855, qui suit Pack Poiscailles (IMG_6847 à 6854) ;
   - Porte-clés Bestiole (IMG_5826), Pack Coquette (IMG_5827) et Sticker Milk
     (IMG_5828) ont chacun une photo d'une série plus ancienne.
8. **Thèmes communs** : Twilight, Doggo, Nokio existent dans plusieurs rubriques.
   Créer des collections ?
9. **Catégories** : stickers à l'unité et packs dans « Stickers » ; Headbands est une
   catégorie masquée sur le site. La montrer à la publication ?
10. **Textes** : noms définitifs, descriptions, poids et dimensions emballées (frais
    de port).

## 4. Point de vigilance

« Twilight » et « Notendo » renvoient à des marques ou œuvres existantes (fan art) :
vérifier les droits avant toute vente.

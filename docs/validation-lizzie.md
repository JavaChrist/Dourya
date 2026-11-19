# Photos produits : à valider avec Lizzie avant publication

Les 29 galeries de `DOURYA-photos-produits/PHOTOS` sont importées en **brouillon**
(`src/data/real-products.ts`). Elles s'affichent uniquement sur la préversion
`stripe-test` et en local (`next dev`), avec le badge « Brouillon ». Sur dourya.fr,
rien ne change : elles restent invisibles et ne peuvent pas être achetées.

Rien n'a été inventé : pas de prix (« Prix à venir »), pas de stock, pas de format,
pas de description. Les noms viennent des noms de dossiers.

Le fichier `galeries.json` n'a pas été fourni : la **photo principale** de chaque
galerie est provisoirement la première photo par ordre de nom de fichier.

## 1. Photos principales proposées (à confirmer ou changer)

| Fiche | Photos | Principale proposée |
|---|---:|---|
| headband-1 | 4 | IMG_6856 |
| headband-2 | 4 | IMG_6857 |
| mail-club | 9 | Design sans titre (1).png |
| porte-cles-bestiole | 4 | IMG_5826 |
| porte-cles-lala | 10 | IMG_6734 |
| porte-cles-nokio | 5 | IMG_6772 |
| print-chat-roi-1 | 2 | IMG_6831 |
| print-chat-roi-2 | 1 | IMG_6830 |
| print-chat-roi-3 | 1 | IMG_6828 |
| print-doggo-1 | 2 | IMG_6732 |
| print-doggo-2 | 2 | IMG_6730 |
| print-gros-dodo | 2 | IMG_6728 |
| print-grozyeux-1 | 2 | IMG_6791 |
| print-grozyeux-2 | 2 | IMG_6789 |
| print-twilight | 12 | IMG_6793 |
| sticker-pack-bookish | 6 | IMG_6783 |
| sticker-pack-coquette | 6 | IMG_5827 |
| sticker-pack-doggo | 7 | IMG_6833 |
| sticker-pack-notendo | 8 | IMG_6839 |
| sticker-pack-papillons | 7 | IMG_6820 |
| sticker-pack-poiscailles | 8 | IMG_6847 |
| sticker-pack-twilight | 6 | IMG_6803 |
| sticker-pack-witchy | 6 | IMG_6777 |
| sticker-chaton-mystere | 9 | IMG_6809 |
| sticker-doudou-lapin | 6 | IMG_6762 |
| sticker-fee | 2 | IMG_6818 |
| sticker-milk | 3 | IMG_5828 |
| sticker-nokio | 3 | IMG_6753 |
| sticker-telephone-a-clapet | 6 | IMG_6756 |

## 2. Regroupements ambigus

1. **Variantes ou produits séparés ?** Chat Roi 1 / 2 / 3, Doggo 1 / 2,
   Grozyeux 1 / 2, Headband 1 / 2. Aujourd'hui : une fiche par dossier.
2. **Photos peut-être mal rangées** (numéro hors de la série du dossier) :
   - Print Twilight contient IMG_6827 et IMG_6829, entre Chat Roi 3 (IMG_6828)
     et Chat Roi 2 (IMG_6830) ;
   - Pack Doggo contient IMG_6855, qui suit Pack Poiscailles (IMG_6847 à 6854) ;
   - Porte-clés Bestiole (IMG_5826), Pack Coquette (IMG_5827) et Sticker Milk
     (IMG_5828) ont chacun une photo d'une série plus ancienne : même produit ?
3. **Thèmes communs à plusieurs rubriques** : Twilight (print et pack), Doggo
   (prints et pack), Nokio (porte-clés et sticker). Créer des collections ?
4. **Mail Club** : produit à vendre, ou visuel de la section Mail Club de
   l'accueil ? Le dossier mélange un montage (« Design sans titre (1).png »),
   des PNG qui ressemblent à des captures et un webp. Aujourd'hui : fiche sans
   catégorie.
5. **Stickers à l'unité et packs** : tous dans la catégorie Stickers. Faut-il
   deux catégories ?
6. **Headbands** : la catégorie est masquée sur le site. La montrer à la
   publication ?

## 3. À fournir pour chaque fiche avant publication

- nom définitif et description ;
- variantes (formats, tailles) avec leur **prix** ;
- mode de stock (fabriqué à la demande, ou stock limité avec quantité) ;
- poids et dimensions emballées (frais de port) ;
- photo principale et ordre des photos.

## 4. Point de vigilance

« Twilight » et « Notendo » renvoient à des marques ou œuvres existantes (fan art) :
vérifier les droits avant toute vente.

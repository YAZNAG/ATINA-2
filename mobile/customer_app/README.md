# Application client Atina — version Flutter

Portage complet de `mobile_rn/customer_app` (React Native + Expo) vers Flutter, à
iso-design : mêmes maquettes Figma, mêmes couleurs, mêmes images, mêmes routes d'API.

**Stack** : Flutter 3.38 / Dart 3.10 · go_router · Riverpod · Dio · flutter_secure_storage ·
shared_preferences · cached_network_image · geolocator · url_launcher.

## Lancer

```bash
flutter pub get
flutter run                                                      # backend de production
flutter run --dart-define=API_URL=http://192.168.1.10:5002/api   # backend local
flutter build apk --release                                      # APK à distribuer
```

L'identifiant de paquet est `ma.atina.client`, le même que l'app Expo : **l'APK Flutter ne
s'installera pas par-dessus l'APK Expo déjà distribué** (clés de signature différentes), il
faut désinstaller l'ancienne app d'abord, ou signer avec le keystore utilisé par EAS.

## Organisation

| Dossier | Rôle |
|---|---|
| `lib/core/` | configuration, client HTTP, jeton, préférences |
| `lib/i18n/` | traduction FR/AR (592 libellés), RTL, formats nombre et date |
| `lib/theme/` | charte Figma (`atina.dart`) et composants partagés (`widgets.dart`) |
| `lib/services/` | appels d'API, une classe par domaine |
| `lib/state/` | états partagés Riverpod (panier, accueil, tunnel de commande) |
| `lib/screens/` | écrans, organisés comme les routes d'expo-router |
| `lib/widgets/` | carte produit, barre du bas, formulaire d'adresse, feuille de sélection |

## Écrans portés

**Ouverture** : splash, choix de la langue, deux écrans de présentation.
**Connexion** : téléphone, code à 4 chiffres, « Complétez votre profil ».
**Catalogue** : accueil, onglet Produits, page famille, catégories, produits d'une
catégorie, fiche produit, recherche, favoris, listes « voir tout ».
**Panier et commande** : panier, mode de réception, adresse, retrait en magasin,
créneaux, paiement avec code promo, confirmation.
**Commandes** : historique, détail, suivi par étapes, réponses aux remplacements.
**Offres et fidélité** : offres, vente flash, packs, points Atina, portefeuille, coupons,
échange de points, jeux, mes gains.
**Profil** : compte, modification, adresses, notifications, langue, suppression de compte.
**Assistance** : conversations, fil de discussion, FAQ, contact, réclamations (liste,
création, détail).

## Différences assumées avec la version Expo

- Changer de langue ne redémarre plus l'application : Flutter bascule le sens d'écriture
  (`Directionality`) sans rechargement.
- Les deux slides de présentation sont un `PageView` : le geste horizontal fonctionne.
- L'arabe utilise Noto Sans Arabic (SIL OFL) en repli : Inter n'a pas de glyphes arabes.
- Pas de mise à jour à distance (l'équivalent d'expo-updates n'existe pas côté Flutter) :
  chaque correction demande un nouvel APK.
- La photo de profil se choisit depuis « Modifier profil » et non à l'inscription, pour ne
  pas demander l'accès aux images au premier lancement.

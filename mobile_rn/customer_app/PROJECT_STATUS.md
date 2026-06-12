# PROJECT_STATUS.md — Dark Store Customer App
> Rapport généré le 2026-06-12 · Branche : Hajar · Auteur de l'analyse : Claude Code

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Vue d'ensemble du projet](#2-vue-densemble-du-projet)
3. [Architecture & structure des dossiers](#3-architecture--structure-des-dossiers)
4. [Technologies & dépendances](#4-technologies--dépendances)
5. [Inventaire des écrans](#5-inventaire-des-écrans)
6. [Inventaire des APIs](#6-inventaire-des-apis)
7. [Analyse des services](#7-analyse-des-services)
8. [Analyse des hooks](#8-analyse-des-hooks)
9. [Navigation](#9-navigation)
10. [Fonctionnalités métier](#10-fonctionnalités-métier)
11. [Détection des problèmes](#11-détection-des-problèmes)
12. [Progression par module](#12-progression-par-module)
13. [Priorités de développement](#13-priorités-de-développement)
14. [Roadmap des prochaines étapes](#14-roadmap-des-prochaines-étapes)

---

## 1. Résumé exécutif

| Indicateur | Valeur |
|---|---|
| **Nom du projet** | customer_app (Dark Store) |
| **Type** | Application mobile e-commerce B2C |
| **Stack principal** | React Native 0.85.3 + Expo v56 + TypeScript |
| **Routing** | Expo Router (file-based) |
| **Langage UI** | Français |
| **URL API** | `http://192.168.100.114:5000/api` |
| **Progression globale** | **~55 %** |
| **Écrans implémentés** | 17 / ~26 estimés |
| **Services actifs** | 5 / 7 |
| **Endpoints consommés** | 26 / 26 définis |

**État général :** Le projet est en phase de développement active. Le flux d'authentification, le catalogue produit, le panier et la gestion du profil / adresses sont fonctionnels. Les modules **Commandes**, **Wallet**, **Fidélité** et **Favoris** sont soit vides soit absents. L'absence de gestion d'état centralisée (Zustand/Redux) est le principal risque de dette technique à court terme.

---

## 2. Vue d'ensemble du projet

### Objectif métier
Application mobile destinée aux **clients finaux** d'un Dark Store (entrepôt de livraison rapide). Elle permet de parcourir un catalogue produit, gérer un panier et passer des commandes livrées à domicile. La plateforme backend associée gère également les opérations internes (Picker, Admin).

### Architecture générale

```
Expo Router (file-based routing)
  └── Screens (src/app/**)
        ├── Services API (src/services/**)    ← Axios + intercepteurs JWT
        ├── Components (src/components/**)
        ├── Hooks (src/hooks/**)
        └── Constants / Theme (src/constants/**)
```

Pas de store global centralisé — chaque écran gère son état local via `useState`.

---

## 3. Architecture & structure des dossiers

```
customer_app/
├── app.json                   # Config Expo (bundle ID, splash, plugins)
├── tsconfig.json              # TypeScript strict + alias @/*
├── package.json
├── expo-env.d.ts
└── src/
    ├── app/                   # Routes Expo Router (1 fichier = 1 route)
    │   ├── _layout.tsx        # Root Stack Navigator
    │   ├── index.tsx          # Splash + redirect
    │   ├── auth/              # Flux authentification (8 écrans)
    │   ├── main/              # App principale (7 écrans)
    │   ├── onboarding/        # Onboarding (3 slides)
    │   └── profile/           # Profil utilisateur (3 écrans)
    ├── api/
    │   └── client.ts          # Instance Axios + intercepteurs
    ├── services/              # Logique métier & appels API
    │   ├── auth.service.ts    # Auth legacy
    │   ├── customer_auth.service.ts  # Auth v2 (active)
    │   ├── catalog.service.ts
    │   ├── cart.service.ts
    │   ├── order.service.ts   # ⚠️ Vide
    │   └── profile.service.ts
    ├── components/
    │   ├── ui/                # Composants custom (ProductCard, BottomNavBar…)
    │   └── (base components)  # ThemedText, ThemedView…
    ├── hooks/
    │   ├── use-color-scheme.ts
    │   └── use-theme.ts
    └── constants/
        ├── config.ts          # API_URL, TIMEOUT
        ├── theme.ts           # Palette, typo, spacing
        └── countries.json     # Indicatifs pays
```

### Rôle de chaque dossier

| Dossier | Rôle |
|---|---|
| `src/app/` | Écrans et routes (convention Expo Router) |
| `src/api/` | Client HTTP unique, gestion du token JWT |
| `src/services/` | Abstraction des appels API, logique métier |
| `src/components/ui/` | Composants réutilisables spécifiques au projet |
| `src/components/` | Composants de base (theme, layout) |
| `src/hooks/` | Hooks partagés (theme, color scheme) |
| `src/constants/` | Configuration, thème, données statiques |

---

## 4. Technologies & dépendances

### Stack de production

| Technologie | Version | Usage |
|---|---|---|
| React Native | 0.85.3 | Moteur mobile |
| Expo SDK | ~56.0.8 | Runtime et toolchain |
| TypeScript | ~6.0.3 | Typage statique |
| Expo Router | ~56.2.8 | Navigation file-based |
| Axios | ^1.17.0 | Client HTTP |
| expo-secure-store | ~56.0.4 | Stockage sécurisé JWT |
| react-native-reanimated | 4.3.1 | Animations |
| expo-linear-gradient | ~56.0.4 | Dégradés UI |
| expo-image | ~56.0.9 | Chargement images optimisé |
| jwt-decode | ^4.0.0 | Décodage tokens JWT |
| @expo-google-fonts/poppins | ^0.4.1 | Police Poppins |
| @expo-google-fonts/inter | ^0.4.2 | Police Inter |

### Absences notables

| Technologie | Impact |
|---|---|
| ❌ Zustand / Redux | Pas de store global → prop drilling & re-fetching inutiles |
| ❌ React Query / SWR | Pas de cache serveur → rechargement à chaque navigation |
| ❌ Expo Notifications | Push notifications non implémentées |
| ❌ React Hook Form / Zod | Validation de formulaires entièrement manuelle |
| ❌ i18n (i18next) | Textes hardcodés en français |

---

## 5. Inventaire des écrans

| Écran | Fichier route | Fonction | Statut |
|---|---|---|---|
| **Splash** | `app/index.tsx` | Animation logo + redirection | ✅ Terminé |
| **Onboarding 1** | `app/onboarding/index.tsx` | Slide 1 de présentation | ✅ Terminé |
| **Onboarding 2** | `app/onboarding/slide2.tsx` | Slide 2 | ✅ Terminé |
| **Onboarding 3** | `app/onboarding/slide3.tsx` | Slide 3 + accès app | ✅ Terminé |
| **Login** | `app/auth/login.tsx` | Connexion phone/email + mdp | ✅ Terminé |
| **Register** | `app/auth/register.tsx` | Inscription (nom, email, mdp) | ✅ Terminé |
| **Verify Phone** | `app/auth/verify-phone.tsx` | Saisie numéro + sélecteur pays | ✅ Terminé |
| **Verify OTP** | `app/auth/verify-otp.tsx` | Code OTP 4 chiffres | ✅ Terminé |
| **Success** | `app/auth/success.tsx` | Confirmation inscription | ✅ Terminé |
| **Forgot Password** | `app/auth/forgot-password.tsx` | Initiation réinitialisation mdp | ✅ Terminé |
| **Forgot OTP** | `app/auth/forgot-otp.tsx` | OTP pour reset mdp | ✅ Terminé |
| **Reset Password** | `app/auth/reset-password.tsx` | Nouveau mot de passe | ✅ Terminé |
| **Home** | `app/main/home.tsx` | Accueil : catégories, produits, reco | ✅ Terminé |
| **Categories** | `app/main/categories.tsx` | Grille de toutes les catégories | ✅ Terminé |
| **Category Products** | `app/main/category-products.tsx` | Produits filtrés par catégorie | ✅ Terminé |
| **Product Detail** | `app/main/product-detail.tsx` | Fiche produit complète | ✅ Terminé |
| **Cart** | `app/main/cart.tsx` | Panier avec gestion quantités | ✅ Terminé |
| **Profile** | `app/profile/profile.tsx` | Profil utilisateur + stats + menu | ✅ Terminé |
| **Addresses** | `app/profile/addresses.tsx` | Liste + CRUD adresses (modal) | ✅ Terminé |
| **Notifications** | `app/profile/notifications.tsx` | Centre de notifications | ✅ Terminé |
| **Orders** | `app/main/orders` | Historique des commandes | ❌ Non implémenté |
| **Order Detail** | `app/main/order-detail` | Détail d'une commande | ❌ Non implémenté |
| **Favorites** | `app/main/favorites` | Liste de favoris | ❌ Non implémenté |
| **Edit Profile** | `app/profile/edit-profile` | Modification infos utilisateur | ❌ Non implémenté |
| **Checkout** | `app/main/checkout` | Tunnel de commande | ❌ Non implémenté |
| **Settings** | `app/profile/settings` | Préférences / langue / notifications | ❌ Non implémenté |

**Résumé : 20 écrans terminés / 26 identifiés (77 % des écrans)**

---

## 6. Inventaire des APIs

### Authentification

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| POST | `/auth/login` | auth.service.ts | login.tsx | ⚠️ Legacy |
| POST | `/auth/check-email` | auth.service.ts | register.tsx | ⚠️ Legacy |
| POST | `/auth/register` | auth.service.ts | register.tsx | ⚠️ Legacy |
| POST | `/otp/send-sms` | auth.service.ts | verify-otp.tsx | ⚠️ Legacy |
| POST | `/otp/send-whatsapp` | auth.service.ts | verify-otp.tsx | ⚠️ Legacy |
| POST | `/otp/verify` | auth.service.ts | verify-otp.tsx | ⚠️ Legacy |
| POST | `/otp/verify-register` | auth.service.ts | verify-otp.tsx | ⚠️ Legacy |
| POST | `/otp/verify-forgot` | auth.service.ts | forgot-otp.tsx | ⚠️ Legacy |
| POST | `/otp/forgot-password` | auth.service.ts | forgot-password.tsx | ⚠️ Legacy |
| POST | `/auth/reset-password` | auth.service.ts | reset-password.tsx | ⚠️ Legacy |
| POST | `/customer/auth/check-phone` | customer_auth.service.ts | — | ✅ Actif |
| POST | `/customer/auth/request-otp` | customer_auth.service.ts | — | ✅ Actif |
| POST | `/customer/auth/verify-otp` | customer_auth.service.ts | — | ✅ Actif |
| POST | `/customer/auth/register` | customer_auth.service.ts | — | ✅ Actif |
| POST | `/customer/auth/login` | customer_auth.service.ts | — | ✅ Actif |

### Catalogue

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/catalog/categories` | catalog.service.ts | home.tsx, categories.tsx | ✅ Actif |
| GET | `/customer/catalog/categories/:id/sub-categories` | catalog.service.ts | category-products.tsx | ✅ Actif |
| GET | `/customer/catalog/articles` | catalog.service.ts | home.tsx, category-products.tsx | ✅ Actif |
| GET | `/customer/catalog/articles/:id` | catalog.service.ts | product-detail.tsx | ✅ Actif |
| GET | `/customer/catalog/categories/:id/articles` | catalog.service.ts | category-products.tsx | ✅ Actif |
| GET | `/customer/catalog/recommendations` | catalog.service.ts | home.tsx | ✅ Actif |

### Panier

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/cart` | cart.service.ts | cart.tsx | ✅ Actif |
| POST | `/customer/cart` | cart.service.ts | product-detail.tsx | ✅ Actif |
| PUT | `/customer/cart/:sku_id` | cart.service.ts | cart.tsx | ✅ Actif |
| DELETE | `/customer/cart/:sku_id` | cart.service.ts | cart.tsx | ✅ Actif |
| DELETE | `/customer/cart` | cart.service.ts | cart.tsx | ✅ Actif |

### Profil & Adresses

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/me` | profile.service.ts | profile.tsx | ✅ Actif |
| PUT | `/customer/me` | profile.service.ts | — (edit-profile absent) | ⚠️ Défini, non utilisé |
| GET | `/customer/me/addresses` | profile.service.ts | addresses.tsx | ✅ Actif |
| POST | `/customer/me/addresses` | profile.service.ts | addresses.tsx | ✅ Actif |
| PUT | `/customer/me/addresses/:id` | profile.service.ts | addresses.tsx | ✅ Actif |
| DELETE | `/customer/me/addresses/:id` | profile.service.ts | addresses.tsx | ✅ Actif |
| PATCH | `/customer/me/addresses/:id/set-default` | profile.service.ts | addresses.tsx | ✅ Actif |
| GET | `/customer/me/orders` | profile.service.ts | — (orders absent) | ⚠️ Défini, non utilisé |
| GET | `/customer/me/orders/:id` | profile.service.ts | — (order-detail absent) | ⚠️ Défini, non utilisé |
| GET | `/customer/me/wallet` | profile.service.ts | profile.tsx | ✅ Actif |
| GET | `/customer/me/notifications` | profile.service.ts | notifications.tsx | ✅ Actif |
| PATCH | `/customer/me/notifications/:id/read` | profile.service.ts | notifications.tsx | ✅ Actif |
| PATCH | `/customer/me/notifications/read-all` | profile.service.ts | notifications.tsx | ✅ Actif |

---

## 7. Analyse des services

---

### `auth.service.ts` ⚠️ Legacy

**Fonction :** Service d'authentification basé sur les anciens endpoints `/auth/*` et `/otp/*`.

**Méthodes :**
- `login(email, password)` — POST `/auth/login`
- `checkEmail(email)` — POST `/auth/check-email`
- `register(...)` — POST `/auth/register`
- `sendSmsOtp(phone)` — POST `/otp/send-sms`
- `sendWhatsAppOtp(phone)` — POST `/otp/send-whatsapp`
- `verifyOtp(phone, code)` — POST `/otp/verify`
- `verifyRegisterOtp(...)` — POST `/otp/verify-register`
- `forgotPassword(phone)` — POST `/otp/forgot-password`
- `verifyForgotOtp(...)` — POST `/otp/verify-forgot`
- `resetPassword(...)` — POST `/auth/reset-password`

**État :** 🟡 Partiel — Service fonctionnel mais dupliqué par `customer_auth.service.ts`. Doit être supprimé ou intégré.

---

### `customer_auth.service.ts` ✅ Actif

**Fonction :** Service d'authentification moderne basé sur les endpoints `/customer/auth/*`. Gestion complète du token JWT via `expo-secure-store`.

**Méthodes :**
- `checkPhone(phone)` — Vérifie si le numéro existe
- `requestOtp(phone, channel)` — Envoie OTP (SMS ou WhatsApp)
- `verifyOtp(phone, code)` — Vérifie le code OTP
- `register(userData)` — Crée le compte client
- `login(credentials)` — Connexion + stockage token
- `logout()` — Suppression du token local
- `getToken()` — Lecture token depuis SecureStore
- `isTokenValid()` — Vérification expiration JWT (jwt-decode)
- `getCurrentUser()` — Retourne les infos du user connecté

**État :** ✅ Complet

---

### `catalog.service.ts` ✅ Actif

**Fonction :** Accès au catalogue produits (catégories, articles, recherche, recommandations).

**Méthodes :**
- `getCategories()` — Liste toutes les catégories
- `getSubCategories(categoryId)` — Sous-catégories d'une catégorie
- `getArticles(params?)` — Articles avec pagination et filtres
- `getArticleById(id)` — Détail d'un article
- `getArticlesByCategory(categoryId, params?)` — Articles filtrés par catégorie
- `searchArticles(query)` — Recherche full-text
- `getRecommendations()` — Articles recommandés pour l'utilisateur

**État :** ✅ Complet

---

### `cart.service.ts` ✅ Actif

**Fonction :** Gestion du panier d'achat côté API.

**Méthodes :**
- `getCart()` — Récupère le panier courant
- `addItem(sku_id, quantity)` — Ajoute un article
- `updateItem(sku_id, quantity)` — Met à jour la quantité
- `removeItem(sku_id)` — Supprime un article
- `clearCart()` — Vide entièrement le panier

**État :** ✅ Complet

---

### `order.service.ts` ❌ Incomplet

**Fonction :** Prévu pour la gestion des commandes.

**Méthodes :** _Aucune — fichier vide (placeholder)_

**État :** ❌ Incomplet — À implémenter en priorité haute

---

### `profile.service.ts` 🟡 Partiel

**Fonction :** Profil utilisateur, adresses, commandes, wallet, notifications.

**Méthodes :**
- `getProfile()` — Données utilisateur + stats
- `updateProfile(data)` — Modification profil _(non connecté à un écran)_
- `getAddresses()` — Liste des adresses
- `createAddress(data)` — Nouvelle adresse
- `updateAddress(id, data)` — Modification adresse
- `deleteAddress(id)` — Suppression adresse
- `setDefaultAddress(id)` — Adresse par défaut
- `getOrders(params?)` — Historique commandes _(écran absent)_
- `getOrderById(id)` — Détail commande _(écran absent)_
- `getWallet()` — Solde wallet
- `getNotifications()` — Liste notifications
- `markNotificationRead(id)` — Marquer lu
- `markAllNotificationsRead()` — Tout marquer lu

**État :** 🟡 Partiel — Service complet, mais 3 méthodes sans écran associé (orders, updateProfile)

---

## 8. Analyse des hooks

| Hook | Fichier | Utilisation | État |
|---|---|---|---|
| `useColorScheme` | `hooks/use-color-scheme.ts` | Détection mode clair/sombre | ✅ Complet |
| `useColorScheme` (web) | `hooks/use-color-scheme.web.ts` | Variante web | ✅ Complet |
| `useTheme` | `hooks/use-theme.ts` | Fournit les couleurs du thème actif | ✅ Complet |

**Hooks métier manquants (à créer) :**

| Hook suggéré | Utilité |
|---|---|
| `useCart` | Centraliser la logique panier (état + actions) |
| `useAuth` | Accès au user connecté depuis n'importe quel écran |
| `useCatalog` | Cache + pagination catalogue |
| `useNotifications` | Compteur de notifications non lues |
| `useProfile` | Données profil partagées entre écrans |

---

## 9. Navigation

### Arbre de navigation (Expo Router)

```
/ (Root Stack — _layout.tsx, headerShown: false)
│
├── /index                          → Splash + redirect automatique
│
├── /onboarding/
│   ├── _layout.tsx                 (Stack onboarding)
│   ├── index                       → Slide 1
│   ├── slide2                      → Slide 2
│   └── slide3                      → Slide 3 → redirige vers /auth/login
│
├── /auth/
│   ├── login                       → Login (phone/email)
│   ├── register                    → Inscription
│   ├── verify-phone                → Saisie numéro + pays
│   ├── verify-otp                  → Code OTP
│   ├── success                     → Confirmation
│   ├── forgot-password             → Init reset mdp
│   ├── forgot-otp                  → OTP reset mdp
│   └── reset-password              → Nouveau mdp
│
├── /main/
│   ├── _layout.tsx                 (Stack main app)
│   ├── home                        → Accueil ⭐
│   ├── categories                  → Grille catégories
│   ├── category-products           → Produits par catégorie
│   ├── product-detail              → Fiche produit
│   ├── cart                        → Panier
│   ├── [orders]                    → ❌ Non implémenté
│   ├── [order-detail]              → ❌ Non implémenté
│   ├── [favorites]                 → ❌ Non implémenté
│   └── [checkout]                  → ❌ Non implémenté
│
└── /profile/
    ├── profile                     → Profil utilisateur
    ├── addresses                   → Gestion adresses
    ├── notifications               → Centre notifications
    ├── [edit-profile]              → ❌ Non implémenté
    └── [settings]                  → ❌ Non implémenté
```

### Bottom Navigation Bar (BottomNavBar.tsx)

```
[ 🏠 Accueil ] [ 📦 Catégories ] [ 🛒 Panier ] [ ❤️ Favoris ] [ 👤 Profil ]
     home          categories         cart        favorites*       profile
                                   (floating)    ← non lié
```

_* La tab Favoris navigue vers une route inexistante → crash potentiel_

### Flux Auth (logique de redirection)

```
App Launch
  └── index.tsx → vérifie token valide
      ├── Token valide → /main/home
      └── Pas de token → /onboarding/index
                          └── Fin onboarding → /auth/login
```

---

## 10. Fonctionnalités métier

### Authentification

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Login (email/mdp) | ✅ Terminé | `/auth/login` | login.tsx |
| Login (téléphone/mdp) | ✅ Terminé | `/auth/login` | login.tsx |
| Inscription | ✅ Terminé | `/auth/register` | register.tsx → verify-phone → verify-otp → success |
| Vérification OTP | ✅ Terminé | `/otp/verify-register` | verify-otp.tsx |
| Reset mot de passe | ✅ Terminé | `/otp/forgot-password` + `/auth/reset-password` | forgot-password → forgot-otp → reset-password |
| Logout | ✅ Terminé | (local only) | profile.tsx |
| Persistance session | ✅ Terminé | SecureStore | Automatique |

### Catalogue

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Liste catégories | ✅ Terminé | `/customer/catalog/categories` | home.tsx, categories.tsx |
| Produits par catégorie | ✅ Terminé | `/customer/catalog/categories/:id/articles` | category-products.tsx |
| Sous-catégories | ✅ Terminé | `/customer/catalog/categories/:id/sub-categories` | category-products.tsx |
| Recherche produits | ✅ Terminé | `/customer/catalog/articles?search=` | category-products.tsx |
| Fiche produit | ✅ Terminé | `/customer/catalog/articles/:id` | product-detail.tsx |
| Recommandations | ✅ Terminé | `/customer/catalog/recommendations` | home.tsx |
| Promotions / Bannières | 🟡 Partiel | — | BannerSlider présent, données non connectées |
| Favoris / Wishlist | ❌ Non implémenté | — | — |

### Panier

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Afficher panier | ✅ Terminé | GET `/customer/cart` | cart.tsx |
| Ajouter article | ✅ Terminé | POST `/customer/cart` | product-detail.tsx |
| Modifier quantité | ✅ Terminé | PUT `/customer/cart/:sku_id` | cart.tsx |
| Supprimer article | ✅ Terminé | DELETE `/customer/cart/:sku_id` | cart.tsx |
| Vider panier | ✅ Terminé | DELETE `/customer/cart` | cart.tsx |
| Total / sous-total | ✅ Terminé | (calculé côté client) | cart.tsx |
| Passer commande | ❌ Non implémenté | — | — |

### Commandes

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Historique commandes | ❌ Non implémenté | GET `/customer/me/orders` | — |
| Détail commande | ❌ Non implémenté | GET `/customer/me/orders/:id` | — |
| Suivi livraison | ❌ Non implémenté | — | — |
| Tunnel de commande (checkout) | ❌ Non implémenté | — | — |

### Profil utilisateur

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Afficher profil | ✅ Terminé | GET `/customer/me` | profile.tsx |
| Statistiques (nb commandes, total) | ✅ Terminé | GET `/customer/me` | profile.tsx |
| Modifier profil | ❌ Non implémenté | PUT `/customer/me` | — |
| Gestion adresses (CRUD) | ✅ Terminé | `/customer/me/addresses/*` | addresses.tsx |
| Adresse par défaut | ✅ Terminé | PATCH `.../set-default` | addresses.tsx |
| Photo de profil | ❌ Non implémenté | — | — |

### Wallet

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Afficher solde | 🟡 Partiel | GET `/customer/me/wallet` | profile.tsx (affichage seul) |
| Recharger wallet | ❌ Non implémenté | — | — |
| Historique transactions | ❌ Non implémenté | — | — |

### Fidélité

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Points fidélité | ❌ Non implémenté | — | — |
| Récompenses | ❌ Non implémenté | — | — |

### Notifications

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Centre de notifications | ✅ Terminé | GET `/customer/me/notifications` | notifications.tsx |
| Marquer lu | ✅ Terminé | PATCH `.../read` | notifications.tsx |
| Marquer tout lu | ✅ Terminé | PATCH `.../read-all` | notifications.tsx |
| Push Notifications | ❌ Non implémenté | — | — |
| Badge compteur | 🟡 Partiel | (icône BottomNavBar) | Compteur non branché |

---

## 11. Détection des problèmes

### 🔴 Problèmes critiques

| # | Problème | Localisation | Impact |
|---|---|---|---|
| C1 | **Double service auth** : `auth.service.ts` et `customer_auth.service.ts` coexistent avec logiques dupliquées | `src/services/` | Confusion, risque de régressions, maintenance difficile |
| C2 | **Favoris tab sans route** : `BottomNavBar.tsx` pointe vers `/main/favorites` qui n'existe pas | `src/components/ui/BottomNavBar.tsx` | Crash navigation à l'usage |
| C3 | **Checkout absent** : Le bouton "Commander" dans `cart.tsx` n'a pas de destination | `src/app/main/cart.tsx` | Fonctionnalité cœur non terminée |
| C4 | **`order.service.ts` vide** : Aucune méthode implémentée | `src/services/order.service.ts` | Module Commandes bloqué |
| C5 | **URL API hardcodée** (`192.168.100.114:5000`) | `src/constants/config.ts` | Ne fonctionnera pas en production |

### 🟡 Problèmes moyens

| # | Problème | Localisation | Impact |
|---|---|---|---|
| M1 | **Pas de state management global** | Tous les écrans | Prop drilling, re-fetch redondants, état incohérent entre écrans |
| M2 | **Pas de cache API** (React Query/SWR absent) | Tous les services | Rechargement complet à chaque montée d'écran |
| M3 | **Validation formulaires manuelle** | Écrans auth, adresses | Code fragile, erreurs UX silencieuses |
| M4 | **`PUT /customer/me` non relié** | `profile.service.ts` | L'endpoint updateProfile existe mais aucun écran ne l'utilise |
| M5 | **Badge notifications non branché** | `BottomNavBar.tsx` | Compteur non lus non affiché |
| M6 | **Textes hardcodés en français** | Tous les écrans | Internationalisation impossible sans refactoring |
| M7 | **Pas de gestion d'erreur globale** | `src/api/client.ts` | Erreurs réseau silencieuses sur certains écrans |

### 🟢 Améliorations mineures

| # | Problème | Localisation |
|---|---|---|
| m1 | Couleurs dupliquées dans plusieurs fichiers (non systématiquement tirées du theme) | Écrans main/* |
| m2 | `BannerSlider.tsx` présent mais non alimenté par des données réelles | `src/components/ui/` |
| m3 | Pas de skeleton loading — indicateurs d'activité basiques (`ActivityIndicator`) | Tous les écrans |
| m4 | `countries.json` chargé entièrement même quand non nécessaire | `src/constants/` |
| m5 | Pas de tests unitaires ou e2e | Tout le projet |

---

## 12. Progression par module

| Module | Écrans | Services | Endpoints | Progression |
|---|---|---|---|---|
| **Authentification** | 8/8 ✅ | 2/2 (legacy à nettoyer) | 10/10 | **90 %** |
| **Onboarding** | 3/3 ✅ | — | — | **100 %** |
| **Catalogue** | 4/4 ✅ | 1/1 ✅ | 6/6 | **85 %** |
| **Panier** | 1/1 ✅ | 1/1 ✅ | 5/5 | **70 %** (checkout manquant) |
| **Profil** | 2/4 🟡 | 1/1 🟡 | 9/13 | **55 %** |
| **Commandes** | 0/2 ❌ | 0/1 ❌ | 0/2 | **0 %** |
| **Wallet** | 0/1 ❌ | 0/1 ❌ | 1/3 | **15 %** (affichage solde seul) |
| **Notifications** | 1/1 ✅ | (dans profile) | 3/3 ✅ | **75 %** (push absent) |
| **Fidélité** | 0/1 ❌ | 0/1 ❌ | 0/2 | **0 %** |
| **Favoris** | 0/1 ❌ | 0/1 ❌ | 0/2 | **0 %** |

### Progression globale estimée : **55 %**

```
Auth        ████████████████████  90 %
Onboarding  ████████████████████ 100 %
Catalogue   █████████████████░░░  85 %
Panier      ██████████████░░░░░░  70 %
Profil      ███████████░░░░░░░░░  55 %
Commandes   ░░░░░░░░░░░░░░░░░░░░   0 %
Wallet      ███░░░░░░░░░░░░░░░░░  15 %
Notifs      ███████████████░░░░░  75 %
Fidélité    ░░░░░░░░░░░░░░░░░░░░   0 %
Favoris     ░░░░░░░░░░░░░░░░░░░░   0 %

GLOBAL      ███████████░░░░░░░░░  55 %
```

---

## 13. Priorités de développement

### Priorité Haute — Bloquants pour la livraison

1. **Implémenter le tunnel de commande (Checkout)** — Écran `checkout.tsx` + intégration API orders + sélection adresse de livraison
2. **Créer `order.service.ts`** — Implémenter `createOrder()`, `getOrders()`, `getOrderById()`
3. **Implémenter les écrans Commandes** — `orders.tsx` (historique) + `order-detail.tsx` (détail + statut)
4. **Corriger la tab Favoris** — Soit implémenter l'écran, soit désactiver la navigation pour éviter le crash
5. **Remplacer l'URL hardcodée** — Utiliser une variable d'environnement via `expo-constants` ou `.env`
6. **Supprimer `auth.service.ts` legacy** — Consolider sur `customer_auth.service.ts` et nettoyer les imports

### Priorité Moyenne — Qualité & expérience utilisateur

1. **Ajouter Zustand** pour l'état global (panier, user, notifications) et éliminer les re-fetch
2. **Créer l'écran Edit Profile** — Brancher `PUT /customer/me`
3. **Brancher le badge notifications** dans `BottomNavBar`
4. **Implémenter le module Wallet** — Écran dédié + historique transactions
5. **Ajouter React Hook Form + Zod** pour la validation des formulaires (auth, adresses)
6. **Implémenter le filtrage par prix et tri** dans le catalogue
7. **Connecter les bannières promotionnelles** à des données API

### Priorité Faible — Évolutions futures

1. **Implémenter les Favoris** (wishlist) — Écran + service + endpoints backend
2. **Internationalisation (i18n)** — Extraction des textes + support arabe/anglais
3. **Push Notifications** — Intégrer `expo-notifications` + token FCM
4. **Fidélité** — Points, récompenses, historique
5. **Écran Settings** — Langue, notifications, confidentialité
6. **Photo de profil** — Upload via `expo-image-picker`
7. **Tests unitaires** — Jest + React Native Testing Library

---

## 14. Roadmap des prochaines étapes

### Sprint 1 — Complétion MVP (2–3 semaines)

```
[ ] Fix immédiat : corriger tab Favoris (désactiver ou stub screen)
[ ] Fix immédiat : externaliser API_URL en variable d'environnement
[ ] Implémenter order.service.ts (createOrder, getOrders, getOrderById)
[ ] Créer écran orders.tsx (historique commandes)
[ ] Créer écran order-detail.tsx (détail + tracking statut)
[ ] Créer écran checkout.tsx (récap panier + sélection adresse + validation)
[ ] Supprimer auth.service.ts legacy
```

### Sprint 2 — Qualité & state management (2 semaines)

```
[ ] Ajouter Zustand : stores authStore, cartStore, notifStore
[ ] Migrer les données partagées vers les stores (supprimer prop drilling)
[ ] Créer écran edit-profile.tsx
[ ] Brancher badge notifications dans BottomNavBar
[ ] Ajouter gestion d'erreur globale dans api/client.ts
[ ] Ajouter skeleton loading sur les écrans catalogue et profil
```

### Sprint 3 — Fonctionnalités avancées (2–3 semaines)

```
[ ] Module Wallet : écran + historique transactions
[ ] Module Favoris : service + écran + endpoints backend
[ ] Connecter BannerSlider à des données API
[ ] Ajouter filtres prix et tri dans le catalogue
[ ] Implémenter React Hook Form + Zod (auth, adresses)
```

### Sprint 4 — Production-readiness (2 semaines)

```
[ ] Push Notifications (expo-notifications + FCM)
[ ] Internationalisation (i18n) — FR/AR/EN
[ ] Module Fidélité
[ ] Tests unitaires (composants clés + services)
[ ] Tests e2e (Maestro ou Detox) sur le golden path (login → catalogue → panier → commande)
[ ] Audit performance (FlatList optimisations, images)
[ ] Configuration CI/CD (EAS Build + EAS Submit)
```

---

## Statistiques globales

| Métrique | Valeur |
|---|---|
| Fichiers source TypeScript | ~45 |
| Lignes de code estimées | ~4 500 |
| Écrans terminés | 20 / 26 (77 %) |
| Endpoints définis dans les services | 38 |
| Endpoints actuellement consommés par un écran | 32 (84 %) |
| Services complets | 3 / 7 (43 %) |
| Hooks personnalisés | 2 (3 manquants prioritaires) |
| Composants UI réutilisables | ~12 |
| Modules entièrement absents | 3 (Commandes, Fidélité, Favoris) |
| Dette technique estimée | Moyenne |

---

*Rapport généré automatiquement par analyse statique du code source — Dark Store, branche `Hajar`, 2026-06-12.*

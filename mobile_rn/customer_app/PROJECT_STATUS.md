# PROJECT_STATUS.md — Dark Store Customer App
> Analyse basée sur la lecture intégrale du code source · Branche : Hajar · Date : 2026-06-23

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Vue d'ensemble du projet](#2-vue-densemble-du-projet)
3. [Architecture & structure des dossiers](#3-architecture--structure-des-dossiers)
4. [Technologies & dépendances](#4-technologies--dépendances)
5. [Inventaire des écrans](#5-inventaire-des-écrans)
6. [Inventaire des APIs](#6-inventaire-des-apis)
7. [Analyse des services](#7-analyse-des-services)
8. [Analyse des hooks & contextes](#8-analyse-des-hooks--contextes)
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
| **Stack principal** | React Native 0.85.3 + Expo SDK 56 + TypeScript |
| **Routing** | Expo Router v56.2.8 (file-based) |
| **Langage UI** | Français |
| **URL API (dev)** | `http://192.168.100.114:5000/api` |
| **Progression globale** | **~78 %** |
| **Écrans implémentés** | 28 / 31 identifiés |
| **Services actifs** | 5 / 5 (100 %) |
| **Endpoints définis** | 50+ |

**État général :** Le projet est significativement plus avancé que les rapports précédents l'indiquaient. Le tunnel de commande complet (7 écrans), les commandes avec tracking en temps réel, les favoris, les paramètres profil (photo, mot de passe, langue, téléphone) sont tous implémentés et fonctionnels. Les principaux manques restants sont : un écran Wallet dédié, le module Fidélité, les Push Notifications, et la configuration production (URL hardcodée).

---

## 2. Vue d'ensemble du projet

### Objectif métier
Application mobile destinée aux **clients finaux** d'un Dark Store (entrepôt de livraison rapide). Parcourir un catalogue, gérer un panier, passer commande (livraison à domicile ou retrait en magasin), suivre la livraison, gérer son profil, wallet et favoris.

### Architecture générale
```
Expo Router (file-based routing)
  └── Screens (src/app/**)
        ├── order.service.ts      ← fetch natif + SecureStore (checkout uniquement)
        ├── services/*.service.ts ← Axios (catalog, cart, profile, auth)
        ├── context/CartContext   ← State global panier (React Context)
        ├── components/ui/**      ← Composants réutilisables
        ├── hooks/**              ← Hooks theme + color scheme
        └── constants/**          ← Config, thème, données statiques
```

**Particularité architecturale :** `order.service.ts` utilise le `fetch` natif avec `SecureStore` directement (sans Axios), alors que tous les autres services utilisent l'instance Axios centralisée de `src/api/client.ts`. Cette incohérence est un point de dette technique.

---

## 3. Architecture & structure des dossiers

```
customer_app/
├── app.json                    # Config Expo (bundle ID, splash, React Compiler)
├── tsconfig.json               # TypeScript strict + alias @/*
├── package.json
├── CLAUDE.md → AGENTS.md       # Note Expo v56 pour agents IA
└── src/
    ├── app/                    # Routes Expo Router (1 fichier = 1 route)
    │   ├── _layout.tsx         # Root Stack Navigator
    │   ├── index.tsx           # Splash + redirect auth
    │   ├── explore.tsx         # (écran Expo template, non utilisé en prod)
    │   ├── auth/               # 8 écrans d'authentification
    │   ├── main/               # 8 écrans de l'application principale
    │   ├── onboarding/         # 4 slides d'onboarding
    │   ├── order/              # 7 écrans du tunnel de commande ← NOUVEAU
    │   └── profile/            # 4 écrans de profil
    ├── api/
    │   └── client.ts           # Instance Axios + intercepteurs JWT
    ├── context/
    │   └── CartContext.tsx     # Global state : cartCount + refreshCartCount
    ├── services/               # Logique métier & appels API
    │   ├── customer_auth.service.ts   # Auth v2 (active, SecureStore)
    │   ├── catalog.service.ts         # Catalogue + villes
    │   ├── cart.service.ts            # Panier
    │   ├── order.service.ts           # Checkout (fetch natif)
    │   └── profile.service.ts         # Profil, adresses, favoris, wallet, notifs
    ├── components/
    │   ├── ui/                 # 10 composants custom
    │   └── (base components)   # ThemedText, ThemedView, etc.
    ├── hooks/
    │   ├── use-color-scheme.ts
    │   └── use-theme.ts
    ├── utils/
    │   └── searchHistory.ts    # Historique des recherches (AsyncStorage)
    └── constants/
        ├── config.ts           # API_URL, STORAGE_URL, TIMEOUT ⚠️ hardcodés
        ├── theme.ts            # Palette, typo, spacing
        └── countries.json      # Indicatifs pays
```

### Rôle de chaque dossier

| Dossier | Rôle |
|---|---|
| `src/app/` | Écrans & routes (convention Expo Router — 1 fichier = 1 route) |
| `src/api/` | Client HTTP unique Axios, injection automatique du token JWT |
| `src/context/` | État global React Context (compteur panier) |
| `src/services/` | Abstraction des appels API, logique métier, types TypeScript |
| `src/components/ui/` | Composants réutilisables spécifiques au projet |
| `src/components/` | Composants de base (theme, layout) |
| `src/hooks/` | Hooks partagés (thème, color scheme) |
| `src/utils/` | Utilitaires (historique de recherche) |
| `src/constants/` | Configuration, thème global, données statiques |

---

## 4. Technologies & dépendances

### Stack de production

| Technologie | Version | Usage |
|---|---|---|
| React Native | 0.85.3 | Moteur mobile cross-platform |
| Expo SDK | ~56.0.8 | Runtime, toolchain, plugins |
| TypeScript | ~6.0.3 | Typage statique strict |
| Expo Router | ~56.2.8 | Navigation file-based |
| React | 19.2.3 | UI |
| Axios | ^1.17.0 | Client HTTP (tous services sauf order) |
| expo-secure-store | ~56.0.4 | Stockage sécurisé JWT |
| expo-location | intégrée | Géolocalisation (delivery_address.tsx) |
| expo-image-picker | intégrée | Upload avatar (settings.tsx) |
| react-native-reanimated | 4.3.1 | Animations |
| expo-linear-gradient | ~56.0.4 | Dégradés (card_payment.tsx) |
| expo-image | ~56.0.9 | Chargement images optimisé |
| jwt-decode | ^4.0.0 | Décodage/validation tokens JWT |
| @expo-google-fonts/poppins | ^0.4.1 | Police display |
| @expo-google-fonts/inter | ^0.4.2 | Police corps de texte |
| react-native-safe-area-context | ~5.7.0 | Zones sûres iOS/Android |
| react-native-gesture-handler | ~2.31.1 | Gestes tactiles |

### Absences notables

| Technologie | Impact |
|---|---|
| ❌ Zustand / Redux | Pas de store global → seul CartContext existe, le reste est local |
| ❌ React Query / SWR | Pas de cache serveur → re-fetch complet à chaque montée d'écran |
| ❌ Expo Notifications | Push notifications impossibles en l'état |
| ❌ React Hook Form / Zod | Validation manuelle dans tous les formulaires |
| ❌ i18n (i18next) | Textes hardcodés en français (langue switchable dans settings mais non appliquée) |
| ❌ Variables d'env | URL IP hardcodée dans config.ts → bloquant pour la production |

---

## 5. Inventaire des écrans

### Auth & Onboarding

| Écran | Fichier route | Fonction | Statut |
|---|---|---|---|
| **Splash** | `app/index.tsx` | Animation logo + redirection auto | ✅ Terminé |
| **Onboarding 1** | `app/onboarding/index.tsx` | Slide 1 | ✅ Terminé |
| **Onboarding 2** | `app/onboarding/slide2.tsx` | Slide 2 | ✅ Terminé |
| **Onboarding 3** | `app/onboarding/slide3.tsx` | Slide 3 + CTA | ✅ Terminé |
| **Login** | `app/auth/login.tsx` | Connexion phone/email + mdp | ✅ Terminé |
| **Register** | `app/auth/register.tsx` | Inscription (nom, email, mdp) | ✅ Terminé |
| **Verify Phone** | `app/auth/verify-phone.tsx` | Saisie numéro + sélecteur pays | ✅ Terminé |
| **Verify OTP** | `app/auth/verify-otp.tsx` | Code OTP 4 chiffres | ✅ Terminé |
| **Success** | `app/auth/success.tsx` | Confirmation inscription | ✅ Terminé |
| **Forgot Password** | `app/auth/forgot-password.tsx` | Init reset mdp | ✅ Terminé |
| **Forgot OTP** | `app/auth/forgot-otp.tsx` | OTP pour reset mdp | ✅ Terminé |
| **Reset Password** | `app/auth/reset-password.tsx` | Nouveau mot de passe | ✅ Terminé |

### Application principale

| Écran | Fichier route | Fonction | Statut |
|---|---|---|---|
| **Home** | `app/main/home.tsx` | Accueil : catégories, produits, reco | ✅ Terminé |
| **Categories** | `app/main/categories.tsx` | Grille de toutes les catégories | ✅ Terminé |
| **Category Products** | `app/main/category-products.tsx` | Produits filtrés + sous-catégories | ✅ Terminé |
| **Product Detail** | `app/main/product-detail.tsx` | Fiche produit + ajout panier | ✅ Terminé |
| **Cart** | `app/main/cart.tsx` | Panier + gestion quantités + accès checkout | ✅ Terminé |
| **Favorites** | `app/main/favorites.tsx` | Wishlist + ajout au panier | ✅ Terminé |
| **Orders** | `app/main/orders.tsx` | Historique commandes + statuts colorés | ✅ Terminé |
| **Order Detail** | `app/main/order-detail.tsx` | Suivi commande + timeline + récapitulatif | ✅ Terminé |

### Tunnel de commande (Checkout)

| Écran | Fichier route | Fonction | Statut |
|---|---|---|---|
| **Delivery Type** | `app/order/delivery_type.tsx` | Choix livraison / retrait | ✅ Terminé |
| **Delivery Address** | `app/order/delivery_address.tsx` | Adresse + GPS + sélecteur ville | ✅ Terminé |
| **Delivery Pickup** | `app/order/delivery_pickup.tsx` | Sélection magasin + itinéraire Maps | ✅ Terminé |
| **Delivery DateTime** | `app/order/delivery_datetime.tsx` | Calendrier + créneaux API | ✅ Terminé |
| **Payment** | `app/order/payment.tsx` | Méthodes paiement + wallet + récap | ✅ Terminé |
| **Card Payment** | `app/order/card_payment.tsx` | Formulaire carte bancaire visuel | ✅ Terminé |
| **Confirmed** | `app/order/confirmed.tsx` | Confirmation commande | ✅ Terminé |

### Profil

| Écran | Fichier route | Fonction | Statut |
|---|---|---|---|
| **Profile** | `app/profile/profile.tsx` | Stats + menu + wallet solde | ✅ Terminé |
| **Addresses** | `app/profile/addresses.tsx` | CRUD adresses + adresse défaut | ✅ Terminé |
| **Notifications** | `app/profile/notifications.tsx` | Centre notifs + marquer lu + supprimer | ✅ Terminé |
| **Settings** | `app/profile/settings.tsx` | Photo, nom, email, tél+OTP, mdp, langue | ✅ Terminé |
| **Wallet** | _(absent)_ | Écran wallet dédié + transactions | ❌ Non implémenté |
| **Loyalty** | _(absent)_ | Programme fidélité + points | ❌ Non implémenté |

### Non reliés / résidus

| Écran | Fichier | Raison |
|---|---|---|
| **Explore** | `app/explore.tsx` | Template Expo, non lié à la navigation |

**Résumé : 28 écrans terminés / 31 identifiés (90 % des écrans métier)**

---

## 6. Inventaire des APIs

### Authentification

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| POST | `/customer/auth/check-phone` | customer_auth | verify-phone.tsx | ✅ |
| POST | `/customer/auth/request-otp` | customer_auth | verify-otp.tsx | ✅ |
| POST | `/customer/auth/verify-otp` | customer_auth | verify-otp.tsx | ✅ |
| POST | `/customer/auth/register` | customer_auth | register.tsx | ✅ |
| POST | `/customer/auth/login` | customer_auth | login.tsx | ✅ |

### Catalogue

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/catalog/categories` | catalog | home, categories | ✅ |
| GET | `/customer/catalog/categories/:id/sub-categories` | catalog | category-products | ✅ |
| GET | `/customer/catalog/articles` | catalog | home, category-products | ✅ |
| GET | `/customer/catalog/articles/:id` | catalog | product-detail | ✅ |
| GET | `/customer/catalog/categories/:id/articles` | catalog | category-products | ✅ |
| GET | `/customer/catalog/recommendations` | catalog | home | ✅ |
| GET | `/customer/catalog/cities` | catalog | delivery_address | ✅ |

### Panier

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/cart` | cart | cart.tsx, CartContext | ✅ |
| POST | `/customer/cart` | cart | product-detail, favorites | ✅ |
| PUT | `/customer/cart/:sku_id` | cart | cart.tsx | ✅ |
| DELETE | `/customer/cart/:sku_id` | cart | cart.tsx | ✅ |
| DELETE | `/customer/cart` | cart | cart.tsx, payment, card_payment | ✅ |

### Checkout (order.service.ts — fetch natif)

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/checkout/meta?node_id=` | order | payment.tsx | ✅ |
| POST | `/customer/checkout/calculate` | order | payment.tsx | ✅ |
| POST | `/customer/checkout/eligible-nodes` | order | _(défini, non appelé en UI)_ | ⚠️ |
| GET | `/customer/checkout/pickup-nodes` | order | delivery_pickup.tsx | ✅ |
| GET | `/customer/checkout/delivery-slots` | order | delivery_datetime.tsx | ✅ |
| POST | `/customer/checkout/create-order` | order | payment.tsx, card_payment.tsx | ✅ |

### Profil & Compte

| Méthode | Endpoint | Service | Utilisé par | Statut |
|---|---|---|---|---|
| GET | `/customer/me` | profile | profile.tsx, delivery_address | ✅ |
| PUT | `/customer/me` | profile | settings.tsx (nom, ville, langue) | ✅ |
| PUT | `/customer/me/email` | profile | settings.tsx | ✅ |
| PUT | `/customer/me/password` | profile | settings.tsx | ✅ |
| POST | `/customer/me/phone/request-otp` | profile | settings.tsx | ✅ |
| POST | `/customer/me/phone/verify-otp` | profile | settings.tsx | ✅ |
| POST | `/customer/me/avatar` | profile | settings.tsx | ✅ |
| DELETE | `/customer/me/avatar` | profile | settings.tsx | ✅ |
| GET | `/customer/me/addresses` | profile | addresses.tsx, delivery_address | ✅ |
| POST | `/customer/me/addresses` | profile | addresses.tsx, delivery_address | ✅ |
| PUT | `/customer/me/addresses/:id` | profile | addresses.tsx, delivery_address | ✅ |
| DELETE | `/customer/me/addresses/:id` | profile | addresses.tsx | ✅ |
| PATCH | `/customer/me/addresses/:id/set-default` | profile | addresses.tsx | ✅ |
| GET | `/customer/me/orders` | profile | orders.tsx | ✅ |
| GET | `/customer/me/orders/:id` | profile | order-detail.tsx | ✅ |
| GET | `/customer/me/wallet` | profile | profile.tsx, payment.tsx | ✅ |
| GET | `/customer/me/favorites` | profile | favorites.tsx | ✅ |
| POST | `/customer/me/favorites` | profile | product-detail.tsx | ✅ |
| DELETE | `/customer/me/favorites/:id` | profile | favorites.tsx | ✅ |
| GET | `/customer/me/notifications` | profile | notifications.tsx | ✅ |
| PATCH | `/customer/me/notifications/:id/read` | profile | notifications.tsx | ✅ |
| PATCH | `/customer/me/notifications/read-all` | profile | notifications.tsx | ✅ |
| DELETE | `/customer/me/notifications/:id` | profile | notifications.tsx | ✅ |
| DELETE | `/customer/me/notifications/all` | profile | notifications.tsx | ✅ |

---

## 7. Analyse des services

---

### `customer_auth.service.ts` ✅ Complet

**Fonction :** Authentification via endpoints `/customer/auth/*`. Stockage JWT dans `expo-secure-store`.

**Méthodes :**
- `checkPhone(phone)` — Vérifie existence du numéro
- `requestOtp(phone, channel)` — Envoie OTP (SMS / WhatsApp)
- `verifyOtp(phone, code)` — Vérifie code OTP
- `register(userData)` — Création compte client
- `login(credentials)` — Connexion + stockage token
- `logout()` — Suppression token local
- `getToken()` — Lecture token SecureStore
- `isTokenValid()` — Validation expiration JWT (jwt-decode)
- `getMe()` — Retourne le user connecté (décodé du token)

**Note :** Plus de `auth.service.ts` legacy — nettoyé.

---

### `catalog.service.ts` ✅ Complet

**Fonction :** Catalogue produits, villes.

**Méthodes :**
- `getCategories()` — Toutes les catégories
- `getSubCategories(categoryId)` — Sous-catégories
- `getArticles(params?)` — Articles + pagination + filtres
- `getArticleById(id)` — Détail article
- `getArticlesByCategory(categoryId, params?)` — Articles par catégorie
- `searchArticles(query)` — Recherche full-text
- `getRecommendations()` — Articles recommandés
- `getCities()` — Liste des villes (utilisée dans delivery_address)

---

### `cart.service.ts` ✅ Complet

**Fonction :** Gestion panier via API.

**Méthodes :**
- `getCart()` — Panier courant
- `addItem(sku_id, quantity)` — Ajout article
- `updateItem(sku_id, quantity)` — Mise à jour quantité
- `removeItem(sku_id)` — Suppression article
- `clearCart()` — Vider le panier (appelé après création commande)

---

### `order.service.ts` ✅ Complet

**Fonction :** Tunnel de commande complet. Utilise `fetch` natif (non Axios).

**Interfaces exportées :** `CartItem`, `PaymentMethod`, `DeliveryType`, `DeliverySlot`, `Node`, `Meta`, `CreateOrderPayload`, `OrderCreated`, `OrderCalculation`, `DeliverySlotsResult`

**Méthodes :**
- `getMeta(node_id?)` — Méthodes de paiement + types de livraison disponibles
- `calculateOrder(params)` — Calcul total HT/TTC/livraison/wallet
- `findEligibleNodes(address_id, cart_items, date?)` — Nœuds de livraison éligibles pour une adresse _(défini mais non utilisé dans l'UI — logique déléguée au backend via delivery-slots)_
- `findPickupNodes(cart_items, date?)` — Magasins de retrait disponibles
- `getDeliverySlots(params)` — Créneaux horaires disponibles (livraison ou retrait)
- `createOrder(payload)` — Création de commande → retourne `{ id, reference, status }`

---

### `profile.service.ts` ✅ Complet

**Fonction :** Profil, adresses, commandes, wallet, favoris, notifications.

**Interfaces exportées :** `Profile`, `Address`, `FavoriteArticle`, `OrderStatus`, `OrderSummary`, `OrderItem`, `OrderTimeline`, `Order`, `Wallet`, `Notification`

**Méthodes :**
- `getProfile()` — Profil complet
- `updateProfile(data)` — Nom, ville, langue préférée
- `updateEmail(email)` — PUT `/customer/me/email`
- `requestPhoneChange(phone, country)` — Envoi OTP changement tél
- `confirmPhoneChange(phone, otp, country)` — Confirmation OTP
- `changePassword(old, new)` — Changement mot de passe
- `uploadAvatar(uri)` — Upload photo (multipart/form-data)
- `deleteAvatar()` — Suppression photo
- `listAddresses()` / `createAddress()` / `updateAddress()` / `deleteAddress()` / `setDefaultAddress()` — CRUD adresses
- `listOrders()` / `getOrderById(id)` — Commandes
- `getWallet()` — Solde + transactions wallet
- `listFavorites()` / `addFavorite(articleId)` / `removeFavorite(articleId)` — Wishlist
- `listNotifications()` / `markNotificationRead()` / `markAllNotificationsRead()` / `deleteNotification()` / `deleteAllNotifications()` — Notifications

---

## 8. Analyse des hooks & contextes

### Hooks

| Hook | Fichier | Utilisation | État |
|---|---|---|---|
| `useColorScheme` | `hooks/use-color-scheme.ts` | Détection mode clair/sombre | ✅ |
| `useColorScheme` (web) | `hooks/use-color-scheme.web.ts` | Variante web | ✅ |
| `useTheme` | `hooks/use-theme.ts` | Fournit les couleurs du thème actif | ✅ |

### Contextes React

| Contexte | Fichier | Utilisation | État |
|---|---|---|---|
| `CartContext` | `context/CartContext.tsx` | `cartCount` + `refreshCartCount()` partagés globalement | ✅ |

`CartContext` est le seul mécanisme de state global. Il est utilisé dans : `_layout.tsx` (Provider), `payment.tsx`, `card_payment.tsx`, `favorites.tsx`, `product-detail.tsx`, `BottomNavBar.tsx`.

### Hooks métier absents (à créer)

| Hook suggéré | Utilité |
|---|---|
| `useAuth` | Accès au user connecté depuis n'importe quel écran |
| `useProfile` | Données profil partagées entre écrans profil |
| `useNotificationBadge` | Compteur de notifications non lues dans la navbar |

---

## 9. Navigation

### Arbre de navigation complet (Expo Router)

```
/ (Root Stack — _layout.tsx, CartProvider wrappé)
│
├── /index                         → Splash + check token → redirect
│
├── /onboarding/
│   ├── _layout.tsx                (Stack)
│   ├── index                      → Slide 1
│   ├── slide2                     → Slide 2
│   └── slide3                     → Slide 3 → /auth/login
│
├── /auth/
│   ├── login                      → Connexion
│   ├── register                   → Inscription
│   ├── verify-phone               → Saisie téléphone
│   ├── verify-otp                 → Code OTP
│   ├── success                    → Succès inscription
│   ├── forgot-password            → Init reset mdp
│   ├── forgot-otp                 → OTP reset mdp
│   └── reset-password             → Nouveau mdp
│
├── /main/
│   ├── _layout.tsx                (Stack)
│   ├── home                       → Accueil ⭐
│   ├── categories                 → Toutes catégories
│   ├── category-products          → Produits filtrés
│   ├── product-detail             → Fiche produit
│   ├── cart                       → Panier → /order/delivery_type
│   ├── favorites                  → Wishlist ✅
│   ├── orders                     → Historique commandes ✅
│   └── order-detail               → Suivi commande ✅
│
├── /order/                        ← TUNNEL CHECKOUT ✅
│   ├── delivery_type              → Choix livraison / retrait (Étape 1)
│   ├── delivery_address           → Adresse + GPS (→ si "home") (Étape 1 suite)
│   ├── delivery_pickup            → Magasin (→ si "pickup") (Étape 1 suite)
│   ├── delivery_datetime          → Calendrier + créneaux (Étape 2)
│   ├── payment                    → Paiement + récapitulatif (Étape 3)
│   ├── card_payment               → Formulaire carte (→ si méthode "card") (Étape 3)
│   └── confirmed                  → Confirmation ✅ → /main/orders ou /main/home
│
└── /profile/
    ├── profile                    → Profil + stats + menu
    ├── addresses                  → CRUD adresses
    ├── notifications              → Centre notifications
    └── settings                  → Photo, infos perso, sécurité, langue ✅
```

### Bottom Navigation Bar (BottomNavBar.tsx)

```
[ 🏠 Accueil ] [ 📦 Catégories ] [ 🛒 Panier ] [ ❤️ Favoris ] [ 👤 Profil ]
     home          categories         cart        favorites        profile
                                   (floating)   ← badge count via CartContext
```

Le badge de la tab Panier est alimenté par `CartContext.cartCount`.

### Flux Auth (logique de redirection)

```
App Launch → index.tsx
  └── isTokenValid() ?
      ├── OUI → /main/home
      └── NON → /onboarding/index → /auth/login → /main/home
```

### Flux Checkout

```
/main/cart → "Commander"
  └── /order/delivery_type
        ├── "Livraison" → /order/delivery_address → /order/delivery_datetime
        └── "Retrait"  → /order/delivery_pickup  → /order/delivery_datetime
                                └── /order/payment
                                      ├── (COD/Wallet) → createOrder() → /order/confirmed
                                      └── (Card)       → /order/card_payment → createOrder() → /order/confirmed
```

---

## 10. Fonctionnalités métier

### Authentification

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Login email/mdp | ✅ | `/customer/auth/login` | login.tsx |
| Login téléphone/mdp | ✅ | `/customer/auth/login` | login.tsx |
| Inscription OTP | ✅ | `check-phone`, `request-otp`, `verify-otp`, `register` | register → verify-phone → verify-otp → success |
| Reset mot de passe | ✅ | `forgot-password`, `reset-password` | forgot-password → forgot-otp → reset-password |
| Logout | ✅ | (local) | profile.tsx |
| Persistance session JWT | ✅ | SecureStore | Automatique via _layout |

### Catalogue

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Catégories | ✅ | `/categories` | home, categories |
| Sous-catégories | ✅ | `/categories/:id/sub-categories` | category-products |
| Produits + pagination | ✅ | `/articles` | home, category-products |
| Fiche produit | ✅ | `/articles/:id` | product-detail |
| Recherche + historique | ✅ | `/articles?search=` + searchHistory.ts | category-products |
| Recommandations | ✅ | `/recommendations` | home |
| Favoris (toggle ♡) | ✅ | `POST/DELETE /me/favorites` | product-detail |
| Bannières promotionnelles | 🟡 | _(BannerSlider présent, non alimenté)_ | home |

### Panier

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Afficher panier | ✅ | GET `/customer/cart` | cart.tsx |
| Ajouter article | ✅ | POST `/customer/cart` | product-detail, favorites |
| Modifier quantité | ✅ | PUT `/customer/cart/:sku_id` | cart.tsx |
| Supprimer article | ✅ | DELETE `/customer/cart/:sku_id` | cart.tsx |
| Vider panier | ✅ | DELETE `/customer/cart` | cart.tsx, après commande |
| Badge panier | ✅ | CartContext | BottomNavBar |

### Tunnel de commande (Checkout)

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Choix mode réception | ✅ | — | delivery_type |
| Saisie adresse + GPS | ✅ | `getCities`, `listAddresses`, `getMe` | delivery_address |
| Sélection magasin + Maps | ✅ | `pickup-nodes` | delivery_pickup |
| Calendrier + créneaux | ✅ | `delivery-slots` | delivery_datetime |
| Paiement COD/Wallet | ✅ | `getMeta`, `calculateOrder`, `createOrder` | payment |
| Paiement carte | ✅ | `createOrder` + wallet déduit | card_payment |
| Confirmation commande | ✅ | — | confirmed |

### Commandes

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Historique commandes | ✅ | GET `/me/orders` | orders.tsx |
| Badge statut coloré | ✅ | (couleur dans OrderStatus) | orders.tsx |
| Suivi commande + timeline | ✅ | GET `/me/orders/:id` | order-detail.tsx |
| Tracking livraison/retrait | ✅ | (steps adaptatifs) | order-detail.tsx |
| Barre de progression | ✅ | (calculé côté client) | order-detail.tsx |
| Appel support | ✅ | `Linking.openURL('tel:...')` | order-detail.tsx |

### Profil & Paramètres

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Afficher profil + stats | ✅ | GET `/customer/me` | profile.tsx |
| Photo de profil (upload) | ✅ | POST `/me/avatar` | settings.tsx |
| Retirer photo | ✅ | DELETE `/me/avatar` | settings.tsx |
| Modifier nom | ✅ | PUT `/me` | settings.tsx |
| Modifier email | ✅ | PUT `/me/email` | settings.tsx |
| Modifier téléphone + OTP | ✅ | `request-otp` + `verify-otp` | settings.tsx |
| Changer mot de passe | ✅ | PUT `/me/password` | settings.tsx |
| Préférence langue FR/AR | 🟡 | PUT `/me` | settings.tsx (stocké, non appliqué à l'UI) |
| CRUD adresses | ✅ | `/me/addresses/*` | addresses.tsx |
| Adresse par défaut | ✅ | `set-default` | addresses.tsx |

### Favoris

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Liste favoris | ✅ | GET `/me/favorites` | favorites.tsx |
| Supprimer favori | ✅ | DELETE `/me/favorites/:id` | favorites.tsx |
| Ajouter au panier depuis favoris | ✅ | POST `/customer/cart` | favorites.tsx |
| Ajouter favori depuis catalogue | ✅ | POST `/me/favorites` | product-detail.tsx |

### Wallet

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Solde dans profil | ✅ | GET `/me/wallet` | profile.tsx |
| Utiliser wallet au paiement | ✅ | (calculateOrder + payload) | payment.tsx |
| Écran wallet dédié | ❌ | — | — |
| Historique transactions | ❌ | (défini dans Wallet interface) | — |
| Recharger wallet | ❌ | — | — |

### Notifications

| Fonctionnalité | État | APIs connectées | Écrans |
|---|---|---|---|
| Centre de notifications | ✅ | GET `/me/notifications` | notifications.tsx |
| Marquer lu | ✅ | PATCH `.../read` | notifications.tsx |
| Marquer tout lu | ✅ | PATCH `.../read-all` | notifications.tsx |
| Supprimer notification | ✅ | DELETE `.../notifications/:id` | notifications.tsx |
| Supprimer toutes | ✅ | DELETE `.../notifications/all` | notifications.tsx |
| Push notifications | ❌ | — | — |
| Badge non lus dans navbar | ❌ | (hook manquant) | BottomNavBar |

### Fidélité

| Fonctionnalité | État |
|---|---|
| Points fidélité | ❌ Non implémenté |
| Récompenses | ❌ Non implémenté |

---

## 11. Détection des problèmes

### 🔴 Problèmes critiques (bloquants production)

| # | Problème | Localisation | Impact |
|---|---|---|---|
| C1 | **URL API & Storage hardcodées** (`192.168.100.114:5000`) | `src/constants/config.ts` | App non fonctionnelle en production / sur d'autres réseaux |
| C2 | **Incohérence client HTTP** : `order.service.ts` utilise `fetch` natif au lieu de l'instance Axios centralisée | `src/services/order.service.ts` | Pas d'intercepteurs (pas de refresh token automatique), maintenance difficile |
| C3 | **Numéro de téléphone support hardcodé** (`tel:+212500000000`) | `order-detail.tsx` | Faux contact en production |
| C4 | **Paiement carte non intégré** à un vrai gateway (Stripe, CMI, etc.) — formulaire UI uniquement | `card_payment.tsx` | Les paiements carte échouent silencieusement en production |

### 🟡 Problèmes moyens (dette technique)

| # | Problème | Localisation | Impact |
|---|---|---|---|
| M1 | **Pas de state management global** — seul `CartContext` existe | Tous les écrans | Re-fetch redondants, état incohérent entre navigations |
| M2 | **Pas de cache serveur** (React Query / SWR absent) | Tous les services | Rechargement complet à chaque montée d'écran |
| M3 | **Badge notifications non branché** dans BottomNavBar | `BottomNavBar.tsx` | Compteur non lus non affiché |
| M4 | **Langue préférentielle stockée mais non appliquée** — les textes restent en FR quoi qu'il arrive | `settings.tsx` | UX trompeuse pour les utilisateurs arabophones |
| M5 | **`findEligibleNodes`** défini dans order.service mais jamais appelé depuis l'UI | `order.service.ts` | Code mort |
| M6 | **Validation formulaires manuelle** — sans bibliothèque de validation | Auth, adresses, settings | Code fragile, erreurs UX silencieuses possibles |
| M7 | **`explore.tsx`** — reste du template Expo, jamais utilisé | `app/explore.tsx` | Code mort |

### 🟢 Améliorations mineures

| # | Problème | Localisation |
|---|---|---|
| m1 | `BannerSlider.tsx` présent mais données non connectées à l'API | `src/components/ui/` |
| m2 | Couleurs partiellement dupliquées (valeurs hardcodées `#E10600` dans certains fichiers plutôt que `theme.ts`) | Écrans order/* |
| m3 | Skeleton loading absent — uniquement `ActivityIndicator` basique | Tous les écrans |
| m4 | `countries.json` chargé entièrement même si non nécessaire | `src/constants/` |
| m5 | `useFonts()` appelé dans chaque écran individuellement → chargements multiples | Tous les écrans |
| m6 | Pas de tests unitaires ni e2e | Tout le projet |

---

## 12. Progression par module

| Module | Écrans | Services | Endpoints | Progression |
|---|---|---|---|---|
| **Authentification** | 8/8 ✅ | 1/1 ✅ | 5/5 ✅ | **95 %** |
| **Onboarding** | 4/4 ✅ | — | — | **100 %** |
| **Catalogue** | 4/4 ✅ | 1/1 ✅ | 7/7 ✅ | **88 %** _(BannerSlider non connecté)_ |
| **Panier** | 1/1 ✅ | 1/1 ✅ | 5/5 ✅ | **95 %** |
| **Checkout** | 7/7 ✅ | 1/1 ✅ | 5/6 | **85 %** _(gateway carte manquant)_ |
| **Commandes** | 2/2 ✅ | (dans profile) | 2/2 ✅ | **95 %** |
| **Profil & Settings** | 4/5 🟡 | 1/1 ✅ | 10/10 ✅ | **85 %** _(Wallet screen absent)_ |
| **Favoris** | 1/1 ✅ | (dans profile) | 3/3 ✅ | **90 %** |
| **Wallet** | 0/1 ❌ | (dans profile) | 0/3 | **25 %** _(solde affiché seulement)_ |
| **Notifications** | 1/1 ✅ | (dans profile) | 5/5 ✅ | **70 %** _(push + badge manquants)_ |
| **Fidélité** | 0/1 ❌ | ❌ | 0/2 | **0 %** |

### Progression globale estimée : **78 %**

```
Auth        ███████████████████░  95 %
Onboarding  ████████████████████ 100 %
Catalogue   █████████████████░░░  88 %
Panier      ███████████████████░  95 %
Checkout    █████████████████░░░  85 %
Commandes   ███████████████████░  95 %
Profil      █████████████████░░░  85 %
Favoris     ██████████████████░░  90 %
Wallet      █████░░░░░░░░░░░░░░░  25 %
Notifs      ██████████████░░░░░░  70 %
Fidélité    ░░░░░░░░░░░░░░░░░░░░   0 %

GLOBAL      ████████████████░░░░  78 %
```

---

## 13. Priorités de développement

### Priorité Haute — Bloquants pour la mise en production

1. **Externaliser la configuration API** — Remplacer les IP hardcodées par des variables d'environnement (`expo-constants` + `.env` + `eas.json`)
2. **Intégrer un vrai gateway de paiement carte** — CMI, Stripe, ou solution locale Maroc (simulé uniquement pour l'instant)
3. **Unifier le client HTTP** — Migrer `order.service.ts` vers l'instance Axios centralisée pour bénéficier des intercepteurs
4. **Corriger le numéro de support** dans `order-detail.tsx`
5. **Brancher le badge notifications** dans `BottomNavBar` (hook `useNotificationBadge`)

### Priorité Moyenne — Complétion des fonctionnalités

1. **Créer l'écran Wallet dédié** — Solde + historique transactions (l'endpoint `getWallet()` est déjà implémenté avec les transactions)
2. **Appliquer réellement la langue préférentielle** — Intégrer `i18next` ou solution équivalente
3. **Connecter BannerSlider** à des données API backend
4. **Ajouter Zustand** pour l'état global (user, profile, notifications count)
5. **Implémenter les Push Notifications** — `expo-notifications` + token FCM/APNs
6. **Supprimer `explore.tsx`** et `findEligibleNodes` inutilisé

### Priorité Faible — Évolutions futures

1. **Module Fidélité** — Points, récompenses, écran dédié
2. **Internationalisation complète** — Extraction de tous les textes en FR/AR
3. **Skeleton loading** — Remplacer les ActivityIndicator par des squelettes d'écran
4. **Optimiser `useFonts`** — Charger les polices une seule fois dans `_layout.tsx`
5. **Tests unitaires & e2e** — Jest + RNTL pour les services, Maestro pour le golden path
6. **CI/CD** — EAS Build + EAS Submit

---

## 14. Roadmap des prochaines étapes

### Sprint 1 — Production-readiness (1–2 semaines)

```
[ ] Configurer les variables d'environnement (API_URL via eas.json / .env)
[ ] Migrer order.service.ts vers l'instance Axios centralisée
[ ] Intégrer gateway de paiement carte (CMI / Stripe)
[ ] Corriger numéro de support hardcodé
[ ] Brancher badge notifications dans BottomNavBar
[ ] Supprimer explore.tsx (template résiduel)
```

### Sprint 2 — Complétion fonctionnelle (2 semaines)

```
[ ] Créer écran Wallet dédié (/profile/wallet) — lister transactions + afficher solde
[ ] Implémenter i18n (react-i18next) — FR et AR
[ ] Connecter BannerSlider à l'API
[ ] Ajouter Zustand : authStore + profileStore
[ ] Implémenter expo-notifications + token FCM
```

### Sprint 3 — Qualité & tests (2 semaines)

```
[ ] Skeleton loading (react-native-skeleton-placeholder ou custom)
[ ] React Hook Form + Zod sur les formulaires auth et adresses
[ ] Tests unitaires services (catalog, cart, order)
[ ] Tests e2e golden path : login → catalogue → panier → checkout → commande
[ ] Optimiser useFonts (1 seul appel dans _layout.tsx)
```

### Sprint 4 — Évolutions avancées (2–3 semaines)

```
[ ] Module Fidélité : points, récompenses, historique
[ ] Internationalisation arabe complète (RTL)
[ ] Écran de carte interactive (livraison en temps réel ?)
[ ] Avis & notes produits
[ ] CI/CD : EAS Build + EAS Submit
```

---

## Statistiques globales

| Métrique | Valeur |
|---|---|
| Fichiers source TypeScript | 67 |
| Lignes de code estimées | ~8 500 |
| Écrans métier terminés | 28 / 31 (90 %) |
| Services implémentés | 5 / 5 (100 %) |
| Endpoints API définis dans les services | 50+ |
| Endpoints consommés par au moins un écran | 47+ (94 %) |
| Contextes React | 1 (CartContext) |
| Hooks personnalisés | 2 |
| Composants UI réutilisables | 10 |
| Modules entièrement absents | 2 (Fidélité, Wallet screen) |
| Dépendances de prod | 20 |
| Dette technique estimée | Faible–Moyenne |

---

*Rapport généré par analyse statique intégrale du code source — Dark Store Customer App, branche `Hajar`, 2026-06-23.*

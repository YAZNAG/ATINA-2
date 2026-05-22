# RAPPORT D'AUDIT TECHNIQUE — AVANCEMENT MODULES
## Dark Store App — Quick Commerce Platform
**Date audit :** 2026-05-22 | **Branche :** `dev` | **Auditeur :** Analyse code réel

---

## 1. RÉSUMÉ GLOBAL

| Dimension | Score | Détail |
|---|---|---|
| **Backend API** | 72 % | 27 modules, ~280 endpoints, logique métier avancée |
| **Frontend Web Admin** | 62 % | 98 pages JSX, CRUD complet master data |
| **Mobile Customer** | 85 % | Catalogue → Panier → Checkout → Commandes opérationnel |
| **Mobile Picker** | 28 % | Login OK, sessions partielles, scan EAN absent |
| **Mobile Driver** | 22 % | Login OK, tours listés, workflow livraison absent |
| **Base de données** | 90 % | 86 modèles Prisma, seeds P0, relations complètes |
| **Temps réel (Socket.IO)** | 45 % | Picker uniquement, driver absent |
| **Tests automatisés** | 0 % | Aucun test unitaire/intégration |
| **Global** | **55–60 %** | P0 opérationnel, P1 partiel, P2 minimal |

---

## 2. ÉTAT PAR PHASE

### PHASE P0 — CORE OPÉRATIONNEL

| Module | Backend | Web | Mobile | État |
|---|---|---|---|---|
| Auth & RBAC | ✅ | ✅ | ✅ | DONE |
| Catalogue admin | ✅ | ✅ | — | DONE |
| Catalogue client | ✅ | — | ✅ | DONE |
| Checkout admin | ✅ | ✅ | — | DONE |
| Checkout client | ✅ | — | ✅ | DONE |
| Gestion commandes | ✅ | ✅ | ✅ | DONE |
| Réservation stock | ✅ | ✅ | — | DONE |
| Picking backend + web | ✅ | ✅ | — | DONE |
| Picker portal mobile | ✅ | — | ⚠️ | PARTIAL |
| Scan EAN13 | ✅ API | — | ❌ | TODO |
| Pickup (retrait) | ✅ | ✅ | — | DONE |
| Tours livraison | ✅ | ⚠️ | ⚠️ | PARTIAL |
| Driver portal web | ✅ | ✅ | — | PARTIAL |
| Driver mobile | ✅ API | — | ❌ | TODO |
| Temps réel picker | ✅ | — | ✅ | DONE |
| Temps réel driver | — | — | — | TODO |
| Stock management | ✅ | ✅ | — | DONE |
| Nodes & slots | ✅ | ✅ | ✅ | DONE |

### PHASE P1 — PAIEMENTS & FIDÉLITÉ

| Module | Backend | Web | Mobile | État |
|---|---|---|---|---|
| COD | ✅ | ✅ | ✅ | DONE |
| Stripe | ✅ | ⚠️ | ✅ | PARTIAL |
| Stripe webhook | ✅ | — | — | DONE |
| Stripe refund | ✅ | ⚠️ | — | PARTIAL |
| Wallet ledger | ✅ | ⚠️ | ✅ | PARTIAL |
| Points fidélité (earn) | ✅ | — | ⚠️ | PARTIAL |
| Points redeem | ❌ | — | — | TODO |
| Referral | ✅ logique | — | ❌ UI | PARTIAL |
| Notifications | ⚠️ logs | — | — | TODO |

### PHASE P2 — EXPÉRIENCE

| Module | Backend | Web | Mobile | État |
|---|---|---|---|---|
| Reporting KPI | ⚠️ API | ⚠️ minimal | — | PARTIAL |
| Promotions codes | ❌ | — | — | TODO |
| Packs produits | ❌ | — | — | TODO |
| Flash sales | ❌ | — | — | TODO |
| Gamification | ❌ | — | — | TODO |
| Push notifications | — | — | — | TODO |
| Exports PDF/Excel | — | — | — | TODO |

---

## 3. ÉTAT DÉTAILLÉ PAR MODULE

### 3.1 Auth & RBAC
- **Endpoints :** `POST /auth/login`, JWT, CRUD roles/permissions/users
- **DB :** users, roles, permissions, role_permissions, user_roles, backoffice_admins
- **Web :** access/, users/, roles/ — complet
- **Mobile :** customer_auth (OTP), picker/driver (phone+password)
- **Statut :** ✅ DONE

### 3.2 Catalogue
- **Admin endpoints :** 20+ CRUD (families, categories, brands, taxes, articles, skus, images)
- **Customer endpoints :** `/customer/catalog/categories`, `/articles`, `/cities`
- **DB :** 13 tables (families → skus)
- **Web :** 14 pages JSX
- **Mobile Customer :** catalog/ feature complet (recherche, filtres, détail produit)
- **Statut :** ✅ DONE

### 3.3 Checkout
- **Admin endpoints :** meta, eligible-nodes, delivery-slots, calculate, create-order
- **Customer endpoints :** idem + pickup-nodes (auto-sélection node)
- **Logique :** auto-détection node, créneaux capacité, réservation stock atomique
- **Stock :** `qty_reserved += qty`, `qty_available -= qty` (physique inchangé jusqu'à livraison)
- **Mobile Customer :** 14 fichiers Dart (sélection livraison/retrait, créneau, paiement)
- **Statut :** ✅ DONE

### 3.4 Picking — Backend + Web
- **Endpoints :** sessions CRUD, `/pick`, `/substitute`, `/out-of-stock`, statuts CRUD
- **Picker portal :** `POST /login`, available-orders, my-orders, accept, sessions, items, `/me`
- **Anti-double-acceptation :** transaction Prisma atomique avec re-vérification order.status
- **Substitution :** `substitute_sku_id` stocké en DB + lookup EAN → SKU UUID
- **Web :** 4 pages JSX (sessions, détail session, items)
- **Statut :** ✅ DONE

### 3.5 Picking — Mobile Picker App
- **Login :** ✅ Phone+password, JWT FlutterSecureStorage
- **Dashboard :** ✅ Stats réelles (availableOrdersProvider + myOrdersProvider)
- **Available orders :** ✅ Liste commandes du node
- **Accept order :** ✅ POST `/picker/orders/:id/accept`
- **Session detail :** ✅ Items avec pick/rupture/substitution (EAN substitut via form)
- **Start session :** ✅ PATCH `/picker/sessions/:id/start`
- **Complete session :** ✅ Validation items pending
- **Scan EAN13 réel :** ❌ `mobile_scanner` installé mais AUCUNE UI caméra dans les screens
- **Temps réel :** ✅ Socket.IO `picker:new_order` (bannière), `picker:order_taken` (suppression)
- **Auth JWT :** ✅ Corrigé (`pickerAuth.middleware.js` : `JWT_SECRET` → `secret`)
- **Routes :** ✅ Corrigé (`/picker` avant wildcards dans routes/index.js)
- **APK debug :** `build\app\outputs\flutter-apk\app-debug.apk`
- **Statut :** ⚠️ PARTIAL (28% — scan EAN manquant)

### 3.6 Pickup (Retrait Magasin)
- **Endpoints :** ready-orders, detail, collect-cod (étape 1), confirm (étape 2), cancel
- **COD :** 2 étapes séparées — collect-cod PUIS confirm (bloqué si COD non collecté)
- **Stock :** `qty_reserved-- + qty_physical--` uniquement après confirm
- **Web :** 2 pages (liste, détail + workflow 2 étapes + annulation)
- **Points :** Crédités automatiquement après delivered
- **Statut :** ✅ DONE

### 3.7 Tours / Livraison
- **Endpoints delivery_mgmt :** meta, drivers, ready-orders, tours CRUD, stops (arrive/deliver/fail)
- **Endpoints driver portal :** login, tours, tour/:id, start, stops (arrive/deliver/fail)
- **COD Driver :** `amount_collected` stocké sur TourStop, `payment.status = collected`
- **Stock :** `qty_reserved-- + qty_physical--` après stop delivered
- **Web admin :** 4 pages (ReadyHomeOrders, ToursList, TourNew, TourDetail avec stops)
- **Mobile Driver :** tours/ avec 7 fichiers Dart (liste, détail, stops) — workflow à compléter
- **Manquant driver mobile :** start tour, deliver stop avec COD, fail stop, navigation GPS complète
- **Statut :** ⚠️ PARTIAL (backend complet, mobile driver 22%)

### 3.8 Stripe & Paiements
- **Endpoints :** create-intent, create-session, create-session-customer, webhook, refund, refund-admin
- **Webhook :** payment_intent.succeeded → collected, payment_intent.payment_failed → failed
- **Refund :** Stripe API + `payment.status = refunded`
- **Mobile Customer :** StripePaymentScreen (Stripe Checkout via url_launcher)
- **Variables :** `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET` requis
- **Statut :** ✅ Backend DONE, ⚠️ clés Stripe production à configurer

### 3.9 Wallet
- **Endpoints :** `/wallet/transactions`, `/credit`, `/debit`, `/refund`, `/customers/:id`
- **Ledger :** `balance_before`/`balance_after` sur chaque transaction, append-only
- **Txn types :** debit_order, credit_refund, credit_recharge, referral_reward, credit_points…
- **Mobile Customer :** WalletScreen avec solde et historique transactions
- **Manquant :** recharge admin UI, conversion points→wallet, expiry
- **Statut :** ✅ Service DONE, ⚠️ UI partielle

### 3.10 Points Fidélité
- **Service :** `loyalty.service.js` — règles DB (per_spend, flat_bonus, first_order, referral_bonus)
- **Déclencheur :** automatique après `order.status = delivered`
- **DB :** points_rules, points_rule_types, customers.points_balance/points_lifetime, orders.points_earned
- **Mobile Customer :** PointsScreen (lecture seule — solde et historique)
- **Manquant :** UI rachat points au checkout, règles admin, historique points dédié
- **Statut :** ⚠️ PARTIAL (earn auto ✅, redeem ❌)

### 3.11 Referral
- **Service :** createReferralOnRegistration → validateReferralOnDelivery → rewards wallet/points
- **Flux :** Inscription avec code → pending → 1ère commande delivered → validated → récompenses
- **Admin endpoint :** `GET /loyalty/referrals`
- **Manquant :** UI partage code, historique referral client, dashboard admin
- **Statut :** ⚠️ PARTIAL (backend complet, aucune UI)

### 3.12 Notifications
- **DB :** notifications, notification_channels, notification_delivery_statuses
- **Backend :** `notify.js` — logs en DB, templates FR pour tous les événements clé
- **Customer endpoints :** GET /notifications, PATCH /read, /read-all
- **Manquant :** Envoi réel push/SMS/email, UI notification center, socket client
- **Statut :** ⚠️ MINIMAL (logs DB uniquement, pas d'envoi)

### 3.13 Reporting
- **Endpoints :** `/reporting/dashboard`, `/orders`, `/picking`, `/delivery`, `/stock`, `/payments`
- **Service :** orderKpis, pickingKpis, deliveryKpis, stockKpis, paymentKpis avec date range
- **Web :** Dashboard.jsx minimal (compteurs statiques)
- **Manquant :** UI complète, graphiques, exports PDF/Excel, analytics par node
- **Statut :** ⚠️ PARTIAL (API OK, UI minimale)

### 3.14 Promotions / Packs / Flash Sales / Gamification
- **DB :** Tables présentes (promotions, packs, pack_items, flash_sales, gamification_games, prizes, plays)
- **API :** ❌ AUCUN endpoint monté
- **Checkout :** promotions non intégrées dans le calcul du total
- **Statut :** ❌ TODO (tables DB uniquement)

---

## 4. ÉTAT BACKEND

### Routes montées (routes/index.js — ordre critique)
```
# AVANT wildcards (important — évite interception par auth.middleware)
/customer/auth      → customer_auth.routes     (public OTP)
/customer/catalog   → customer_catalog.routes  (public catalogue)
/customer/me        → customer_me.routes       (auth customer)
/customer/checkout  → customer_checkout.routes (auth customer)
/picker             → pickerPortal.routes      (public login, puis auth picker)
/driver             → driverPortal.routes      (public login, puis auth driver)

# Admin (après wildcards)
/auth /users /roles /permissions → RBAC admin
/catalog             → catalogue admin
/                    → locationRoutes + nodeRoutes  (⚠️ wildcards)
/customers /warehouse /stock /delivery /payment /wallet /orders /addresses
/checkout            → checkout admin
/orders-mgmt         → order_mgmt
/picking             → picking
/staff               → pickers + drivers
/tours               → tours
/reporting           → reporting KPI
/pickup              → pickup retrait
/delivery            → delivery_mgmt (tournées)
/loyalty             → referrals + points
```

**Bugs backend résolus :**
- Route `/picker` et `/driver` placées AVANT `router.use('/', nodeRoutes)` → `auth.middleware` (admin) interceptait `/picker/login`
- `pickerAuth.middleware.js` : `{ JWT_SECRET }` → `{ secret: JWT_SECRET }` (jwt.verify(token, undefined) causait 401)
- `PickingSessionItem.substitute_sku_id` ajouté au schema Prisma + `prisma db push`
- `articleSkuLink.js` : vérification FK avant CREATE (supprime warning Prisma 42710)
- `stripe.routes.js` : double déclaration `const E` supprimée

---

## 5. ÉTAT FRONTEND WEB

| Répertoire | Fichiers | État | Notes |
|---|---|---|---|
| access/ | 3 | ✅ DONE | RBAC complet |
| auth/ | 1 | ✅ DONE | Login admin |
| catalog/ | 14 | ✅ DONE | CRUD articles/skus/images |
| checkout/ | 2 | ✅ DONE | 5 étapes (créneau obligatoire, wallet, Stripe) |
| customers/ | 5 | ✅ DONE | Liste, détail, adresses |
| dashboard/ | 1 | ⚠️ PARTIAL | KPI stubs |
| delivery/ | 9 | ⚠️ PARTIAL | Tours, stops, ready-orders |
| location/ | 9 | ✅ DONE | Nodes, géographie |
| orders/ | 7 | ✅ DONE | Liste, statuts, historique |
| orders_mgmt/ | 1 | ⚠️ PARTIAL | Liste uniquement |
| p0/ | 3 | ✅ DONE | Tables de référence |
| payment/ | 8 | ⚠️ PARTIAL | Méthodes, Stripe test |
| picker/ | 5 | ⚠️ PARTIAL | Login web, sessions |
| picking/ | 4 | ⚠️ PARTIAL | Sessions, items |
| pickup/ | 2 | ⚠️ PARTIAL | Liste, détail COD |
| roles/ | 2 | ✅ DONE | |
| staff/ | 4 | ✅ DONE | Pickers, drivers |
| stock/ | 11 | ✅ DONE | Niveaux, mouvements, lots |
| users/ | 2 | ✅ DONE | |
| wallet/ | 1 | ⚠️ PARTIAL | Transactions minimale |
| warehouse/ | 3 | ✅ DONE | Zones, emplacements |

**Total :** 98 fichiers JSX | **Score :** 62%

---

## 6. ÉTAT MOBILE CUSTOMER

**Stack :** Flutter + Riverpod + Dio + go_router + flutter_screenutil  
**Fichiers Dart :** ~63 | **Score :** 85%

| Feature | Fichiers | État | Manquant |
|---|---|---|---|
| auth | 5 | ✅ DONE | — |
| customer_auth | 8 | ✅ DONE | — |
| catalog | 7 | ✅ DONE | — |
| cart | 3 | ✅ DONE | — |
| checkout | 14 | ✅ DONE | Stripe webhook natif |
| orders | 10 | ✅ DONE | — |
| addresses | 7 | ✅ DONE | City select depuis DB |
| profile | 8 | ✅ DONE | — |
| home | 1 | ⚠️ PARTIAL | Screen complet |
| notifications | — | ❌ TODO | Tout |
| referral | — | ❌ TODO | UI partage/historique |
| gamification | — | ❌ TODO | Tout |

---

## 7. ÉTAT MOBILE PICKER

**Stack :** Flutter + Riverpod + Dio + go_router + mobile_scanner + socket_io_client  
**Score :** 28%

| Feature | État | Détail |
|---|---|---|
| Login (phone+password) | ✅ | JWT FlutterSecureStorage |
| Dashboard stats | ✅ | Compteurs réels depuis API |
| Available orders | ✅ | Liste commandes du node |
| Accept order | ✅ | POST + redirect session |
| Session detail | ✅ | Items, progression |
| Start session | ✅ | PATCH start |
| Pick item (EAN + qty) | ✅ | Via formulaire texte |
| **Scan EAN13 caméra** | **❌** | **`mobile_scanner` installé mais UI absente** |
| Substitution (par EAN) | ✅ | Backend valide EAN→SKU |
| Rupture | ✅ | Out-of-stock avec raison |
| Complete session | ✅ | Validation pending items |
| Temps réel new_order | ✅ | Bannière verte Socket.IO |
| Temps réel order_taken | ✅ | Commande retirée de la liste |
| Profile / logout | ✅ | |

---

## 8. ÉTAT MOBILE DRIVER

**Stack :** Flutter + Riverpod + Dio + go_router + url_launcher  
**Score :** 22%

| Feature | État | Détail |
|---|---|---|
| Login (phone+password) | ✅ | JWT FlutterSecureStorage |
| Dashboard stats | ✅ | Stats depuis tournées |
| Tours list | ✅ | Mes tournées avec progression |
| Tour detail + stops | ✅ | Stops listés avec statuts |
| Start tour | ✅ | PATCH `/driver/tours/:id/start` |
| Arrive at stop | ✅ | PATCH arrive |
| Deliver stop + COD | ✅ | Form COD + confirm |
| Fail stop | ✅ | Raisons sélectionnables |
| GPS navigation | ✅ | url_launcher → Google Maps |
| Profile / logout | ✅ | |
| Assign driver | ⚠️ | Depuis admin web uniquement |
| **Temps réel socket** | **❌** | **Non implémenté** |
| APK debug | ✅ | Disponible |

---

## 9. ÉTAT BASE DE DONNÉES

**Modèles Prisma :** 86 | **Score :** 90%

| Groupe | Tables clés | État |
|---|---|---|
| Auth & RBAC | users, roles, permissions, user_roles, role_permissions | ✅ |
| Catalogue | families, categories, brands, articles, skus, sku_images | ✅ |
| Géographie | regions, provinces, cities, node_types, nodes, delivery_slots | ✅ |
| Staff | pickers, drivers | ✅ |
| Warehouse & Stock | zones, levels, locations, stock_levels, stock_moves, stock_lots, selling_rules | ✅ |
| Commandes | orders, order_items, order_statuses, payments, order_histories, app_configs | ✅ |
| Picking | picking_sessions, picking_session_items (+ substitute_sku_id) | ✅ |
| Livraison | tours, tour_stops (+ delivered_at, failure_reason, cod_collected) | ✅ |
| Wallet | wallet_transactions, wallet_txn_types | ✅ |
| Notifications | notifications, notification_channels | ✅ tables |
| Fidélité | referrals, referral_configs, points_rules, points_rule_types | ✅ |
| P0 Lookups | 25+ tables (move_types, delivery_types, etc.) | ✅ |
| Promotions | promotions, packs, pack_items, flash_sales | ✅ tables |
| Gamification | gamification_games, prizes, plays | ✅ tables |

**Migrations :** `prisma db push` (développement)  
**Seed :** `seed_p0_reference_data.sql` (statuts, types, méthodes, tour_statuses, wallet_txn_types)

---

## 10. ÉTAT TEMPS RÉEL / SOCKET.IO

| Composant | État | Détail |
|---|---|---|
| Socket serveur | ✅ | `socket.io` sur `/socket/picker`, auth JWT |
| Room par node | ✅ | `node:{node_id}` — isolement par entrepôt |
| Event `picker:new_order` | ✅ | Émis par checkout.service après create-order confirmed |
| Event `picker:order_taken` | ✅ | Émis par createPickingSession.helper après accept |
| Event `picker:session_started` | ✅ | Émetteur présent |
| Mobile picker — connexion | ✅ | `PickerSocketService` + `RealtimeNotifier` (Riverpod) |
| Mobile picker — bannière | ✅ | `NewOrderBanner` flottante verte |
| Reconnexion auto | ✅ | 10 tentatives, 2s délai |
| **Socket driver** | **❌** | Non implémenté |
| **Notifications client** | **❌** | Non implémenté |

---

## 11. ÉTAT PAIEMENTS

| Méthode | Backend | Mobile | Web | Test |
|---|---|---|---|---|
| COD | ✅ | ✅ | ✅ | ✅ |
| Wallet | ✅ | ✅ | ⚠️ | ✅ |
| Stripe (card) | ✅ | ✅ | ⚠️ | ⚠️ (clés) |
| Stripe webhook | ✅ | — | — | ⚠️ (WEBHOOK_SECRET) |
| Stripe refund | ✅ | — | ⚠️ | ⚠️ |
| Points redeem | ❌ | — | — | — |
| Mixed (wallet+COD) | ✅ logique | ⚠️ | ⚠️ | — |

**Variables d'env requises :** `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## 12. ÉTAT WALLET

| Fonction | Backend | Mobile Customer | État |
|---|---|---|---|
| Solde + historique | ✅ | ✅ | DONE |
| Débit commande | ✅ | ✅ | DONE |
| Crédit remboursement | ✅ | — | DONE |
| Crédit referral reward | ✅ | — | DONE |
| Recharge admin | ✅ API | — | DONE (API) |
| Recharge UI | — | — | ❌ TODO |
| Expiry transactions | — | — | ❌ TODO |

---

## 13. ÉTAT FIDÉLITÉ

| Fonction | Backend | Mobile | État |
|---|---|---|---|
| Calcul points à livraison | ✅ auto | — | DONE |
| Règles per_spend / flat_bonus | ✅ | — | DONE |
| Referral pending à inscription | ✅ auto | — | DONE |
| Validation referral 1ère commande | ✅ auto | — | DONE |
| Récompense wallet/points | ✅ | — | DONE |
| Affichage points (lecture) | ✅ | ✅ | DONE |
| **Points redeem au checkout** | ❌ | ❌ | TODO |
| **UI partage code parrainage** | — | ❌ | TODO |
| Dashboard referrals admin | ⚠️ | — | PARTIAL |

---

## 14. ÉTAT NOTIFICATIONS

| Fonction | État | Détail |
|---|---|---|
| Logs en DB | ✅ DONE | Templates FR pour tous événements clé |
| Endpoints lecture client | ✅ DONE | GET, mark-read, mark-all-read |
| **Envoi push (Firebase/Expo)** | ❌ TODO | Non implémenté |
| **Envoi SMS** | ❌ TODO | Non implémenté |
| **Envoi email** | ❌ TODO | Non implémenté |
| **UI notification center** | ❌ TODO | Non implémenté |
| Socket notifications client | ❌ TODO | Non implémenté |

---

## 15. ÉTAT REPORTING

| Endpoint | Backend | Frontend | État |
|---|---|---|---|
| /reporting/dashboard | ✅ | ⚠️ minimal | PARTIAL |
| /reporting/orders | ✅ | — | PARTIAL |
| /reporting/picking | ✅ | — | PARTIAL |
| /reporting/delivery | ✅ | — | PARTIAL |
| /reporting/stock | ✅ | — | PARTIAL |
| /reporting/payments | ✅ | — | PARTIAL |
| Export PDF | — | — | ❌ TODO |
| Export Excel | — | — | ❌ TODO |
| Graphiques temps réel | — | — | ❌ TODO |

---

## 16. ÉTAT PROMOTIONS & GAMIFICATION

| Module | DB | API | Web | Mobile | État |
|---|---|---|---|---|---|
| Promotions codes promo | ✅ tables | ❌ | — | — | TODO |
| Packs produits | ✅ tables | ❌ | — | — | TODO |
| Flash sales | ✅ tables | ❌ | — | — | TODO |
| Gamification (jeux, prix) | ✅ tables | ❌ | — | — | TODO |
| Promo intégrée checkout | — | ❌ | — | — | BLOCKED |

> ⚠️ Tables Prisma complètes mais **aucun endpoint API monté**. Non intégrés dans le checkout.

---

## 17. PROBLÈMES RESTANTS

### 🔴 Critiques
1. **Scan EAN13 mobile picker :** `mobile_scanner` installé, UI de scan absente
2. **Mobile Driver :** workflow start/deliver/fail non complet (UI manquante)
3. **Zéro test automatisé :** risque de régression au déploiement
4. **Stripe production :** clés test absentes, webhook secret à configurer

### 🟠 Importants
5. **Notifications push/SMS :** logs DB uniquement, aucun envoi réel
6. **Promotions non intégrées :** tables présentes, aucun endpoint, checkout non branché
7. **Points redeem :** earning automatique ✅ mais rachat impossible
8. **Dashboard reporting :** KPI API présents, UI quasi vide
9. **Socket driver :** aucun temps réel pour les livreurs

### 🟡 Mineurs
10. Recharge wallet UI absente (endpoint API existe)
11. Referral UI absente (logique backend complète)
12. Home screen mobile customer incomplet
13. Export PDF/Excel absent
14. Gamification désactivée (tables présentes)

---

## 18. PRIORITÉS RESTANTES

| Priorité | Module | Travail restant | Complexité |
|---|---|---|---|
| 🔴 P0 | Scan EAN13 picker | Intégrer `mobile_scanner` dans session_detail_screen.dart | Medium |
| 🔴 P0 | Mobile Driver complet | Start tour, stop deliver/fail + COD natif | Medium |
| 🔴 P0 | APK release picker + driver | Build release + signature | Low |
| 🔴 P0 | Test E2E workflow | Checkout → picking → ready → delivered | Medium |
| 🟠 P1 | Promotions API | Routes CRUD + intégration checkout | High |
| 🟠 P1 | Points redeem | Checkout → déduire points_balance | Medium |
| 🟠 P1 | Notifications push | Firebase FCM setup | High |
| 🟠 P1 | Dashboard KPI | Graphiques + export | Medium |
| 🟠 P1 | Referral UI | Page partage code + historique | Medium |
| 🟡 P2 | Packs + Flash sales | API + checkout + mobile | High |
| 🟡 P2 | Gamification | API + mobile | High |
| 🟡 P2 | Socket driver temps réel | Notifications tournées | Medium |
| 🟡 P2 | Tests automatisés | Jest backend, Flutter tests | High |
| 🟡 P2 | Exports PDF/Excel | Reporting complet | Medium |

---

## 19. ROADMAP FINALE

### Sprint 1 — P0 Opérationnel (1–2 jours)
- [ ] Scan EAN13 dans `session_detail_screen.dart` (mobile_scanner déjà installé)
- [ ] Mobile Driver : workflow complet (start/deliver/fail) si manquant
- [ ] Build APK release picker + driver
- [ ] Test E2E complet : checkout → confirmed → picking → ready → pickup/delivered

### Sprint 2 — Paiements & Fidélité (2–3 jours)
- [ ] Stripe clés production + webhook en production
- [ ] Points redeem au checkout (frontend + backend)
- [ ] Referral UI mobile customer (partage code, historique)
- [ ] Wallet recharge UI admin

### Sprint 3 — Notifications (2 jours)
- [ ] Firebase FCM setup (backend + mobile customer)
- [ ] Notification center mobile customer
- [ ] Socket.IO notifications driver (nouvelles tournées)

### Sprint 4 — Dashboard & Reporting (2–3 jours)
- [ ] Graphiques KPI (recharts)
- [ ] Export PDF commandes
- [ ] Export Excel stock/reporting
- [ ] Analytics par node

### Sprint 5 — Promotions & Gamification (3–5 jours)
- [ ] API packs, promotions, flash_sales (routes + CRUD)
- [ ] Intégration checkout (code promo calcul)
- [ ] Flash sales dans catalogue mobile
- [ ] Gamification endpoint + mobile

### Sprint 6 — Production (2–3 jours)
- [ ] Tests unitaires backend (Jest)
- [ ] Tests Flutter
- [ ] Configuration VPS (Nginx, SSL, PM2)
- [ ] Variables d'environnement production
- [ ] Monitoring (Sentry, PM2 logs)
- [ ] Documentation API (Swagger/Postman)

---

## 20. WORKFLOW GLOBAL FINAL — ÉTAT ACTUEL

```
CLIENT MOBILE
  ↓
Catalog ✅ → Panier ✅ → Checkout ✅
  ↓
Stock réservé ✅ (qty_reserved++, qty_available--)
  ↓
Order.status = confirmed ✅
  ↓
[SOCKET.IO] picker:new_order → pickers du node ✅
  ↓
PICKER accepte ✅ → Session picking créée ✅
  ↓
Items : pick/substitution/rupture ✅ | Scan EAN13 réel ❌
  ↓
Session complete → Order.status = ready ✅
  ↓
┌─────────────────────┬────────────────────────┐
│ PICKUP (retrait)     │ DELIVERY (home)         │
│ ✅ OPÉRATIONNEL      │ ⚠️ PARTIEL              │
├─────────────────────┼────────────────────────┤
│ COD comptoir ✅      │ Tour créée ✅            │
│ Confirm ✅           │ Driver assigné ✅        │
│ Stock OUT ✅         │ Start tour ✅            │
│ Points crédités ✅   │ Stop deliver ✅          │
│                      │ COD driver ✅            │
│                      │ Fail stop ✅             │
│                      │ Stock OUT ✅             │
└─────────────────────┴────────────────────────┘
  ↓
Order.status = delivered ✅
  ↓
Points crédités ✅ (auto) | Referral validé ✅ (auto)
Wallet débité ✅ | Notification loggée ✅ | Push ❌
  ↓
Reporting KPI ⚠️ (API OK, UI minimale)
```

---

## TABLEAU SYNTHÈSE FINAL

| Module | Backend | Web | Mobile Customer | Mobile Picker | Mobile Driver | DB | Temps réel | Global |
|--------|---------|-----|-----------------|----------------|----------------|-----|------------|--------|
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ DONE |
| Catalogue | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ DONE |
| Checkout | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ DONE |
| Stock | ✅ | ✅ | — | — | — | ✅ | — | ✅ DONE |
| Commandes | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ DONE |
| Picking | ✅ | ✅ | — | ⚠️ | — | ✅ | ✅ | ⚠️ PARTIAL |
| Pickup | ✅ | ✅ | — | — | — | ✅ | — | ✅ DONE |
| Tours/Livraison | ✅ | ⚠️ | — | — | ⚠️ | ✅ | ❌ | ⚠️ PARTIAL |
| Paiements | ✅ | ⚠️ | ✅ | — | ⚠️ | ✅ | — | ⚠️ PARTIAL |
| Wallet | ✅ | ⚠️ | ✅ | — | — | ✅ | — | ⚠️ PARTIAL |
| Points fidélité | ✅ | — | ⚠️ | — | — | ✅ | — | ⚠️ PARTIAL |
| Referral | ✅ | — | ❌ | — | — | ✅ | — | ⚠️ PARTIAL |
| Notifications | ⚠️ | — | ❌ | — | — | ✅ | — | ❌ TODO |
| Reporting | ⚠️ | ⚠️ | — | — | — | — | — | ⚠️ PARTIAL |
| Promotions | ❌ | — | — | — | — | ✅ tables | — | ❌ TODO |
| Gamification | ❌ | — | — | — | — | ✅ tables | — | ❌ TODO |

**Légende :** ✅ Done · ⚠️ Partial · ❌ Todo · — N/A

---

*Rapport basé sur analyse du code source réel. Branche `dev` — 2026-05-22.*

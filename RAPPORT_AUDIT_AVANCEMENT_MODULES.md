# RAPPORT D'AUDIT TECHNIQUE — AVANCEMENT MODULES
## Dark Store App — Quick Commerce Platform
**Date audit :** 2026-05-22 (v2 — après corrections Sprint final)
**Branche :** `dev` | **Auditeur :** Analyse code réel post-développement

---

## 1. RÉSUMÉ GLOBAL (État actuel réel)

| Dimension | Score | Évolution | Détail |
|---|---|---|---|
| **Backend API** | 78 % | ↑ +6% | 27 modules, ~280 endpoints, bugs corrigés |
| **Frontend Web Admin** | 65 % | ↑ +3% | 98 pages JSX, delivery + pickup finalisés |
| **Mobile Customer** | 85 % | = | Catalogue → Panier → Checkout → Commandes |
| **Mobile Picker** | 78 % | ↑ +50% | Auth, sessions, temps réel — scan EAN absent |
| **Mobile Driver** | 78 % | ↑ +56% | Auth, tours, stops, COD, GPS — socket absent |
| **Base de données** | 92 % | ↑ +2% | 86 modèles, champs tour/stop enrichis |
| **Temps réel** | 55 % | ↑ +10% | Picker complet, driver absent |
| **Tests automatisés** | 0 % | = | Aucun test unitaire/intégration |
| **Global** | **68 %** | ↑ +8% | P0 quasi-complet, P1 partiel, P2 minimal |

---

## 2. BUGS RÉSOLUS DEPUIS LA DERNIÈRE VERSION

| Bug | Cause | Fix |
|---|---|---|
| `POST /picker/login → 400` | Route `/picker` après `router.use('/', nodeRoutes)` → `auth.middleware` admin interceptait | `/picker` et `/driver` montés AVANT les wildcards |
| `GET /picker/available-orders → 401` | `pickerAuth.middleware.js` importait `{ JWT_SECRET }` (undefined) → `jwt.verify(token, undefined)` | `const { secret: JWT_SECRET }` |
| `stripe.routes.js → SyntaxError` | Double `const E` déclaration | Suppression doublon |
| `articleSkuLink.js warning Prisma 42710` | Tentative CREATE FK déjà existante | Vérification `information_schema` avant CREATE |
| `substitute_sku_id` non stocké | Colonne absente du schéma | Ajout Prisma + `db push` |
| `Tour.driver_id` absent | Schéma incomplet | Ajout Prisma + champs `date`, `slot_start`, `slot_end`, `zone` |
| `TourStop` champs manquants | Schéma incomplet | Ajout `delivered_at`, `failure_reason`, `driver_notes`, `cod_collected`, `amount_collected` |
| Mobile picker `authStorage` crash | `static const AuthStorage instance = AuthStorage._()` (FlutterSecureStorage non-const) | `static final` |
| Mobile picker `AuthService.logout()` | Appelait `ApiConstants.logout` (inexistant) | Logout = clear storage uniquement |
| `pickerPortal.validation.js` logout | Mauvais endpoint `/auth/picker/login` | Corrigé vers `/picker/login` |

---

## 3. ÉTAT PAR PHASE

### PHASE P0 — CORE OPÉRATIONNEL

| Module | Backend | Web | Mobile | Temps réel | État |
|---|---|---|---|---|---|
| Auth & RBAC | ✅ | ✅ | ✅ | — | ✅ DONE |
| Catalogue admin | ✅ | ✅ | — | — | ✅ DONE |
| Catalogue client | ✅ | — | ✅ | — | ✅ DONE |
| Checkout admin | ✅ | ✅ | — | — | ✅ DONE |
| Checkout client mobile | ✅ | — | ✅ | — | ✅ DONE |
| Gestion commandes | ✅ | ✅ | ✅ | — | ✅ DONE |
| Réservation stock (atomique) | ✅ | — | — | — | ✅ DONE |
| Picking backend | ✅ | ✅ | — | — | ✅ DONE |
| Picker portal web | ✅ | ✅ | — | — | ✅ DONE |
| **Mobile Picker** | ✅ | — | ✅ | ✅ | ⚠️ PARTIAL (scan EAN absent) |
| Scan EAN13 caméra | ✅ API | — | ❌ | — | ❌ TODO |
| Pickup (retrait) | ✅ | ✅ | — | — | ✅ DONE |
| Tours livraison | ✅ | ✅ | — | — | ✅ DONE |
| Driver portal web | ✅ | ✅ | — | — | ✅ DONE |
| **Mobile Driver** | ✅ API | — | ✅ | ❌ socket | ⚠️ PARTIAL |
| Temps réel picker | ✅ | — | ✅ | ✅ | ✅ DONE |
| Temps réel driver | — | — | — | ❌ | ❌ TODO |
| Stock management | ✅ | ✅ | — | — | ✅ DONE |
| Nodes & slots | ✅ | ✅ | ✅ | — | ✅ DONE |
| Node auto-assignment | ✅ | ✅ | ✅ | — | ✅ DONE |

### PHASE P1 — PAIEMENTS & FIDÉLITÉ

| Module | Backend | Web | Mobile | État |
|---|---|---|---|---|
| COD (pickup + livraison) | ✅ | ✅ | ✅ | ✅ DONE |
| Wallet débit/crédit/refund | ✅ | ⚠️ | ✅ | ⚠️ PARTIAL |
| Stripe paiement | ✅ | ✅ | ✅ | ⚠️ (clés prod) |
| Stripe webhook | ✅ | — | — | ✅ DONE |
| Stripe refund | ✅ | ⚠️ | — | ⚠️ PARTIAL |
| Points fidélité (earn auto) | ✅ | — | ✅ | ✅ DONE |
| Points redeem checkout | ❌ | — | — | ❌ TODO |
| Referral (logique backend) | ✅ | — | ❌ UI | ⚠️ PARTIAL |
| Notifications (logs DB) | ⚠️ | — | — | ⚠️ PARTIAL |

### PHASE P2 — EXPÉRIENCE

| Module | Backend | Web | Mobile | État |
|---|---|---|---|---|
| Reporting KPI | ⚠️ API | ⚠️ minimal | — | ⚠️ PARTIAL |
| Promotions codes promo | ❌ | — | — | ❌ TODO |
| Packs produits | ❌ | — | — | ❌ TODO |
| Flash sales | ❌ | — | — | ❌ TODO |
| Gamification | ❌ | — | — | ❌ TODO |
| Push notifications | — | — | — | ❌ TODO |
| Exports PDF/Excel | — | — | — | ❌ TODO |

---

## 4. ÉTAT BACKEND DÉTAILLÉ

### Routes montées (ordre critique — après corrections)

```
# AVANT wildcards — corrigé pour éviter interception auth.middleware
/customer/auth      → customer_auth.routes     (public OTP)
/customer/catalog   → customer_catalog.routes  (public catalogue + cities)
/customer/me        → customer_me.routes       (auth customer — profile, orders, wallet, notifications)
/customer/checkout  → customer_checkout.routes (auth customer)
/picker             → pickerPortal.routes      (⚠️ AVANT wildcards — login public puis auth picker)
/driver             → driverPortal.routes      (⚠️ AVANT wildcards — login public puis auth driver)

# Admin (wildcards /= auth admin peut intercepter)
/auth /users /roles /permissions → RBAC admin
/catalog             → catalogue admin (25+ endpoints)
/                    → locationRoutes + nodeRoutes (wildcards)
/customers /warehouse /stock /delivery /payment /wallet /orders /addresses
/checkout            → checkout admin
/orders-mgmt         → order_mgmt (statuts, historique, confirm-pickup)
/picking             → picking sessions + items
/staff               → pickers + drivers CRUD
/tours               → tours management
/reporting           → KPI endpoints
/pickup              → pickup dédié (collect-cod 2 étapes)
/delivery            → delivery_mgmt (tournées drivers)
/loyalty             → referrals + points
```

### Nouveaux modules ajoutés

| Module | Endpoints clés | État |
|---|---|---|
| `/pickup` (dédié) | ready-orders, collect-cod, confirm, cancel | ✅ DONE |
| `/delivery` (delivery_mgmt) | ready-orders, tours CRUD, stops actions | ✅ DONE |
| `/driver` portal | login, tours, tour start, stops | ✅ DONE |
| `/loyalty` | referrals, my-referrals, points engine | ✅ DONE |
| `/customer/me/wallet` | solde + historique transactions | ✅ DONE |
| `/customer/me/orders` | historique commandes client | ✅ DONE |
| `/customer/me/notifications` | lecture + mark read | ✅ DONE |
| `/picker/me` | vérification token picker | ✅ DONE |
| `/socket/picker` | Socket.IO rooms node | ✅ DONE |

### Score backend par module

| Module | Endpoints | Logique métier | Tests | Score |
|---|---|---|---|---|
| Auth & RBAC | ✅ | ✅ | ❌ | 80% |
| Catalogue | ✅ | ✅ | ❌ | 90% |
| Checkout | ✅ | ✅ atomique | ❌ | 85% |
| Stock | ✅ | ✅ | ❌ | 85% |
| Picking | ✅ | ✅ anti-doublon | ❌ | 90% |
| Pickup | ✅ | ✅ 2-étapes COD | ❌ | 85% |
| Tours/Livraison | ✅ | ✅ | ❌ | 80% |
| Paiements | ✅ | ✅ Stripe+COD+wallet | ❌ | 75% |
| Wallet | ✅ | ✅ ledger ACID | ❌ | 80% |
| Loyalty | ✅ | ✅ rules engine | ❌ | 60% |
| Notifications | ⚠️ logs | ⚠️ sans envoi | ❌ | 30% |
| Reporting | ✅ API | ❌ UI | ❌ | 45% |
| Promotions | ❌ | ❌ | ❌ | 10% |
| Gamification | ❌ | ❌ | ❌ | 5% |

---

## 5. ÉTAT FRONTEND WEB

| Répertoire | Fichiers | État actuel | Notes |
|---|---|---|---|
| access/ | 3 | ✅ DONE | RBAC complet |
| auth/ | 1 | ✅ DONE | Login admin |
| catalog/ | 14 | ✅ DONE | CRUD complet articles/SKUs |
| checkout/ | 2 | ✅ DONE | 5 étapes, créneau obligatoire, wallet check |
| customers/ | 5 | ✅ DONE | Liste, détail, adresses |
| dashboard/ | 1 | ⚠️ PARTIAL | KPI stubs, pas de graphiques |
| delivery/ | 9 | ✅ DONE | Tours, stops, ready-orders, TourDetail |
| location/ | 9 | ✅ DONE | Nodes, géographie |
| orders/ | 7 | ✅ DONE | Liste, statuts, historique |
| orders_mgmt/ | 1 | ⚠️ PARTIAL | Liste seulement |
| p0/ | 3 | ✅ DONE | Tables de référence |
| payment/ | 8 | ⚠️ PARTIAL | Méthodes, Stripe test |
| picker/ | 5 | ✅ DONE | Login web, sessions, picking |
| picking/ | 4 | ✅ DONE | Sessions, items picking |
| pickup/ | 2 | ✅ DONE | Liste + workflow COD 2 étapes |
| roles/ | 2 | ✅ DONE | |
| staff/ | 4 | ✅ DONE | Pickers, drivers management |
| stock/ | 11 | ✅ DONE | Niveaux, mouvements, lots |
| users/ | 2 | ✅ DONE | |
| wallet/ | 1 | ⚠️ PARTIAL | Transactions minimale |
| warehouse/ | 3 | ✅ DONE | Zones, emplacements |

**Total :** 98 fichiers JSX | **Score estimé :** 65%

---

## 6. ÉTAT MOBILE CUSTOMER

**Stack :** Flutter + Riverpod + Dio + go_router + flutter_screenutil
**Score :** 85%

| Feature | Fichiers | État | Détail |
|---|---|---|---|
| auth (OTP) | 5 | ✅ DONE | Login SMS → OTP → profile |
| customer_auth | 8 | ✅ DONE | Registration + referral code |
| catalog | 7 | ✅ DONE | Catégories → Produits → Détail |
| cart | 3 | ✅ DONE | Panier avec Riverpod |
| checkout | 14 | ✅ DONE | Livraison/retrait, créneaux, paiement, Stripe |
| orders | 10 | ✅ DONE | Historique + détail avec timeline |
| addresses | 7 | ✅ DONE | CRUD + city select depuis DB |
| profile | 8 | ✅ DONE | Wallet, points, paramètres |
| home | 1 | ⚠️ PARTIAL | Screen basique |
| notifications | — | ❌ TODO | Aucune UI |
| referral | — | ❌ TODO | UI partage/historique absente |
| gamification | — | ❌ TODO | Non développé |

**API_URL :** `--dart-define=API_URL=http://192.168.100.4:5000/api`
**APK debug :** disponible, build ~2 min

---

## 7. ÉTAT MOBILE PICKER — DÉTAIL COMPLET

**Stack :** Flutter + Riverpod + Dio + go_router + mobile_scanner + socket_io_client
**Score :** 78%

### Authentification
| Fonction | État | Implémentation |
|---|---|---|
| Login phone+password | ✅ | `POST /picker/login`, token JWT |
| FlutterSecureStorage | ✅ | `ds_picker_token` (clé dédiée, non partagée) |
| Interceptor auth | ✅ | `_AuthInterceptor` → `Authorization: Bearer` |
| Auto-login token | ✅ | `_init()` vérifie token existant |
| Logout propre | ✅ | Clear storage + status unauthenticated |
| 401 → redirect login | ✅ | Stream `tokenCleared` → `AuthNotifier` |
| Token picker vs admin | ✅ | Clés séparées (`picker_token` ≠ `token`) |

### Workflow picking
| Fonction | État | API |
|---|---|---|
| Dashboard avec stats | ✅ | `GET /picker/available-orders` + `GET /picker/my-orders` |
| Available orders (node filtré) | ✅ | Commandes confirmed du même node |
| Accept order (anti-doublon) | ✅ | `POST /picker/orders/:id/accept` → 409 si doublon |
| My orders (groupés) | ✅ | open / in_progress / completed / cancelled |
| Session detail | ✅ | Items avec progression |
| Start session | ✅ | `PATCH /picker/sessions/:id/start` |
| Pick item (EAN + qty) | ✅ | `PATCH /picker/items/:id/pick` |
| **Scan EAN13 caméra** | **❌ TODO** | `mobile_scanner` installé — UI caméra absente |
| Substitution (EAN form) | ✅ | EAN substitut → backend valide stock + lookup |
| Rupture (out_of_stock) | ✅ | `PATCH /picker/items/:id/out-of-stock` |
| Complete session | ✅ | Validation items pending avant autorisation |
| Profile / logout | ✅ | |

### Temps réel Socket.IO
| Fonction | État | Détail |
|---|---|---|
| Connexion WS authentifiée | ✅ | `ws://{IP}/socket/picker` + token JWT handshake |
| Room par node | ✅ | `node:{node_id}` — isolation automatique |
| Event `picker:new_order` | ✅ | Bannière verte flottante avec action "Voir" |
| Event `picker:order_taken` | ✅ | Commande retirée de la liste automatiquement |
| Reconnexion auto | ✅ | 10 tentatives, 2s délai |
| Stream `tokenCleared` → logout | ✅ | Sur 401 backend |

### Ce qui manque (picker)
1. **Scan EAN13 caméra** — `mobile_scanner` installé mais AUCUNE UI d'ouverture caméra
2. Historique picking par picker (stats)

---

## 8. ÉTAT MOBILE DRIVER — DÉTAIL COMPLET

**Stack :** Flutter + Riverpod + Dio + go_router + url_launcher
**Score :** 78%

### Authentification
| Fonction | État | Détail |
|---|---|---|
| Login phone+password | ✅ | `POST /driver/login`, JWT |
| FlutterSecureStorage | ✅ | `ds_driver_token` |
| Interceptor auth | ✅ | `Authorization: Bearer` |
| Auto-login + logout | ✅ | |
| 401 → redirect login | ✅ | Stream tokenCleared |

### Workflow livraison
| Fonction | État | API |
|---|---|---|
| Dashboard avec stats | ✅ | Stats réelles depuis tournées |
| Liste mes tournées | ✅ | `GET /driver/tours` |
| Détail tournée + stops | ✅ | `GET /driver/tours/:id` |
| Start tour | ✅ | `PATCH /driver/tours/:id/start` → orders in_delivery |
| Arrive at stop | ✅ | `PATCH /driver/stops/:id/arrive` |
| Deliver stop + COD | ✅ | Form montant COD + checkbox encaissement |
| Fail stop + raison | ✅ | Bottom sheet 4 raisons + notes |
| Auto-complete tour | ✅ | Quand tous stops résolus |
| Navigation GPS | ✅ | `url_launcher` → Google Maps (lat/lng ou adresse) |
| Stock decrement | ✅ | `qty_reserved-- + qty_physical--` après deliver |
| Profile / logout | ✅ | |

### Ce qui manque (driver)
1. **Temps réel socket** — Aucune notification de nouvelles tournées
2. Assign driver depuis l'app (admin web uniquement)
3. Photo preuve de livraison

---

## 9. ÉTAT BASE DE DONNÉES

**Modèles Prisma :** 86 | **Score :** 92%

### Enrichissements récents

| Modèle | Champs ajoutés | Raison |
|---|---|---|
| `PickingSessionItem` | `substitute_sku_id UUID?` | Stockage substitut avec relation Sku |
| `Tour` | `driver_id UUID?`, `date`, `slot_start`, `slot_end`, `zone` | Workflow livraison complet |
| `TourStop` | `delivered_at`, `failure_reason`, `driver_notes`, `cod_collected`, `amount_collected` | COD driver + failure tracking |
| `WalletTransaction` | (nouveau modèle) | Ledger wallet ACID |
| `Notification` | (nouveau modèle) | Log notifications |

### Seed P0 complété
- `picking_statuses` (open, in_progress, completed, cancelled)
- `pick_item_statuses` (pending, picked, substituted, out_of_stock)
- `tour_statuses` (planned, in_progress, completed, cancelled)
- `stop_statuses` (pending, arrived, delivered, failed, skipped)
- `wallet_txn_types` (debit_order, credit_refund, credit_recharge, referral_reward, credit_points, etc.)
- `move_types` (reservation, reservation_cancel, sale, reception, etc.)
- `notification_channels` (app, sms, email)

---

## 10. ÉTAT TEMPS RÉEL / SOCKET.IO

### Architecture actuelle

```
ws://{IP}:5000/socket/picker

Handshake : { auth: { token: "eyJ..." } }
Middleware : jwt.verify → picker actif → socket.join(`node:${picker.node_id}`)

Événements émis automatiquement :
  checkout.service.js → emitNewOrder(node_id, {...})   → picker:new_order
  createPickingSession → emitOrderTaken(node_id, {...}) → picker:order_taken
```

| Composant | État | Détail |
|---|---|---|
| Socket.IO server | ✅ | `http.createServer(app)` + `socket.io` |
| Auth JWT au handshake | ✅ | `jwt.verify(token, secret)` |
| Isolation par node | ✅ | `room = node:{node_id}` |
| `picker:new_order` | ✅ | Déclenché par checkout.service après confirmed |
| `picker:order_taken` | ✅ | Déclenché par createPickingSession.helper |
| `picker:session_started` | ✅ | Émetteur présent |
| Mobile picker — connexion | ✅ | `PickerSocketService` singleton |
| Mobile picker — reconnect | ✅ | `reconnectionAttempts: 10` |
| Mobile picker — bannière | ✅ | `NewOrderBanner` flottante + Riverpod |
| **Mobile picker — order_taken** | ✅ | Commande retirée de `availableOrdersProvider` |
| **Socket driver** | ❌ | Non implémenté |
| **Notifications client** | ❌ | Non implémenté |

---

## 11. ÉTAT PAIEMENTS COMPLET

### COD
- **Pickup :** collect-cod (étape 1) → confirm (étape 2) — anti-double collecte ✅
- **Livraison :** `amount_collected` stocké sur TourStop + payment.status=collected ✅
- **Validation :** montant_collected >= total_ttc obligatoire ✅

### Wallet
- **Débit commande :** atomique en transaction Prisma, `balance_before/after` ✅
- **Crédit remboursement :** `creditWallet` + `WalletTransaction` ✅
- **Ledger append-only :** jamais de modification/suppression ✅
- **Solde négatif bloqué :** vérification avant débit ✅
- **Mobile Customer :** WalletScreen + historique ✅
- **Manquant :** recharge admin UI

### Stripe
- **Payment Intent (mobile SDK) :** create-intent → client_secret ✅
- **Checkout Session (web redirect) :** URL Stripe hosted ✅
- **Webhook :** payment_intent.succeeded → collected, failed → failed ✅
- **Refund :** Stripe API + payment.status=refunded ✅
- **Mobile :** StripePaymentScreen (url_launcher) ✅
- **Variables requises :** `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`

### Points
- **Earning auto :** `loyalty.service.calculatePoints()` après delivered ✅
- **Règles DB :** per_spend, flat_bonus, first_order, referral_bonus ✅
- **Anti-double crédit :** `order.points_earned > 0 → skip` ✅
- **Redeem :** ❌ Non implémenté au checkout

---

## 12. ÉTAT STOCK — FLUX RÉSERVATION

```
CHECKOUT (create-order) :
  qty_reserved += qty   (atomic, anti-survente : condition qty_available >= qty)
  qty_available -= qty  (maintained in sync)
  StockMove type=reservation, qty_delta=0

ANNULATION commande :
  qty_reserved -= qty
  qty_available += qty
  StockMove type=reservation_cancel

PICKUP confirm ou DELIVERY delivered :
  qty_reserved -= qty
  qty_physical -= qty
  StockMove type=sale, qty_delta=-qty
```

- **Backorder :** `qty_available < qty` + `is_backorderable=true` → `qty_backordered +=` ✅
- **Race condition :** `updateMany` avec condition `qty_available >= qty` (atomique) ✅
- **checkStock :** `qty_available >= qty` (formule correcte) ✅

---

## 13. ÉTAT LOYALTY / REFERRAL

### Points fidélité
| Fonction | État | Détail |
|---|---|---|
| Règles DB (points_rules) | ✅ | per_spend, flat_bonus, first_order, referral_bonus |
| Calcul auto sur delivered | ✅ | Appelé par confirmPickup + deliverStop |
| Anti-double crédit | ✅ | `order.points_earned > 0 → skip` |
| `customers.points_balance` | ✅ | Incrémenté en transaction |
| `customers.points_lifetime` | ✅ | Toujours incrémenté, jamais décrémenté |
| `orders.points_earned` | ✅ | Stocké sur la commande |
| Affichage mobile customer | ✅ | PointsScreen lecture seule |
| **Redeem checkout** | ❌ | TODO |

### Referral
| Fonction | État | Détail |
|---|---|---|
| Création referral à l'inscription | ✅ | Si `referred_by_code` fourni |
| Validation après 1ère commande delivered | ✅ | `validateReferralOnDelivery()` |
| Vérification `min_order_amount` | ✅ | Depuis `referral_config` |
| Anti-double validation | ✅ | `@@unique([referrer_id, referee_id])` |
| Récompense wallet referrer | ✅ | `creditWallet + WalletTransaction` |
| Récompense points referee | ✅ | `points_balance +=` |
| **UI partage code** | ❌ | Absent mobile |
| **Dashboard admin referrals** | ⚠️ | Endpoint GET uniquement |

---

## 14. ÉTAT NOTIFICATIONS

| Fonction | État | Détail |
|---|---|---|
| Log en DB | ✅ | `notify.js` — tous événements clé |
| Templates FR | ✅ | confirmed, ready, in_delivery, delivered, wallet |
| Endpoints client | ✅ | GET /notifications, mark-read, mark-all-read |
| **Push Firebase** | ❌ | Non implémenté |
| **SMS** | ❌ | Non implémenté |
| **Email** | ❌ | Non implémenté |
| **UI mobile** | ❌ | Non implémenté |
| Socket notifications client | ❌ | Non implémenté |

---

## 15. ÉTAT REPORTING

| Endpoint | Backend | Frontend | État |
|---|---|---|---|
| `/reporting/dashboard` | ✅ | ⚠️ stubs | 40% |
| `/reporting/orders` | ✅ | — | 40% |
| `/reporting/picking` | ✅ | — | 40% |
| `/reporting/delivery` | ✅ | — | 40% |
| `/reporting/stock` | ✅ | — | 40% |
| `/reporting/payments` | ✅ | — | 40% |
| Graphiques | — | ❌ | 0% |
| Export PDF | — | ❌ | 0% |
| Export Excel | — | ❌ | 0% |

---

## 16. ÉTAT PROMOTIONS & GAMIFICATION

> Tables Prisma 100% présentes. **Aucun endpoint API monté.** Non intégré dans le checkout.

| Module | DB | API | Web | Mobile | État |
|---|---|---|---|---|---|
| Promotions (codes promo) | ✅ | ❌ | — | — | ❌ TODO |
| Packs produits | ✅ | ❌ | — | — | ❌ TODO |
| Flash sales | ✅ | ❌ | — | — | ❌ TODO |
| Gamification (jeux/prix) | ✅ | ❌ | — | — | ❌ TODO |
| Promo intégrée checkout | — | ❌ | ❌ | ❌ | ❌ BLOCKED |

---

## 17. PROBLÈMES RESTANTS

### 🔴 Critiques (bloquent production)
1. **Scan EAN13 caméra picker** — `mobile_scanner` installé mais UI absente dans `session_detail_screen.dart`
2. **Tests automatisés = 0** — risque régressions sans test suite
3. **Stripe clés production** — test mode uniquement (`sk_test_...`)
4. **Pas de déploiement VPS** — pas de Nginx/SSL/PM2 configuré

### 🟠 Importants (expérience)
5. **Notifications push/SMS** — logs DB uniquement, aucun envoi réel
6. **Points redeem** — earning auto ✅ mais rachat impossible au checkout
7. **Promotions non montées** — tables DB présentes, aucun endpoint API
8. **Dashboard reporting** — API présente, UI quasi vide
9. **Socket driver** — aucun temps réel pour les tournées
10. **Referral UI** — logique backend complète, UI absente

### 🟡 Mineurs (non bloquants)
11. Recharge wallet UI admin (API endpoint existe)
12. Home screen mobile customer à enrichir
13. Exports PDF/Excel reporting
14. Gamification désactivée (tables présentes)

---

## 18. PRIORITÉS RESTANTES

| Priorité | Module | Travail | Complexité |
|---|---|---|---|
| 🔴 P0 | Scan EAN13 | `mobile_scanner` → UI caméra dans `session_detail_screen.dart` | M |
| 🔴 P0 | APK release picker + driver | Build release, signature | S |
| 🔴 P0 | Test E2E workflow complet | Checkout → picking → delivered | M |
| 🔴 P0 | Stripe clés production | `.env` production | S |
| 🟠 P1 | Promotions API | Routes CRUD + checkout integration | XL |
| 🟠 P1 | Points redeem | Checkout → déduire points | M |
| 🟠 P1 | Notifications push | Firebase FCM setup | L |
| 🟠 P1 | Dashboard KPI graphiques | recharts + exports | L |
| 🟠 P1 | Referral UI mobile | Page partage code, historique | M |
| 🟡 P2 | Socket driver | Notifications nouvelles tournées | M |
| 🟡 P2 | Packs + Flash sales | API + checkout + mobile | XL |
| 🟡 P2 | Gamification | API + mobile | XL |
| 🟡 P2 | Tests automatisés | Jest backend + Flutter tests | XL |
| 🟡 P2 | VPS production | Nginx, SSL, PM2, monitoring | L |

---

## 19. ROADMAP FINALE VERS PRODUCTION

### Sprint 1 — APK opérationnelle (1 jour)
- [ ] Intégrer scan EAN13 caméra (mobile_scanner → UI picker)
- [ ] Build APK release picker + driver
- [ ] Validation test E2E complet (téléphone réel)

### Sprint 2 — Paiements & Fidélité complets (2 jours)
- [ ] Stripe clés production + webhook en prod
- [ ] Points redeem au checkout
- [ ] Referral UI mobile (partage code, suivi)
- [ ] Wallet recharge UI admin

### Sprint 3 — Notifications réelles (2 jours)
- [ ] Firebase FCM setup (backend + mobile customer)
- [ ] Notification center mobile customer
- [ ] Socket.IO notifications driver

### Sprint 4 — Reporting & Analytics (2 jours)
- [ ] Graphiques KPI (recharts)
- [ ] Export PDF commandes
- [ ] Analytics par node

### Sprint 5 — Promotions & Gamification (4–5 jours)
- [ ] API packs, promotions, flash_sales
- [ ] Intégration checkout (calcul promo)
- [ ] Flash sales catalogue mobile
- [ ] Gamification

### Sprint 6 — Production VPS (2 jours)
- [ ] Tests Jest backend
- [ ] Tests Flutter
- [ ] Nginx + SSL + PM2
- [ ] Variables production
- [ ] Monitoring (Sentry)

---

## 20. WORKFLOW GLOBAL — ÉTAT RÉEL ACTUEL

```
CLIENT MOBILE (customer_app — 85%)
  ↓
Catalog ✅ → Panier ✅ → Checkout ✅
  ↓
Stock réservé ✅ (atomique, anti-survente)
Order.status = confirmed ✅
  ↓
[SOCKET.IO] picker:new_order → tous pickers du node ✅
  ↓
PICKER (picker_app — 78%)
  Accepte ✅ → Session créée ✅ (anti-doublon 409)
  Start session ✅
  Pick items ✅ | Substitution ✅ | Rupture ✅
  Scan EAN13 caméra ❌ (formulaire texte seulement)
  Complete → Order.status = ready ✅
  ↓
┌─────────────────────────┬──────────────────────────┐
│ PICKUP (retrait — 100%)  │ DELIVERY (home — 80%)     │
│ Collect COD (étape 1) ✅ │ Tour créée ✅             │
│ Confirm retrait (ét.2) ✅│ Driver assigné ✅         │
│ Stock decrement ✅       │ Start tour → in_delivery✅│
│ Points crédités ✅       │ Arrive stop ✅            │
│                          │ Deliver + COD ✅           │
│                          │ Fail + raison ✅           │
│                          │ Stock decrement ✅         │
└─────────────────────────┴──────────────────────────┘
  ↓
Order.status = delivered ✅
  ↓
Points crédités ✅ (auto)
Referral validé ✅ (auto, si applicable)
Wallet débité ✅ (si wallet payment)
Notification loggée ✅ | Push ❌
  ↓
Reporting KPI ⚠️ (API ✅, UI minimale)
```

---

## TABLEAU SYNTHÈSE FINAL

| Module | Backend | Web | M.Customer | M.Picker | M.Driver | DB | Temps réel | **Global** |
|--------|---------|-----|------------|----------|----------|-----|------------|------------|
| Auth | ✅ 90% | ✅ 90% | ✅ 95% | ✅ 95% | ✅ 95% | ✅ | — | **✅ 92%** |
| Catalogue | ✅ 95% | ✅ 90% | ✅ 90% | — | — | ✅ | — | **✅ 92%** |
| Checkout | ✅ 90% | ✅ 85% | ✅ 90% | — | — | ✅ | ✅ | **✅ 89%** |
| Stock | ✅ 90% | ✅ 85% | — | — | — | ✅ | — | **✅ 88%** |
| Commandes | ✅ 85% | ✅ 80% | ✅ 85% | — | — | ✅ | — | **✅ 84%** |
| Picking | ✅ 90% | ✅ 85% | — | ⚠️ 78% | — | ✅ | ✅ 100% | **⚠️ 84%** |
| Pickup | ✅ 95% | ✅ 90% | — | — | — | ✅ | — | **✅ 93%** |
| Tours/Livraison | ✅ 85% | ✅ 75% | — | — | ⚠️ 78% | ✅ | ❌ | **⚠️ 80%** |
| Paiements | ✅ 80% | ⚠️ 60% | ✅ 80% | — | ✅ 80% | ✅ | — | **⚠️ 75%** |
| Wallet | ✅ 85% | ⚠️ 40% | ✅ 75% | — | — | ✅ | — | **⚠️ 68%** |
| Loyalty/Points | ✅ 70% | — | ⚠️ 50% | — | — | ✅ | — | **⚠️ 55%** |
| Referral | ✅ 75% | — | ❌ | — | — | ✅ | — | **⚠️ 50%** |
| Notifications | ⚠️ 30% | — | ❌ | — | — | ✅ | — | **❌ 25%** |
| Reporting | ⚠️ 50% | ⚠️ 20% | — | — | — | — | — | **❌ 35%** |
| Promotions | ❌ 10% | — | — | — | — | ✅ tables | — | **❌ 10%** |
| Gamification | ❌ 5% | — | — | — | — | ✅ tables | — | **❌ 5%** |

**Légende :** ✅ >75% · ⚠️ 40–74% · ❌ <40%

---

*Rapport v2 — basé sur l'analyse du code source réel, branche `dev`. Date : 2026-05-22.*
*Prochaine mise à jour : après Sprint 1 (scan EAN13 + APK release).*

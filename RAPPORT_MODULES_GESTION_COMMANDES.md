# RAPPORT — Modules Gestion des Commandes
## Dark Store App — Workflow Complet

**Date :** Mai 2026  
**Version :** 1.0  
**Périmètre :** Checkout · Commande · Stock · Picking · Livraison · Retrait · Paiement · Wallet · Points

---

## 1. Introduction

### Objectif

Ce rapport documente l'ensemble des modules, sous-modules, tables de base de données, relations et workflows nécessaires pour gérer une commande de bout en bout dans l'application Dark Store — depuis la sélection d'un article par le client jusqu'à la livraison à domicile ou le retrait en magasin, en passant par le paiement et la fidélisation.

### Périmètre

| Domaine | Description |
|---|---|
| **Checkout** | Sélection node automatique, créneaux, validation stock |
| **Commande** | Création, cycle de vie, historique |
| **Stock** | Niveaux, réservation, mouvements, backorder |
| **Picking** | Préparation commande par picker dans le node |
| **Livraison** | Tournées livreurs, collecte COD |
| **Retrait magasin** | Pickup par le client dans le node |
| **Paiement** | COD, Wallet, méthodes |
| **Wallet** | Solde client, transactions |
| **Points** | Fidélité, règles d'attribution |

---

## 2. Architecture Fonctionnelle Globale

```
CLIENT
  │
  ├─► Sélectionne une ADRESSE (addresses)
  │
  ├─► Choisit TYPE LIVRAISON (delivery_types)
  │       ├── home  → système sélectionne NODE automatiquement (nodes)
  │       └── pickup → client choisit NODE
  │
  ├─► Système vérifie CRÉNEAU DISPONIBLE (delivery_slots)
  │
  ├─► Système vérifie STOCK (stock_levels + selling_rules)
  │
  ├─► CHECKOUT crée la COMMANDE (orders + order_items)
  │       └── Réserve STOCK (stock_levels.qty_reserved++)
  │
  ├─► PAIEMENT (payments)
  │       ├── COD       → collecte à la livraison
  │       ├── Wallet    → débit wallet_txns
  │       └── Mixte     → wallet partiel + COD
  │
  ├─► Commande → confirmed → PICKING SESSION créée
  │       └── PICKER prépare les articles (picking_session_items)
  │
  ├─► Commande → ready
  │       ├── Livraison → TOUR créé, DRIVER livraison (tour_stops)
  │       └── Retrait   → Client vient récupérer dans le NODE
  │
  ├─► Commande → delivered
  │       ├── Stock libéré (qty_reserved--)
  │       ├── COD collecté (payments.status = collected)
  │       ├── Wallet débité si applicable (wallet_txns)
  │       └── POINTS crédités (customers.points_balance++)
  │
  └─► Historique complet (order_histories)
```

---

## 3. Modules Nécessaires

### A. Clients & Adresses

| Attribut | Valeur |
|---|---|
| **Tables** | `customers`, `addresses` |
| **Rôle** | Gérer les comptes clients, leurs adresses de livraison et soldes |
| **Relations** | customers → orders, customers → addresses, addresses → orders |
| **État** | ✅ Terminé |

**Colonnes clés `customers` :**
```
id · user_id (nullable FK) · phone_country · phone_number
name · preferred_lang · referral_code · referred_by_id
wallet_balance · points_balance · points_lifetime
city · lat · lng · is_active · is_deleted
```

**Colonnes clés `addresses` :**
```
id · customer_id · label · street_number · street_name
quartier · city · postal_code · lat · lng
delivery_notes · is_default · is_deleted
```

**Fonctionnalités couvertes :**
- CRUD complet customers
- CRUD adresses avec ville select → code postal auto
- Block/unblock client (synchronisé users.is_active)
- Soft delete

---

### B. Nodes & Créneaux

| Attribut | Valeur |
|---|---|
| **Tables** | `nodes`, `node_types`, `delivery_slots`, `delivery_types` |
| **Rôle** | Définir les dark stores, leurs créneaux et les types de livraison |
| **Relations** | nodes → orders, nodes → delivery_slots, nodes → stock_levels |
| **État** | ✅ Terminé |

**Colonnes clés `nodes` :**
```
id · code · name_fr · name_ar · node_type_id · city_id
lat · lng · delivery_radius_km · max_daily_orders
opening_hours_json · is_active · is_deleted
```

**Colonnes clés `delivery_slots` :**
```
id · node_id · name_fr · name_ar
day_of_week (0=Dim…6=Sam) · slot_start · slot_end
max_orders · is_active
```

**Nodes actifs :** 8 nodes (Rabat, Casablanca ×2, Marrakech, Fès, Agadir, Salé, Hub CBA)  
**Créneaux :** 168 total = 3 créneaux × 7 jours × 8 nodes

---

### C. Catalogue Produits

| Attribut | Valeur |
|---|---|
| **Tables** | `articles`, `skus`, `sku_images`, `brands`, `families`, `categories`, `sub_categories`, `units`, `taxes` |
| **Rôle** | Définir les produits vendables et leur référence logistique (SKU) |
| **Relations** | articles → skus (via sku_uuid), skus → stock_levels, skus → order_items |
| **État** | ✅ Terminé |

**Architecture :**
```
Article (Int PK, prix, TVA, EAN13)
  └── SKU (UUID PK — logistique, stock, picking)
        ├── stock_levels (par node)
        ├── order_items
        └── picking_session_items
```

> ⚠️ **Important :** La recherche d'articles au checkout utilise `articles.price` et `articles.sku_uuid` pour alimenter le panier.

---

### D. Stock

| Attribut | Valeur |
|---|---|
| **Tables** | `stock_levels`, `stock_moves`, `stock_lots`, `selling_rules`, `reorder_rules`, `stock_threshold_rules`, `sku_node_locations`, `locations` |
| **Rôle** | Gérer les quantités physiques, réservées et disponibles par node × SKU |
| **Relations** | stock_levels → nodes + skus, stock_moves → stock_levels, selling_rules → nodes + skus |
| **État** | ✅ Initialisé (256 stock_levels), ⚠️ Réservation à valider |

**Colonnes clés `stock_levels` :**
```
id · node_id · sku_id
qty_physical · qty_reserved · qty_available
qty_backordered · qty_incoming · qty_floating_cod
last_move_id · UNIQUE(node_id, sku_id)
```

**Colonnes clés `selling_rules` :**
```
id · node_id · sku_id
is_backorderable · backorder_limit · backordered_quantity
estimated_restock_days · UNIQUE(node_id, sku_id)
```

**Règles stock :**
- `qty_available = qty_physical - qty_reserved`
- Si `qty_available >= qty_demandée` → OK
- Sinon → vérifier `selling_rules.is_backorderable`
- Backorder autorisé → commande créée en statut `awaiting_stock`
- Backorder refusé → node non éligible

**Script :** `node scripts/seedInitialStock.js` — 256 niveaux de stock initialisés

---

### E. Commandes

| Attribut | Valeur |
|---|---|
| **Tables** | `orders`, `order_items`, `order_statuses`, `order_item_statuses`, `order_slot_statuses`, `order_histories` |
| **Rôle** | Cycle de vie complet d'une commande client |
| **Relations** | orders → customers, nodes, addresses, delivery_types, payments, picking_sessions |
| **État** | ✅ Terminé |

**Colonnes clés `orders` :**
```
id · customer_id · node_id · address_id · status_id
delivery_type_id · confirmed_slot_id
subtotal_ht · vat_amount · delivery_fee · discount_amount
wallet_used · total_ttc · cod_amount · cod_collected_at
points_earned · notes · cancelled_reason · is_deleted
```

**Statuts commande (9) :**

| Code | Couleur | Terminal | Ordre |
|---|---|---|---|
| `pending` | 🟠 orange | Non | 1 |
| `confirmed` | 🔵 bleu | Non | 2 |
| `picking` | 🟣 violet | Non | 3 |
| `ready` | 🩵 cyan | Non | 4 |
| `in_delivery` | 💜 indigo | Non | 5 |
| `delivered` | 🟢 vert | **Oui** | 6 |
| `cancelled` | 🔴 rouge | **Oui** | 7 |
| `returned` | ⚪ gris | **Oui** | 8 |
| `awaiting_stock` | 🟡 jaune | Non | 9 |

**`order_histories` :**
```
id · order_id · status_id · changed_by (user.id) · note · created_at
```
Chaque changement de statut est tracé automatiquement.

---

### F. Checkout

| Attribut | Valeur |
|---|---|
| **Tables liées** | customers, addresses, nodes, delivery_slots, stock_levels, selling_rules, orders, order_items, payments |
| **Rôle** | Orchestrer la création de commande avec affectation automatique du node |
| **État** | ✅ Fonctionnel (node auto + stock check) |

**Endpoints :**

| Route | Description |
|---|---|
| `GET /api/checkout/meta` | Types livraison + méthodes paiement |
| `GET /api/checkout/articles?search=` | Recherche articles catalogue |
| `POST /api/checkout/eligible-nodes` | Nodes éligibles pour adresse + panier |
| `GET /api/checkout/delivery-slots` | Node auto + créneaux (home) / liste nodes (pickup) |
| `POST /api/checkout/create-order` | Créer commande — transaction complète |

**Algorithme sélection node (home) :**
1. Normaliser ville (lowercase + strip accents)
2. Filtrer nodes par `city.name_fr`
3. Distance GPS Haversine ≤ `delivery_radius_km`
4. Créneaux actifs pour `day_of_week`
5. Capacité quotidienne `< max_daily_orders`
6. Stock disponible (lenient — SKU sans record = OK)
7. Tri par distance (plus proche en premier)

**Transaction `create-order` :**
```
1. Créer Order (status: pending ou awaiting_stock)
2. Créer OrderItems (status: active)
3. StockLevel: qty_reserved++ / qty_available--
4. Payment (status: pending)
5. OrderHistory: "Commande créée"
```

---

### G. Picking

| Attribut | Valeur |
|---|---|
| **Tables** | `pickers`, `picking_statuses`, `pick_item_statuses`, `picking_sessions`, `picking_session_items` |
| **Rôle** | Préparer les articles d'une commande dans le node |
| **Relations** | picking_sessions → orders + pickers, picking_session_items → order_items + locations |
| **État** | ✅ Fonctionnel |

**Colonnes clés `pickers` :**
```
id (UUID) · node_id · phone_country · phone_number
name · password_hash · is_active · is_deleted
```
> Auth standalone (phone + bcrypt password) — pas lié à `users`

**Colonnes clés `picking_sessions` :**
```
id · order_id · node_id · picker_id (nullable)
status_id · started_at · completed_at · error_count
```

**Colonnes clés `picking_session_items` :**
```
id · session_id · order_item_id · location_id
status_id · qty_expected · qty_picked
scanned_ean · picked_at
```

**Statuts picking :** `open` → `in_progress` → `completed` | `cancelled`  
**Statuts articles :** `pending` → `picked` | `substituted` | `out_of_stock`

**Déclenchement automatique :** Quand `order.status → picking`, une `picking_session` est créée automatiquement avec les `picking_session_items` générés depuis les `order_items`.

**Validation EAN :** `scanned_ean` comparé à `articles.ean13` — incrémente `error_count` si incorrect.

---

### H. Livraison

| Attribut | Valeur |
|---|---|
| **Tables** | `drivers`, `tours`, `tour_stops`, `tour_statuses`, `stop_statuses` |
| **Rôle** | Organiser les tournées de livraison et la collecte COD |
| **Relations** | tours → nodes + drivers, tour_stops → orders |
| **État** | ⚠️ À développer (drivers créés, tours non liés) |

**Colonnes clés `drivers` :**
```
id (UUID) · node_id · phone_country · phone_number
name · password_hash · vehicle_type · vehicle_plate
is_active · is_deleted
```
> Auth standalone identique aux pickers

**Tables à finaliser :**
- `tours` : ajouter `driver_id UUID FK → drivers(id)`
- `tour_stops` : lier commandes prêtes à une tournée
- Endpoints : `POST /api/tours`, `PATCH /api/tours/:id/start`, etc.

**Permissions :** `tours.read`, `tours.create`, `tours.start`, `tours.complete`, `delivery.deliver`, `delivery.collect_cod`

---

### I. Paiement

| Attribut | Valeur |
|---|---|
| **Tables** | `payments`, `payment_methods`, `payment_statuses` |
| **Rôle** | Enregistrer et suivre les paiements liés aux commandes |
| **Relations** | payments → orders + payment_methods + payment_statuses |
| **État** | ✅ Terminé (structure), ⚠️ Collecte COD à finaliser |

**Colonnes `payments` :**
```
id · order_id · status_id · payment_method_id
amount · currency · metadata
```

**Méthodes :** `cod` (actif par défaut) · `wallet` · `mixed`  
**Statuts :** `pending` → `collected` | `failed` | `refunded`

**Règle COD :** Le montant COD est collecté lors de la livraison (`cod_collected_at = NOW()`).  
**Règle Wallet :** Débit immédiat à la création commande → création `wallet_txn` de type `OUT`.

---

### J. Wallet

| Attribut | Valeur |
|---|---|
| **Tables** | `wallet_txns` (à créer), `wallet_txn_types`, `customers` |
| **Rôle** | Gérer le solde électronique du client |
| **Relations** | wallet_txns → customers + orders + wallet_txn_types |
| **État** | ⚠️ Types seedés, table `wallet_txns` à créer |

**Types de transactions (7 seedés) :**

| Code | Direction | Description |
|---|---|---|
| `order_payment` | OUT | Paiement commande |
| `refund` | IN | Remboursement |
| `cod_cashback` | IN | Cashback COD |
| `referral_bonus` | IN | Bonus parrainage |
| `admin_credit` | IN | Crédit manuel admin |
| `admin_debit` | OUT | Débit manuel admin |
| `points_conversion` | IN | Conversion points → MAD |

**Table `wallet_txns` à créer :**
```sql
CREATE TABLE wallet_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  txn_type_id UUID NOT NULL REFERENCES wallet_txn_types(id),
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference VARCHAR(100),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### K. Points / Fidélité

| Attribut | Valeur |
|---|---|
| **Tables** | `points_rules`, `points_rule_types`, `customers`, `orders` |
| **Rôle** | Attribuer des points de fidélité aux clients après chaque commande livrée |
| **Relations** | points_rules → nodes (optionnel), orders → customers |
| **État** | ⚠️ Tables existantes, logique d'attribution à développer |

**Logique d'attribution :**
- Déclenchée quand `order.status → delivered`
- `points_earned = f(total_ttc, points_rule)`
- `customers.points_balance += points_earned`
- `customers.points_lifetime += points_earned`

---

### L. Audit / Notifications

| Attribut | Valeur |
|---|---|
| **Tables** | `audit_logs` (à créer), `notifications_log` (à créer) |
| **Rôle** | Tracer tous les événements importants, notifier le client |
| **État** | ❌ À développer |

**Historique commandes existant :** `order_histories` — trace chaque changement de statut commande.

**À créer :**
- `audit_logs` : actions admin (création picker, reset password, etc.)
- `notifications_log` : SMS/Push envoyés au client (confirmation, prêt, livré)

---

## 4. Relations Principales

| Source | Cible | Type | Cardinalité |
|---|---|---|---|
| `customers` | `orders` | orders.customer_id | 1 → N |
| `customers` | `addresses` | addresses.customer_id | 1 → N |
| `addresses` | `orders` | orders.address_id | 1 → N (nullable) |
| `nodes` | `orders` | orders.node_id | 1 → N |
| `nodes` | `stock_levels` | stock_levels.node_id | 1 → N |
| `nodes` | `delivery_slots` | delivery_slots.node_id | 1 → N |
| `nodes` | `pickers` | pickers.node_id | 1 → N |
| `nodes` | `drivers` | drivers.node_id | 1 → N |
| `orders` | `order_items` | order_items.order_id | 1 → N |
| `orders` | `payments` | payments.order_id | 1 → N |
| `orders` | `picking_sessions` | picking_sessions.order_id | 1 → 1 (active) |
| `orders` | `tour_stops` | tour_stops.order_id | 1 → 1 |
| `orders` | `order_histories` | order_histories.order_id | 1 → N |
| `picking_sessions` | `picking_session_items` | session_items.session_id | 1 → N |
| `order_items` | `picking_session_items` | session_items.order_item_id | 1 → 1 |
| `tours` | `tour_stops` | tour_stops.tour_id | 1 → N |
| `payments` | `orders` | payments.order_id | N → 1 |
| `wallet_txns` | `customers` | wallet_txns.customer_id | N → 1 |
| `wallet_txns` | `orders` | wallet_txns.order_id | N → 1 (nullable) |
| `skus` | `stock_levels` | stock_levels.sku_id | 1 → N |
| `skus` | `order_items` | order_items.sku_id | 1 → N |
| `skus` | `picking_session_items` (via order_item) | indirect | indirect |

---

## 5. Workflows Possibles

---

### Workflow 1 — Livraison à domicile avec COD

```
ÉTAPES :
1. Client sélectionne articles + adresse + créneau
2. Système sélectionne node automatiquement (city match + radius + stock)
3. Commande créée (status: pending)
4. Stock réservé (qty_reserved++)
5. Payment créé (method: COD, status: pending)
6. Manager confirme → status: confirmed
7. Picking session créée automatiquement
8. Picker prépare les articles → status: picking → ready
9. Tour créé, driver assigné → status: in_delivery
10. Driver livre, collecte COD → status: delivered
11. Payment.status → collected, cod_collected_at = NOW()
12. Points crédités au client
13. Historique finalisé
```

| Étape | Statut commande | Tables impactées | Action |
|---|---|---|---|
| Commande créée | `pending` | orders, order_items, stock_levels, payments | Réservation stock |
| Confirmation | `confirmed` | orders, order_histories | Log historique |
| Picking | `picking` | orders, picking_sessions, picking_session_items | Session auto-créée |
| Préparation terminée | `ready` | orders, picking_sessions | Session completed |
| En livraison | `in_delivery` | orders, tours, tour_stops | Tour créé |
| Livré + COD collecté | `delivered` | orders, payments, customers, wallet_txns | Points + COD |

---

### Workflow 2 — Livraison à domicile avec Wallet

```
ÉTAPES :
1. Vérification wallet_balance >= total_ttc
2. Commande créée (status: pending)
3. Stock réservé
4. wallet_txns créé (type: order_payment, direction: OUT)
5. customers.wallet_balance -= total_ttc
6. Payment.status → pending (sera collected automatiquement)
7. Picking → ready → in_delivery → delivered
8. À la livraison : Payment.status → collected
9. Points crédités
```

| Étape | Statut commande | Tables impactées |
|---|---|---|
| Débit wallet | `pending` | wallet_txns, customers.wallet_balance |
| Livraison | `delivered` | orders, payments, customers.points_balance |

---

### Workflow 3 — Retrait magasin avec COD

```
ÉTAPES :
1. Client choisit node + créneau retrait
2. delivery_type = pickup
3. Commande créée (status: pending)
4. Stock réservé dans le node choisi
5. Payment créé (COD, pending)
6. Picking session créée
7. Picker prépare → status: ready
8. Client vient au node → status: delivered
9. Agent magasin collecte COD
10. Payment.status → collected
11. Points crédités
```

> ⚠️ **Différence :** Pas de tour/driver — la commande passe directement de `ready` à `delivered` au retrait.

---

### Workflow 4 — Retrait magasin avec Wallet

```
Identique au Workflow 3 mais :
- wallet_txns créé à la commande
- customers.wallet_balance -= total_ttc
- Pas de collecte physique à la livraison
```

---

### Workflow 5 — Commande avec stock insuffisant / backorder

```
ÉTAPES :
1. Stock disponible < quantité demandée
2. Vérification selling_rules.is_backorderable
   a. Si OUI → commande créée (status: awaiting_stock)
             → stock_levels.qty_backordered++
             → picking_session créée mais en attente
   b. Si NON → node marqué inéligible → autre node recherché
             → Si aucun node → erreur 422 retournée
3. Quand stock arrive :
   a. stock_moves créé (réception)
   b. stock_levels mis à jour
   c. order.status → confirmed → picking
```

| Condition | Statut commande | Action |
|---|---|---|
| is_backorderable = true | `awaiting_stock` | Attente réapprovisionnement |
| is_backorderable = false + autre node disponible | `pending` | Affecté à autre node |
| Aucun node | Erreur 422 | Commande non créée |

---

## 6. Statuts Commande — Cycle de Vie Complet

```
                    ┌─────────────┐
                    │   pending   │ ←── Création commande
                    └──────┬──────┘
                           │ Confirmation admin/manager
                    ┌──────▼──────┐
              ┌─────│  confirmed  │─────┐
              │     └──────┬──────┘     │
              │            │ Auto        │
              │     ┌──────▼──────┐     │
              │     │   picking   │     │
              │     └──────┬──────┘     │
              │            │ Picking OK  │
              │     ┌──────▼──────┐     │
              │     │    ready    │     │
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              │     │ in_delivery │     │ ← home delivery seulement
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              └────►│  delivered  │◄────┘ ← pickup direct depuis ready
                    └─────────────┘

Cas exceptionnels (depuis tout statut non terminal) :
  → cancelled  (annulation volontaire)
  → returned   (retour après livraison)

Statut spécial :
  pending ──► awaiting_stock ──► confirmed (quand stock disponible)
```

### Transitions autorisées

| De | Vers | Condition |
|---|---|---|
| `pending` | `confirmed` | Manager valide |
| `pending` | `cancelled` | Annulation |
| `awaiting_stock` | `confirmed` | Stock disponible |
| `awaiting_stock` | `cancelled` | Annulation |
| `confirmed` | `picking` | Auto à validation |
| `confirmed` | `cancelled` | Annulation |
| `picking` | `ready` | Picking terminé |
| `picking` | `cancelled` | Annulation |
| `ready` | `in_delivery` | Tour créé (home) |
| `ready` | `delivered` | Retrait magasin direct |
| `ready` | `cancelled` | Annulation |
| `in_delivery` | `delivered` | Livraison confirmée |
| `in_delivery` | `cancelled` | Problème livraison |
| `in_delivery` | `returned` | Retour colis |

---

## 7. Règles Métier Importantes

### Affectation Node

> **Règle :** Une commande `delivery_type = home` est affectée automatiquement au node le plus proche qui couvre l'adresse client (même ville + rayon GPS + créneaux disponibles + stock OK).

> **Règle :** Une commande `delivery_type = pickup` permet au client de choisir le node. Le stock est vérifié dans le node choisi.

### Stock

> **Règle :** Une commande ne peut pas être créée sans stock suffisant OU backorder explicitement autorisé (`selling_rules.is_backorderable = true`).

> **Règle :** À la création de la commande, le stock est immédiatement réservé (`qty_reserved++`, `qty_available--`). La réservation est libérée uniquement à la livraison ou l'annulation.

### Picking

> **Règle :** Quand une commande passe au statut `picking`, une `picking_session` est créée automatiquement. Les `picking_session_items` sont générés depuis les `order_items`.

> **Règle :** Le picker scanne l'EAN du produit. Si l'EAN ne correspond pas, `error_count` est incrémenté. L'item peut être marqué `substituted` ou `out_of_stock`.

### Livraison et Retrait

> **Règle :** Une commande `home` passe par `in_delivery` (tour + driver requis).  
> **Règle :** Une commande `pickup` passe directement de `ready` à `delivered` au retrait magasin.

### Paiement

> **Règle :** Le COD est collecté physiquement par le driver ou l'agent magasin. `payments.status → collected` et `cod_collected_at = NOW()`.

> **Règle :** Un paiement Wallet décrédite immédiatement `customers.wallet_balance` et crée une `wallet_txns` de type `order_payment` (direction OUT).

> **Règle :** Le wallet ne peut pas être utilisé si `customers.wallet_balance < order.total_ttc`. L'option Wallet est désactivée dans l'interface.

### Fidélité

> **Règle :** Les points sont crédités uniquement quand la commande passe au statut `delivered`. `customers.points_balance += order.points_earned`, `customers.points_lifetime += order.points_earned`.

### Historique

> **Règle :** Tout changement de statut commande est tracé dans `order_histories` avec `changed_by` (id de l'opérateur) et `note`.

---

## 8. Étapes de Développement Restantes

| Priorité | Étape | Statut | Dépendances |
|---|---|---|---|
| 1 | Initialiser stock par node × SKU | ✅ Fait | — |
| 2 | Checkout / create-order fonctionnel | ✅ Fait | stock_levels |
| 3 | Réservation stock à la commande | ✅ Fait | stock_levels |
| 4 | Picking sessions auto-créées | ✅ Fait | order_statuses |
| 5 | Picking items scan EAN | ✅ Fait | picking_sessions |
| 6 | Transition commande → ready | ✅ Fait | picking_sessions |
| 7 | **Retrait magasin** | ⚠️ À finaliser | ready → delivered direct |
| 8 | **Drivers liés aux tours** | ⚠️ À développer | tours.driver_id |
| 9 | **Tours / tour_stops** | ⚠️ À développer | drivers, orders |
| 10 | **Livraison driver** | ⚠️ À développer | tours, tour_stops |
| 11 | **Collecte COD** | ⚠️ À développer | payments, cod_collected_at |
| 12 | **Table wallet_txns** | ⚠️ À créer | customers, orders |
| 13 | **Débit wallet à commande** | ⚠️ À développer | wallet_txns |
| 14 | **Attribution points** | ⚠️ À développer | points_rules, customers |
| 15 | **Historique complet** | ✅ order_histories OK | audit_logs à créer |
| 16 | **Dashboard commandes** | ⚠️ À enrichir | toutes les tables |
| 17 | **Notifications client** | ❌ À créer | SMS/Push |

---

## 9. Checklist de Validation — Commande Complète

### Phase 1 — Création

- [ ] Client authentifié (`users.is_active = true`)
- [ ] Client non bloqué (`customers.is_active = true`)
- [ ] Adresse sélectionnée et valide (`addresses.is_deleted = false`)
- [ ] Node actif trouvé (`nodes.is_active = true`)
- [ ] Créneau actif disponible (`delivery_slots.is_active = true`, capacité non atteinte)
- [ ] Stock disponible ou backorder autorisé (`stock_levels.qty_available >= qty` OU `selling_rules.is_backorderable`)
- [ ] Méthode de paiement active (`payment_methods.is_active = true`)
- [ ] Wallet suffisant si paiement wallet (`customers.wallet_balance >= total_ttc`)

### Phase 2 — Commande Créée

- [x] `orders` créé avec `status = pending`
- [x] `order_items` créés pour chaque article
- [x] `stock_levels.qty_reserved += qty` pour chaque SKU
- [x] `stock_levels.qty_available -= qty`
- [x] `payments` créé avec `status = pending`
- [x] `order_histories` : entrée "Commande créée"

### Phase 3 — Confirmation & Picking

- [ ] `orders.status → confirmed`
- [ ] `order_histories` mis à jour
- [ ] `picking_session` créée automatiquement
- [ ] `picking_session_items` générés depuis `order_items`
- [ ] Picker assigné à la session
- [ ] `orders.status → picking`
- [ ] Items scannés (`scanned_ean` validé vs `articles.ean13`)
- [ ] Items : `picked` | `substituted` | `out_of_stock`
- [ ] `picking_session.status → completed`
- [ ] `orders.status → ready`

### Phase 4 — Livraison ou Retrait

**Livraison :**
- [ ] Tour créé (`tours`)
- [ ] `tour_stop` créé pour cette commande
- [ ] Driver assigné au tour
- [ ] `orders.status → in_delivery`
- [ ] Driver livre physiquement
- [ ] COD collecté (`cod_collected_at = NOW()`)
- [ ] `orders.status → delivered`

**Retrait magasin :**
- [ ] Client vient au node
- [ ] Agent magasin valide le retrait
- [ ] `orders.status → ready → delivered` (direct)

### Phase 5 — Clôture

- [ ] `payments.status → collected`
- [ ] Si Wallet : `wallet_txns` créé, `customers.wallet_balance` décrémenté
- [ ] `customers.points_balance += order.points_earned`
- [ ] `customers.points_lifetime += order.points_earned`
- [ ] `order_histories` : entrée finale "Livrée / Retirée"
- [ ] `stock_levels.qty_reserved -= qty` (libération réservation)

---

## 10. Résumé des APIs Disponibles

### Checkout
```
GET  /api/checkout/meta
GET  /api/checkout/articles?search=
POST /api/checkout/eligible-nodes
GET  /api/checkout/delivery-slots
POST /api/checkout/create-order
```

### Gestion Commandes
```
GET    /api/orders-mgmt/meta
GET    /api/orders-mgmt
GET    /api/orders-mgmt/:id
GET    /api/orders-mgmt/:id/transitions
GET    /api/orders-mgmt/:id/history
PATCH  /api/orders-mgmt/:id/status
PATCH  /api/orders-mgmt/:id/cancel
```

### Picking
```
GET    /api/picking/statuses
GET    /api/picking/item-statuses
GET    /api/picking/pickers
GET    /api/picking/sessions
POST   /api/picking/sessions
GET    /api/picking/sessions/:id
PATCH  /api/picking/sessions/:id/start
PATCH  /api/picking/sessions/:id/complete
PATCH  /api/picking/sessions/:id/cancel
PATCH  /api/items/:id/pick
PATCH  /api/items/:id/substitute
PATCH  /api/items/:id/out-of-stock
```

### Staff
```
GET    /api/staff/pickers
POST   /api/staff/pickers
GET    /api/staff/pickers/:id
GET    /api/staff/pickers/:id/stats
GET    /api/staff/pickers/:id/sessions
GET    /api/staff/pickers/:id/orders
PATCH  /api/staff/pickers/:id/activate
PATCH  /api/staff/pickers/:id/deactivate
PATCH  /api/staff/pickers/:id/reset-password
DELETE /api/staff/pickers/:id

GET    /api/staff/drivers
POST   /api/staff/drivers
GET    /api/staff/drivers/:id
GET    /api/staff/drivers/:id/stats
PATCH  /api/staff/drivers/:id/activate
PATCH  /api/staff/drivers/:id/deactivate
PATCH  /api/staff/drivers/:id/reset-password
DELETE /api/staff/drivers/:id
```

### Paiement
```
GET    /api/payment/statuses
GET    /api/payment/methods
PATCH  /api/payment/methods/:id/toggle-active
```

### Paramétrage Commandes
```
GET    /api/orders/statuses
GET    /api/orders/item-statuses
GET    /api/orders/slot-statuses
GET    /api/orders/configs?node_id=
POST   /api/orders/configs
GET    /api/orders/delivery-slots?node_id=
```

---

## 11. État Global des Modules

| Module | Frontend | Backend | DB | État |
|---|---|---|---|---|
| Auth & Permissions | ✅ | ✅ | ✅ | Terminé |
| Clients & Adresses | ✅ | ✅ | ✅ | Terminé |
| Catalogue | ✅ | ✅ | ✅ | Terminé |
| Géographie | ✅ | ✅ | ✅ | Terminé |
| Nodes & Créneaux | ✅ | ✅ | ✅ | Terminé |
| Entrepôt | ✅ | ✅ | ✅ | Terminé |
| Stock | ✅ | ✅ | ✅ | Initialisé |
| Livraison (types) | ✅ | ✅ | ✅ | Terminé |
| Paiement & Wallet | ✅ | ✅ | ✅ | Terminé |
| Paramétrage Commandes | ✅ | ✅ | ✅ | Terminé |
| Checkout | ✅ | ✅ | ✅ | Fonctionnel |
| Gestion Commandes | ✅ | ✅ | ✅ | Fonctionnel |
| Picking (param) | ✅ | ✅ | ✅ | Terminé |
| Picking (sessions) | ✅ | ✅ | ✅ | Fonctionnel |
| Staff Pickers | ✅ | ✅ | ✅ | Terminé |
| Staff Drivers | ✅ | ✅ | ✅ | Interface OK |
| Tours & Livraison | ❌ | ❌ | ⚠️ | À développer |
| Wallet Transactions | ❌ | ❌ | ❌ | À créer |
| Points Fidélité | ❌ | ❌ | ⚠️ | À développer |
| Notifications | ❌ | ❌ | ❌ | À créer |

---

*Document généré automatiquement — Dark Store App — Mai 2026*  
*Maintenu par l'équipe technique — à mettre à jour après chaque sprint*

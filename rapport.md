# Rapport Complet — Dark Store App

**Stack** : Node.js · Express · Prisma 5 · PostgreSQL · React 18 · Vite · Tailwind CSS  
**Architecture** : monorepo `backend/` + `frontend/` — modules métier auto-contenus  
**Date** : Mai 2026

---

## Sommaire

1. [Auth & Accès](#1-auth--accès)
2. [Catalogue](#2-catalogue)
3. [Géographie](#3-géographie)
4. [Noeuds (Nodes)](#4-noeuds)
5. [Entrepôt (Warehouse)](#5-entrepôt)
6. [Stock](#6-stock)
7. [Livraison](#7-livraison)
8. [Paiement & Wallet](#8-paiement--wallet)
9. [Paramétrage Commandes](#9-paramétrage-commandes)
10. [Gestion Commandes](#10-gestion-commandes)
11. [Checkout](#11-checkout)
12. [Clients & Adresses](#12-clients--adresses)
13. [Référentiel P0](#13-référentiel-p0)

---

## 1. Auth & Accès

### Tables

| Table | Description |
|---|---|
| `users` | Comptes utilisateurs back-office |
| `roles` | Rôles (superadmin, backoffice_admin, manager_node, picker, driver, customer) |
| `permissions` | Permissions atomiques par module/action |
| `role_permissions` | Association role ↔ permission |
| `user_roles` | Association user ↔ role |
| `backoffice_admins` | Profil admin BO (user_id Int FK, node_id nullable) |
| `pickers` | Profil préparateur (user_id, node_id) |
| `drivers` | Profil livreur (user_id, node_id, vehicle_type, vehicle_plate) |

### Colonnes clés `users`

```
id (Int autoincrement) · full_name · email · password_hash
phone_country · phone_number · otp_code · otp_expires_at · phone_verified_at
last_login_at · is_active · is_deleted · deleted_at · status
```

### Colonnes clés `roles`

```
id (Int) · code (UNIQUE) · name · name_fr · name_ar · description
is_active · is_system
```

### Colonnes clés `permissions`

```
id (Int) · code (UNIQUE) · module · action · name · name_fr · name_ar · description
```

### API Backend

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login email + password → JWT |
| GET | `/api/auth/me` | Profil connecté avec permissions |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/users` | Liste utilisateurs |
| POST | `/api/users` | Créer utilisateur |
| PUT | `/api/users/:id` | Modifier |
| DELETE | `/api/users/:id` | Supprimer |
| GET | `/api/roles` | Liste rôles |
| POST | `/api/roles` | Créer rôle |
| PUT | `/api/roles/:id` | Modifier |
| DELETE | `/api/roles/:id` | Supprimer (non-système) |
| POST | `/api/roles/:id/permissions` | Affecter permissions à un rôle |
| GET | `/api/roles/:id/permissions` | Permissions d'un rôle |
| GET | `/api/permissions` | Liste groupées par module |

### Pages Frontend

| Page | Route | Description |
|---|---|---|
| `UsersPage` | `/users` | CRUD utilisateurs |
| `RolesPage` | `/access/roles` | Tableau + badge is_system + drawer |
| `PermissionsPage` | `/access/permissions` | Par module avec couleurs + search |
| `RolePermissionsPage` | `/access/role-permissions` | Split view rôles / cocher-décocher perms |

### Rôles seedés (6)

| Code | is_system | Permissions attribuées |
|---|---|---|
| `superadmin` | Oui | Toutes (57+) |
| `backoffice_admin` | Oui | 30 |
| `manager_node` | Non | 14 |
| `picker` | Non | 8 |
| `driver` | Non | 7 |
| `customer` | Non | 0 (pas d'accès BO) |

---

## 2. Catalogue

### Tables

| Table | Description |
|---|---|
| `articles` | Fiche produit (nom FR/AR, prix TTC, TVA, code SKU, EAN13) |
| `skus` | SKU logistique UUID (lié à article via sku_uuid) |
| `sku_images` | Images SKU (url, alt_fr, alt_ar, is_primary, sort_order) |
| `article_images` | Images article |
| `families` | Familles produit |
| `categories` | Catégories (→ family) |
| `sub_categories` | Sous-catégories (→ category) |
| `brands` | Marques |
| `article_types` | Types article |
| `article_statuses` | Statuts article |
| `taxes` | Taux TVA |
| `units` | Unités de mesure |
| `packaging_types` | Types emballage |
| `conservation_types` | Types conservation |

### Colonnes clés `articles`

```
id (Int) · sku_code (UNIQUE) · ean13 (UNIQUE) · name_fr · name_ar
family_id · category_id · sub_category_id · brand_id
article_type_id · article_status_id · conservation_type_id · tax_id
unit_sale · unit_purchase · coeff
price (Decimal 12,2) · vat_rate (Decimal 5,2)
weight_g · volume_ml · is_active · is_deleted
sku_uuid (UUID UNIQUE FK → skus.id)
```

### API Backend — `/api/catalog`

| Méthode | Route | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/catalog/articles` | CRUD articles |
| GET | `/api/catalog/articles/:id` | Détail avec relations |
| GET/POST/PUT/DELETE | `/api/catalog/skus` | CRUD SKUs |
| GET/POST/PUT/DELETE | `/api/catalog/sku-images` | Galerie images SKU |
| GET/POST/PUT/DELETE | `/api/catalog/ref/:entitySlug` | CRUD génériques (brands, families, etc.) |

### Pages Frontend

| Page | Route |
|---|---|
| `CatalogDashboard` | `/catalog` |
| `ArticleList` | `/catalog/articles` |
| `ArticleForm` | `/catalog/articles/new` ou `/:id/edit` |
| `ArticleDetailPage` | `/catalog/articles/:id` |
| `SkusPage` | `/catalog/skus` |
| `SkuImagesPage` | `/catalog/sku-images` |
| `SkuImageFormPage` | `/catalog/sku-images/new` ou `/:id/edit` |
| `CatalogTaxonomyPage` | `/catalog/taxonomy` |
| `CatalogRefPage` | `/catalog/refs` |
| `ReferentialListPage` | `/catalog/ref/:entitySlug` |

---

## 3. Géographie

### Tables

| Table | Description |
|---|---|
| `regions` | Régions du Maroc |
| `provinces` | Provinces (→ region_id) |
| `cities` | Villes (→ province_id, code postal) |

### Colonnes clés `cities`

```
id (UUID) · code (UNIQUE) · name_fr · name_ar · postal_code
province_id (FK) · is_active · is_deleted
```

### API Backend

| Méthode | Route |
|---|---|
| GET/POST/PUT/DELETE | `/api/regions` |
| GET/POST/PUT/DELETE | `/api/provinces` |
| GET/POST/PUT/DELETE | `/api/cities` |

### Pages Frontend

| Page | Route |
|---|---|
| `GeoPage` | `/geo/regions` `/geo/provinces` `/geo/cities` |

---

## 4. Noeuds

### Tables

| Table | Description |
|---|---|
| `nodes` | Dark stores / hubs logistiques |
| `node_types` | Types de nœuds (DARK_STORE, HUB, PICKUP_POINT…) |
| `delivery_slots` | Créneaux de livraison (par node, jour, horaire) |

### Colonnes clés `nodes`

```
id (UUID) · code (UNIQUE) · name_fr · name_ar
node_type_id (FK) · region_id (FK) · province_id (FK) · city_id (FK → cities)
address_line1 · quartier · postal_code
lat (Decimal 10,7) · lng (Decimal 10,7) · phone
timezone · delivery_radius_km (Decimal 8,2) · max_daily_orders
opening_hours_json · is_active · is_deleted
```

### Colonnes clés `delivery_slots`

```
id (UUID) · node_id (FK → nodes) · name_fr · name_ar
day_of_week (0=Dim … 6=Sam)
slot_start (VARCHAR HH:MM) · slot_end (VARCHAR HH:MM)
max_orders · is_active
```

### API Backend

| Méthode | Route |
|---|---|
| GET/POST/PUT/DELETE | `/api/nodes` |
| GET | `/api/nodes/:id` |
| GET/POST/PUT/DELETE | `/api/node-types` |

### Pages Frontend

| Page | Route |
|---|---|
| `NodesPage` | `/nodes` |
| `NodeDetailPage` | `/nodes/:id` |
| `NodeForm` | `/nodes/new` `/nodes/:id/edit` |
| `NodeTypesPage` | `/node-types` |

### Nodes seedés (8)

| Code | Ville | Rayon km |
|---|---|---|
| DS-RBA-01 | Rabat | 5 |
| DS-CBA-01 | Casablanca | 5 |
| DS-CBA-02 | Aïn Sebaâ | 4 |
| DS-MAR-01 | Marrakech | 5 |
| DS-FES-01 | Fès | 4 |
| DS-AGA-01 | Agadir | 5 |
| DS-SAL-01 | Salé | 4 |
| HUB-CBA-01 | Casablanca | 30 |

**Créneaux** : 168 total = 3 créneaux × 7 jours × 8 nodes  
Matin 08h-12h (max 30) · Après-midi 14h-18h (max 30) · Soir 18h-22h (max 20)

---

## 5. Entrepôt

### Tables

| Table | Description |
|---|---|
| `zones` | Zones de stockage (→ node) |
| `warehouse_locations` | Emplacements (allée, travée, niveau) |
| `sku_node_locations` | Localisation SKU dans entrepôt |

### API Backend — `/api/warehouse`

| Méthode | Route |
|---|---|
| GET/POST/PUT/DELETE | `/api/warehouse/zones` |
| GET/POST/PUT/DELETE | `/api/warehouse/levels` |
| GET | `/api/warehouse` |

### Pages Frontend

| Page | Route |
|---|---|
| `WarehousePage` | `/warehouse` |
| `ZonesPage` | `/warehouse/zones` |
| `LevelsPage` | `/warehouse/levels` |

---

## 6. Stock

### Tables

| Table | Description |
|---|---|
| `stock_statuses` | Statuts stock + color (hex), is_sellable |
| `move_types` | Types de mouvements stock |
| `inventory_types` | Types d'inventaire |
| `inventory_statuses` | Statuts d'inventaire |
| `inventory_gap_types` | Types d'écarts inventaire |
| `stock_threshold_rules` | Règles de seuil d'alerte (→ node, SKU) |
| `stock_levels` | Stock par node+SKU (qty_physical, reserved, available) |
| `selling_rules` | Règles de vente (backorder, limite) par node+SKU |
| `reorder_rules` | Règles réapprovisionnement par node+SKU |
| `stock_moves` | Mouvements de stock (entrée, sortie, transfert) |
| `stock_lots` | Lots FIFO (dates de péremption, traçabilité) |

### Colonnes clés `stock_levels`

```
id (UUID) · node_id · sku_id
qty_physical · qty_reserved · qty_available
qty_backordered · qty_incoming · qty_floating_cod
last_move_id · last_counted_at · updated_at
UNIQUE (node_id, sku_id)
```

### Colonnes clés `selling_rules`

```
id (UUID) · node_id · sku_id
is_backorderable · backorder_limit · backordered_quantity
estimated_restock_days
UNIQUE (node_id, sku_id)
```

### API Backend — `/api/stock`

| Méthode | Route | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/stock/move-types` | Types de mouvement |
| GET/POST/PUT/DELETE | `/api/stock/stock-statuses` | Statuts (color picker natif) |
| GET/POST/PUT/DELETE | `/api/stock/inventory-types` | Types inventaire |
| GET/POST/PUT/DELETE | `/api/stock/inventory-statuses` | Statuts inventaire |
| GET/POST/PUT/DELETE | `/api/stock/inventory-gap-types` | Types écarts |
| GET/POST/PUT/DELETE | `/api/stock/thresholds` | Seuils d'alerte |
| GET | `/api/stock/levels` | Niveaux de stock |
| GET/POST/PUT/DELETE | `/api/stock/selling-rules` | Règles de vente |
| GET/POST/PUT/DELETE | `/api/stock/reorder-rules` | Règles réappro |
| GET | `/api/stock/moves` | Mouvements stock |
| GET | `/api/stock/lots` | Lots stock |

### Pages Frontend

| Page | Route |
|---|---|
| `StockStatusesPage` | `/stock/stock-statuses` |
| `MoveTypesPage` | `/stock/move-types` |
| `InventoryTypesPage` | `/stock/inventory-types` |
| `InventoryStatusesPage` | `/stock/inventory-statuses` |
| `InventoryGapTypesPage` | `/stock/inventory-gap-types` |
| `StockThresholdsPage` | `/stock/thresholds` |
| `StockLevelsPage` | `/stock/levels` |
| `SellingRulesPage` | `/stock/selling-rules` |
| `ReorderRulesPage` | `/stock/reorder-rules` |
| `StockMovesPage` | `/stock/moves` |
| `StockLotsPage` | `/stock/lots` |

---

## 7. Livraison

### Tables

| Table | Description |
|---|---|
| `delivery_types` | Types de livraison + color (hex) |

### Colonnes `delivery_types`

```
id (UUID) · code (UNIQUE) · name_fr · name_ar · color (hex)
```

### API Backend — `/api/delivery`

| Méthode | Route |
|---|---|
| GET/POST/PUT/DELETE | `/api/delivery/types` |
| POST | `/api/delivery/types/seed` |

### Types seedés

| Code | Nom |
|---|---|
| `home` | Livraison à domicile |
| `pickup` | Retrait magasin |

---

## 8. Paiement & Wallet

### Tables

| Table | Description |
|---|---|
| `payment_statuses` | Statuts paiement (pending, collected, failed, refunded) |
| `payment_methods` | Méthodes (cod, wallet, mixed) + is_active |
| `payments` | Paiements (→ order, status, method) |
| `wallet_txn_types` | Types transaction wallet + direction (IN/OUT) |

### Colonnes `payments`

```
id (UUID) · order_id (FK) · status_id (FK) · payment_method_id (FK)
amount (Decimal 12,2) · currency · metadata (JSON)
created_at · updated_at
```

### Colonnes `wallet_txn_types`

```
id (UUID) · code (UNIQUE) · name_fr · name_ar · color (hex) · direction (IN|OUT)
```

### API Backend

| Méthode | Route | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/payment/statuses` | CRUD statuts paiement |
| POST | `/api/payment/statuses/seed` | Seed 4 statuts |
| GET/POST/PUT/DELETE | `/api/payment/methods` | CRUD méthodes |
| PATCH | `/api/payment/methods/:id/toggle-active` | Activer/désactiver (COD protégé) |
| POST | `/api/payment/methods/seed` | Seed COD, Wallet, Mixed |
| GET/POST/PUT/DELETE | `/api/wallet/txn-types` | CRUD types transaction |
| POST | `/api/wallet/txn-types/seed` | Seed 7 types (IN/OUT) |

### Pages Frontend

| Page | Route | Description |
|---|---|---|
| `PaymentStatusesPage` | `/payment/statuses` | Color picker indigo, count usages |
| `PaymentMethodsPage` | `/payment/methods` | Toggle inline, COD protégé contre désactivation |
| `WalletTxnTypesPage` | `/wallet/txn-types` | Badges direction IN/OUT |

---

## 9. Paramétrage Commandes

### Tables

| Table | Description |
|---|---|
| `order_statuses` | 9 statuts cycle de vie + color (hex), is_terminal, sort_order |
| `order_item_statuses` | 4 statuts ligne commande + color |
| `order_slot_statuses` | 4 statuts créneau + color |
| `app_configs` | Configs globales ou par node (key/value typé) |
| `config_value_types` | Types de valeur (string, number, boolean) |

### Colonnes `order_statuses`

```
id (UUID) · code (UNIQUE) · name_fr · name_ar
color (hex VarChar 20) · is_terminal · sort_order (SmallInt)
```

### Colonnes `app_configs`

```
id (UUID) · node_id (UUID nullable FK → nodes.id)
config_key (VarChar 100) · config_value (Text)
value_type_id (FK → config_value_types) · description
updated_by (Int FK → users.id) · updated_at
UNIQUE (node_id, config_key)
```

### API Backend — `/api/orders`

| Méthode | Route | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/orders/statuses` | Statuts commande (color picker) |
| POST | `/api/orders/statuses/seed` | Seed 9 statuts |
| GET/POST/PUT/DELETE | `/api/orders/item-statuses` | Statuts ligne (color picker) |
| POST | `/api/orders/item-statuses/seed` | Seed 4 statuts |
| GET/POST/PUT/DELETE | `/api/orders/slot-statuses` | Statuts créneaux (color picker) |
| POST | `/api/orders/slot-statuses/seed` | Seed 4 statuts |
| GET/POST/DELETE | `/api/orders/configs` | App configs (global ou par node) |
| POST | `/api/orders/configs/seed` | Seed 8 configs globales |
| GET | `/api/orders/configs/keys` | Clés disponibles avec types |
| GET/POST/PUT/DELETE | `/api/orders/delivery-slots` | Créneaux livraison par node |

### Statuts commande seedés (9)

| Code | Couleur | Terminal | Ordre |
|---|---|---|---|
| `pending` | #f97316 orange | Non | 1 |
| `confirmed` | #3b82f6 bleu | Non | 2 |
| `picking` | #8b5cf6 violet | Non | 3 |
| `ready` | #06b6d4 cyan | Non | 4 |
| `in_delivery` | #6366f1 indigo | Non | 5 |
| `delivered` | #10b981 vert | **Oui** | 6 |
| `cancelled` | #ef4444 rouge | **Oui** | 7 |
| `returned` | #64748b gris | **Oui** | 8 |
| `awaiting_stock` | #eab308 jaune | Non | 9 |

### Configs globales seedées (app_configs)

| Clé | Valeur défaut | Type |
|---|---|---|
| `min_order_amount` | 50 | number |
| `delivery_fee` | 0 | number |
| `cod_max_amount` | 5000 | number |
| `slot_duration_min` | 120 | number |
| `maintenance_mode` | false | boolean |
| `payment_method_cod` | true | boolean |
| `payment_method_wallet` | false | boolean |
| `payment_method_mixed` | false | boolean |

### Pages Frontend

| Page | Route | Description |
|---|---|---|
| `OrderStatusesPage` | `/orders/statuses` | Color picker + colonne is_terminal + sort_order |
| `OrderItemStatusesPage` | `/orders/item-statuses` | Color picker, lignes commandes |
| `OrderSlotStatusesPage` | `/orders/slot-statuses` | Color picker, créneaux |
| `DeliverySlotsPage` | `/orders/delivery-slots` | Vue par node, groupée par jour |
| `NodeConfigPage` | `/orders/node-config` | 3 onglets (Livraison / Paiement / Règles) |

---

## 10. Gestion Commandes

### Tables

| Table | Description |
|---|---|
| `orders` | Commandes client |
| `order_items` | Lignes de commande (→ order, sku, status, node) |
| `order_histories` | Historique changements de statut (timeline) |

### Colonnes `orders`

```
id (UUID) · customer_id · node_id · address_id · status_id
delivery_type_id · confirmed_slot_id · slot_start · slot_end
currency · subtotal_ht · vat_amount · delivery_fee
discount_amount · wallet_used · total_ttc
cod_amount · cod_collected_at · points_earned
notes · cancelled_reason · is_deleted · deleted_at
created_at · updated_at
```

### Colonnes `order_items`

```
id (UUID) · order_id (FK CASCADE) · sku_id · pack_id
parent_item_id · flash_sale_id · status_id · node_id
qty (Decimal 10,3) · unit_price_sold (Decimal 12,2)
discount_amount · qty_backordered · vat_rate
```

### Colonnes `order_histories`

```
id (UUID) · order_id (FK CASCADE → orders)
status_id (FK → order_statuses)
changed_by (Int nullable → users.id)
note (Text nullable) · created_at (Timestamptz)
```

### API Backend — `/api/orders-mgmt`

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/orders-mgmt/meta` | Compteurs par statut + nodes + types livraison |
| GET | `/api/orders-mgmt` | Liste paginée + filtres (search, status, node, type) |
| GET | `/api/orders-mgmt/:id` | Détail complet (customer, address, items+article, payments, slot) |
| GET | `/api/orders-mgmt/:id/transitions` | Transitions autorisées depuis statut actuel |
| GET | `/api/orders-mgmt/:id/history` | Historique chronologique avec statuts |
| PATCH | `/api/orders-mgmt/:id/status` | Changer statut (validation transitions) |
| PATCH | `/api/orders-mgmt/:id/cancel` | Annuler directement |

### Transitions autorisées

```
pending        → confirmed    | cancelled
awaiting_stock → confirmed    | cancelled
confirmed      → picking      | cancelled
picking        → ready        | cancelled
ready          → in_delivery  | cancelled
in_delivery    → delivered    | cancelled  | returned
delivered      → (terminal — aucune action)
cancelled      → (terminal — aucune action)
returned       → (terminal — aucune action)
```

### Page Frontend — `OrdersListPage` `/orders-mgmt`

**Layout** : Split view — liste gauche (55%) + panel détail droit (45%)

**Filtres liste** :
- Tabs statuts colorés avec compteur temps réel
- Search (ID/nom client/téléphone)
- Dropdown type de livraison
- Dropdown node

**ID commande** : format `ORD-XXXXXXXX` (8 premiers chars UUID uppercase)

**Panel détail — 5 onglets** :

| Onglet | Contenu |
|---|---|
| Résumé | Client (wallet/points), adresse + notes, node, totaux HT/TVA/livraison/promo |
| Articles | Lignes — nom depuis catalogue, qté ×, prix unitaire, sous-total |
| Créneau | Nom, horaire `HH:MM–HH:MM`, **date calculée depuis day_of_week** |
| Paiement | Montant, méthode (code), statut coloré |
| Historique | **Timeline verticale** — dot coloré hex, nom statut, note, heure + date |

**Boutons action** :
- Transition principale (Confirmer / Lancer picking / …) — bleu
- "Annuler la commande" — séparé, rouge, avec confirmation

---

## 11. Checkout

### Description

Module d'affectation **automatique** du node pour la livraison à domicile.  
Le client ne choisit pas le node — le système le détermine.

### Algorithme sélection node (home delivery)

```
1. Normaliser ville (lowercase + strip accents NFD)
   "Marrakech" = "marrakech" = "MARRAKECH" → même résultat

2. Charger TOUS les nodes actifs
   Filtrer par ville normalisée en JS (pas en SQL)

3. Pour chaque node candidat :
   a. Distance GPS Haversine(address.lat/lng, node.lat/lng)
      Si distance > delivery_radius_km → inéligible
      Si pas de GPS → fallback ville seule

   b. Créneaux actifs pour le day_of_week demandé
      Si aucun créneau → inéligible

   c. count(orders aujourd'hui) < max_daily_orders
      Si dépassé → inéligible

   d. Stock check (lenient back-office)
      SKU sans stock_levels record → OK (non bloquant)
      stock.qty_available < qty ET pas de backorder → inéligible

4. Trier éligibles par distance (plus proche en premier)
5. Retourner best_node = eligible[0]
```

### API Backend — `/api/checkout`

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/checkout/meta` | Types livraison + méthodes paiement actives |
| GET | `/api/checkout/articles` | Recherche articles (search, limit) — pour panier |
| POST | `/api/checkout/eligible-nodes` | Nodes éligibles + raisons inéligibilité |
| GET | `/api/checkout/delivery-slots` | Node auto + créneaux (home) / liste nodes (pickup) |
| POST | `/api/checkout/create-order` | Créer commande — transaction complète |

### Payload `create-order`

```json
{
  "customer_id": "uuid-customer",
  "address_id": "uuid-address",
  "delivery_type_id": "uuid-type",
  "node_id": "uuid-node",
  "selected_slot_id": "uuid-slot",
  "payment_method_id": "uuid-method",
  "cart_items": [
    { "sku_id": "uuid-sku", "qty": 2, "unit_price": 25.9, "vat_rate": 20 }
  ],
  "notes": "Sonner 2 fois"
}
```

### Transaction `create-order`

```
1. Créer Order (status: pending OU awaiting_stock si backorder)
2. Créer OrderItems (status: active, node_id = finalNode)
3. StockLevel.updateMany: qty_reserved++, qty_available-- (si record existe)
4. Créer Payment (status: pending) si payment_method_id fourni
5. Créer OrderHistory (note: "Commande créée")
```

### Page Frontend — `CheckoutPage` `/checkout/new`

**4 étapes** :

| Étape | Contenu |
|---|---|
| 1. Client | Sélecteur client (debounce 300ms) + sélection adresse |
| 2. Livraison | Type home/pickup + date → **node affiché automatiquement** + créneaux |
| 3. Panier | **Sélecteur article DB** (search debounce → prix+TVA auto-remplis) + total dynamique |
| 4. Paiement | Wallet **désactivé** si `wallet_balance < total` OU `= 0` |

**Récapitulatif** : sidebar sticky avec client, adresse, node, créneau, total

---

## 12. Clients & Adresses

### Tables

| Table | Description |
|---|---|
| `customers` | Profil client (wallet, points, referral, lang, GPS) |
| `addresses` | Adresses livraison (soft-delete, is_default, GPS) |

### Colonnes `customers`

```
id (UUID) · user_id (Int nullable FK → users.id)
phone_country (VarChar 5) · phone_number (VarChar 15) · phone_verified_at
name (VarChar 150) · preferred_lang (fr|ar)
referral_code (VarChar 20 UNIQUE) · referred_by_id (nullable FK self)
wallet_balance (Decimal 12,2 >= 0) · points_balance (Int >= 0)
points_lifetime (Int) · city · lat · lng
is_active · is_deleted · deleted_at · created_at · updated_at
```

### Colonnes `addresses`

```
id (UUID) · customer_id (FK CASCADE → customers)
label (VarChar 100) · street_number (VarChar 20) · street_name (VarChar 255)
quartier (VarChar 100) · city (VarChar 100) · postal_code (VarChar 5)
lat (Decimal 9,6) · lng (Decimal 9,6)
delivery_notes (Text) · is_default · is_deleted · deleted_at
created_at · updated_at
```

### API Backend

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/customers` | Liste paginée + filtres multi-critères |
| POST | `/api/customers` | Créer client |
| GET | `/api/customers/:id` | Détail avec compteurs |
| PUT | `/api/customers/:id` | Modifier |
| PUT | `/api/customers/:id/block` | Bloquer (sync users.is_active si user_id) |
| PUT | `/api/customers/:id/unblock` | Débloquer |
| DELETE | `/api/customers/:id` | Soft delete |
| GET | `/api/customers/:id/addresses` | Liste adresses actives |
| POST | `/api/customers/:id/addresses` | Créer (1ère = is_default auto) |
| PUT | `/api/addresses/:id` | Modifier |
| PATCH | `/api/addresses/:id/set-default` | Définir par défaut (unset les autres) |
| DELETE | `/api/addresses/:id` | Soft delete |

### Pages Frontend

| Page | Route | Description |
|---|---|---|
| `CustomerList` | `/customers` | Tableau + stats wallet/OTP/bloqués + filtres scope |
| `CustomerDetail` | `/customers/:id` | 4 stat cards + onglets Profil/Adresses/Parrainage |
| `CustomerForm` | `/customers/new` ou `/:id/edit` | Formulaire sectionné + sélecteur indicatif |
| `CustomerAddressesPage` | `/customers/:id/addresses` | Grille cartes + **ville select → CP auto** |

### Spécificité formulaire adresse

Champ **Ville** = `<select>` chargé depuis `GET /api/cities?all=true`
Sélection → **auto-remplissage postal_code** depuis `cities.postal_code`
Indicateur "Auto ✓" vert si auto-rempli, champ reste modifiable

### Customers seedés (15)

| Ville | Count |
|---|---|
| Rabat | 4 |
| Casablanca | 4 |
| Marrakech | 2 |
| Fès | 2 |
| Agadir | 1 |
| Tétouan | 1 |
| Oujda | 1 |

---

## 13. Référentiel P0

Tables de référence consultables directement depuis le back-office.

### API Backend — `/api/p0`

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/p0/registry` | Registre de toutes les tables P0 groupées |
| GET | `/api/p0/table/:sql` | Données d'une table spécifique |

### Pages Frontend

| Page | Route |
|---|---|
| `P0TablesHub` | `/p0/tables` |
| `P0TablePage` | `/p0/tables/:sql` |

---

## Scripts disponibles

```bash
# Auth
node scripts/seedAuthSystem.js     # 6 rôles + 57 perms + assignments + admin@test.com → superadmin

# Clients
node scripts/seedCustomers.js      # 15 clients marocains + 23 adresses démo

# Checkout & Nodes
node scripts/seedCheckout.js       # 168 créneaux (3×7j×8 nodes) + fix city casing
node scripts/testCheckout.js       # Test findEligibleNodes + getDeliverySlots
node scripts/testCreateOrder.js    # Test création commande end-to-end

# Commandes
node scripts/seedOrders.js         # 12 commandes démo (statuts variés)
node scripts/seedOrderHistory.js   # Historique reconstitué (51 entrées)
node scripts/patchOrderSlots.js    # Assigner confirmed_slot_id aux commandes existantes

# Debug
node scripts/checkDb.js            # État nodes, customers, delivery_slots
node scripts/checkCities.js        # Correspondance villes customers ↔ cities
node scripts/checkArticles.js      # Structure articles + SKUs
```

---

## Chiffres clés du projet

| Catégorie | Valeur |
|---|---|
| Modules backend | 14 |
| Fichiers de routes | 58 |
| Endpoints API estimés | ~150 |
| Tables DB principales | ~55 |
| Pages frontend | ~45 |
| Fichiers API frontend | 17 |
| Rôles | 6 |
| Permissions | 57 |
| Nodes actifs | 8 |
| Créneaux livraison | 168 |
| Statuts commande | 9 |
| Clients démo | 15 |
| Commandes démo | 13 |
| Entrées historique | 51 |

---

*Dark Store App — Rapport technique complet — Mai 2026*

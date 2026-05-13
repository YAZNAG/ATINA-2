# Module Stock — Documentation complète

> **Base URL backend :** `GET|POST|PUT|DELETE /api/stock/...`
> **Permissions :** `stock.view` (lecture) · `stock.manage` (écriture)
> **Toutes les routes sont protégées par JWT.**

---

## Sommaire

1. [Architecture générale](#1-architecture-générale)
2. [PARAMÉTRAGE STOCK](#2-paramétrage-stock)
   - 2.1 Types de mouvement
   - 2.2 Statuts de stock
   - 2.3 Types d'inventaire
   - 2.4 Statuts d'inventaire
   - 2.5 Types d'écarts inventaire
   - 2.6 Seuils de stock
   - 2.7 Opérations stock
3. [SUIVI OPÉRATIONNEL](#3-suivi-opérationnel)
   - 3.1 Niveaux de stock
   - 3.2 Règles de vente
   - 3.3 Règles de réapprovisionnement
   - 3.4 Mouvements stock
   - 3.5 Lots de stock (FIFO)
4. [Tables et colonnes](#4-tables-et-colonnes)
5. [Workflows](#5-workflows)
6. [Référence complète des API](#6-référence-complète-des-api)

---

## 1. Architecture générale

```
backend/src/modules/stock/
├── stock.routes.js                        ← routeur principal
├── move_types/                            ← paramétrage
├── stock_statuses/
├── inventory_types/
├── inventory_statuses/
├── inventory_gap_types/
├── stock_threshold_rules/
├── stock_operations/
├── stock_levels/                          ← suivi
├── selling_rules/
├── reorder_rules/
├── stock_moves/
└── stock_lots/

frontend/src/pages/stock/
├── MoveTypesPage.jsx
├── StockStatusesPage.jsx
├── InventoryTypesPage.jsx
├── InventoryStatusesPage.jsx
├── InventoryGapTypesPage.jsx
├── StockThresholdsPage.jsx
├── StockLevelsPage.jsx
├── SellingRulesPage.jsx
├── ReorderRulesPage.jsx
├── StockMovesPage.jsx
└── StockLotsPage.jsx
```

Chaque sous-module suit le pattern : `repository → service → controller → routes`

---

## 2. PARAMÉTRAGE STOCK

### 2.1 Types de mouvement (`/api/stock/move-types`)

Définit la nature de chaque mouvement de stock (réception, vente, transfert, etc.).
Chaque type est rattaché à une **opération** : `IN`, `OUT`, ou `NEUTRAL`.

**Table : `move_types`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `code` | VARCHAR(50) UNIQUE | Code technique (ex: `RECEIPT`, `SALE`) |
| `name_fr` | VARCHAR(100) | Libellé français |
| `name_ar` | VARCHAR(100) | Libellé arabe |
| `operation` | VARCHAR(10) | Direction : `IN` / `OUT` / `NEUTRAL` |
| `color` | VARCHAR(20) | Couleur badge UI (ex: `green`, `red`) |
| `created_at` | TIMESTAMPTZ | Date de création |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/move-types` | stock.view | Liste paginée (filtre `?all=true` pour tout récupérer) |
| GET | `/move-types/:id` | stock.view | Détail |
| POST | `/move-types` | stock.manage | Créer |
| PUT | `/move-types/:id` | stock.manage | Modifier |
| DELETE | `/move-types/:id` | stock.manage | Supprimer |

---

### 2.2 Statuts de stock (`/api/stock/stock-statuses`)

Qualifie l'état du stock physique (disponible, bloqué, endommagé, en quarantaine…).
Le flag `is_sellable` indique si ce statut autorise la vente.

**Table : `stock_statuses`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `code` | VARCHAR(50) UNIQUE | Code technique |
| `name_fr` | VARCHAR(100) | Libellé français |
| `name_ar` | VARCHAR(100) | Libellé arabe |
| `color` | VARCHAR(20) | Couleur badge UI |
| `is_sellable` | BOOLEAN | Autorise la vente si vrai |
| `is_active` | BOOLEAN | Actif / inactif |
| `sort_order` | INT | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | Date de création |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/stock-statuses` | stock.view | Liste paginée (`?all=true` pour dropdown) |
| GET | `/stock-statuses/:id` | stock.view | Détail |
| POST | `/stock-statuses` | stock.manage | Créer |
| PUT | `/stock-statuses/:id` | stock.manage | Modifier |
| DELETE | `/stock-statuses/:id` | stock.manage | Supprimer |

---

### 2.3 Types d'inventaire (`/api/stock/inventory-types`)

Catégorise les sessions d'inventaire (complet, tournant, flash, aléatoire…).
Le `scope` indique si l'inventaire couvre un nœud entier ou une zone/rayon.

**Table : `inventory_types`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `code` | VARCHAR(50) UNIQUE | Code technique |
| `name_fr` | VARCHAR(100) | Libellé français |
| `name_ar` | VARCHAR(100) | Libellé arabe |
| `scope` | VARCHAR(20) | Périmètre : `FULL`, `ZONE`, `SKU`, etc. |
| `color` | VARCHAR(20) | Couleur badge UI |
| `description_fr` | VARCHAR(255) | Description |
| `is_active` | BOOLEAN | Actif / inactif |
| `sort_order` | INT | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | Date de création |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/inventory-types` | stock.view | Liste paginée |
| GET | `/inventory-types/:id` | stock.view | Détail |
| POST | `/inventory-types` | stock.manage | Créer |
| PUT | `/inventory-types/:id` | stock.manage | Modifier |
| DELETE | `/inventory-types/:id` | stock.manage | Supprimer |

---

### 2.4 Statuts d'inventaire (`/api/stock/inventory-statuses`)

Cycle de vie d'une session d'inventaire (brouillon, en cours, clôturé, validé…).

**Table : `inventory_statuses`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `code` | VARCHAR(50) UNIQUE | Code technique |
| `name_fr` | VARCHAR(100) | Libellé français |
| `name_ar` | VARCHAR(100) | Libellé arabe |
| `color` | VARCHAR(20) | Couleur badge UI |
| `description_fr` | VARCHAR(255) | Description |
| `is_active` | BOOLEAN | Actif / inactif |
| `sort_order` | INT | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | Date de création |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/inventory-statuses` | stock.view | Liste paginée |
| GET | `/inventory-statuses/:id` | stock.view | Détail |
| POST | `/inventory-statuses` | stock.manage | Créer |
| PUT | `/inventory-statuses/:id` | stock.manage | Modifier |
| DELETE | `/inventory-statuses/:id` | stock.manage | Supprimer |

---

### 2.5 Types d'écarts inventaire (`/api/stock/inventory-gap-types`)

Classe les causes des écarts découverts lors d'un inventaire (vol, casse, erreur saisie…).
`impact_stock` indique si l'écart réduit (`REDUCE`) ou augmente (`INCREASE`) le stock physique.
`requires_validation` exige une approbation managériale avant ajustement.

**Table : `inventory_gap_types`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `code` | VARCHAR(50) UNIQUE | Code technique |
| `name_fr` | VARCHAR(100) | Libellé français |
| `name_ar` | VARCHAR(100) | Libellé arabe |
| `description_fr` | VARCHAR(255) | Description |
| `color` | VARCHAR(20) | Couleur badge UI |
| `impact_stock` | VARCHAR(10) | `REDUCE` ou `INCREASE` |
| `requires_validation` | BOOLEAN | Validation requise avant ajustement |
| `is_active` | BOOLEAN | Actif / inactif |
| `sort_order` | INT | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | Date de création |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/inventory-gap-types` | stock.view | Liste paginée |
| GET | `/inventory-gap-types/:id` | stock.view | Détail |
| POST | `/inventory-gap-types` | stock.manage | Créer |
| PUT | `/inventory-gap-types/:id` | stock.manage | Modifier |
| DELETE | `/inventory-gap-types/:id` | stock.manage | Supprimer |

---

### 2.6 Seuils de stock (`/api/stock/thresholds`)

Définit pour chaque couple **nœud × SKU** les niveaux seuils déclenchant des alertes ou un réapprovisionnement automatique.

**Table : `stock_threshold_rules`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `node_id` | UUID FK → nodes | Entrepôt / nœud concerné |
| `sku_id` | UUID FK → skus | SKU concerné |
| `stock_minimum` | DECIMAL(12,3) | Stock en dessous duquel l'article est critique |
| `stock_alert_threshold` | DECIMAL(12,3) | Seuil déclenchant une alerte visuelle |
| `stock_maximum` | DECIMAL(12,3) | Capacité maximale souhaitée |
| `reorder_quantity` | DECIMAL(12,3) | Quantité standard à commander |
| `auto_restock_enabled` | BOOLEAN | Réapprovisionnement automatique activé |
| `is_active` | BOOLEAN | Règle active ou non |
| `created_at` | TIMESTAMPTZ | Date de création |
| `updated_at` | TIMESTAMPTZ | Dernière mise à jour |

**Contrainte :** `UNIQUE(node_id, sku_id)` — une seule règle par couple nœud/SKU.

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/thresholds?node_id=` | stock.view | Règles d'un nœud |
| POST | `/thresholds/bulk-save` | stock.manage | Sauvegarde en masse (upsert) |
| POST | `/thresholds` | stock.manage | Créer une règle |
| PUT | `/thresholds/:id` | stock.manage | Modifier |
| DELETE | `/thresholds/:id` | stock.manage | Supprimer |

---

### 2.7 Opérations stock (`/api/stock/operations`)

Table de référence fixe des directions de mouvement. Utilisée comme classificateur sur les `move_types`.

**Table : `stock_operations`**

| Colonne | Type | Description |
|---|---|---|
| `code` | VARCHAR(10) PK | Code unique : `IN`, `OUT`, `ADJ`, `TRF`, `NEUTRAL` |
| `name_fr` | VARCHAR(50) | Libellé français |
| `name_ar` | VARCHAR(50) | Libellé arabe |

**Valeurs en base :**

| code | name_fr | name_ar | Signification |
|---|---|---|---|
| `IN` | Entrée de stock | دخول | Réception, retour fournisseur |
| `OUT` | Sortie de stock | خروج | Vente, picking, perte |
| `ADJ` | Ajustement de stock | تسوية | Correction inventaire |
| `TRF` | Transfert de stock | نقل | Mouvement inter-nœuds |
| `NEUTRAL` | Neutre | محايد | Réservation, annulation |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/operations` | stock.view | Liste toutes les opérations |
| POST | `/operations/seed` | stock.manage | Initialise les 5 valeurs par défaut |

---

## 3. SUIVI OPÉRATIONNEL

### 3.1 Niveaux de stock (`/api/stock/levels`)

Agrégat temps réel du stock par couple **nœud × SKU**. C'est la table centrale : toute mutation passe par ce module et génère automatiquement une ligne dans `stock_moves`.

**Table : `stock_levels`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `node_id` | UUID FK → nodes | Entrepôt / nœud |
| `sku_id` | UUID FK → skus | SKU |
| `qty_physical` | DECIMAL(12,3) | Stock physique total présent |
| `qty_reserved` | DECIMAL(12,3) | Quantité réservée pour commandes confirmées |
| `qty_available` | DECIMAL(12,3) | `qty_physical − qty_reserved` (vendable) |
| `qty_backordered` | DECIMAL(12,3) | Commandes acceptées au-delà du stock disponible |
| `qty_incoming` | DECIMAL(12,3) | Commandes fournisseur en transit |
| `qty_floating_cod` | DECIMAL(12,3) | Stock livré COD non encore collecté |
| `last_move_id` | UUID | Dernier mouvement appliqué |
| `last_counted_at` | TIMESTAMPTZ | Dernière date de comptage physique |
| `updated_at` | TIMESTAMPTZ | Dernière mise à jour |

**Contrainte :** `UNIQUE(node_id, sku_id)`

**API — Lectures :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/levels` | stock.view | Liste filtrée (`?node_id=`, `?sku_id=`, pagination) |
| GET | `/levels/by-node/:node_id` | stock.view | Tous les SKU d'un nœud |
| GET | `/levels/:id` | stock.view | Détail d'un niveau |

**API — Mutations (chaque appel crée un `StockMove`) :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| POST | `/levels/receipt` | stock.manage | **Réception** : ↑ qty_physical + crée un `StockLot` FIFO |
| POST | `/levels/reserve` | stock.manage | **Réservation** : ↑ qty_reserved, ↓ qty_available |
| POST | `/levels/picking` | stock.manage | **Picking** : ↓ qty_physical + ↓ qty_reserved (consomme FIFO) |
| POST | `/levels/cancel` | stock.manage | **Annulation réservation** : ↓ qty_reserved, ↑ qty_available |
| POST | `/levels/incoming` | stock.manage | **Mise en transit** : ↑ qty_incoming |
| POST | `/levels/cod-delivered` | stock.manage | **Livraison COD** : ↑ qty_floating_cod |
| POST | `/levels/cod-collected` | stock.manage | **Encaissement COD** : ↓ qty_floating_cod |
| POST | `/levels/count` | stock.manage | **Comptage inventaire** : force qty_physical |
| POST | `/levels/adjust` | stock.manage | **Ajustement** : delta ± sur qty_physical |
| POST | `/levels/recalculate` | stock.manage | **Recalcul** : recalcule qty_available depuis physical−reserved |
| POST | `/levels/move` | stock.manage | **Transfert inter-nœuds** : ↓ nœud source, ↑ nœud destination |

---

### 3.2 Règles de vente (`/api/stock/selling-rules`)

Paramètre par couple **nœud × SKU** les conditions de vente : autorisation de backorder, limite de backorder et délai de restockage estimé.

**Table : `selling_rules`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `node_id` | UUID FK → nodes | Nœud concerné |
| `sku_id` | UUID FK → skus | SKU concerné |
| `is_backorderable` | BOOLEAN | Vente autorisée si stock épuisé |
| `backorder_limit` | DECIMAL(12,3) | Quantité max acceptable en backorder |
| `backordered_quantity` | DECIMAL(12,3) | Quantité actuellement en backorder |
| `estimated_restock_days` | SMALLINT | Délai estimé de réapprovisionnement (jours) |
| `updated_at` | TIMESTAMPTZ | Dernière mise à jour |

**Contrainte :** `UNIQUE(node_id, sku_id)`

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/selling-rules` | stock.view | Liste paginée |
| GET | `/selling-rules/by-node/:node_id` | stock.view | Toutes les règles d'un nœud |
| GET | `/selling-rules/estimated-delivery` | stock.view | Date de livraison estimée pour un SKU/nœud |
| GET | `/selling-rules/:id` | stock.view | Détail |
| POST | `/selling-rules/bulk-save` | stock.manage | Sauvegarde en masse (upsert) |
| POST | `/selling-rules/can-sell` | stock.view | Vérifie si une quantité est vendable |
| POST | `/selling-rules/reserve-backorder` | stock.manage | Réserve une quantité en backorder |
| POST | `/selling-rules/release-backorder` | stock.manage | Libère une réservation backorder |
| POST | `/selling-rules` | stock.manage | Créer / upsert |
| PUT | `/selling-rules/:id` | stock.manage | Modifier |
| DELETE | `/selling-rules/:id` | stock.manage | Supprimer |

---

### 3.3 Règles de réapprovisionnement (`/api/stock/reorder-rules`)

Définit par couple **nœud × SKU** les paramètres de réassort : point de commande, stock de sécurité, quantité économique, délai fournisseur et méthode de valorisation.

**Table : `reorder_rules`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `node_id` | UUID FK → nodes | Nœud concerné |
| `sku_id` | UUID FK → skus | SKU concerné |
| `safety_stock` | DECIMAL(12,3) | Stock de sécurité minimum absolu |
| `reorder_point` | DECIMAL(12,3) | Seuil déclenchant la commande |
| `economic_qty` | DECIMAL(12,3) | Quantité économique de commande (EOQ) |
| `max_stock` | DECIMAL(12,3) | Capacité maximale de stockage |
| `lead_time_days` | SMALLINT | Délai fournisseur en jours |
| `costing_method_id` | UUID FK → costing_methods | FIFO / LIFO / CMP / Standard |
| `preferred_supplier_id` | UUID FK → suppliers | Fournisseur privilégié |
| `is_active` | BOOLEAN | Règle active |
| `updated_at` | TIMESTAMPTZ | Dernière mise à jour |

**Contrainte :** `UNIQUE(node_id, sku_id)`

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/reorder-rules` | stock.view | Liste paginée |
| GET | `/reorder-rules/by-node/:node_id` | stock.view | Règles d'un nœud |
| GET | `/reorder-rules/refs` | stock.view | Listes de référence (méthodes coût, fournisseurs) |
| GET | `/reorder-rules/suggested-qty` | stock.view | Quantité suggérée pour un SKU/nœud |
| GET | `/reorder-rules/:id` | stock.view | Détail |
| POST | `/reorder-rules/bulk-save` | stock.manage | Sauvegarde en masse (upsert) |
| POST | `/reorder-rules/should-reorder` | stock.view | Indique si un SKU doit être commandé maintenant |
| POST | `/reorder-rules/detect-critical` | stock.view | Détecte tous les SKU en stock critique |
| POST | `/reorder-rules/detect-overstock` | stock.view | Détecte tous les SKU en surstock |
| POST | `/reorder-rules` | stock.manage | Créer |
| PUT | `/reorder-rules/:id` | stock.manage | Modifier |
| DELETE | `/reorder-rules/:id` | stock.manage | Supprimer |

---

### 3.4 Mouvements stock (`/api/stock/moves`)

**Journal immuable** (append-only) : chaque mutation du stock inscrit une ligne. Aucun UPDATE ni DELETE n'est jamais effectué sur cette table. Toutes les mutations passent via `stock_levels`.

**Table : `stock_moves`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `node_id` | UUID FK → nodes | Nœud concerné |
| `sku_id` | UUID FK → skus | SKU concerné |
| `move_type_id` | UUID FK → move_types | Type de mouvement (nullable) |
| `lot_id` | UUID FK → stock_lots | Lot FIFO consommé/créé (nullable) |
| `order_id` | UUID FK → orders | Commande déclenchante (nullable) |
| `operator_id` | INT FK → users | Opérateur ayant effectué l'opération (nullable) |
| `qty_delta` | DECIMAL(12,3) | Variation appliquée (positif = entrée, négatif = sortie) |
| `reference` | VARCHAR(100) | Numéro de référence externe (BC, BL…) |
| `reason` | TEXT | Motif texte libre |
| `metadata` | JSONB | Données complémentaires arbitraires |
| `created_at` | TIMESTAMPTZ | Horodatage (non modifiable) |

**API (lecture seule) :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/moves` | stock.view | Liste paginée côté serveur (`?page=&limit=&node_id=&sku_id=&move_type_id=&operation=&date_from=&date_to=`) |
| GET | `/moves/stats` | stock.view | Statistiques : total, aujourd'hui, entrées, sorties (`?node_id=`) |
| GET | `/moves/:id` | stock.view | Détail d'un mouvement |

---

### 3.5 Lots de stock — FIFO (`/api/stock/lots`)

Gère les lots physiques permettant la consommation **FIFO** (premier entré, premier sorti). Chaque réception crée un lot. Le picking consomme les lots dans l'ordre chronologique en excluant les lots expirés.

**Table : `stock_lots`**

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant unique |
| `sku_id` | UUID FK → skus | SKU du lot |
| `node_id` | UUID FK → nodes | Entrepôt du lot |
| `qty_initial` | DECIMAL(12,3) | Quantité reçue à l'origine |
| `qty_remaining` | DECIMAL(12,3) | Quantité encore disponible dans le lot |
| `cost_unit` | DECIMAL(12,4) | Coût unitaire d'achat (MAD) |
| `lot_number` | VARCHAR(100) | Numéro de lot fournisseur (nullable) |
| `received_at` | TIMESTAMPTZ | Date de réception (sert au tri FIFO) |
| `expiry_date` | DATE | Date de péremption (nullable) |
| `is_deleted` | BOOLEAN | Suppression logique |
| `deleted_at` | TIMESTAMPTZ | Horodatage de suppression |
| `created_at` | TIMESTAMPTZ | Date de création |

**Statuts calculés côté frontend :**

| Statut | Condition | Badge |
|---|---|---|
| `NORMAL` | Non expiré, qty_remaining > 0 | Vert |
| `EXPIRING` | Expire dans ≤ 30 jours | Orange |
| `EXPIRED` | expiry_date < aujourd'hui | Rouge |
| `EXHAUSTED` | qty_remaining ≤ 0 | Gris |

**API :**

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET | `/lots` | stock.view | Liste filtrée (`?node_id=&sku_id=&expiring_soon=&expired=&exhausted=&active=`) |
| GET | `/lots/alerts` | stock.view | Compteurs d'alertes : expiré / expire bientôt / épuisé (`?node_id=`) |
| GET | `/lots/:id` | stock.view | Détail d'un lot |
| POST | `/lots` | stock.manage | Créer un lot manuellement |
| DELETE | `/lots/:id` | stock.manage | Suppression logique (is_deleted = true) |

---

## 4. Tables et colonnes

Récapitulatif de toutes les tables du module stock et leur rôle :

| Table | Clé | Description |
|---|---|---|
| `stock_operations` | `code` PK | Référentiel fixe : IN / OUT / ADJ / TRF / NEUTRAL |
| `move_types` | UUID PK | Types de mouvement personnalisés liés à une opération |
| `stock_statuses` | UUID PK | Statuts qualifiant l'état physique du stock |
| `inventory_types` | UUID PK | Natures de session d'inventaire |
| `inventory_statuses` | UUID PK | Cycle de vie d'une session d'inventaire |
| `inventory_gap_types` | UUID PK | Causes des écarts inventaire |
| `stock_threshold_rules` | UUID PK | Seuils min/alerte/max par nœud×SKU |
| `stock_levels` | UUID PK | Stock temps réel agrégé par nœud×SKU |
| `selling_rules` | UUID PK | Règles de vente et backorder par nœud×SKU |
| `reorder_rules` | UUID PK | Règles de réapprovisionnement par nœud×SKU |
| `stock_moves` | UUID PK | Journal immuable de tous les mouvements |
| `stock_lots` | UUID PK | Lots FIFO avec suivi de quantité et expiration |

---

## 5. Workflows

### WF-01 — Réception marchandise

```
Fournisseur livre →
  POST /levels/receipt { node_id, sku_id, qty, cost_unit, lot_number, expiry_date }
    ├─ Crée ou met à jour stock_levels (↑ qty_physical)
    ├─ Crée un StockLot (lot FIFO avec qty_initial = qty, received_at = now)
    └─ Inscrit un StockMove (qty_delta > 0, move_type = RECEIPT, lot_id lié)
```

### WF-02 — Passage de commande (vente normale)

```
Client commande →
  1. POST /selling-rules/can-sell { node_id, sku_id, qty }
       └─ Vérifie qty_available ≥ qty (ou is_backorderable si rupture)
  2. POST /levels/reserve { node_id, sku_id, qty }
       ├─ ↑ qty_reserved, ↓ qty_available
       └─ StockMove NEUTRAL
  3. POST /levels/picking { node_id, sku_id, qty }
       ├─ ↓ qty_physical, ↓ qty_reserved (consomme FIFO lots)
       └─ StockMove OUT avec lot_id du premier lot consommé
```

### WF-03 — Vente en backorder (rupture autorisée)

```
Stock disponible = 0, is_backorderable = true →
  1. POST /selling-rules/reserve-backorder { node_id, sku_id, qty }
       ├─ ↑ backordered_quantity sur SellingRule
       └─ ↑ qty_backordered sur StockLevel
  2. À la réception du réassort → WF-01
  3. POST /selling-rules/release-backorder
       └─ Décrémente backordered_quantity + déclenche WF-02
```

### WF-04 — Livraison COD (paiement à la livraison)

```
Livreur part →
  POST /levels/cod-delivered { node_id, sku_id, qty }
    └─ ↑ qty_floating_cod (stock flottant chez livreur)

Livreur encaisse →
  POST /levels/cod-collected { node_id, sku_id, qty }
    └─ ↓ qty_floating_cod
```

### WF-05 — Inventaire physique

```
Comptage terrain →
  POST /levels/count { node_id, sku_id, qty_counted }
    ├─ Écrase qty_physical avec qty_counted
    ├─ Recalcule qty_available
    ├─ Met à jour last_counted_at
    └─ StockMove NEUTRAL (opération = ADJ)

Si écart → POST /levels/adjust { node_id, sku_id, delta }
    └─ StockMove ADJ avec raison et éventuel type d'écart
```

### WF-06 — Transfert inter-nœuds

```
POST /levels/move { from_node_id, to_node_id, sku_id, qty }
  ├─ ↓ qty_physical nœud source → StockMove OUT (opération TRF)
  └─ ↑ qty_physical nœud destination → StockMove IN (opération TRF)
```

### WF-07 — Détection et alerte réapprovisionnement

```
Tâche planifiée / action manuelle →
  POST /reorder-rules/detect-critical { node_id? }
    └─ Retourne tous les SKU dont qty_available ≤ reorder_point

  POST /reorder-rules/should-reorder { node_id, sku_id }
    └─ true/false + quantité suggérée = economic_qty

  GET /reorder-rules/suggested-qty?node_id=&sku_id=
    └─ Calcul EOQ avec lead_time_days et safety_stock
```

### WF-08 — Gestion FIFO et expiration

```
Chaque picking →
  fifoConsume(tx, node_id, sku_id, qty_to_consume)
    ├─ SELECT lots ORDER BY received_at ASC
    │   WHERE qty_remaining > 0
    │   AND (expiry_date IS NULL OR expiry_date >= now())
    ├─ Décrémente qty_remaining progressivement
    └─ Retourne { consumed: [{lot_id, consumed, cost_unit}], unmet }

Surveillance expiration →
  GET /lots/alerts?node_id=
    └─ { expired: N, expiring_soon: N, exhausted: N }
```

---

## 6. Référence complète des API

Toutes les routes sous `/api/stock/` :

### Paramétrage

```
GET    /api/stock/move-types
GET    /api/stock/move-types/:id
POST   /api/stock/move-types
PUT    /api/stock/move-types/:id
DELETE /api/stock/move-types/:id

GET    /api/stock/stock-statuses
GET    /api/stock/stock-statuses/:id
POST   /api/stock/stock-statuses
PUT    /api/stock/stock-statuses/:id
DELETE /api/stock/stock-statuses/:id

GET    /api/stock/inventory-types
GET    /api/stock/inventory-types/:id
POST   /api/stock/inventory-types
PUT    /api/stock/inventory-types/:id
DELETE /api/stock/inventory-types/:id

GET    /api/stock/inventory-statuses
GET    /api/stock/inventory-statuses/:id
POST   /api/stock/inventory-statuses
PUT    /api/stock/inventory-statuses/:id
DELETE /api/stock/inventory-statuses/:id

GET    /api/stock/inventory-gap-types
GET    /api/stock/inventory-gap-types/:id
POST   /api/stock/inventory-gap-types
PUT    /api/stock/inventory-gap-types/:id
DELETE /api/stock/inventory-gap-types/:id

GET    /api/stock/thresholds?node_id=
POST   /api/stock/thresholds
POST   /api/stock/thresholds/bulk-save
PUT    /api/stock/thresholds/:id
DELETE /api/stock/thresholds/:id

GET    /api/stock/operations
POST   /api/stock/operations/seed
```

### Suivi — Niveaux de stock

```
GET    /api/stock/levels
GET    /api/stock/levels/by-node/:node_id
GET    /api/stock/levels/:id
POST   /api/stock/levels/receipt
POST   /api/stock/levels/reserve
POST   /api/stock/levels/picking
POST   /api/stock/levels/cancel
POST   /api/stock/levels/incoming
POST   /api/stock/levels/cod-delivered
POST   /api/stock/levels/cod-collected
POST   /api/stock/levels/count
POST   /api/stock/levels/adjust
POST   /api/stock/levels/recalculate
POST   /api/stock/levels/move
```

### Suivi — Règles de vente

```
GET    /api/stock/selling-rules
GET    /api/stock/selling-rules/by-node/:node_id
GET    /api/stock/selling-rules/estimated-delivery?node_id=&sku_id=
GET    /api/stock/selling-rules/:id
POST   /api/stock/selling-rules
POST   /api/stock/selling-rules/bulk-save
POST   /api/stock/selling-rules/can-sell
POST   /api/stock/selling-rules/reserve-backorder
POST   /api/stock/selling-rules/release-backorder
PUT    /api/stock/selling-rules/:id
DELETE /api/stock/selling-rules/:id
```

### Suivi — Règles de réapprovisionnement

```
GET    /api/stock/reorder-rules
GET    /api/stock/reorder-rules/by-node/:node_id
GET    /api/stock/reorder-rules/refs
GET    /api/stock/reorder-rules/suggested-qty?node_id=&sku_id=
GET    /api/stock/reorder-rules/:id
POST   /api/stock/reorder-rules
POST   /api/stock/reorder-rules/bulk-save
POST   /api/stock/reorder-rules/should-reorder
POST   /api/stock/reorder-rules/detect-critical
POST   /api/stock/reorder-rules/detect-overstock
PUT    /api/stock/reorder-rules/:id
DELETE /api/stock/reorder-rules/:id
```

### Suivi — Mouvements (lecture seule)

```
GET    /api/stock/moves?page=&limit=&node_id=&sku_id=&move_type_id=&operation=&date_from=&date_to=
GET    /api/stock/moves/stats?node_id=
GET    /api/stock/moves/:id
```

### Suivi — Lots FIFO

```
GET    /api/stock/lots?node_id=&sku_id=&expiring_soon=&expired=&exhausted=&active=
GET    /api/stock/lots/alerts?node_id=
GET    /api/stock/lots/:id
POST   /api/stock/lots
DELETE /api/stock/lots/:id    ← suppression logique
```

---

*Dernière mise à jour : 2026-05-09 — branche `dev`*

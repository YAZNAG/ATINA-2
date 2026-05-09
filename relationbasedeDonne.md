# Relations Base de Données — Dark Store App

> Toutes les relations du schéma Prisma. Base : PostgreSQL. ORM : Prisma.

---

## Légende

| Symbole | Sens |
|---------|------|
| `1 → N` | Un-à-plusieurs (FK dans la table N) |
| `1 → 1` | Un-à-un (FK unique dans l'une des tables) |
| `N ↔ M` | Plusieurs-à-plusieurs (table de jointure) |
| `CASCADE` | Suppression en cascade |
| `SET NULL` | FK mise à NULL si parent supprimé |
| `RESTRICT` | Suppression bloquée si enfants existent |

---

## 1. Module Auth

### users
| Relation | Table cible | Type | Cardinalité | Cascade |
|----------|-------------|------|-------------|---------|
| `users.id` ← `user_roles.user_id` | user_roles | 1→N | Un user, plusieurs rôles | CASCADE |
| `users.id` ← `regions.created_by` | regions | 1→N | Audit créateur | SET NULL (nullable) |
| `users.id` ← `regions.updated_by` | regions | 1→N | Audit modificateur | SET NULL (nullable) |
| `users.id` ← `regions.deleted_by` | regions | 1→N | Audit suppresseur | SET NULL (nullable) |
| `users.id` ← `app_configs.updated_by` | app_configs | 1→N | Éditeur config | RESTRICT |
| `users.id` ← `packs.created_by` | packs | 1→N | Créateur pack | RESTRICT |
| `users.id` ← `flash_sales.created_by` | flash_sales | 1→N | Créateur flash sale | RESTRICT |
| `users.id` ← `gamification_games.created_by` | gamification_games | 1→N | Créateur jeu | RESTRICT |
| `users.id` ← `referral_config.created_by` | referral_config | 1→N | Créateur config parrainage | RESTRICT |

### roles
| Relation | Table cible | Type | Cardinalité | Cascade |
|----------|-------------|------|-------------|---------|
| `roles.id` ← `user_roles.role_id` | user_roles | 1→N | Un rôle, plusieurs users | CASCADE |
| `roles.id` ← `role_permissions.role_id` | role_permissions | 1→N | Un rôle, plusieurs permissions | CASCADE |

### permissions
| Relation | Table cible | Type | Cardinalité | Cascade |
|----------|-------------|------|-------------|---------|
| `permissions.id` ← `role_permissions.permission_id` | role_permissions | 1→N | Une permission, plusieurs rôles | CASCADE |

### Tables de jointure Auth
| Table | Clé unique composée | Description |
|-------|---------------------|-------------|
| `user_roles` | `(user_id, role_id)` | Affectation rôle ↔ utilisateur |
| `role_permissions` | `(role_id, permission_id)` | Affectation permission ↔ rôle |

---

## 2. Module Catalog

### families
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `families.id` ← `categories.family_id` | categories | 1→N | RESTRICT |
| `families.id` ← `articles.family_id` | articles | 1→N | RESTRICT |

### categories
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `categories.family_id` → `families.id` | families | N→1 | RESTRICT |
| `categories.id` ← `sub_categories.category_id` | sub_categories | 1→N | RESTRICT |
| `categories.id` ← `articles.category_id` | articles | 1→N (nullable) | SET NULL |

### sub_categories
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `sub_categories.category_id` → `categories.id` | categories | N→1 | RESTRICT |
| `sub_categories.id` ← `articles.sub_category_id` | articles | 1→N (nullable) | SET NULL |

### brands
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `brands.id` ← `articles.brand_id` | articles | 1→N (nullable) | SET NULL |

### units
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `units.id` ← `packaging_types.unit_id` | packaging_types | 1→N (nullable) | SET NULL |

### article_types / article_statuses / conservation_types / taxes
Tous ont une relation `1→N` vers `articles` avec `onDelete: SetNull` (FK nullable).

### articles
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `articles.id` ← `article_images.article_id` | article_images | 1→N | CASCADE |
| `articles.sku_uuid` → `skus.id` | skus | 1→1 (nullable) | SET NULL |

### skus
| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `skus.id` ← `sku_images.sku_id` | sku_images | 1→N | CASCADE |
| `skus.id` ← `articles.sku_uuid` | articles | 1→1 (nullable) | — |
| `skus.id` ← `stock_levels.sku_id` | stock_levels | 1→N | CASCADE |
| `skus.id` ← `selling_rules.sku_id` | selling_rules | 1→N | CASCADE |
| `skus.id` ← `reorder_rules.sku_id` | reorder_rules | 1→N | CASCADE |
| `skus.id` ← `sku_node_locations.sku_id` | sku_node_locations | 1→N | CASCADE |
| `skus.id` ← `order_items.sku_id` | order_items | 1→N (nullable) | — |
| `skus.id` ← `pack_items.sku_id` | pack_items | 1→N | CASCADE |
| `skus.id` ← `flash_sales.sku_id` | flash_sales | 1→N (nullable) | — |
| `skus.id` ← `stock_moves.sku_id` | stock_moves | 1→N | CASCADE |
| `skus.id` ← `gamification_prizes.sku_id` | gamification_prizes | 1→N (nullable) | — |
| `skus.id` ← `stock_threshold_rules.sku_id` | stock_threshold_rules | 1→N | CASCADE |

---

## 3. Module Location (Géographie)

### Hiérarchie géographique

```
regions
  └── provinces (region_id → regions.id)
        └── cities (province_id → provinces.id)
```

| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `provinces.region_id` → `regions.id` | regions | N→1 | RESTRICT |
| `cities.province_id` → `provinces.id` | provinces | N→1 | RESTRICT |
| `nodes.region_id` → `regions.id` | regions | N→1 | RESTRICT |
| `nodes.province_id` → `provinces.id` | provinces | N→1 | RESTRICT |
| `nodes.city_id` → `cities.id` | cities | N→1 | RESTRICT |

### Audit regions (User)
| Champ | FK vers | Description |
|-------|---------|-------------|
| `regions.created_by` | `users.id` (nullable) | Qui a créé |
| `regions.updated_by` | `users.id` (nullable) | Qui a modifié |
| `regions.deleted_by` | `users.id` (nullable) | Qui a supprimé (soft delete) |

---

## 4. Module Nodes (Points logistiques)

### node_types → nodes
```
node_types
  └── nodes (node_type_id → node_types.id)
        └── delivery_slots (node_id → nodes.id, CASCADE)
```

| Relation | Cardinalité | Cascade |
|----------|-------------|---------|
| `node_types.id` ← `nodes.node_type_id` | 1→N | RESTRICT |
| `nodes.id` ← `delivery_slots.node_id` | 1→N | CASCADE |
| `delivery_slots.id` ← `orders.confirmed_slot_id` | 1→N (nullable) | — |

### Node est hub central — liste complète de ses dépendances

| Table dépendante | FK | Cascade |
|------------------|----|---------|
| `delivery_slots` | `node_id` | CASCADE |
| `stock_levels` | `node_id` | CASCADE |
| `selling_rules` | `node_id` | CASCADE |
| `reorder_rules` | `node_id` | CASCADE |
| `warehouse_locations (locations)` | `node_id` | CASCADE |
| `sku_node_locations` | `node_id` | CASCADE |
| `orders` | `node_id` | RESTRICT |
| `order_items` | `node_id` | RESTRICT |
| `app_configs` | `node_id` | CASCADE |
| `packs` | `node_id` (nullable) | — |
| `flash_sales` | `node_id` | CASCADE |
| `points_rules` | `node_id` (nullable) | — |
| `gamification_games` | `node_id` (nullable) | — |
| `stock_moves` | `node_id` | CASCADE |
| `tours` | `node_id` (nullable) | — |
| `promotions` | `node_id` (nullable) | — |
| `referral_config` | `node_id` (nullable) | — |
| `stock_threshold_rules` | `node_id` | CASCADE |

---

## 5. Module Warehouse (Entrepôt)

### Hiérarchie localisation entrepôt

```
zones ──────────────────────────────┐
                                    ├── locations (WarehouseLocation)
levels ─────────────────────────────┘         │
                                              └── sku_node_locations
nodes ──────────────────────────────────────────────────────────────
```

| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `locations.zone_id` → `zones.id` | zones | N→1 (nullable) | — |
| `locations.level_id` → `levels.id` | levels | N→1 | RESTRICT |
| `locations.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `locations.id` ← `sku_node_locations.location_id` | locations | 1→N | CASCADE |
| `sku_node_locations.sku_id` → `skus.id` | skus | N→1 | CASCADE |
| `sku_node_locations.node_id` → `nodes.id` | nodes | N→1 | CASCADE |

### Clés uniques composées
| Table | Clé unique |
|-------|-----------|
| `locations` | `(node_id, aisle, shelf, level_id)` |
| `sku_node_locations` | `(sku_id, node_id, location_id)` |

---

## 6. Module Stock

### stock_levels
Pivot central `Node × SKU` — un niveau de stock par nœud logistique et par SKU.

| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `stock_levels.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `stock_levels.sku_id` → `skus.id` | skus | N→1 | CASCADE |

**Clé unique** : `(node_id, sku_id)`

### stock_threshold_rules
| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `stock_threshold_rules.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `stock_threshold_rules.sku_id` → `skus.id` | skus | N→1 | CASCADE |

**Clé unique** : `(node_id, sku_id)`

### selling_rules
| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `selling_rules.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `selling_rules.sku_id` → `skus.id` | skus | N→1 | CASCADE |

**Clé unique** : `(node_id, sku_id)`

### reorder_rules
| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `reorder_rules.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `reorder_rules.sku_id` → `skus.id` | skus | N→1 | CASCADE |
| `reorder_rules.costing_method_id` → `costing_methods.id` | costing_methods | N→1 | RESTRICT |
| `reorder_rules.preferred_supplier_id` → `suppliers.id` | suppliers | N→1 (nullable) | — |

**Clé unique** : `(node_id, sku_id)`

### stock_moves
Journal immuable de tous les mouvements de stock.

| Relation | Table parente | Cardinalité | Cascade |
|----------|--------------|-------------|---------|
| `stock_moves.node_id` → `nodes.id` | nodes | N→1 | CASCADE |
| `stock_moves.sku_id` → `skus.id` | skus | N→1 | CASCADE |
| `stock_moves.move_type_id` → `move_types.id` | move_types | N→1 (nullable) | — |

### Lookups stock (sans FK actives sortantes)
| Table | Rôle |
|-------|------|
| `move_types` | Type de mouvement (entrant, sortant, ajustement…) |
| `stock_statuses` | Statut de stock (disponible, bloqué…) |
| `inventory_types` | Type d'inventaire (total, partiel…) |
| `inventory_statuses` | Statut inventaire (brouillon, validé…) |
| `inventory_gap_types` | Type d'écart inventaire (vol, casse…) |

---

## 7. Module Customers

### Hiérarchie client

```
customers ──┐
            ├── addresses (customer_id → customers.id, CASCADE)
            ├── orders    (customer_id → customers.id, RESTRICT)
            └── customers (referred_by_id → customers.id, auto-jointure)
```

| Relation | Table cible | Cardinalité | Cascade |
|----------|-------------|-------------|---------|
| `customers.id` ← `addresses.customer_id` | addresses | 1→N | CASCADE |
| `customers.id` ← `orders.customer_id` | orders | 1→N | RESTRICT |
| `customers.referred_by_id` → `customers.id` | customers | N→1 (auto-ref) | — |
| `customers.id` ← `referrals.referrer_id` | referrals | 1→N | RESTRICT |
| `customers.id` ← `referrals.referee_id` | referrals | 1→N | RESTRICT |
| `customers.id` ← `gamification_plays.customer_id` | gamification_plays | 1→N | RESTRICT |

---

## 8. Module Orders (Commandes)

### Schéma relationnel complet

```
customers ──────────────────────────────────────────────────────┐
nodes ──────────────────────────────────────────────────────────┤
addresses (nullable) ───────────────────────────────────────────┤
order_statuses ─────────────────────────────────────────────────┤── orders ──┬── order_items
delivery_types ─────────────────────────────────────────────────┤            ├── payments
delivery_slots (confirmed, nullable) ────────────────────────────┤            └── tour_stops
tours (nullable) ───────────────────────────────────────────────┤
promotions (nullable) ──────────────────────────────────────────┘
```

### orders
| Relation | Table parente | FK | Cascade |
|----------|--------------|-----|---------|
| `orders.customer_id` | customers | N→1 | RESTRICT |
| `orders.node_id` | nodes | N→1 | RESTRICT |
| `orders.address_id` (nullable) | addresses | N→1 | — |
| `orders.status_id` | order_statuses | N→1 | RESTRICT |
| `orders.delivery_type_id` | delivery_types | N→1 | RESTRICT |
| `orders.confirmed_slot_id` (nullable) | delivery_slots | N→1 | — |
| `orders.tour_id` (nullable) | tours | N→1 | — |
| `orders.promotion_id` (nullable) | promotions | N→1 | — |
| `orders.id` ← `order_items.order_id` | order_items | 1→N | CASCADE |
| `orders.id` ← `payments.order_id` | payments | 1→N | CASCADE |
| `orders.id` ← `tour_stops.order_id` | tour_stops | 1→N (nullable) | — |
| `orders.id` ← `referrals.qualifying_order_id` | referrals | 1→N (nullable) | — |
| `orders.id` ← `gamification_plays.order_id` | gamification_plays | 1→N (nullable) | — |

### order_items
| Relation | Table parente | FK | Cascade |
|----------|--------------|-----|---------|
| `order_items.order_id` | orders | N→1 | CASCADE |
| `order_items.sku_id` (nullable) | skus | N→1 | — |
| `order_items.status_id` | order_item_statuses | N→1 | RESTRICT |
| `order_items.node_id` | nodes | N→1 | RESTRICT |
| `order_items.parent_item_id` (nullable) | order_items | Auto-ref (lignes pack) | — |
| `order_items.pack_id` (nullable) | packs | N→1 | — |
| `order_items.flash_sale_id` (nullable) | flash_sales | N→1 | — |

### payments
| Relation | Table parente | FK | Cascade |
|----------|--------------|-----|---------|
| `payments.order_id` | orders | N→1 | CASCADE |
| `payments.status_id` | payment_statuses | N→1 | RESTRICT |
| `payments.payment_method_id` (nullable) | payment_methods | N→1 | — |

---

## 9. Module Packs & Flash Sales

### packs
| Relation | Table parente/cible | Cardinalité | Cascade |
|----------|---------------------|-------------|---------|
| `packs.node_id` (nullable) → `nodes.id` | nodes | N→1 | — |
| `packs.created_by` → `users.id` | users | N→1 | RESTRICT |
| `packs.id` ← `pack_items.pack_id` | pack_items | 1→N | CASCADE |
| `packs.id` ← `order_items.pack_id` | order_items | 1→N (nullable) | — |
| `packs.id` ← `flash_sales.pack_id` | flash_sales | 1→N (nullable) | — |

### pack_items (jointure pack × sku avec quantité)
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `pack_items.pack_id` → `packs.id` | packs | CASCADE |
| `pack_items.sku_id` → `skus.id` | skus | CASCADE |

### flash_sales
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `flash_sales.node_id` → `nodes.id` | nodes | CASCADE |
| `flash_sales.sku_id` (nullable) → `skus.id` | skus | — |
| `flash_sales.pack_id` (nullable) → `packs.id` | packs | — |
| `flash_sales.created_by` → `users.id` | users | RESTRICT |
| `flash_sales.id` ← `order_items.flash_sale_id` | order_items | 1→N (nullable) | — |

---

## 10. Module Promotions & Fidélité

### promotions
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `promotions.node_id` (nullable) → `nodes.id` | nodes | — |
| `promotions.promo_type_id` → `promo_types.id` | promo_types | RESTRICT |
| `promotions.id` ← `orders.promotion_id` | orders | 1→N (nullable) | — |

### points_rules
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `points_rules.rule_type_id` → `points_rule_types.id` | points_rule_types | RESTRICT |
| `points_rules.node_id` (nullable) → `nodes.id` | nodes | — |

### referral_config
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `referral_config.node_id` (nullable) → `nodes.id` | nodes | — |
| `referral_config.referrer_reward_type_id` → `reward_types.id` | reward_types | RESTRICT |
| `referral_config.referee_reward_type_id` → `reward_types.id` | reward_types | RESTRICT |
| `referral_config.created_by` → `users.id` | users | RESTRICT |
| `referral_config.id` ← `referrals.config_id` | referrals | 1→N (nullable) | — |

### referrals
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `referrals.referrer_id` → `customers.id` | customers | RESTRICT |
| `referrals.referee_id` → `customers.id` | customers | RESTRICT |
| `referrals.config_id` (nullable) → `referral_config.id` | referral_config | — |
| `referrals.status_id` → `referral_statuses.id` | referral_statuses | RESTRICT |
| `referrals.qualifying_order_id` (nullable) → `orders.id` | orders | — |

**Clé unique** : `(referrer_id, referee_id)`

---

## 11. Module Gamification

```
gamification_games ──┬── gamification_prizes ──── gamification_plays
                     └── gamification_plays
```

### gamification_games
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `gamification_games.node_id` (nullable) → `nodes.id` | nodes | — |
| `gamification_games.game_type_id` → `game_types.id` | game_types | RESTRICT |
| `gamification_games.play_period_id` → `game_play_periods.id` | game_play_periods | RESTRICT |
| `gamification_games.unlock_condition_id` (nullable) → `unlock_conditions.id` | unlock_conditions | — |
| `gamification_games.created_by` → `users.id` | users | RESTRICT |
| `gamification_games.id` ← `gamification_prizes.game_id` | gamification_prizes | 1→N | CASCADE |
| `gamification_games.id` ← `gamification_plays.game_id` | gamification_plays | 1→N | RESTRICT |

### gamification_prizes
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `gamification_prizes.game_id` → `gamification_games.id` | gamification_games | CASCADE |
| `gamification_prizes.prize_type_id` → `prize_types.id` | prize_types | RESTRICT |
| `gamification_prizes.sku_id` (nullable) → `skus.id` | skus | — |
| `gamification_prizes.id` ← `gamification_plays.prize_id` | gamification_plays | 1→N (nullable) | — |

### gamification_plays
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `gamification_plays.customer_id` → `customers.id` | customers | RESTRICT |
| `gamification_plays.game_id` → `gamification_games.id` | gamification_games | RESTRICT |
| `gamification_plays.prize_id` (nullable) → `gamification_prizes.id` | gamification_prizes | — |
| `gamification_plays.order_id` (nullable) → `orders.id` | orders | — |

---

## 12. Module Tours (Livraison)

```
tour_statuses ──── tours ──── tour_stops
nodes (nullable) ──┘             │
                                 ├── orders (nullable)
                                 └── stop_statuses
```

### tours
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `tours.node_id` (nullable) → `nodes.id` | nodes | — |
| `tours.status_id` → `tour_statuses.id` | tour_statuses | RESTRICT |
| `tours.id` ← `tour_stops.tour_id` | tour_stops | 1→N | CASCADE |
| `tours.id` ← `orders.tour_id` | orders | 1→N (nullable) | — |

### tour_stops
| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `tour_stops.tour_id` → `tours.id` | tours | CASCADE |
| `tour_stops.order_id` (nullable) → `orders.id` | orders | — |
| `tour_stops.status_id` → `stop_statuses.id` | stop_statuses | RESTRICT |

---

## 13. app_configs

| Relation | Table parente | Cascade |
|----------|--------------|---------|
| `app_configs.node_id` (nullable) → `nodes.id` | nodes | CASCADE |
| `app_configs.value_type_id` → `config_value_types.id` | config_value_types | RESTRICT |
| `app_configs.updated_by` → `users.id` | users | RESTRICT |

**Clé unique** : `(node_id, config_key)`

---

## Résumé — Tables pivot (clés uniques composées)

| Table | Clé unique composée | Description |
|-------|---------------------|-------------|
| `user_roles` | `(user_id, role_id)` | Un user ne peut avoir le même rôle deux fois |
| `role_permissions` | `(role_id, permission_id)` | Une permission ne peut être assignée qu'une fois par rôle |
| `stock_levels` | `(node_id, sku_id)` | Un seul niveau de stock par nœud × SKU |
| `stock_threshold_rules` | `(node_id, sku_id)` | Un seul seuil par nœud × SKU |
| `selling_rules` | `(node_id, sku_id)` | Une seule règle de vente par nœud × SKU |
| `reorder_rules` | `(node_id, sku_id)` | Une seule règle de réapprovisionnement par nœud × SKU |
| `sku_node_locations` | `(sku_id, node_id, location_id)` | Un SKU dans un emplacement précis d'un nœud |
| `locations` | `(node_id, aisle, shelf, level_id)` | Un emplacement physique unique dans l'entrepôt |
| `referrals` | `(referrer_id, referee_id)` | Un parrain ne peut parrainer le même filleul deux fois |
| `app_configs` | `(node_id, config_key)` | Une clé de config unique par nœud |

---

## Diagramme entité simplifié (groupes fonctionnels)

```
[AUTH]           users ──── user_roles ──── roles ──── role_permissions ──── permissions

[CATALOG]        families → categories → sub_categories → articles → article_images
                 brands / units / taxes / article_types / article_statuses → articles
                 articles 1:1 skus → sku_images

[GEO]            regions → provinces → cities
                                             ↘
[NODES]          node_types → nodes (hub) ─── delivery_slots

[WAREHOUSE]      zones ──┐
                 levels ─┤── warehouse_locations → sku_node_locations ←── skus & nodes
                 nodes ──┘

[STOCK]          nodes × skus → stock_levels (qty)
                 nodes × skus → stock_threshold_rules
                 nodes × skus → selling_rules (backorder)
                 nodes × skus → reorder_rules
                 nodes × skus → stock_moves (journal)

[CUSTOMERS]      customers → addresses / orders / referrals / gamification_plays

[ORDERS]         customers + nodes + statuses → orders → order_items + payments

[PACKS]          packs → pack_items (skus)
[FLASH SALES]    flash_sales → order_items

[PROMOTIONS]     promotions → orders
[FIDÉLITÉ]       points_rules / referral_config → referrals

[GAMIFICATION]   gamification_games → prizes → plays (customers)

[TOURS]          tours → tour_stops → orders
```

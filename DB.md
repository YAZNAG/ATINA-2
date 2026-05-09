# BASE DE DONNÉES — DARK STORE APP
> PostgreSQL · ORM Prisma · Généré le 2026-05-08

---

## SOMMAIRE DES MODULES

| # | Module | Tables |
|---|--------|--------|
| 1 | Auth | users, roles, permissions, role_permissions, user_roles |
| 2 | Catalogue | families, categories, sub_categories, brands, units, packaging_types, conservation_types, article_types, article_statuses, taxes, articles, article_images, skus, sku_images |
| 3 | Géographie | regions, provinces, cities |
| 4 | Noeuds (Nodes) | node_types, nodes, delivery_slots |
| 5 | Entrepôt (Warehouse) | zones, levels, locations, sku_node_locations, suppliers |
| 6 | Stock | stock_operations, move_types, stock_statuses, inventory_types, inventory_statuses, inventory_gap_types, stock_threshold_rules, stock_levels, selling_rules, reorder_rules, stock_moves |
| 7 | Clients | customers, addresses |
| 8 | Commandes | orders, order_items, order_statuses, order_item_statuses, order_slot_statuses, payments, payment_statuses, payment_methods, delivery_types |
| 9 | Livraison | tours, tour_stops, tour_statuses, stop_statuses |
| 10 | Marketing | promotions, promo_types, packs, pack_items, flash_sales, points_rules, points_rule_types |
| 11 | Fidélité | referral_config, referrals, referral_statuses, reward_types |
| 12 | Gamification | gamification_games, gamification_prizes, gamification_plays, game_types, game_play_periods, unlock_conditions, prize_types |
| 13 | Config & Divers | app_configs, config_value_types, costing_methods, wallet_txn_types, notification_channels, notification_statuses, quality_check_types, slot_assignment_sources, picking_statuses, pick_item_statuses, stock_operations |

---

## MODULE 1 — AUTH

### Table : `users`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | Identifiant admin |
| full_name | VARCHAR | NOT NULL | Nom complet |
| email | VARCHAR | UNIQUE NOT NULL | Email de connexion |
| password_hash | VARCHAR | NOT NULL | Hash bcrypt |
| phone | VARCHAR | nullable | Téléphone |
| status | VARCHAR | DEFAULT 'active' | active / inactive |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Date création |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | Date modification |

### Table : `roles`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | Identifiant |
| name | VARCHAR | NOT NULL | Nom du rôle |
| code | VARCHAR | UNIQUE NOT NULL | Code unique |
| description | VARCHAR | nullable | Description |
| status | VARCHAR | DEFAULT 'active' | Statut |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `permissions`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | Identifiant |
| name | VARCHAR | NOT NULL | Nom |
| code | VARCHAR | UNIQUE NOT NULL | ex: stock.manage |
| module | VARCHAR | NOT NULL | Module concerné |
| description | VARCHAR | nullable | Description |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `role_permissions`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| role_id | INT | FK → roles.id CASCADE | |
| permission_id | INT | FK → permissions.id CASCADE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
> Contrainte UNIQUE : (role_id, permission_id)

### Table : `user_roles`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| user_id | INT | FK → users.id CASCADE | |
| role_id | INT | FK → roles.id CASCADE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
> Contrainte UNIQUE : (user_id, role_id)

---

## MODULE 2 — CATALOGUE

### Table : `families`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | Nom français |
| name_ar | VARCHAR | NOT NULL | Nom arabe |
| code | VARCHAR | UNIQUE NOT NULL | Code unique |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| image_path | VARCHAR | nullable | Chemin image |
| icon_path | VARCHAR | nullable | Chemin icône |
| status | VARCHAR | DEFAULT 'active' | |
| sort_order | INT | DEFAULT 0 | Ordre tri |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | Soft delete |

### Table : `categories`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| family_id | INT | FK → families.id | Famille parente |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| image_path | VARCHAR | nullable | |
| icon_path | VARCHAR | nullable | |
| status | VARCHAR | DEFAULT 'active' | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `sub_categories`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| category_id | INT | FK → categories.id | Catégorie parente |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| image_path | VARCHAR | nullable | |
| icon_path | VARCHAR | nullable | |
| status | VARCHAR | DEFAULT 'active' | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `brands`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| logo | VARCHAR | nullable | URL logo |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `units`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | ex: Kilogramme |
| name_ar | VARCHAR | NOT NULL | |
| short_name_fr | VARCHAR | nullable | ex: kg |
| short_name_ar | VARCHAR | nullable | |
| code | VARCHAR | UNIQUE NOT NULL | |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `packaging_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| quantity | DECIMAL(10,3) | nullable | Quantité contenu |
| unit_id | INT | FK → units.id nullable | Unité |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `conservation_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | ex: Réfrigéré |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| min_temperature | DECIMAL(5,2) | nullable | °C minimum |
| max_temperature | DECIMAL(5,2) | nullable | °C maximum |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `article_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `article_statuses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| color | VARCHAR | nullable | Couleur badge |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `taxes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| name_fr | VARCHAR | NOT NULL | ex: TVA 20% |
| name_ar | VARCHAR | NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| rate | DECIMAL(5,2) | NOT NULL | Taux en % |
| status | VARCHAR | DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `articles`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| sku_code | VARCHAR(100) | UNIQUE NOT NULL | Code article |
| ean13 | VARCHAR(13) | UNIQUE nullable | Code-barres |
| name_fr | VARCHAR(255) | NOT NULL | Nom français |
| name_ar | VARCHAR(255) | NOT NULL | Nom arabe |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| brand_id | INT | FK → brands nullable | |
| family_id | INT | FK → families NOT NULL | |
| category_id | INT | FK → categories nullable | |
| sub_category_id | INT | FK → sub_categories nullable | |
| article_type_id | INT | FK → article_types nullable | |
| article_status_id | INT | FK → article_statuses nullable | |
| conservation_type_id | INT | FK → conservation_types nullable | |
| tax_id | INT | FK → taxes nullable | |
| unit_sale | VARCHAR(20) | DEFAULT 'unit' | Unité vente |
| unit_purchase | VARCHAR(20) | DEFAULT 'unit' | Unité achat |
| coeff | DECIMAL(10,4) | DEFAULT 1 | Coefficient |
| price | DECIMAL(12,2) | NOT NULL | Prix HT |
| vat_rate | DECIMAL(5,2) | DEFAULT 20 | TVA % |
| weight_g | INT | nullable | Poids en g |
| volume_ml | INT | nullable | Volume en ml |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | Soft delete |
| deleted_at | TIMESTAMPTZ | nullable | |
| sku_uuid | UUID | UNIQUE nullable FK → skus | Lien SKU logistique |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `article_images`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | INT | PK AUTOINCREMENT | |
| article_id | INT | FK → articles CASCADE | |
| image_path | VARCHAR | NOT NULL | Chemin fichier |
| is_main | BOOLEAN | DEFAULT false | Image principale |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `skus`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() | SKU logistique |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `sku_images`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| sku_id | UUID | FK → skus CASCADE | |
| url | TEXT | NOT NULL | URL image |
| alt_fr | VARCHAR(255) | nullable | |
| alt_ar | VARCHAR(255) | nullable | |
| is_primary | BOOLEAN | DEFAULT false | Image principale |
| sort_order | SMALLINT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

---

## MODULE 3 — GÉOGRAPHIE

### Table : `regions`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR | UNIQUE NOT NULL | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| created_by | INT | FK → users nullable | |
| updated_by | INT | FK → users nullable | |
| deleted_by | INT | FK → users nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
| deleted_at | TIMESTAMPTZ | nullable | |

### Table : `provinces`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| region_id | UUID | FK → regions NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `cities`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| province_id | UUID | FK → provinces NOT NULL | |
| code | VARCHAR | UNIQUE NOT NULL | |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| postal_code | VARCHAR | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 4 — NOEUDS (NODES)

### Table : `node_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR | UNIQUE NOT NULL | ex: DARK_STORE |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| description | TEXT | nullable | |
| icon | VARCHAR | nullable | |
| color_badge | VARCHAR | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `nodes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR | UNIQUE NOT NULL | ex: AGD01 |
| name_fr | VARCHAR | NOT NULL | |
| name_ar | VARCHAR | NOT NULL | |
| node_type_id | UUID | FK → node_types NOT NULL | |
| region_id | UUID | FK → regions NOT NULL | |
| province_id | UUID | FK → provinces NOT NULL | |
| city_id | UUID | FK → cities NOT NULL | |
| address_line1 | VARCHAR | nullable | |
| quartier | VARCHAR | nullable | |
| postal_code | VARCHAR | nullable | |
| lat | DECIMAL(10,7) | nullable | Latitude |
| lng | DECIMAL(10,7) | nullable | Longitude |
| phone | VARCHAR | nullable | |
| timezone | VARCHAR | DEFAULT 'Africa/Casablanca' | |
| delivery_radius_km | DECIMAL(8,2) | nullable | |
| max_daily_orders | INT | nullable | |
| opening_hours_json | JSON | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `delivery_slots`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | |
| name_fr | VARCHAR | NOT NULL | ex: Matin 9h-12h |
| name_ar | VARCHAR | NOT NULL | |
| day_of_week | INT | NOT NULL | 0=Lundi…6=Dimanche |
| slot_start | VARCHAR | NOT NULL | ex: '09:00' |
| slot_end | VARCHAR | NOT NULL | ex: '12:00' |
| max_orders | INT | nullable | Capacité max |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 5 — ENTREPÔT (WAREHOUSE)

### Table : `zones`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: ZONE-A |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| description_fr | TEXT | nullable | |
| description_ar | TEXT | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `levels`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(20) | UNIQUE NOT NULL | ex: L1 |
| name_fr | VARCHAR(100) | NOT NULL | ex: Niveau 1 |
| name_ar | VARCHAR(100) | NOT NULL | |
| sort_order | INT | DEFAULT 0 | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `locations` (warehouse_locations)
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | Entrepôt |
| aisle | VARCHAR(10) | NOT NULL | Allée ex: A |
| shelf | VARCHAR(10) | NOT NULL | Étagère ex: 01 |
| level_id | UUID | FK → levels NOT NULL | Niveau |
| zone_id | UUID | FK → zones nullable | Zone |
| label | VARCHAR(50) | NOT NULL | ex: A-01-L1 |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| deleted_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (node_id, aisle, shelf, level_id)

### Table : `sku_node_locations`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| sku_id | UUID | FK → skus CASCADE | |
| node_id | UUID | FK → nodes CASCADE | |
| location_id | UUID | FK → locations CASCADE | |
| qty_physical | DECIMAL(12,3) | DEFAULT 0 | Qté à cet emplacement |
| is_primary_location | BOOLEAN | DEFAULT false | Emplacement principal |
| is_active | BOOLEAN | DEFAULT true | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (sku_id, node_id, location_id)

### Table : `suppliers`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE nullable | |
| name_fr | VARCHAR(200) | NOT NULL | |
| name_ar | VARCHAR(200) | NOT NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| deleted_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 6 — STOCK

### Table : `stock_operations` (lookup)
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| code | VARCHAR(10) | PK | ex: IN, OUT, ADJUST |
| name_fr | VARCHAR(50) | NOT NULL | |

### Table : `move_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: RECEPTION |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| operation | VARCHAR(10) | NOT NULL | FK logique → stock_operations |
| color | VARCHAR(20) | nullable | Couleur UI |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `stock_statuses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: DISPONIBLE |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| color | VARCHAR(20) | nullable | |
| is_sellable | BOOLEAN | DEFAULT false | Vendable dans cet état |
| is_active | BOOLEAN | DEFAULT true | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `inventory_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: COMPLET |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| scope | VARCHAR(20) | nullable | ex: TOTAL, PARTIEL |
| color | VARCHAR(20) | nullable | |
| description_fr | VARCHAR(255) | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `inventory_statuses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: EN_COURS |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| color | VARCHAR(20) | nullable | |
| description_fr | VARCHAR(255) | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `inventory_gap_types`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(50) | UNIQUE NOT NULL | ex: MANQUANT |
| name_fr | VARCHAR(100) | NOT NULL | |
| name_ar | VARCHAR(100) | NOT NULL | |
| description_fr | VARCHAR(255) | nullable | |
| color | VARCHAR(20) | nullable | |
| impact_stock | VARCHAR(10) | NOT NULL | ex: NEGATIF |
| requires_validation | BOOLEAN | DEFAULT false | |
| is_active | BOOLEAN | DEFAULT true | |
| sort_order | INT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table : `stock_threshold_rules`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | |
| sku_id | UUID | FK → skus CASCADE | |
| stock_minimum | DECIMAL(12,3) | DEFAULT 0 | Seuil rupture |
| stock_alert_threshold | DECIMAL(12,3) | DEFAULT 0 | Seuil alerte |
| stock_maximum | DECIMAL(12,3) | DEFAULT 0 | Seuil surstock |
| reorder_quantity | DECIMAL(12,3) | DEFAULT 0 | Qté réappro |
| auto_restock_enabled | BOOLEAN | DEFAULT false | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (node_id, sku_id)

### Table : `stock_levels` ⭐ CRITIQUE
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | Entrepôt |
| sku_id | UUID | FK → skus CASCADE | SKU |
| qty_physical | DECIMAL(12,3) | DEFAULT 0 | Quantité physique réelle |
| qty_reserved | DECIMAL(12,3) | DEFAULT 0 | Réservé commandes |
| qty_available | DECIMAL(12,3) | DEFAULT 0 | Disponible = physical − reserved |
| qty_backordered | DECIMAL(12,3) | DEFAULT 0 | Commandé sans stock |
| qty_incoming | DECIMAL(12,3) | DEFAULT 0 | En route (PO) |
| qty_floating_cod | DECIMAL(12,3) | DEFAULT 0 | COD livré non encore payé |
| last_move_id | UUID | nullable | Dernier mouvement |
| last_counted_at | TIMESTAMPTZ | nullable | Dernier inventaire |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (node_id, sku_id)

### Table : `selling_rules` ⭐ CRITIQUE
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | Entrepôt |
| sku_id | UUID | FK → skus CASCADE | SKU |
| is_backorderable | BOOLEAN | DEFAULT true | Vente en rupture autorisée |
| backorder_limit | DECIMAL(12,3) | DEFAULT 0 | Limite (0 = illimité) |
| backordered_quantity | DECIMAL(12,3) | DEFAULT 0 | Total vendu en backorder |
| estimated_restock_days | SMALLINT | DEFAULT 1 | Délai réappro en jours |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (node_id, sku_id)

### Table : `reorder_rules`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | |
| sku_id | UUID | FK → skus CASCADE | |
| safety_stock | DECIMAL(12,3) | DEFAULT 0 | Stock de sécurité |
| reorder_point | DECIMAL(12,3) | DEFAULT 0 | Point de réappro |
| economic_qty | DECIMAL(12,3) | DEFAULT 0 | Qté économique |
| max_stock | DECIMAL(12,3) | nullable | Stock maximum |
| lead_time_days | SMALLINT | DEFAULT 1 | Délai fournisseur |
| costing_method_id | UUID | FK → costing_methods | Méthode valorisation |
| preferred_supplier_id | UUID | FK → suppliers nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |
> Contrainte UNIQUE : (node_id, sku_id)

### Table : `stock_moves`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | |
| sku_id | UUID | FK → skus CASCADE | |
| move_type_id | UUID | FK → move_types nullable | |
| qty_delta | DECIMAL(12,3) | NOT NULL | +entrant / −sortant |
| reference | VARCHAR(100) | nullable | Référence doc |
| metadata | JSON | nullable | Données libres |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Horodatage |

---

## MODULE 7 — CLIENTS

### Table : `customers`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| phone_country | VARCHAR(5) | DEFAULT '+212' | Indicatif pays |
| phone_number | VARCHAR(15) | NOT NULL | Numéro |
| phone_verified_at | TIMESTAMPTZ | nullable | Date vérification |
| name | VARCHAR(150) | NOT NULL | Nom client |
| preferred_lang | VARCHAR(5) | DEFAULT 'fr' | |
| referral_code | VARCHAR(20) | UNIQUE NOT NULL | Code parrainage |
| referred_by_id | UUID | FK → customers nullable | Parrain |
| wallet_balance | DECIMAL(12,2) | DEFAULT 0 | Solde wallet MAD |
| points_balance | INT | DEFAULT 0 | Points actuels |
| points_lifetime | INT | DEFAULT 0 | Points cumulés vie |
| city | VARCHAR(100) | nullable | |
| lat | DECIMAL(9,6) | nullable | |
| lng | DECIMAL(9,6) | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| deleted_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `addresses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| customer_id | UUID | FK → customers CASCADE | |
| label | VARCHAR(100) | nullable | ex: Maison, Travail |
| street_number | VARCHAR(20) | nullable | |
| street_name | VARCHAR(255) | NOT NULL | |
| quartier | VARCHAR(100) | nullable | |
| city | VARCHAR(100) | DEFAULT 'Rabat' | |
| postal_code | VARCHAR(5) | nullable | |
| lat | DECIMAL(9,6) | nullable | |
| lng | DECIMAL(9,6) | nullable | |
| delivery_notes | TEXT | nullable | Instructions livraison |
| is_default | BOOLEAN | DEFAULT false | |
| is_deleted | BOOLEAN | DEFAULT false | |
| deleted_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 8 — COMMANDES

### Table : `order_statuses` (lookup)
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| code | VARCHAR UNIQUE | ex: PENDING, CONFIRMED, CANCELLED |
| name_fr | VARCHAR | |
| name_ar | VARCHAR | |
| is_terminal | BOOLEAN | Statut final |
| sort_order | SMALLINT | |

### Table : `order_item_statuses` (lookup)
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| code | VARCHAR UNIQUE | |
| name_fr / name_ar | VARCHAR | |

### Table : `delivery_types` (lookup)
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| code | VARCHAR UNIQUE | ex: EXPRESS, STANDARD |
| name_fr / name_ar | VARCHAR | |

### Table : `payment_statuses` / `payment_methods` (lookups)
Standard : id UUID PK, code VARCHAR UNIQUE, name_fr, name_ar

### Table : `orders` ⭐ CENTRALE
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| customer_id | UUID | FK → customers | |
| node_id | UUID | FK → nodes | Entrepôt origine |
| address_id | UUID | FK → addresses nullable | |
| tour_id | UUID | FK → tours nullable | |
| promotion_id | UUID | FK → promotions nullable | |
| status_id | UUID | FK → order_statuses | |
| delivery_type_id | UUID | FK → delivery_types | |
| confirmed_slot_id | UUID | FK → delivery_slots nullable | |
| slot_start | TIMESTAMPTZ | nullable | Créneau début |
| slot_end | TIMESTAMPTZ | nullable | Créneau fin |
| currency | VARCHAR(3) | DEFAULT 'MAD' | |
| subtotal_ht | DECIMAL(12,2) | DEFAULT 0 | |
| vat_amount | DECIMAL(12,2) | DEFAULT 0 | |
| delivery_fee | DECIMAL(12,2) | DEFAULT 0 | |
| discount_amount | DECIMAL(12,2) | DEFAULT 0 | |
| wallet_used | DECIMAL(12,2) | DEFAULT 0 | |
| total_ttc | DECIMAL(12,2) | DEFAULT 0 | |
| cod_amount | DECIMAL(12,2) | nullable | Montant COD |
| cod_collected_at | TIMESTAMPTZ | nullable | Date collecte espèces |
| points_earned | INT | DEFAULT 0 | Points gagnés |
| notes | TEXT | nullable | |
| cancelled_reason | TEXT | nullable | |
| is_deleted | BOOLEAN | DEFAULT false | |
| deleted_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `order_items`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| order_id | UUID | FK → orders CASCADE | |
| sku_id | UUID | FK → skus nullable | SKU article |
| pack_id | UUID | FK → packs nullable | Pack |
| parent_item_id | UUID | FK → order_items nullable | Ligne parent (pack) |
| flash_sale_id | UUID | FK → flash_sales nullable | |
| status_id | UUID | FK → order_item_statuses | |
| qty | DECIMAL(10,3) | NOT NULL | |
| unit_price_sold | DECIMAL(12,2) | NOT NULL | Prix au moment vente |
| discount_amount | DECIMAL(12,2) | DEFAULT 0 | |
| qty_backordered | DECIMAL(10,3) | DEFAULT 0 | Qté en backorder |
| vat_rate | DECIMAL(5,2) | DEFAULT 20 | |
| node_id | UUID | FK → nodes | |

### Table : `payments`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| order_id | UUID | FK → orders CASCADE | |
| status_id | UUID | FK → payment_statuses | |
| payment_method_id | UUID | FK → payment_methods nullable | |
| amount | DECIMAL(12,2) | NOT NULL | |
| currency | VARCHAR(3) | DEFAULT 'MAD' | |
| metadata | JSON | nullable | Données gateway |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 9 — LIVRAISON (TOURNÉES)

### Table : `tour_statuses` / `stop_statuses` (lookups)
Standard : id UUID PK, code VARCHAR UNIQUE, name_fr, name_ar

### Table : `tours`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes nullable | |
| status_id | UUID | FK → tour_statuses | |
| planned_at | TIMESTAMPTZ | nullable | Date planifiée |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `tour_stops`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| tour_id | UUID | FK → tours CASCADE | |
| order_id | UUID | FK → orders nullable | |
| status_id | UUID | FK → stop_statuses | |
| sort_order | SMALLINT | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

---

## MODULE 10 — MARKETING

### Table : `packs`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes nullable | |
| name_fr / name_ar | VARCHAR(255) | NOT NULL | |
| description_fr / description_ar | TEXT | nullable | |
| image_url | TEXT | nullable | |
| total_price | DECIMAL(12,2) | NOT NULL | Prix pack |
| original_price | DECIMAL(12,2) | NOT NULL | Prix sans promo |
| discount_pct | DECIMAL(5,2) | nullable | % remise |
| valid_from / valid_to | TIMESTAMPTZ | nullable | Validité |
| is_active | BOOLEAN | DEFAULT true | |
| is_deleted | BOOLEAN | DEFAULT false | |
| created_by | INT | FK → users | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `pack_items`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| pack_id | UUID | FK → packs CASCADE | |
| sku_id | UUID | FK → skus CASCADE | |
| qty | DECIMAL(10,3) | DEFAULT 1 | |
| unit_price_in_pack | DECIMAL(12,2) | NOT NULL | |
| sort_order | SMALLINT | DEFAULT 0 | |

### Table : `flash_sales`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes CASCADE | |
| sku_id | UUID | FK → skus nullable | |
| pack_id | UUID | FK → packs nullable | |
| name_fr / name_ar | VARCHAR(255) | nullable | |
| flash_price | DECIMAL(12,2) | NOT NULL | Prix flash |
| stock_flash | INT | NOT NULL | Stock alloué |
| sold_count | INT | DEFAULT 0 | |
| max_qty_per_user | SMALLINT | DEFAULT 1 | |
| starts_at / ends_at | TIMESTAMPTZ | NOT NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| created_by | INT | FK → users | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `promotions`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes nullable | |
| promo_type_id | UUID | FK → promo_types | |
| code | VARCHAR(50) | UNIQUE NOT NULL | Code promo |
| value | DECIMAL(12,2) | NOT NULL | Valeur remise |
| min_order_amount | DECIMAL(12,2) | DEFAULT 0 | |
| uses_max | INT | nullable | Utilisations max |
| uses_count | INT | DEFAULT 0 | |
| uses_per_user_max | SMALLINT | DEFAULT 1 | |
| valid_from / valid_to | TIMESTAMPTZ | NOT NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `points_rules`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| rule_type_id | UUID | FK → points_rule_types | |
| node_id | UUID | FK → nodes nullable | |
| category_id | UUID | nullable | |
| points_value | INT | NOT NULL | Points attribués |
| per_mad_spent | DECIMAL(5,2) | nullable | Points/MAD |
| min_order_amount | DECIMAL(12,2) | DEFAULT 0 | |
| valid_from | TIMESTAMPTZ | NOT NULL | |
| valid_to | TIMESTAMPTZ | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

---

## MODULE 11 — FIDÉLITÉ & PARRAINAGE

### Table : `referral_config`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes nullable | |
| referrer_reward_type_id | UUID | FK → reward_types | |
| referrer_reward_value | DECIMAL(12,2) | NOT NULL | |
| referee_reward_type_id | UUID | FK → reward_types | |
| referee_reward_value | DECIMAL(12,2) | NOT NULL | |
| min_order_amount | DECIMAL(12,2) | DEFAULT 0 | |
| max_referrals_per_user | SMALLINT | nullable | |
| valid_from | TIMESTAMPTZ | NOT NULL | |
| valid_to | TIMESTAMPTZ | nullable | |
| is_active | BOOLEAN | DEFAULT true | |
| created_by | INT | FK → users | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `referrals`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| referrer_id | UUID | FK → customers | Parrain |
| referee_id | UUID | FK → customers | Filleul |
| config_id | UUID | FK → referral_config nullable | |
| status_id | UUID | FK → referral_statuses | |
| qualifying_order_id | UUID | FK → orders nullable | |
| reward_amount | DECIMAL(12,2) | nullable | |
| validated_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
> Contrainte UNIQUE : (referrer_id, referee_id)

---

## MODULE 12 — GAMIFICATION

### Table : `gamification_games`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| node_id | UUID | FK → nodes nullable | |
| game_type_id | UUID | FK → game_types | |
| play_period_id | UUID | FK → game_play_periods | |
| unlock_condition_id | UUID | FK → unlock_conditions nullable | |
| name_fr / name_ar | VARCHAR(255) | NOT NULL | |
| max_plays_per_user | SMALLINT | DEFAULT 1 | |
| unlock_min_amount | DECIMAL(12,2) | nullable | |
| starts_at / ends_at | TIMESTAMPTZ | | |
| is_active | BOOLEAN | DEFAULT true | |
| created_by | INT | FK → users | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | AUTOUPDATE | |

### Table : `gamification_prizes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| game_id | UUID | FK → gamification_games CASCADE | |
| prize_type_id | UUID | FK → prize_types | |
| name_fr / name_ar | VARCHAR(150) | NOT NULL | |
| value | DECIMAL(12,2) | nullable | |
| sku_id | UUID | FK → skus nullable | |
| probability_weight | DECIMAL(8,4) | NOT NULL | |
| stock_limit | INT | nullable | |
| awarded_count | INT | DEFAULT 0 | |
| sort_order | SMALLINT | DEFAULT 0 | |
| is_active | BOOLEAN | DEFAULT true | |

### Table : `gamification_plays`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | UUID | PK | |
| customer_id | UUID | FK → customers | |
| game_id | UUID | FK → gamification_games | |
| prize_id | UUID | FK → gamification_prizes nullable | |
| order_id | UUID | FK → orders nullable | |
| result | VARCHAR(10) | NOT NULL | WIN / LOSE |
| played_at | TIMESTAMPTZ | DEFAULT NOW() | |
| claimed_at | TIMESTAMPTZ | nullable | |
| expires_at | TIMESTAMPTZ | nullable | |

---

## MODULE 13 — CONFIG & LOOKUPS DIVERS

| Table | Description |
|-------|-------------|
| `app_configs` | Configuration par node (clé/valeur typée) |
| `config_value_types` | Types de valeurs config (string, int, bool…) |
| `costing_methods` | Méthodes valorisation stock (FIFO, CUMP…) |
| `wallet_txn_types` | Types transactions wallet (CREDIT, DEBIT) |
| `notification_channels` | Canaux notif (SMS, PUSH, EMAIL) |
| `notification_statuses` | Statuts livraison notifs |
| `quality_check_types` | Types contrôle qualité |
| `slot_assignment_sources` | Sources affectation créneau |
| `picking_statuses` | Statuts picking |
| `pick_item_statuses` | Statuts lignes picking |
| `promo_types` | Types promotion (PERCENT, FIXED…) |
| `points_rule_types` | Types règles points |
| `reward_types` | Types récompenses parrainage |
| `prize_types` | Types lots gamification |
| `game_types` | Types jeux (ROUE, GRATTAGE…) |
| `game_play_periods` | Périodes jeu |
| `unlock_conditions` | Conditions déverrouillage jeu |
| `order_slot_statuses` | Statuts créneaux commandes |

---

*Fichier généré automatiquement — Dark Store App — 2026-05-08*

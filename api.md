# API Documentation — Dark Store App

> Base URL : `http://localhost:5000/api`  
> Auth : Bearer token (JWT) — requis sur toutes les routes sauf `/auth/login`  
> Format : JSON (`Content-Type: application/json`)

---

## Conventions

| Statut | Sens |
|--------|------|
| `200` | Succès GET/PUT |
| `201` | Ressource créée |
| `400` | Validation échouée / token manquant |
| `401` | Token invalide |
| `403` | Permission refusée |
| `404` | Ressource introuvable |
| `409` | Conflit (doublon) |
| `500` | Erreur serveur |

Les permissions sont vérifiées après authentification. Chaque route indique la permission requise.

---

## 1. Auth

Base : `/api/auth`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `POST` | `/login` | — | Connexion — retourne `{ token, user }` |
| `GET` | `/me` | Connecté | Profil utilisateur courant |
| `POST` | `/logout` | Connecté | Déconnexion (invalide le token) |

### Corps POST /login
```json
{ "email": "string", "password": "string" }
```

---

## 2. Users (Utilisateurs)

Base : `/api/users`  
Permission requise : `users.*`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `users.view` | Liste des utilisateurs |
| `POST` | `/` | `users.create` | Créer un utilisateur |
| `GET` | `/:id` | `users.view` | Détail utilisateur |
| `PUT` | `/:id` | `users.update` | Modifier un utilisateur |
| `DELETE` | `/:id` | `users.delete` | Supprimer un utilisateur |

### Corps POST/PUT
```json
{
  "full_name": "string",
  "email": "string",
  "password": "string",
  "phone": "string (optionnel)",
  "status": "active|inactive"
}
```

---

## 3. Roles

Base : `/api/roles`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `roles.view` | Liste des rôles |
| `POST` | `/` | `roles.create` | Créer un rôle |
| `GET` | `/:id` | `roles.view` | Détail rôle |
| `PUT` | `/:id` | `roles.update` | Modifier un rôle |
| `DELETE` | `/:id` | `roles.delete` | Supprimer un rôle |
| `GET` | `/:id/permissions` | `permissions.view` | Permissions du rôle |
| `POST` | `/:id/permissions` | `permissions.assign` | Assigner des permissions |

### Corps POST /:id/permissions
```json
{ "permission_ids": [1, 2, 3] }
```

---

## 4. Permissions

Base : `/api/permissions`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `permissions.view` | Liste toutes les permissions |

---

## 5. Catalog — Familles

Base : `/api/catalog/families`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `families.view` | Liste (paginée, filtrable) |
| `POST` | `/` | `families.create` | Créer (multipart/form-data, image) |
| `GET` | `/:id` | `families.view` | Détail |
| `PUT` | `/:id` | `families.update` | Modifier |
| `DELETE` | `/:id` | `families.delete` | Supprimer (soft) |

---

## 6. Catalog — Catégories

Base : `/api/catalog/categories`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `categories.view` | Liste |
| `POST` | `/` | `categories.create` | Créer |
| `GET` | `/:id` | `categories.view` | Détail |
| `PUT` | `/:id` | `categories.update` | Modifier |
| `DELETE` | `/:id` | `categories.delete` | Supprimer |

---

## 7. Catalog — Sous-catégories

Base : `/api/catalog/sub-categories`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `categories.view` | Liste |
| `POST` | `/` | `categories.create` | Créer |
| `GET` | `/:id` | `categories.view` | Détail |
| `PUT` | `/:id` | `categories.update` | Modifier |
| `DELETE` | `/:id` | `categories.delete` | Supprimer |

---

## 8. Catalog — Marques

Base : `/api/catalog/brands`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `brands.view` | Liste |
| `POST` | `/` | `brands.create` | Créer |
| `GET` | `/:id` | `brands.view` | Détail |
| `PUT` | `/:id` | `brands.update` | Modifier |
| `DELETE` | `/:id` | `brands.delete` | Supprimer |

---

## 9. Catalog — Unités

Base : `/api/catalog/units`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `units.view` | Liste |
| `POST` | `/` | `units.create` | Créer |
| `GET` | `/:id` | `units.view` | Détail |
| `PUT` | `/:id` | `units.update` | Modifier |
| `DELETE` | `/:id` | `units.delete` | Supprimer |

---

## 10. Catalog — Types conditionnement

Base : `/api/catalog/packaging-types`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | Connecté | Liste |
| `POST` | `/` | Connecté | Créer |
| `GET` | `/:id` | Connecté | Détail |
| `PUT` | `/:id` | Connecté | Modifier |
| `DELETE` | `/:id` | Connecté | Supprimer |

---

## 11. Catalog — Types conservation

Base : `/api/catalog/conservation-types`

Standard CRUD — même pattern que packaging-types.

---

## 12. Catalog — Types article

Base : `/api/catalog/article-types`

Standard CRUD.

---

## 13. Catalog — Statuts article

Base : `/api/catalog/article-statuses`

Standard CRUD.

---

## 14. Catalog — Taxes / TVA

Base : `/api/catalog/taxes`

Standard CRUD.

---

## 15. Catalog — Articles

Base : `/api/catalog/articles`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `articles.view` | Liste (filtres : famille, catégorie, statut) |
| `POST` | `/` | `articles.create` | Créer un article |
| `GET` | `/:id` | `articles.view` | Détail complet |
| `PUT` | `/:id` | `articles.update` | Modifier |
| `DELETE` | `/:id` | `articles.delete` | Supprimer (soft) |

### Corps POST/PUT (principaux champs)
```json
{
  "sku_code": "string (unique)",
  "ean13": "string (13 chiffres, optionnel)",
  "name_fr": "string",
  "name_ar": "string",
  "family_id": "integer",
  "category_id": "integer (optionnel)",
  "sub_category_id": "integer (optionnel)",
  "brand_id": "integer (optionnel)",
  "price": "decimal",
  "vat_rate": "decimal (défaut: 20)"
}
```

---

## 16. Catalog — Images article

Base : `/api/catalog/articles/:articleId/images`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `articles.view` | Images de l'article |
| `POST` | `/` | `articles.create / sku_images.create` | Ajouter image(s) (multipart) |
| `PATCH` | `/:imageId/primary` | `articles.update` | Définir image principale |
| `PATCH` | `/:imageId/sort` | `articles.update` | Modifier l'ordre |
| `DELETE` | `/:imageId` | `articles.delete` | Supprimer image |

---

## 17. Catalog — SKUs

Base : `/api/catalog/skus`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `skus.view` | Liste des SKUs |
| `POST` | `/` | `skus.create` | Créer un SKU |
| `GET` | `/:id` | `skus.view` | Détail SKU (UUID) |
| `DELETE` | `/:id` | `skus.delete` | Supprimer SKU |

---

## 18. Catalog — Images SKU

Base : `/api/catalog/sku-images`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `sku_images.view` | Liste |
| `POST` | `/` | `sku_images.create` | Créer |
| `GET` | `/:id` | `sku_images.view` | Détail |
| `PUT` | `/:id` | `sku_images.update` | Modifier |
| `DELETE` | `/:id` | `sku_images.delete` | Supprimer |

---

## 19. Location — Régions

Base : `/api/regions`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `regions.view` | Liste (filtre : is_active) |
| `POST` | `/` | `regions.create` | Créer une région |
| `GET` | `/:id` | `regions.view` | Détail |
| `PUT` | `/:id` | `regions.update` | Modifier |
| `DELETE` | `/:id` | `regions.delete` | Supprimer (soft) |

### Corps POST/PUT
```json
{
  "code": "string (unique)",
  "name_fr": "string",
  "name_ar": "string",
  "description_fr": "string (optionnel)",
  "is_active": "boolean"
}
```

---

## 20. Location — Provinces

Base : `/api/provinces`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `provinces.view` | Liste (filtre : region_id) |
| `POST` | `/` | `provinces.create` | Créer |
| `GET` | `/:id` | `provinces.view` | Détail |
| `PUT` | `/:id` | `provinces.update` | Modifier |
| `DELETE` | `/:id` | `provinces.delete` | Supprimer |

---

## 21. Location — Villes

Base : `/api/cities`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `cities.view` | Liste (filtre : province_id) |
| `POST` | `/` | `cities.create` | Créer |
| `GET` | `/:id` | `cities.view` | Détail |
| `PUT` | `/:id` | `cities.update` | Modifier |
| `DELETE` | `/:id` | `cities.delete` | Supprimer |

---

## 22. Nodes — Types de nœud

Base : `/api/node-types`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/active` | `node_types.view` | Liste des types actifs uniquement |
| `GET` | `/` | `node_types.view` | Liste complète |
| `POST` | `/` | `node_types.create` | Créer |
| `GET` | `/:id` | `node_types.view` | Détail |
| `PUT` | `/:id` | `node_types.update` | Modifier |
| `DELETE` | `/:id` | `node_types.delete` | Supprimer |

---

## 23. Nodes — Nœuds logistiques

Base : `/api/nodes`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `nodes.view` | Liste (filtres : region_id, node_type_id, is_active) |
| `POST` | `/` | `nodes.create` | Créer un nœud |
| `GET` | `/:id` | `nodes.view` | Détail complet |
| `PUT` | `/:id` | `nodes.update` | Modifier |
| `DELETE` | `/:id` | `nodes.delete` | Supprimer |

### Corps POST/PUT (principaux champs)
```json
{
  "code": "string (unique)",
  "name_fr": "string",
  "name_ar": "string",
  "node_type_id": "uuid",
  "region_id": "uuid",
  "province_id": "uuid",
  "city_id": "uuid",
  "address_line1": "string (optionnel)",
  "lat": "decimal (optionnel)",
  "lng": "decimal (optionnel)",
  "is_active": "boolean"
}
```

---

## 24. Nodes — Créneaux de livraison

Base : `/api/nodes/:id/slots` et `/api/slots/:id`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/nodes/:id/slots` | `delivery_slots.view` | Créneaux du nœud |
| `POST` | `/nodes/:id/slots` | `delivery_slots.create` | Ajouter un créneau |
| `PUT` | `/slots/:id` | `delivery_slots.update` | Modifier un créneau |
| `DELETE` | `/slots/:id` | `delivery_slots.delete` | Supprimer un créneau |

---

## 25. Warehouse — Zones

Base : `/api/warehouse/zones`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `warehouse.view` | Liste des zones |
| `POST` | `/` | `warehouse.manage` | Créer une zone |
| `GET` | `/:id` | `warehouse.view` | Détail |
| `PUT` | `/:id` | `warehouse.manage` | Modifier |
| `DELETE` | `/:id` | `warehouse.manage` | Supprimer |

---

## 26. Warehouse — Niveaux (étagères)

Base : `/api/warehouse/levels`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `warehouse.view` | Liste |
| `POST` | `/` | `warehouse.manage` | Créer |
| `GET` | `/:id` | `warehouse.view` | Détail |
| `PUT` | `/:id` | `warehouse.manage` | Modifier |
| `DELETE` | `/:id` | `warehouse.manage` | Supprimer |

---

## 27. Warehouse — Emplacements

Base : `/api/warehouse/locations`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `warehouse.view` | Liste (filtre : node_id) |
| `POST` | `/` | `warehouse.manage` | Créer un emplacement |
| `POST` | `/bulk-generate` | `warehouse.manage` | Générer en masse |
| `GET` | `/:id` | `warehouse.view` | Détail |
| `PUT` | `/:id` | `warehouse.manage` | Modifier |
| `DELETE` | `/:id` | `warehouse.manage` | Supprimer |

---

## 28. Warehouse — Emplacements SKU (sku_node_locations)

Base : `/api/warehouse/sku-locations`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `warehouse.view` | Liste (filtre : node_id, sku_id) |
| `POST` | `/` | `warehouse.manage` | Assigner un SKU à un emplacement |
| `GET` | `/:id` | `warehouse.view` | Détail |
| `PUT` | `/:id` | `warehouse.manage` | Modifier |
| `DELETE` | `/:id` | `warehouse.manage` | Supprimer |

---

## 29. Customers (Clients)

Base : `/api/customers`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `customers.view` | Liste des clients (paginée, filtre : phone, name) |
| `GET` | `/:id` | `customers.view` | Détail client + adresses + historique commandes |

---

## 30. P0 — Accès direct aux tables (mode debug)

Base : `/api/p0`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/registry` | `p0.view` | Registre de toutes les tables |
| `GET` | `/table/:sql` | `p0.view` | Données brutes d'une table (nom SQL) |
| `GET` | `/relations` | `p0.view` | Toutes les relations |
| `GET` | `/relations/:sql` | `p0.view` | Relations d'une table |
| `GET` | `/crud/refs/:sql/options` | `p0.crud` | Options FK pour formulaire |
| `GET` | `/crud/:sql/meta` | `p0.crud` | Méta-données colonnes |
| `GET` | `/crud/:sql` | `p0.crud` | Liste CRUD d'une table |
| `POST` | `/crud/:sql` | `p0.crud` | Créer un enregistrement |
| `GET` | `/crud/:sql/:id` | `p0.crud` | Un enregistrement |
| `PUT` | `/crud/:sql/:id` | `p0.crud` | Modifier |
| `DELETE` | `/crud/:sql/:id` | `p0.crud` | Supprimer |

---

## 31. Stock — Types de mouvement

Base : `/api/stock/move-types`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `stock.view` | Liste (param `all=true` pour liste complète sans pagination) |
| `POST` | `/` | `stock.manage` | Créer |
| `GET` | `/:id` | `stock.view` | Détail |
| `PUT` | `/:id` | `stock.manage` | Modifier |
| `DELETE` | `/:id` | `stock.manage` | Supprimer |

### Corps POST/PUT
```json
{
  "code": "string (unique)",
  "name_fr": "string",
  "name_ar": "string",
  "operation": "IN|OUT|ADJUST",
  "color": "string CSS (optionnel)"
}
```

---

## 32. Stock — Statuts de stock

Base : `/api/stock/stock-statuses`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `stock.view` | Liste |
| `POST` | `/` | `stock.manage` | Créer |
| `GET` | `/:id` | `stock.view` | Détail |
| `PUT` | `/:id` | `stock.manage` | Modifier |
| `DELETE` | `/:id` | `stock.manage` | Supprimer |

---

## 33. Stock — Types d'inventaire

Base : `/api/stock/inventory-types`

Standard CRUD — permission `stock.view` / `stock.manage`.

---

## 34. Stock — Statuts d'inventaire

Base : `/api/stock/inventory-statuses`

Standard CRUD — permission `stock.view` / `stock.manage`.

---

## 35. Stock — Types d'écart inventaire

Base : `/api/stock/inventory-gap-types`

Standard CRUD — permission `stock.view` / `stock.manage`.

---

## 36. Stock — Règles de seuil (Thresholds)

Base : `/api/stock/thresholds`

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `stock.view` | Liste par nœud (param `node_id` requis) |
| `POST` | `/bulk-save` | `stock.manage` | Sauvegarder plusieurs seuils en une fois |
| `POST` | `/` | `stock.manage` | Créer une règle de seuil |
| `PUT` | `/:id` | `stock.manage` | Modifier |
| `DELETE` | `/:id` | `stock.manage` | Supprimer |

### Corps POST /bulk-save
```json
{
  "node_id": "uuid",
  "rows": [
    {
      "sku_id": "uuid",
      "stock_minimum": 5,
      "stock_alert_threshold": 10,
      "stock_maximum": 100,
      "reorder_quantity": 50,
      "auto_restock_enabled": false
    }
  ]
}
```

---

## 37. Stock — Niveaux de stock

Base : `/api/stock/levels`

### Lectures

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `stock.view` | Liste filtrée (params ci-dessous) |
| `GET` | `/by-node/:node_id` | `stock.view` | Tous les niveaux d'un nœud |
| `GET` | `/:id` | `stock.view` | Détail d'un niveau |

### Paramètres GET /
| Paramètre | Type | Description |
|-----------|------|-------------|
| `node_id` | uuid | Filtrer par nœud |
| `sku_id` | uuid | Filtrer par SKU |
| `category_id` | integer | Filtrer par catégorie article |
| `out_of_stock` | boolean | Uniquement ruptures |
| `low_stock` | boolean | Uniquement stocks faibles |
| `backordered` | boolean | Avec backorders en cours |
| `has_incoming` | boolean | Avec stock entrant prévu |
| `has_cod` | boolean | Avec COD flottant |

### Opérations de stock (mutations)

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `POST` | `/receipt` | `stock.manage` | Réception marchandise |
| `POST` | `/reserve` | `stock.manage` | Réserver pour commande |
| `POST` | `/picking` | `stock.manage` | Picking (déduction physique) |
| `POST` | `/cancel` | `stock.manage` | Annuler réservation |
| `POST` | `/incoming` | `stock.manage` | Mettre à jour stock entrant |
| `POST` | `/cod-delivered` | `stock.manage` | Livraison COD effectuée |
| `POST` | `/cod-collected` | `stock.manage` | Encaissement COD |
| `POST` | `/count` | `stock.manage` | Marquer comptage inventaire |
| `POST` | `/adjust` | `stock.manage` | Ajustement manuel |
| `POST` | `/recalculate` | `stock.manage` | Recalculer qty_available |
| `POST` | `/move` | `stock.manage` | Appliquer un mouvement brut |

### Corps POST /receipt
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "qty": 50,
  "move_type_id": "uuid (optionnel)",
  "reference": "string (optionnel)"
}
```

### Corps POST /reserve
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "qty": 2
}
```

### Corps POST /adjust
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "qty_physical": 45,
  "reason": "string (optionnel)"
}
```

---

## 38. Stock — Règles de vente (Selling Rules)

Base : `/api/stock/selling-rules`

### Lectures

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `GET` | `/` | `stock.view` | Liste filtrée (params : node_id, sku_id) |
| `GET` | `/by-node/:node_id` | `stock.view` | Toutes les règles d'un nœud enrichies (+ qty_available) |
| `GET` | `/estimated-delivery` | `stock.view` | Date de livraison estimée (params : node_id, sku_id) |
| `GET` | `/:id` | `stock.view` | Détail d'une règle |

### Mutations

| Méthode | Endpoint | Permission | Description |
|---------|----------|-----------|-------------|
| `POST` | `/can-sell` | `stock.view` | Vérifier si un SKU est vendable |
| `POST` | `/reserve-backorder` | `stock.manage` | Incrémenter compteur backorder |
| `POST` | `/release-backorder` | `stock.manage` | Décrémenter compteur backorder |
| `POST` | `/` | `stock.manage` | Créer ou mettre à jour (upsert) |
| `PUT` | `/:id` | `stock.manage` | Modifier une règle existante |
| `DELETE` | `/:id` | `stock.manage` | Supprimer |

### Corps POST /can-sell
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "requested_qty": 2
}
```

### Réponse POST /can-sell
```json
{
  "allowed": true,
  "reason": "in_stock | backorder | out_of_stock | backorder_limit_reached",
  "estimated_delivery_date": "2026-05-15T00:00:00Z | null"
}
```

### Corps POST /reserve-backorder
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "qty": 1
}
```

### Corps POST / (upsert)
```json
{
  "node_id": "uuid",
  "sku_id": "uuid",
  "is_backorderable": true,
  "backorder_limit": 50,
  "estimated_restock_days": 3
}
```

---

## Résumé des modules et préfixes

| Module | Préfixe | Description |
|--------|---------|-------------|
| Auth | `/api/auth` | Connexion, profil |
| Users | `/api/users` | Gestion utilisateurs admin |
| Roles | `/api/roles` | Gestion des rôles |
| Permissions | `/api/permissions` | Liste des permissions |
| Catalog | `/api/catalog/...` | Familles, catégories, articles, SKUs, images |
| Regions | `/api/regions` | Régions géographiques |
| Provinces | `/api/provinces` | Provinces |
| Cities | `/api/cities` | Villes |
| Node Types | `/api/node-types` | Types de nœuds logistiques |
| Nodes | `/api/nodes` | Nœuds (entrepôts, dark stores…) |
| Delivery Slots | `/api/nodes/:id/slots` | Créneaux de livraison |
| Warehouse Zones | `/api/warehouse/zones` | Zones entrepôt |
| Warehouse Levels | `/api/warehouse/levels` | Niveaux étagères |
| Warehouse Locations | `/api/warehouse/locations` | Emplacements physiques |
| SKU Locations | `/api/warehouse/sku-locations` | Assignation SKU × emplacement |
| Customers | `/api/customers` | Clients de l'app |
| P0 | `/api/p0` | Debug / accès direct tables |
| Move Types | `/api/stock/move-types` | Types de mouvements stock |
| Stock Statuses | `/api/stock/stock-statuses` | Statuts de stock |
| Inventory Types | `/api/stock/inventory-types` | Types d'inventaire |
| Inventory Statuses | `/api/stock/inventory-statuses` | Statuts inventaire |
| Inventory Gap Types | `/api/stock/inventory-gap-types` | Types d'écarts inventaire |
| Thresholds | `/api/stock/thresholds` | Règles de seuil (min/max/alerte) |
| Stock Levels | `/api/stock/levels` | Niveaux de stock + opérations |
| Selling Rules | `/api/stock/selling-rules` | Règles de vente + backorder |

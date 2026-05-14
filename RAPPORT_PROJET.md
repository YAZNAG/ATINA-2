# Dark Store App — Rapport Global du Projet

> Généré le : 2026-05-13  
> Auteur : YAZNAG

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Structure du projet](#3-structure-du-projet)
4. [Modules Backend développés](#4-modules-backend-développés)
5. [API complète par module](#5-api-complète-par-module)
6. [Modèles de base de données (Prisma)](#6-modèles-de-base-de-données-prisma)
7. [Frontend — Pages et API clients](#7-frontend--pages-et-api-clients)
8. [Dépendances](#8-dépendances)
9. [Configuration environnement](#9-configuration-environnement)
10. [Flux métier principaux](#10-flux-métier-principaux)

---

## 1. Vue d'ensemble

**Dark Store App** est une plateforme de gestion de commerce rapide (quick commerce / dark store) comprenant :

- Un **back-office** d'administration (gestion catalogue, stock, commandes, livraisons)
- Une **API cliente** pour l'app mobile (authentification OTP, catalogue, checkout, suivi commande)
- Un **système de picking** pour les préparateurs de commandes en entrepôt
- Un **système de livraison** avec tournées et chauffeurs

| Élément | Technologie |
|---|---|
| Backend | Node.js + Express.js |
| ORM | Prisma v5 |
| Base de données | PostgreSQL |
| Authentification | JWT (RBAC) + OTP client |
| Frontend | React 18 + Vite + TailwindCSS |
| Upload fichiers | Multer |

---

## 2. Architecture technique

```
Request
  └─→ Route (Express)
        └─→ Middleware (Auth JWT / Permission RBAC)
              └─→ Validator (express-validator)
                    └─→ Controller
                          └─→ Service (logique métier)
                                └─→ Prisma Client
                                      └─→ PostgreSQL
```

**Patterns utilisés :**
- **MVC layered** : Controllers → Services → Prisma
- **RBAC** : Roles & Permissions granulaires sur chaque route
- **Modular** : chaque domaine métier est un module autonome (`src/modules/`)
- **Soft deletes** : audit trail préservé
- **Transactions Prisma** : pour les opérations complexes (création commande, session picking)
- **Generic CRUD (P0)** : module générique pour accès rapide aux tables de référence

---

## 3. Structure du projet

```
dark-store-app/
├── backend/
│   ├── src/
│   │   ├── config/           # DB, JWT
│   │   ├── controllers/      # Auth, User, Role, Permission
│   │   ├── middlewares/      # auth, permission, error, upload
│   │   ├── routes/           # auth, users, roles, permissions
│   │   ├── services/         # Auth, User, Role, Permission, FileUpload
│   │   ├── repositories/     # Permission repository
│   │   ├── validators/       # auth, user, role
│   │   ├── utils/            # response, password
│   │   ├── seeders/          # seed scripts
│   │   └── modules/
│   │       ├── catalog/      # Familles, Catégories, Articles, SKUs...
│   │       ├── stock/        # Niveaux, Mouvements, Lots, Règles...
│   │       ├── warehouse/    # Zones, Emplacements, SKU Locations
│   │       ├── orders/       # Statuts commandes, Méthodes paiement...
│   │       ├── orders_mgmt/  # Gestion opérationnelle des commandes
│   │       ├── picking/      # Sessions picking, Items
│   │       ├── staff/        # Pickers, Drivers
│   │       ├── nodes/        # Nodes, Types, Delivery Slots
│   │       ├── location/     # Régions, Provinces, Villes
│   │       ├── customer_auth/    # Auth client OTP
│   │       ├── customer_catalog/ # Catalogue client
│   │       ├── customer_me/      # Profil client + adresses
│   │       ├── customers/        # Admin CRUD clients
│   │       ├── checkout/         # Processus de commande
│   │       └── p0/               # CRUD générique
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
└── frontend/
    └── src/
        ├── api/              # Modules Axios par domaine
        ├── components/       # Composants réutilisables
        ├── context/          # AuthContext
        ├── layouts/          # DashboardLayout, etc.
        ├── pages/            # Pages par module
        └── routes/           # React Router v6
```

---

## 4. Modules Backend développés

### 4.1 Module Core

| Fichier | Rôle |
|---|---|
| `src/controllers/auth.controller.js` | Login, Me, Logout admin |
| `src/controllers/user.controller.js` | CRUD utilisateurs admin |
| `src/controllers/role.controller.js` | CRUD rôles + assignation permissions |
| `src/controllers/permission.controller.js` | Liste des permissions |
| `src/services/auth.service.js` | Authentification JWT, extraction permissions |
| `src/services/user.service.js` | Gestion utilisateurs avec rôles |
| `src/services/role.service.js` | Gestion rôles et permissions |
| `src/middlewares/auth.middleware.js` | Vérification JWT |
| `src/middlewares/permission.middleware.js` | RBAC sur les routes |

### 4.2 Module Catalog

| Sous-module | Entités gérées |
|---|---|
| `families` | Familles de produits |
| `categories` | Catégories |
| `subCategories` | Sous-catégories |
| `brands` | Marques |
| `units` | Unités de mesure |
| `packagingTypes` | Types d'emballage |
| `conservationTypes` | Types de conservation (froid, ambiant…) |
| `articleTypes` | Types d'article |
| `articleStatuses` | Statuts d'article |
| `taxes` | Taux de TVA |
| `articles` | Articles produits (avec images, SKU) |
| `skus` | Références logistiques |
| `sku-images` | Images des SKUs |

### 4.3 Module Stock

| Sous-module | Rôle |
|---|---|
| `stock_levels` | Niveaux de stock par node/SKU (physique, réservé, disponible) |
| `stock_moves` | Mouvements de stock (entrée, sortie, ajustement) |
| `stock_lots` | Lots avec traçabilité (expiration, N° lot) |
| `move_types` | Types de mouvement |
| `stock_statuses` | Statuts de stock |
| `inventory_types` | Types d'inventaire |
| `inventory_statuses` | Statuts d'inventaire |
| `inventory_gap_types` | Types d'écart d'inventaire |
| `thresholds` | Règles de seuil (min, alerte, max) |
| `selling_rules` | Règles de vente (backorder) |
| `reorder_rules` | Règles de réapprovisionnement |
| `operations` | Opérations de stock (IN, OUT, ADJ) |

### 4.4 Module Warehouse

| Sous-module | Rôle |
|---|---|
| `zones` | Zones d'entrepôt (A, B, C…) |
| `levels` | Niveaux de rayonnage |
| `locations` | Emplacements physiques (allée/étagère/niveau) |
| `sku-locations` | Mapping SKU → emplacement entrepôt |

### 4.5 Module Nodes & Location

| Sous-module | Rôle |
|---|---|
| `node_types` | Types de nœud logistique |
| `nodes` | Nœuds (entrepôts, dark stores) avec coordonnées GPS |
| `delivery_slots` | Créneaux de livraison par nœud |
| `regions` | Régions géographiques |
| `provinces` | Provinces |
| `cities` | Villes |

### 4.6 Module Orders

| Sous-module | Rôle |
|---|---|
| `order_statuses` | Statuts de commande |
| `order_item_statuses` | Statuts des lignes de commande |
| `order_slot_statuses` | Statuts des créneaux |
| `delivery_types` | Types de livraison |
| `payment_statuses` | Statuts de paiement |
| `payment_methods` | Méthodes de paiement (COD, carte, wallet) |
| `wallet_txn_types` | Types de transaction portefeuille |
| `app_configs` | Configuration applicative par nœud |

### 4.7 Module Orders Management

Gestion opérationnelle du cycle de vie des commandes :

| Fonction | Description |
|---|---|
| Liste des commandes | Filtres, pagination, recherche |
| Détail commande | Tous les items, statut, client |
| Transitions de statut | Validation des changements d'état autorisés |
| Changement de statut | `PATCH /:id/status` avec audit trail |
| Annulation | `PATCH /:id/cancel` avec raison |
| Historique | Audit trail complet |
| Assignation picker | Crée une session picking + assigne picker |
| Confirmation pickup | Confirmation de récupération |

### 4.8 Module Picking

Workflow de préparation des commandes :

| Fonction | Description |
|---|---|
| Sessions | Création, démarrage, complétion, annulation |
| Items | Marquer comme prélevé, substitué, en rupture |
| Pickers | Liste des préparateurs disponibles |
| Statuts | PickingStatus, PickItemStatus avec seeding |

### 4.9 Module Staff

| Sous-module | Rôle |
|---|---|
| `pickers` | CRUD préparateurs (UUID, node, auth) |
| `drivers` | CRUD chauffeurs (UUID, node, auth) |
| Auth picker/driver | Login par téléphone + mot de passe |

### 4.10 Module Customer (API mobile)

| Sous-module | Rôle |
|---|---|
| `customer_auth` | Vérif. téléphone, OTP, inscription, login |
| `customer_catalog` | Catégories, articles, recherche |
| `customer_me` | Profil, adresses (CRUD + adresse par défaut) |
| `customers` | CRUD admin côté back-office |
| `checkout` | Méta, articles dispo, nœuds éligibles, créneaux, création commande |

### 4.11 Module P0 (CRUD générique)

Accès générique aux tables de référence via SQL table name :

| Route | Rôle |
|---|---|
| `GET /p0/registry` | Liste des tables disponibles |
| `GET /p0/table/:sql` | Structure d'une table |
| `GET /p0/relations` | Graphe de toutes les relations |
| `GET /p0/crud/:sql` | Liste générique |
| `POST /p0/crud/:sql` | Création générique |
| `GET /p0/crud/:sql/:id` | Détail générique |
| `PUT /p0/crud/:sql/:id` | Mise à jour générique |
| `DELETE /p0/crud/:sql/:id` | Suppression générique |

---

## 5. API complète par module

### Authentification Admin

```
POST   /api/auth/login                    Connexion admin (email + password)
GET    /api/auth/me                       Profil admin connecté
POST   /api/auth/logout                   Déconnexion
POST   /api/auth/picker/login             Connexion picker (téléphone + password)
POST   /api/auth/driver/login             Connexion chauffeur (téléphone + password)
```

### Utilisateurs Admin

```
GET    /api/users                         Liste des utilisateurs
POST   /api/users                         Créer un utilisateur
GET    /api/users/:id                     Détail utilisateur
PUT    /api/users/:id                     Modifier utilisateur
DELETE /api/users/:id                     Supprimer utilisateur
```

### Rôles & Permissions

```
GET    /api/roles                         Liste des rôles
POST   /api/roles                         Créer un rôle
GET    /api/roles/:id                     Détail rôle
PUT    /api/roles/:id                     Modifier rôle
DELETE /api/roles/:id                     Supprimer rôle
POST   /api/roles/:id/permissions         Assigner permissions à un rôle
GET    /api/roles/:id/permissions         Permissions d'un rôle
GET    /api/permissions                   Liste toutes les permissions
```

### Catalogue

```
# Familles
GET|POST          /api/catalog/families
GET|PUT|DELETE    /api/catalog/families/:id

# Catégories
GET|POST          /api/catalog/categories
GET|PUT|DELETE    /api/catalog/categories/:id

# Sous-catégories
GET|POST          /api/catalog/sub-categories
GET|PUT|DELETE    /api/catalog/sub-categories/:id

# Marques
GET|POST          /api/catalog/brands
GET|PUT|DELETE    /api/catalog/brands/:id

# Unités
GET|POST          /api/catalog/units
GET|PUT|DELETE    /api/catalog/units/:id

# Types d'emballage
GET|POST          /api/catalog/packaging-types
GET|PUT|DELETE    /api/catalog/packaging-types/:id

# Types de conservation
GET|POST          /api/catalog/conservation-types
GET|PUT|DELETE    /api/catalog/conservation-types/:id

# Types d'article
GET|POST          /api/catalog/article-types
GET|PUT|DELETE    /api/catalog/article-types/:id

# Statuts d'article
GET|POST          /api/catalog/article-statuses
GET|PUT|DELETE    /api/catalog/article-statuses/:id

# Taxes
GET|POST          /api/catalog/taxes
GET|PUT|DELETE    /api/catalog/taxes/:id

# Articles
GET    /api/catalog/articles              Liste (pagination, filtres, recherche)
POST   /api/catalog/articles              Créer article
GET    /api/catalog/articles/:id          Détail article
PUT    /api/catalog/articles/:id          Modifier article
DELETE /api/catalog/articles/:id          Supprimer article

# Images article
GET|POST          /api/catalog/articles/:articleId/images
GET|PUT|DELETE    /api/catalog/articles/:articleId/images/:imageId

# SKUs
GET|POST          /api/catalog/skus
GET|PUT|DELETE    /api/catalog/skus/:id

# Images SKU
GET|POST          /api/catalog/sku-images
GET|PUT|DELETE    /api/catalog/sku-images/:id
GET|POST          /api/catalog/articles/:articleId/sku-images
GET|PUT|DELETE    /api/catalog/articles/:articleId/sku-images/:imageId
```

### Stock

```
# Types de mouvement
GET|POST          /api/stock/move-types
GET|PUT|DELETE    /api/stock/move-types/:id

# Statuts de stock
GET|POST          /api/stock/stock-statuses
GET|PUT|DELETE    /api/stock/stock-statuses/:id

# Types d'inventaire
GET|POST          /api/stock/inventory-types
GET|PUT|DELETE    /api/stock/inventory-types/:id

# Statuts d'inventaire
GET|POST          /api/stock/inventory-statuses
GET|PUT|DELETE    /api/stock/inventory-statuses/:id

# Types d'écart d'inventaire
GET|POST          /api/stock/inventory-gap-types
GET|PUT|DELETE    /api/stock/inventory-gap-types/:id

# Seuils de stock
GET|POST          /api/stock/thresholds
GET|PUT|DELETE    /api/stock/thresholds/:id

# Niveaux de stock
GET|POST          /api/stock/levels
GET|PUT|DELETE    /api/stock/levels/:id

# Règles de vente
GET|POST          /api/stock/selling-rules
GET|PUT|DELETE    /api/stock/selling-rules/:id

# Règles de réapprovisionnement
GET|POST          /api/stock/reorder-rules
GET|PUT|DELETE    /api/stock/reorder-rules/:id

# Opérations de stock
GET|POST          /api/stock/operations
GET|PUT|DELETE    /api/stock/operations/:id

# Mouvements de stock
GET|POST          /api/stock/moves
GET|PUT|DELETE    /api/stock/moves/:id

# Lots de stock
GET|POST          /api/stock/lots
GET|PUT|DELETE    /api/stock/lots/:id
```

### Entrepôt (Warehouse)

```
GET|POST          /api/warehouse/zones
GET|PUT|DELETE    /api/warehouse/zones/:id

GET|POST          /api/warehouse/levels
GET|PUT|DELETE    /api/warehouse/levels/:id

GET|POST          /api/warehouse/locations
GET|PUT|DELETE    /api/warehouse/locations/:id

GET|POST          /api/warehouse/sku-locations
GET|PUT|DELETE    /api/warehouse/sku-locations/:id
```

### Nœuds & Localisation

```
GET|POST          /api/regions
GET|PUT|DELETE    /api/regions/:id

GET|POST          /api/provinces
GET|PUT|DELETE    /api/provinces/:id

GET|POST          /api/cities
GET|PUT|DELETE    /api/cities/:id

GET|POST          /api/node-types
GET|PUT|DELETE    /api/node-types/:id

GET|POST          /api/nodes
GET|PUT|DELETE    /api/nodes/:id

GET|POST          /api/delivery-slots
GET|PUT|DELETE    /api/delivery-slots/:id
```

### Commandes — Configuration

```
GET|POST          /api/orders/statuses
GET|PUT|DELETE    /api/orders/statuses/:id

GET|POST          /api/orders/item-statuses
GET|PUT|DELETE    /api/orders/item-statuses/:id

GET|POST          /api/orders/slot-statuses
GET|PUT|DELETE    /api/orders/slot-statuses/:id

GET|POST          /api/orders/delivery-slots
GET|PUT|DELETE    /api/orders/delivery-slots/:id

GET|POST          /api/orders/configs
GET|PUT|DELETE    /api/orders/configs/:id
```

### Gestion opérationnelle des commandes

```
GET    /api/orders-mgmt/meta              Méta-données (statuts, filtres...)
GET    /api/orders-mgmt                   Liste commandes (pagination + filtres)
GET    /api/orders-mgmt/:id               Détail commande
GET    /api/orders-mgmt/:id/transitions   Transitions de statut disponibles
GET    /api/orders-mgmt/:id/history       Historique / audit trail
PATCH  /api/orders-mgmt/:id/status        Changer le statut
PATCH  /api/orders-mgmt/:id/cancel        Annuler commande
GET    /api/orders-mgmt/:id/pickers       Pickers disponibles pour le nœud
POST   /api/orders-mgmt/:id/assign-picker Assigner un picker (crée session picking)
PATCH  /api/orders-mgmt/:id/confirm-pickup Confirmer récupération
```

### Picking

```
# Statuts
GET|POST          /api/picking/statuses
POST              /api/picking/statuses/seed
GET|PUT|DELETE    /api/picking/statuses/:id

GET|POST          /api/picking/item-statuses
POST              /api/picking/item-statuses/seed
GET|PUT|DELETE    /api/picking/item-statuses/:id

# Pickers
GET    /api/picking/pickers               Liste des pickers

# Sessions
GET    /api/picking/sessions              Liste des sessions (pagination)
POST   /api/picking/sessions              Créer une session
GET    /api/picking/sessions/:id          Détail session
PATCH  /api/picking/sessions/:id/start    Démarrer session
PATCH  /api/picking/sessions/:id/complete Compléter session
PATCH  /api/picking/sessions/:id/cancel   Annuler session
PATCH  /api/picking/sessions/:id/picker   Assigner picker

# Items
PATCH  /api/picking/items/:id/pick           Marquer comme prélevé
PATCH  /api/picking/items/:id/substitute     Substituer un article
PATCH  /api/picking/items/:id/out-of-stock   Marquer en rupture
```

### Staff

```
# Pickers
GET|POST          /api/staff/pickers
GET|PUT|DELETE    /api/staff/pickers/:id

# Drivers
GET|POST          /api/staff/drivers
GET|PUT|DELETE    /api/staff/drivers/:id
```

### Paiement & Wallet

```
GET|POST          /api/payment/statuses
GET|PUT|DELETE    /api/payment/statuses/:id

GET|POST          /api/payment/methods
GET|PUT|DELETE    /api/payment/methods/:id

GET|POST          /api/wallet/txn-types
GET|PUT|DELETE    /api/wallet/txn-types/:id
```

### Livraison

```
GET|POST          /api/delivery/types
GET|PUT|DELETE    /api/delivery/types/:id
```

### Client — Auth (API mobile)

```
POST   /api/customer/auth/check-phone     Vérifier si le téléphone existe
POST   /api/customer/auth/request-otp     Envoyer un OTP
POST   /api/customer/auth/verify-otp      Vérifier l'OTP
POST   /api/customer/auth/register        Inscription client
POST   /api/customer/auth/login           Connexion client
GET    /api/customer/auth/me              Profil client connecté
```

### Client — Catalogue (API mobile)

```
GET    /api/customer/catalog/categories               Liste des catégories
GET    /api/customer/catalog/categories/:id/articles  Articles d'une catégorie
GET    /api/customer/catalog/articles                 Recherche d'articles
GET    /api/customer/catalog/articles/:id             Détail article
```

### Client — Profil & Adresses (API mobile)

```
GET    /api/customer/me                              Profil client
PUT    /api/customer/me                              Modifier profil
GET    /api/customer/me/addresses                    Liste des adresses
POST   /api/customer/me/addresses                    Ajouter une adresse
PUT    /api/customer/me/addresses/:id                Modifier adresse
PATCH  /api/customer/me/addresses/:id/set-default    Définir adresse par défaut
DELETE /api/customer/me/addresses/:id                Supprimer adresse
```

### Checkout (API mobile)

```
GET    /api/checkout/meta                Méta-données checkout
GET    /api/checkout/articles            Articles disponibles à la commande
POST   /api/checkout/eligible-nodes      Nœuds éligibles (GPS)
GET    /api/checkout/delivery-slots      Créneaux de livraison disponibles
POST   /api/checkout/create-order        Créer une commande
```

### Clients (admin)

```
GET    /api/customers                    Liste des clients
POST   /api/customers                    Créer client
GET    /api/customers/:id                Détail client
PUT    /api/customers/:id                Modifier client
DELETE /api/customers/:id                Supprimer client
PUT    /api/customers/:id/block          Bloquer client
PUT    /api/customers/:id/unblock        Débloquer client
```

### P0 — CRUD générique

```
GET    /api/p0/registry                  Liste des tables disponibles
GET    /api/p0/table/:sql                Structure d'une table
GET    /api/p0/relations                 Graphe de toutes les relations
GET    /api/p0/relations/:sql            Relations d'une table
GET    /api/p0/crud/refs/:sql/options    Options de référence (pour selects)
GET    /api/p0/crud/:sql/meta            Méta-données d'une table
GET    /api/p0/crud/:sql                 Liste générique
POST   /api/p0/crud/:sql                 Création générique
GET    /api/p0/crud/:sql/:id             Détail générique
PUT    /api/p0/crud/:sql/:id             Mise à jour générique
DELETE /api/p0/crud/:sql/:id             Suppression générique
```

---

## 6. Modèles de base de données (Prisma)

### Auth & RBAC

| Modèle | Description |
|---|---|
| `User` | Utilisateurs admin |
| `Role` | Rôles (Admin, Manager, Opérateur…) |
| `Permission` | Permissions granulaires |
| `RolePermission` | Liaison Rôle ↔ Permission |
| `UserRole` | Liaison User ↔ Rôle |
| `BackofficeAdmin` | Profil étendu admin |

### Staff

| Modèle | Description |
|---|---|
| `Picker` | Préparateur de commande (UUID) |
| `Driver` | Chauffeur livreur (UUID) |
| `PickingSession` | Session de préparation |
| `PickingSessionItem` | Item dans une session |
| `PickingStatus` | Statuts de session picking |
| `PickItemStatus` | Statuts d'items picking |

### Catalogue & Produits

| Modèle | Description |
|---|---|
| `Family` | Famille de produits |
| `Category` | Catégorie |
| `SubCategory` | Sous-catégorie |
| `Brand` | Marque |
| `Unit` | Unité de mesure |
| `PackagingType` | Type d'emballage (unité, pack, caisse…) |
| `ConservationType` | Conservation (ambiant, réfrigéré, surgelé…) |
| `ArticleType` | Classification article |
| `ArticleStatus` | Statut article (actif, discontinué…) |
| `Tax` | Taux de TVA |
| `Article` | Article produit avec tous ses attributs |
| `ArticleImage` | Images article |
| `Sku` | Référence logistique (EAN, code, poids) |
| `SkuImage` | Images SKU |

### Localisation & Nœuds

| Modèle | Description |
|---|---|
| `Region` | Région géographique |
| `Province` | Province |
| `City` | Ville |
| `NodeType` | Type de nœud (entrepôt, dark store…) |
| `Node` | Nœud logistique avec GPS |
| `DeliverySlot` | Créneau horaire de livraison |

### Stock

| Modèle | Description |
|---|---|
| `StockLevel` | Niveau de stock (qty_physical, qty_reserved, qty_available, qty_backordered, qty_incoming) |
| `StockMove` | Mouvement de stock (delta quantité) |
| `StockLot` | Lot avec N° lot et date expiration |
| `MoveType` | Type de mouvement (IN, OUT, ADJ) |
| `StockStatus` | Statut du stock |
| `SellingRule` | Règles de vente (backorder autorisé, limites) |
| `ReorderRule` | Règles de réapprovisionnement (safety stock, point de commande, qté économique) |
| `StockThresholdRule` | Seuils (min, alerte, max) |
| `InventoryType` | Type d'inventaire |
| `InventoryStatus` | Statut inventaire |
| `InventoryGapType` | Type d'écart inventaire |
| `StockOperation` | Opérations de stock |

### Entrepôt

| Modèle | Description |
|---|---|
| `Zone` | Zone d'entrepôt |
| `Level` | Niveau de rayonnage |
| `WarehouseLocation` | Emplacement physique |
| `SkuNodeLocation` | Mapping SKU → emplacement |

### Commandes & Livraison

| Modèle | Description |
|---|---|
| `Order` | Commande client |
| `OrderStatus` | Statuts de commande |
| `OrderItem` | Ligne de commande |
| `OrderItemStatus` | Statut d'une ligne |
| `OrderHistory` | Historique / audit trail |
| `OrderSlotStatus` | Statut du créneau |
| `DeliveryType` | Type de livraison |
| `Tour` | Tournée de livraison |
| `TourStatus` | Statut de tournée |
| `TourStop` | Arrêt dans une tournée |
| `StopStatus` | Statut d'un arrêt |

### Paiement & Wallet

| Modèle | Description |
|---|---|
| `Payment` | Enregistrement de paiement |
| `PaymentStatus` | Statuts de paiement |
| `PaymentMethod` | Méthodes (COD, carte, wallet…) |
| `WalletTxnType` | Types de transaction portefeuille |

### Client

| Modèle | Description |
|---|---|
| `Customer` | Client (UUID) |
| `Address` | Adresse livraison client |
| `Referral` | Parrainage |
| `ReferralStatus` | Statut parrainage |
| `ReferralConfig` | Config programme parrainage |

### Promotions & Gamification

| Modèle | Description |
|---|---|
| `Pack` | Pack de produits groupés |
| `PackItem` | Items dans un pack |
| `FlashSale` | Vente flash |
| `Promotion` | Codes promo / réductions |
| `PromoType` | Type de promotion |
| `GamificationGame` | Jeux d'engagement client |
| `GameType` | Type de jeu |
| `GamificationPrize` | Prix dans les jeux |
| `PrizeType` | Type de prix |
| `GamificationPlay` | Parties jouées par le client |
| `PointsRule` | Règles d'attribution de points |

### Configuration

| Modèle | Description |
|---|---|
| `AppConfig` | Configuration applicative par nœud |
| `ConfigValueType` | Type de valeur de config |
| `CostingMethod` | Méthode de valorisation des stocks |
| `Supplier` | Fournisseurs |
| `NotificationChannel` | Canaux de notification |

---

## 7. Frontend — Pages et API clients

**Stack :** React 18 + Vite + TailwindCSS + React Router v6 + Axios

### Modules frontend développés

| Module | Pages |
|---|---|
| **Auth** | Login admin |
| **Dashboard** | Tableau de bord |
| **Catalog** | Familles, Catégories, Sous-catégories, Marques, Unités, Emballages, Conservations, Types, Statuts, Taxes, Articles, SKUs |
| **Stock** | Niveaux, Mouvements, Lots, Seuils, Règles vente, Règles réappro |
| **Warehouse** | Zones, Niveaux, Emplacements, SKU Locations |
| **Nodes** | Types, Nœuds, Créneaux livraison |
| **Location** | Régions, Provinces, Villes |
| **Orders** | Statuts, Config, Gestion commandes |
| **Picking** | Sessions, Items |
| **Staff** | Pickers, Drivers |
| **Customers** | Liste, Détail, Adresses |
| **Payment** | Statuts paiement, Méthodes |
| **Settings** | Utilisateurs, Rôles, Permissions, Config app |

### Structure API client (Axios)

```
src/api/
├── auth.api.js
├── users.api.js
├── roles.api.js
├── permissions.api.js
├── catalog/
│   ├── families.api.js
│   ├── categories.api.js
│   ├── articles.api.js
│   ├── skus.api.js
│   └── ...
├── stock/
│   ├── levels.api.js
│   ├── moves.api.js
│   └── ...
├── orders/
│   ├── orders_mgmt.api.js
│   └── ...
├── picking/
│   └── picking.api.js
└── ...
```

---

## 8. Dépendances

### Backend

| Package | Version | Rôle |
|---|---|---|
| `express` | ^4.18.2 | Framework HTTP |
| `@prisma/client` | ^5.7.0 | ORM PostgreSQL |
| `prisma` | ^5.7.0 | CLI Prisma (dev) |
| `jsonwebtoken` | ^9.0.2 | Authentification JWT |
| `bcryptjs` | ^2.4.3 | Hashage mots de passe |
| `express-validator` | ^7.0.1 | Validation des inputs |
| `multer` | ^1.4.5-lts.1 | Upload de fichiers |
| `cors` | ^2.8.5 | CORS |
| `dotenv` | ^16.3.1 | Variables d'environnement |
| `morgan` | ^1.10.0 | Logging HTTP |
| `nodemon` | ^3.0.2 | Hot reload (dev) |

### Frontend

| Package | Version | Rôle |
|---|---|---|
| `react` | ^18.2.0 | Framework UI |
| `react-dom` | ^18.2.0 | Rendu DOM |
| `react-router-dom` | ^6.21.0 | Routing |
| `axios` | ^1.6.2 | Client HTTP |
| `react-hot-toast` | ^2.4.1 | Notifications toast |
| `tailwindcss` | ^3.4.0 | CSS utilitaire |
| `vite` | ^5.0.8 | Build tool |
| `@vitejs/plugin-react` | ^4.2.1 | Plugin React Vite |

---

## 9. Configuration environnement

### Backend `.env`

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
BODY_LIMIT=10mb

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/dark_store_db?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

### Scripts disponibles

```bash
# Backend
npm run dev            # Démarrer en développement (nodemon)
npm run start          # Démarrer en production

# Base de données
npm run db:generate    # Générer le client Prisma
npm run db:migrate     # Créer et appliquer une migration
npm run db:push        # Push le schéma sans migration
npm run db:seed        # Seeder la base de données
npm run db:studio      # Ouvrir Prisma Studio
npm run db:reset       # Réinitialiser la base de données

# Frontend
npm run dev            # Démarrer Vite (localhost:5173)
npm run build          # Build production
npm run preview        # Preview du build
```

---

## 10. Flux métier principaux

### Flux 1 — Commande client (mobile)

```
Client → POST /customer/auth/login
       → GET  /checkout/meta
       → POST /checkout/eligible-nodes   (envoi GPS → nœuds dispo)
       → GET  /checkout/articles         (articles du nœud)
       → GET  /checkout/delivery-slots   (créneaux dispo)
       → POST /checkout/create-order     (création commande)
```

### Flux 2 — Gestion commande (back-office)

```
Admin → GET  /orders-mgmt                (liste commandes)
      → GET  /orders-mgmt/:id            (détail)
      → GET  /orders-mgmt/:id/transitions (statuts possibles)
      → POST /orders-mgmt/:id/assign-picker (assigner picker → crée session)
      → PATCH /orders-mgmt/:id/status    (changer statut)
```

### Flux 3 — Picking (préparateur)

```
Picker → POST /auth/picker/login
       → GET  /picking/sessions           (sessions assignées)
       → PATCH /picking/sessions/:id/start (démarrer)
       → PATCH /picking/items/:id/pick     (prélever item)
       → PATCH /picking/items/:id/out-of-stock (rupture)
       → PATCH /picking/sessions/:id/complete  (terminer)
```

### Flux 4 — Gestion stock

```
Admin → GET  /stock/levels               (voir niveaux)
      → POST /stock/moves                (enregistrer mouvement)
      → GET  /stock/lots                 (voir lots / expirations)
      → GET  /stock/thresholds           (voir seuils alertes)
      → GET  /stock/reorder-rules        (règles réappro)
```

---

*Rapport généré automatiquement à partir de l'analyse complète du code source.*

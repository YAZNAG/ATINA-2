# DARK STORE - RAPPORT UNIQUE DES MODULES ET APIs

**Projet :** Dark Store App  
**Stack :** Node.js + Express + Prisma/PostgreSQL, React, Flutter  
**Objectif du document :** remplacer les anciens fichiers Markdown par un seul rapport GitHub lisible qui centralise l'etat des modules et la liste des APIs par module/sous-module.

## 1. Etat global

| Domaine | Etat | Commentaire |
|---|---|---|
| Auth & RBAC | Avance | JWT, roles, permissions, middleware admin, login picker/driver. |
| Master Data Catalogue | Avance | Referentiels catalogue, articles, SKUs, images, uploads. |
| Geo / Nodes | Avance | Regions, provinces, villes, nodes, node types, slots. |
| Clients | Avance | Customers, addresses, auth customer, profil mobile. |
| Checkout | Avance | Node automatique, slots, calcul, create order. |
| Orders / OMS | Avance | Liste, detail, transitions, historique, assign picker. |
| Warehouse | Avance | Zones, niveaux, emplacements, emplacements SKU. |
| Stock | Avance | Levels, moves, lots, selling rules, reorder rules, seuils. |
| Picking | Avance web, mobile en cours | Sessions, items, scan, portail picker, app picker partielle. |
| Pickup | En cours | Ready orders, collecte COD, confirmation retrait. |
| Livraison / Driver | En cours | Tours, stops, driver portal, delivery management. |
| Paiements | En cours | Payment methods/statuses, Stripe, wallet, refund. |
| Wallet / Loyalty | En cours | Wallet transactions, debit/credit/refund, referrals partiels. |
| Reporting | Partiel | Dashboard et KPI par domaine. |
| Mobile Customer | Avance | Auth, OTP, catalogue, panier, checkout, commandes, profil. |
| Mobile Picker | En cours | Auth/dashboard + sessions en cours dans le code local. |
| Mobile Driver | En cours | Auth/dashboard, tours/stops a finaliser. |

## 2. Conventions API

| Element | Valeur |
|---|---|
| Prefix global | `/api` |
| Auth admin | Header `Authorization: Bearer <token>` |
| Auth customer | JWT customer sur routes `/api/customer/*` protegees |
| Auth picker | JWT picker sur routes `/api/picker/*` protegees |
| Auth driver | JWT driver sur routes `/api/driver/*` protegees |
| Reponse standard | JSON `{ success, message, data }` ou structure paginee |
| Uploads | `multipart/form-data` sur modules catalogue avec images |

## 3. APIs Backoffice Core

### Auth

Base : `/api/auth`

| Methode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login admin/backoffice. |
| GET | `/api/auth/me` | Profil utilisateur connecte. |
| POST | `/api/auth/logout` | Logout logique. |
| POST | `/api/auth/picker/login` | Login picker historique. |
| POST | `/api/auth/driver/login` | Login driver historique. |

### Users

Base : `/api/users`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | Liste utilisateurs. |
| POST | `/api/users` | Creation utilisateur. |
| GET | `/api/users/:id` | Detail utilisateur. |
| PUT | `/api/users/:id` | Mise a jour utilisateur. |
| DELETE | `/api/users/:id` | Suppression/desactivation utilisateur. |

### Roles

Base : `/api/roles`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/roles` | Liste roles. |
| POST | `/api/roles` | Creation role. |
| GET | `/api/roles/:id` | Detail role. |
| PUT | `/api/roles/:id` | Mise a jour role. |
| DELETE | `/api/roles/:id` | Suppression role. |
| POST | `/api/roles/:id/permissions` | Affecter permissions a un role. |
| GET | `/api/roles/:id/permissions` | Permissions du role. |

### Permissions

Base : `/api/permissions`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/permissions` | Liste/groupement des permissions. |

## 4. APIs Master Data Catalogue

Base generale : `/api/catalog`

### Routeur catalogue

| Sous-module | Base API |
|---|---|
| Familles | `/api/catalog/families` |
| Categories | `/api/catalog/categories` |
| Sous-categories | `/api/catalog/sub-categories` |
| Marques | `/api/catalog/brands` |
| Unites | `/api/catalog/units` |
| Conditionnements | `/api/catalog/packaging-types` |
| Types de conservation | `/api/catalog/conservation-types` |
| Types d'articles | `/api/catalog/article-types` |
| Statuts articles | `/api/catalog/article-statuses` |
| TVA | `/api/catalog/taxes` |
| Articles | `/api/catalog/articles` |
| Images articles | `/api/catalog/articles/:articleId/images` |
| SKUs | `/api/catalog/skus` |
| Images SKU | `/api/catalog/skus/:skuId/images` et `/api/catalog/sku-images` |

### Referentiels catalogue CRUD standard

Ces endpoints existent pour familles, categories, sous-categories, marques, unites, conditionnements, types de conservation, types d'articles, statuts articles et TVA.

| Methode | Endpoint type | Description |
|---|---|---|
| GET | `/api/catalog/<module>` | Liste paginee, recherche, filtres. |
| POST | `/api/catalog/<module>` | Creation. |
| GET | `/api/catalog/<module>/:id` | Detail. |
| PUT | `/api/catalog/<module>/:id` | Mise a jour. |
| DELETE | `/api/catalog/<module>/:id` | Soft delete/desactivation. |

Modules concernes :

| Module | Endpoints |
|---|---|
| Families | `GET/POST /api/catalog/families`, `GET/PUT/DELETE /api/catalog/families/:id` |
| Categories | `GET/POST /api/catalog/categories`, `GET/PUT/DELETE /api/catalog/categories/:id` |
| Sub-categories | `GET/POST /api/catalog/sub-categories`, `GET/PUT/DELETE /api/catalog/sub-categories/:id` |
| Brands | `GET/POST /api/catalog/brands`, `GET/PUT/DELETE /api/catalog/brands/:id` |
| Units | `GET/POST /api/catalog/units`, `GET/PUT/DELETE /api/catalog/units/:id` |
| Packaging types | `GET/POST /api/catalog/packaging-types`, `GET/PUT/DELETE /api/catalog/packaging-types/:id` |
| Conservation types | `GET/POST /api/catalog/conservation-types`, `GET/PUT/DELETE /api/catalog/conservation-types/:id` |
| Article types | `GET/POST /api/catalog/article-types`, `GET/PUT/DELETE /api/catalog/article-types/:id` |
| Article statuses | `GET/POST /api/catalog/article-statuses`, `GET/PUT/DELETE /api/catalog/article-statuses/:id` |
| Taxes | `GET/POST /api/catalog/taxes`, `GET/PUT/DELETE /api/catalog/taxes/:id` |

### Articles

Base : `/api/catalog/articles`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/catalog/articles` | Liste articles avec filtres. |
| POST | `/api/catalog/articles` | Creation article, image possible. |
| GET | `/api/catalog/articles/:id` | Detail article. |
| PUT | `/api/catalog/articles/:id` | Mise a jour article. |
| DELETE | `/api/catalog/articles/:id` | Soft delete article. |

### Images articles

Base : `/api/catalog/articles/:articleId/images`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/catalog/articles/:articleId/images` | Liste images article. |
| POST | `/api/catalog/articles/:articleId/images` | Ajouter image. |
| PATCH | `/api/catalog/articles/:articleId/images/:imageId/main` | Definir image principale. |
| PATCH | `/api/catalog/articles/:articleId/images/:imageId/sort` | Modifier ordre. |
| DELETE | `/api/catalog/articles/:articleId/images/:imageId` | Supprimer image. |

### SKUs et images SKU

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/catalog/skus` | Liste SKUs. |
| POST | `/api/catalog/skus` | Creation SKU. |
| GET | `/api/catalog/skus/:id` | Detail SKU. |
| DELETE | `/api/catalog/skus/:id` | Suppression SKU. |
| GET | `/api/catalog/skus/:skuId/images` | Images d'un SKU. |
| POST | `/api/catalog/skus/:skuId/images` | Ajouter image SKU. |
| PATCH | `/api/catalog/skus/:skuId/images/:imageId/primary` | Definir image primaire. |
| PATCH | `/api/catalog/skus/:skuId/images/:imageId/sort` | Modifier ordre image SKU. |
| DELETE | `/api/catalog/skus/:skuId/images/:imageId` | Supprimer image SKU. |
| GET | `/api/catalog/sku-images` | Liste globale images SKU. |
| POST | `/api/catalog/sku-images` | Creation image SKU globale. |
| GET | `/api/catalog/sku-images/:id` | Detail image SKU. |
| PUT | `/api/catalog/sku-images/:id` | Mise a jour image SKU. |
| DELETE | `/api/catalog/sku-images/:id` | Suppression image SKU. |

## 5. APIs Geo, Nodes et Delivery Slots

### Regions, provinces, cities

Bases : `/api/regions`, `/api/provinces`, `/api/cities`

| Module | Endpoints |
|---|---|
| Regions | `GET/POST /api/regions`, `GET/PUT/DELETE /api/regions/:id` |
| Provinces | `GET/POST /api/provinces`, `GET/PUT/DELETE /api/provinces/:id` |
| Cities | `GET/POST /api/cities`, `GET/PUT/DELETE /api/cities/:id` |

### Node types

Base : `/api/node-types`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/node-types/active` | Types actifs. |
| GET | `/api/node-types` | Liste. |
| POST | `/api/node-types` | Creation. |
| GET | `/api/node-types/:id` | Detail. |
| PUT | `/api/node-types/:id` | Mise a jour. |
| DELETE | `/api/node-types/:id` | Suppression. |

### Nodes

Base : `/api/nodes`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/nodes` | Liste nodes. |
| POST | `/api/nodes` | Creation node. |
| GET | `/api/nodes/:id` | Detail node. |
| PUT | `/api/nodes/:id` | Mise a jour node. |
| DELETE | `/api/nodes/:id` | Suppression node. |

### Slots par node

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/nodes/:id/slots` | Slots d'un node. |
| POST | `/api/nodes/:id/slots` | Creation slot node. |
| PUT | `/api/slots/:id` | Mise a jour slot. |
| DELETE | `/api/slots/:id` | Suppression slot. |

## 6. APIs Clients et adresses

### Customers backoffice

Base : `/api/customers`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | Liste clients. |
| POST | `/api/customers` | Creation client. |
| GET | `/api/customers/:id` | Detail client. |
| PUT | `/api/customers/:id` | Mise a jour client. |
| PUT | `/api/customers/:id/block` | Bloquer client. |
| PUT | `/api/customers/:id/unblock` | Debloquer client. |
| DELETE | `/api/customers/:id` | Soft delete client. |

### Addresses

Base : `/api/addresses`

| Methode | Endpoint | Description |
|---|---|---|
| PUT | `/api/addresses/:id` | Mise a jour adresse. |
| PATCH | `/api/addresses/:id/set-default` | Adresse par defaut. |
| DELETE | `/api/addresses/:id` | Suppression adresse. |

## 7. APIs Customer Mobile

### Customer auth

Base : `/api/customer/auth`

| Methode | Endpoint | Description |
|---|---|---|
| POST | `/api/customer/auth/check-phone` | Verifier telephone. |
| POST | `/api/customer/auth/request-otp` | Demander OTP. |
| POST | `/api/customer/auth/verify-otp` | Verifier OTP. |
| POST | `/api/customer/auth/register` | Inscription client. |
| POST | `/api/customer/auth/login` | Login client. |
| GET | `/api/customer/auth/me` | Profil token client. |

### Customer catalog

Base : `/api/customer/catalog`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/customer/catalog/categories` | Categories client. |
| GET | `/api/customer/catalog/categories/:id/articles` | Articles par categorie. |
| GET | `/api/customer/catalog/articles` | Articles client. |
| GET | `/api/customer/catalog/articles/:id` | Detail article client. |
| GET | `/api/customer/catalog/cities` | Villes disponibles. |

### Customer checkout

Base : `/api/customer/checkout`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/customer/checkout/meta` | Metadonnees checkout. |
| GET | `/api/customer/checkout/delivery-slots` | Slots disponibles. |
| POST | `/api/customer/checkout/eligible-nodes` | Nodes eligibles. |
| GET | `/api/customer/checkout/pickup-nodes` | Nodes pickup. |
| POST | `/api/customer/checkout/create-order` | Creation commande customer. |

### Customer me

Base : `/api/customer/me`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/customer/me` | Profil client. |
| PUT | `/api/customer/me` | Mise a jour profil. |
| GET | `/api/customer/me/addresses` | Mes adresses. |
| POST | `/api/customer/me/addresses` | Ajouter adresse. |
| PUT | `/api/customer/me/addresses/:id` | Modifier adresse. |
| PATCH | `/api/customer/me/addresses/:id/set-default` | Adresse par defaut. |
| DELETE | `/api/customer/me/addresses/:id` | Supprimer adresse. |
| GET | `/api/customer/me/orders` | Mes commandes. |
| GET | `/api/customer/me/orders/:id` | Detail commande. |
| GET | `/api/customer/me/wallet` | Wallet client. |
| GET | `/api/customer/me/notifications` | Notifications client. |
| PATCH | `/api/customer/me/notifications/:id/read` | Marquer notification lue. |
| PATCH | `/api/customer/me/notifications/read-all` | Tout marquer lu. |

## 8. APIs Checkout Backoffice

Base : `/api/checkout`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/checkout/meta` | Referentiels checkout. |
| GET | `/api/checkout/available-dates` | Dates disponibles. |
| GET | `/api/checkout/articles` | Recherche articles. |
| GET | `/api/checkout/customers` | Recherche clients. |
| GET | `/api/checkout/customers/:customerId/addresses` | Adresses client. |
| POST | `/api/checkout/eligible-nodes` | Nodes eligibles. |
| GET | `/api/checkout/delivery-slots` | Slots. |
| POST | `/api/checkout/calculate` | Calcul total. |
| POST | `/api/checkout/create-order` | Creation commande transactionnelle. |

## 9. APIs Orders / OMS

### Parametrage commandes

Base : `/api/orders`

| Sous-module | Endpoints |
|---|---|
| Order statuses | `GET /api/orders/statuses`, `POST /api/orders/statuses/seed`, `POST /api/orders/statuses`, `GET/PUT/DELETE /api/orders/statuses/:id` |
| Order item statuses | `GET /api/orders/item-statuses`, `POST /api/orders/item-statuses/seed`, `POST /api/orders/item-statuses`, `GET/PUT/DELETE /api/orders/item-statuses/:id` |
| Order slot statuses | `GET /api/orders/slot-statuses`, `POST /api/orders/slot-statuses/seed`, `POST /api/orders/slot-statuses`, `GET/PUT/DELETE /api/orders/slot-statuses/:id` |
| Delivery slots orders | `GET/POST /api/orders/delivery-slots`, `GET/PUT/DELETE /api/orders/delivery-slots/:id` |
| App configs | `GET /api/orders/configs`, `GET /api/orders/configs/keys`, `POST /api/orders/configs/seed`, `POST /api/orders/configs`, `DELETE /api/orders/configs/:id` |

### Gestion commandes

Base : `/api/orders-mgmt`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/orders-mgmt/meta` | Metadonnees OMS. |
| GET | `/api/orders-mgmt` | Liste commandes. |
| GET | `/api/orders-mgmt/by-node/:nodeId` | Commandes par node. |
| GET | `/api/orders-mgmt/by-customer/:custId` | Commandes par client. |
| GET | `/api/orders-mgmt/:id` | Detail commande. |
| GET | `/api/orders-mgmt/:id/transitions` | Transitions autorisees. |
| GET | `/api/orders-mgmt/:id/history` | Historique commande. |
| PATCH | `/api/orders-mgmt/:id/status` | Changer statut. |
| PATCH | `/api/orders-mgmt/:id/cancel` | Annuler commande. |
| GET | `/api/orders-mgmt/:id/pickers` | Pickers eligibles. |
| POST | `/api/orders-mgmt/:id/assign-picker` | Assigner picker. |
| PATCH | `/api/orders-mgmt/:id/confirm-pickup` | Confirmer retrait. |

## 10. APIs Warehouse

Base : `/api/warehouse`

| Sous-module | Endpoints |
|---|---|
| Zones | `GET/POST /api/warehouse/zones`, `GET/PUT/DELETE /api/warehouse/zones/:id` |
| Levels | `GET/POST /api/warehouse/levels`, `GET/PUT/DELETE /api/warehouse/levels/:id` |
| Locations | `GET/POST /api/warehouse/locations`, `POST /api/warehouse/locations/bulk-generate`, `GET/PUT/DELETE /api/warehouse/locations/:id` |
| SKU locations | `GET/POST /api/warehouse/sku-locations`, `GET/PUT/DELETE /api/warehouse/sku-locations/:id` |

## 11. APIs Stock

Base : `/api/stock`

### Parametrage stock

| Sous-module | Endpoints |
|---|---|
| Operations | `GET /api/stock/operations`, `POST /api/stock/operations/seed` |
| Move types | `GET/POST /api/stock/move-types`, `GET/PUT/DELETE /api/stock/move-types/:id` |
| Stock statuses | `GET/POST /api/stock/stock-statuses`, `GET/PUT/DELETE /api/stock/stock-statuses/:id` |
| Inventory types | `GET/POST /api/stock/inventory-types`, `GET/PUT/DELETE /api/stock/inventory-types/:id` |
| Inventory statuses | `GET/POST /api/stock/inventory-statuses`, `GET/PUT/DELETE /api/stock/inventory-statuses/:id` |
| Inventory gap types | `GET/POST /api/stock/inventory-gap-types`, `GET/PUT/DELETE /api/stock/inventory-gap-types/:id` |
| Stock thresholds | `GET /api/stock/thresholds`, `POST /api/stock/thresholds/bulk-save`, `POST /api/stock/thresholds`, `PUT/DELETE /api/stock/thresholds/:id` |

### Operations stock

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/stock/levels` | Liste niveaux stock. |
| GET | `/api/stock/levels/by-node/:node_id` | Stock par node. |
| GET | `/api/stock/levels/:id` | Detail niveau. |
| POST | `/api/stock/levels/receipt` | Reception stock. |
| POST | `/api/stock/levels/reserve` | Reservation. |
| POST | `/api/stock/levels/picking` | Consommation picking. |
| POST | `/api/stock/levels/cancel` | Annuler reservation. |
| POST | `/api/stock/levels/incoming` | Stock entrant. |
| POST | `/api/stock/levels/cod-delivered` | Stock flottant COD. |
| POST | `/api/stock/levels/cod-collected` | COD collecte. |
| POST | `/api/stock/levels/count` | Comptage. |
| POST | `/api/stock/levels/adjust` | Ajustement. |
| POST | `/api/stock/levels/recalculate` | Recalcul. |
| POST | `/api/stock/levels/move` | Transfert. |

### Rules, moves et lots

| Sous-module | Endpoints |
|---|---|
| Selling rules | `GET /api/stock/selling-rules`, `GET /api/stock/selling-rules/by-node/:node_id`, `GET /api/stock/selling-rules/estimated-delivery`, `POST /api/stock/selling-rules/bulk-save`, `POST /api/stock/selling-rules/can-sell`, `POST /api/stock/selling-rules/reserve-backorder`, `POST /api/stock/selling-rules/release-backorder`, `POST /api/stock/selling-rules`, `GET/PUT/DELETE /api/stock/selling-rules/:id` |
| Reorder rules | `GET /api/stock/reorder-rules`, `GET /api/stock/reorder-rules/by-node/:node_id`, `GET /api/stock/reorder-rules/refs`, `GET /api/stock/reorder-rules/suggested-qty`, `POST /api/stock/reorder-rules/bulk-save`, `POST /api/stock/reorder-rules/should-reorder`, `POST /api/stock/reorder-rules/detect-critical`, `POST /api/stock/reorder-rules/detect-overstock`, `POST /api/stock/reorder-rules`, `GET/PUT/DELETE /api/stock/reorder-rules/:id` |
| Stock moves | `GET /api/stock/moves`, `GET /api/stock/moves/stats`, `GET /api/stock/moves/:id` |
| Stock lots | `GET /api/stock/lots`, `GET /api/stock/lots/alerts`, `GET /api/stock/lots/:id`, `POST /api/stock/lots`, `DELETE /api/stock/lots/:id` |

## 12. APIs Picking

### Backoffice picking

Base : `/api/picking`

| Sous-module | Endpoints |
|---|---|
| Picking statuses | `GET /api/picking/statuses`, `POST /api/picking/statuses/seed`, `POST /api/picking/statuses`, `GET/PUT/DELETE /api/picking/statuses/:id` |
| Pick item statuses | `GET /api/picking/item-statuses`, `POST /api/picking/item-statuses/seed`, `POST /api/picking/item-statuses`, `GET/PUT/DELETE /api/picking/item-statuses/:id` |
| Sessions | `GET /api/picking/sessions`, `POST /api/picking/sessions`, `GET /api/picking/sessions/:id`, `PATCH /api/picking/sessions/:id/start`, `PATCH /api/picking/sessions/:id/complete`, `PATCH /api/picking/sessions/:id/cancel`, `PATCH /api/picking/sessions/:id/picker` |
| Items | `PATCH /api/picking/items/:id/pick`, `PATCH /api/picking/items/:id/substitute`, `PATCH /api/picking/items/:id/out-of-stock` |
| Pickers ref | `GET /api/picking/pickers` |

### Picker portal

Base : `/api/picker`

| Methode | Endpoint | Description |
|---|---|---|
| POST | `/api/picker/login` | Login picker. |
| GET | `/api/picker/me` | Profil picker. |
| GET | `/api/picker/available-orders` | Commandes disponibles. |
| GET | `/api/picker/my-orders` | Mes commandes. |
| POST | `/api/picker/orders/:orderId/accept` | Accepter commande. |
| GET | `/api/picker/sessions/:sessionId` | Detail session. |
| PATCH | `/api/picker/sessions/:sessionId/start` | Demarrer session. |
| PATCH | `/api/picker/sessions/:sessionId/complete` | Terminer session. |
| PATCH | `/api/picker/items/:itemId/pick` | Picker item. |
| PATCH | `/api/picker/items/:itemId/out-of-stock` | Rupture item. |
| PATCH | `/api/picker/items/:itemId/substitute` | Substitution item. |

## 13. APIs Pickup

Base : `/api/pickup`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/pickup/ready-orders` | Commandes pretes retrait. |
| GET | `/api/pickup/orders/:orderId` | Detail retrait. |
| PATCH | `/api/pickup/orders/:orderId/collect-cod` | Collecter COD comptoir. |
| PATCH | `/api/pickup/orders/:orderId/confirm` | Confirmer retrait. |
| PATCH | `/api/pickup/orders/:orderId/cancel` | Annuler retrait. |

## 14. APIs Delivery / Tours / Driver

### Delivery types

Base : `/api/delivery/types`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/delivery/types` | Liste types livraison. |
| GET | `/api/delivery/types/:id` | Detail type. |
| POST | `/api/delivery/types/seed` | Seeder types. |
| POST | `/api/delivery/types` | Creation type. |
| PUT | `/api/delivery/types/:id` | Mise a jour type. |
| DELETE | `/api/delivery/types/:id` | Suppression type. |

### Delivery management

Base : `/api/delivery`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/delivery/meta` | Metadonnees delivery. |
| GET | `/api/delivery/drivers` | Drivers disponibles. |
| GET | `/api/delivery/ready-orders` | Commandes pretes livraison. |
| GET | `/api/delivery/tours` | Liste tours. |
| GET | `/api/delivery/tours/:id` | Detail tour. |
| POST | `/api/delivery/tours` | Creation tour. |
| PATCH | `/api/delivery/tours/:id/assign-driver` | Assigner driver. |
| POST | `/api/delivery/tours/:id/orders` | Ajouter commande au tour. |
| DELETE | `/api/delivery/tours/:id/stops/:stopId` | Retirer stop. |
| PATCH | `/api/delivery/tours/:id/start` | Demarrer tour. |
| PATCH | `/api/delivery/tours/:id/complete` | Terminer tour. |
| PATCH | `/api/delivery/stops/:stopId/arrive` | Arrivee stop. |
| PATCH | `/api/delivery/stops/:stopId/deliver` | Stop livre. |
| PATCH | `/api/delivery/stops/:stopId/fail` | Echec stop. |

### Tours legacy/backoffice

Base : `/api/tours`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/tours/meta` | Meta tours. |
| GET | `/api/tours/ready-orders` | Commandes ready. |
| GET | `/api/tours` | Liste tours. |
| GET | `/api/tours/:id` | Detail tour. |
| POST | `/api/tours` | Creation tour. |
| POST | `/api/tours/:id/orders` | Ajouter commandes. |
| DELETE | `/api/tours/:id/stops/:stopId` | Supprimer stop. |
| PATCH | `/api/tours/:id/start` | Demarrer. |
| PATCH | `/api/tours/:id/stops/:stopId/deliver` | Stop livre. |
| PATCH | `/api/tours/:id/stops/:stopId/fail` | Stop echoue. |
| PATCH | `/api/tours/:id/complete` | Terminer tour. |

### Driver portal

Base : `/api/driver`

| Methode | Endpoint | Description |
|---|---|---|
| POST | `/api/driver/login` | Login driver. |
| GET | `/api/driver/tours` | Mes tours. |
| GET | `/api/driver/tours/:id` | Detail tour. |
| PATCH | `/api/driver/tours/:id/start` | Demarrer tour. |
| GET | `/api/driver/stops/:stopId` | Detail stop. |
| PATCH | `/api/driver/stops/:stopId/arrive` | Arrivee stop. |
| PATCH | `/api/driver/stops/:stopId/deliver` | Livraison stop. |
| PATCH | `/api/driver/stops/:stopId/fail` | Echec livraison. |

## 15. APIs Staff

Base : `/api/staff`

### Pickers

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/staff/pickers` | Liste pickers. |
| POST | `/api/staff/pickers` | Creation picker. |
| GET | `/api/staff/pickers/:id` | Detail picker. |
| PUT | `/api/staff/pickers/:id` | Mise a jour picker. |
| PATCH | `/api/staff/pickers/:id/activate` | Activer picker. |
| PATCH | `/api/staff/pickers/:id/deactivate` | Desactiver picker. |
| PATCH | `/api/staff/pickers/:id/reset-password` | Reset mot de passe. |
| DELETE | `/api/staff/pickers/:id` | Suppression picker. |
| GET | `/api/staff/pickers/:id/stats` | Stats picker. |
| GET | `/api/staff/pickers/:id/sessions` | Sessions picker. |
| GET | `/api/staff/pickers/:id/orders` | Commandes picker. |

### Drivers

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/staff/drivers` | Liste drivers. |
| POST | `/api/staff/drivers` | Creation driver. |
| GET | `/api/staff/drivers/:id` | Detail driver. |
| PUT | `/api/staff/drivers/:id` | Mise a jour driver. |
| PATCH | `/api/staff/drivers/:id/activate` | Activer driver. |
| PATCH | `/api/staff/drivers/:id/deactivate` | Desactiver driver. |
| PATCH | `/api/staff/drivers/:id/reset-password` | Reset mot de passe. |
| DELETE | `/api/staff/drivers/:id` | Suppression driver. |
| GET | `/api/staff/drivers/:id/stats` | Stats driver. |

## 16. APIs Payment

Base : `/api/payment`

### Payment statuses

| Methode | Endpoint |
|---|---|
| GET | `/api/payment/statuses` |
| GET | `/api/payment/statuses/:id` |
| POST | `/api/payment/statuses/seed` |
| POST | `/api/payment/statuses` |
| PUT | `/api/payment/statuses/:id` |
| DELETE | `/api/payment/statuses/:id` |

### Payment methods

| Methode | Endpoint |
|---|---|
| GET | `/api/payment/methods` |
| GET | `/api/payment/methods/:id` |
| POST | `/api/payment/methods/seed` |
| POST | `/api/payment/methods` |
| PUT | `/api/payment/methods/:id` |
| PATCH | `/api/payment/methods/:id/toggle-active` |
| DELETE | `/api/payment/methods/:id` |

### Stripe

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/payment/stripe/config` | Config publique Stripe. |
| POST | `/api/payment/stripe/create-intent` | Payment intent. |
| POST | `/api/payment/stripe/create-session` | Session checkout admin. |
| POST | `/api/payment/stripe/create-session-customer` | Session checkout customer. |
| POST | `/api/payment/stripe/webhook` | Webhook Stripe. |
| POST | `/api/payment/stripe/refund` | Refund client/system. |
| POST | `/api/payment/stripe/refund-admin` | Refund admin. |

## 17. APIs Wallet et Loyalty

### Wallet

Base : `/api/wallet`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/wallet/transactions` | Liste transactions wallet. |
| GET | `/api/wallet/customers/:customerId` | Wallet d'un client. |
| POST | `/api/wallet/credit` | Crediter wallet. |
| POST | `/api/wallet/debit` | Debiter wallet. |
| POST | `/api/wallet/refund` | Rembourser wallet. |

### Wallet transaction types

Base : `/api/wallet/txn-types`

| Methode | Endpoint |
|---|---|
| GET | `/api/wallet/txn-types` |
| GET | `/api/wallet/txn-types/:id` |
| POST | `/api/wallet/txn-types/seed` |
| POST | `/api/wallet/txn-types` |
| PUT | `/api/wallet/txn-types/:id` |
| DELETE | `/api/wallet/txn-types/:id` |

### Loyalty / Referral

Base : `/api/loyalty`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/loyalty/referrals` | Liste referrals. |
| GET | `/api/loyalty/my-referrals` | Mes referrals. |

## 18. APIs Reporting

Base : `/api/reporting`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/reporting/dashboard` | Dashboard global. |
| GET | `/api/reporting/orders` | KPI commandes. |
| GET | `/api/reporting/picking` | KPI picking. |
| GET | `/api/reporting/delivery` | KPI livraison. |
| GET | `/api/reporting/stock` | KPI stock. |
| GET | `/api/reporting/payments` | KPI paiements. |

## 19. API P0 generique

Base : `/api/p0`

| Methode | Endpoint | Description |
|---|---|---|
| GET | `/api/p0/registry` | Registry tables P0. |
| GET | `/api/p0/table/:sql` | Lecture table SQL referencee. |
| GET | `/api/p0/relations` | Relations globales. |
| GET | `/api/p0/relations/:sql` | Relations d'une table. |
| GET | `/api/p0/crud/refs/:sql/options` | Options FK/reference. |
| GET | `/api/p0/crud/:sql/meta` | Metadata CRUD. |
| GET | `/api/p0/crud/:sql` | Liste. |
| POST | `/api/p0/crud/:sql` | Creation. |
| GET | `/api/p0/crud/:sql/:id` | Detail. |
| PUT | `/api/p0/crud/:sql/:id` | Mise a jour. |
| DELETE | `/api/p0/crud/:sql/:id` | Suppression. |

## 20. Applications mobiles

| App | Dossier | Etat | APIs principales consommees |
|---|---|---|---|
| Customer | `mobile/customer_app` | Avance | `/api/customer/auth`, `/api/customer/catalog`, `/api/customer/checkout`, `/api/customer/me` |
| Picker | `mobile/picker_app` | En cours | `/api/picker/*` |
| Driver | `mobile/driver_app` | En cours | `/api/driver/*` |

## 21. Fichiers Markdown consolides

Les anciens fichiers Markdown de la racine ont ete remplaces par ce rapport unique :

| Ancien fichier | Action |
|---|---|
| `DB.md` | Supprime, contenu consolide. |
| `DOCUMENTATION_COMPLETE.md` | Supprime, contenu consolide. |
| `PLAN_ACTION_CATALOGUE.md` | Supprime, contenu consolide. |
| `RAPPORT_AUDIT_AVANCEMENT_MODULES.md` | Supprime, contenu consolide. |
| `RAPPORT_MODULES_GESTION_COMMANDES.md` | Supprime, contenu consolide. |
| `RAPPORT_PROJET.md` | Supprime, contenu consolide. |
| `STOCK.md` | Supprime, contenu consolide. |
| `TODO.md` | Supprime, contenu consolide. |
| `api.md` | Supprime, contenu consolide. |
| `rapport.md` | Supprime, contenu consolide. |
| `relationbasedeDonne.md` | Supprime, contenu consolide. |
| `ramder;md` | Supprime, contenu consolide. |
| `E2E_TEST_REPORT.md` | Supprime, contenu consolide. |
| `TESTS_E2E_PICKER_MOBILE.md` | Supprime, contenu consolide. |

## 22. Priorites restantes

| Priorite | Travail | Modules |
|---|---|---|
| P0 | Verrouiller checkout transactionnel et stock reservation/decrement | Checkout, Orders, Stock |
| P0 | Finaliser picking mobile complet | Picker portal, Mobile picker |
| P0 | Finaliser pickup avec COD comptoir | Pickup, Payment, Stock |
| P1 | Finaliser livraison driver/tours/stops | Delivery, Tours, Driver portal, Mobile driver |
| P1 | Stabiliser wallet, refunds et Stripe | Wallet, Payment |
| P1 | Ajouter notifications client | Customer me, Notifications |
| P2 | Completer promotions, loyalty/referral, reporting avance | Promotions, Loyalty, Reporting |

## 23. Conclusion

Ce fichier est maintenant le rapport unique de navigation GitHub pour le projet. Il centralise l'etat des modules et la liste des APIs par module/sous-module. Les fichiers Markdown historiques de la racine doivent rester supprimes pour eviter la duplication documentaire.

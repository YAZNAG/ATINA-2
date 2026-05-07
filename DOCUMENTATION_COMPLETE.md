# 📱 DOCUMENTATION COMPLÈTE - APPLICATION DARK STORE

## 🎯 Aperçu Global

**Nom de l'Application:** Dark Store Management System  
**Type:** Application de gestion de magasin sombre (full-stack)  
**Architecture:** Backend Express.js + Frontend React.js  
**Base de données:** PostgreSQL avec Prisma ORM

---

## 📊 STRUCTURE GÉNÉRALE DE L'APPLICATION

```
dark-store-app/
├── backend/          # API Express.js (Node.js)
│   ├── src/
│   │   ├── controllers/     # Logique métier
│   │   ├── services/        # Services métier
│   │   ├── repositories/    # Accès aux données
│   │   ├── middlewares/     # Authentification, permissions, erreurs
│   │   ├── modules/         # Modules métier isolés
│   │   ├── routes/          # Routes API
│   │   ├── validators/      # Validation des données
│   │   ├── utils/           # Utilitaires
│   │   └── server.js        # Point d'entrée
│   └── prisma/              # Configuration BD
└── frontend/         # Interface React (Vite)
    └── src/
        ├── pages/          # Pages par module
        ├── components/     # Composants réutilisables
        ├── api/            # Clients API
        ├── context/        # Contexte (Auth)
        ├── layouts/        # Layouts
        └── routes/         # Définition des routes
```

---

## 🔐 ARCHITECTURE D'AUTHENTIFICATION & PERMISSION

### Modèles de Base (Phase 1)

#### 1. **User (Utilisateur)**
- **Champs:**
  - `id` (INT, clé primaire)
  - `full_name` (TEXT)
  - `email` (UNIQUE, identifiant)
  - `password_hash` (TEXT)
  - `phone` (TEXT, optionnel)
  - `status` (STRING: "active" par défaut)
  - `created_at`, `updated_at` (TIMESTAMPS)

- **Relations:**
  - N:M avec Role via UserRole
  - Créateur/modifieur de Regions, AppConfig, Packs, etc.

#### 2. **Role (Rôle)**
- **Champs:**
  - `id` (INT, clé primaire)
  - `name` (TEXT)
  - `code` (UNIQUE)
  - `description` (TEXT)
  - `status` (STRING: "active" par défaut)

- **Relations:**
  - N:M avec Permission via RolePermission
  - N:M avec User via UserRole

#### 3. **Permission (Permission)**
- **Champs:**
  - `id` (INT, clé primaire)
  - `name` (TEXT)
  - `code` (UNIQUE)
  - `module` (STRING) - Identifie le module
  - `description` (TEXT)

- **Codes de Permission:**
  ```
  - users.view / users.create / users.update / users.delete
  - roles.view / roles.create / roles.update / roles.delete
  - permissions.view / permissions.assign
  - dashboard.view
  - customers.view
  ```

#### 4. **UserRole (Association User-Role)**
- Lien N:M entre User et Role
- `UNIQUE(user_id, role_id)` - Un utilisateur ne peut pas avoir deux fois le même rôle

#### 5. **RolePermission (Association Role-Permission)**
- Lien N:M entre Role et Permission
- `UNIQUE(role_id, permission_id)` - Un rôle ne peut pas avoir deux fois la même permission

---

## 🔌 MODULES DE L'APPLICATION

### **1. MODULE AUTHENTIFICATION (Auth)**

#### Responsabilité:
Gérer la connexion, les sessions et les profils utilisateurs

#### Routes API:
```
POST   /api/auth/login              - Connexion
GET    /api/auth/me                 - Récupérer le profil actuel
POST   /api/auth/logout             - Déconnexion
```

#### Contrôleurs:
- **AuthController**
  - `login(email, password)` → retourne JWT + userData
  - `me()` → profil utilisateur avec permissions
  - `logout()` → invalide la session

#### Service Auth:
- `login(email, password)` 
  - Recherche user par email
  - Vérifie password avec bcrypt
  - Génère JWT (secret dans config/jwt.js)
  - Retourne token + user info + permissions

#### Flux d'Authentification:
1. Utilisateur saisit email + password → Login
2. Backend vérifie credentials
3. Backend génère JWT + récupère permissions
4. Frontend stocke JWT dans localStorage
5. Chaque requête inclut: `Authorization: Bearer <JWT>`
6. Middleware vérifie token + charge permissions

#### Middleware (auth.middleware.js):
- Valide le JWT
- Charge user avec roles et permissions
- Ajoute `req.user` et `req.userPermissions`

---

### **2. MODULE UTILISATEURS (Users)**

#### Responsabilité:
Gestion CRUD des utilisateurs système

#### Routes API:
```
GET    /api/users                   - Liste des utilisateurs
POST   /api/users                   - Créer utilisateur
GET    /api/users/:id               - Détail utilisateur
PUT    /api/users/:id               - Mettre à jour
DELETE /api/users/:id               - Supprimer
```

#### Permissions Requises:
- `users.view` - Voir les utilisateurs
- `users.create` - Créer
- `users.update` - Modifier
- `users.delete` - Supprimer

#### Validations:
- Email unique et valide
- Password fort (validateur express-validator)
- Full name requis
- Phone optionnel

#### Workflows:
- **Création:** Email + Password + Fullname → Hash password + Créer user
- **Édition:** Mettre à jour infos + optionnellement password
- **Suppression:** Soft delete possible (status = "inactive")

---

### **3. MODULE RÔLES (Roles)**

#### Responsabilité:
Gérer les rôles et assigner les permissions

#### Routes API:
```
GET    /api/roles                   - Liste des rôles
POST   /api/roles                   - Créer rôle
GET    /api/roles/:id               - Détail rôle
PUT    /api/roles/:id               - Mettre à jour
DELETE /api/roles/:id               - Supprimer
POST   /api/roles/:id/permissions   - Assigner permissions
GET    /api/roles/:id/permissions   - Lister permissions du rôle
```

#### Permissions Requises:
- `roles.view`, `roles.create`, `roles.update`, `roles.delete`
- `permissions.assign` - Assigner permissions aux rôles

#### Données:
```
{
  "name": "Manager",
  "code": "manager",
  "description": "Gestionnaire magasin",
  "status": "active",
  "permissions": [
    { "id": 1, "code": "users.view" },
    { "id": 2, "code": "dashboard.view" }
  ]
}
```

---

### **4. MODULE PERMISSIONS (Permissions)**

#### Responsabilité:
Référentiel des permissions système (lecture seule)

#### Routes API:
```
GET    /api/permissions             - Lister toutes les permissions
```

#### Structure Permission:
```
{
  "id": 1,
  "name": "View Users",
  "code": "users.view",
  "module": "users",
  "description": "Afficher la liste des utilisateurs"
}
```

#### Permissions Définies:
- **Module Users:** view, create, update, delete
- **Module Roles:** view, create, update, delete
- **Module Dashboard:** view
- **Module Customers:** view
- **Module Permissions:** view, assign

---

### **5. MODULE CATALOGUE (Catalog)**

#### Responsabilité:
Gestion complète du catalogue produits (articles, SKU, images, référentiels)

#### Sous-Entités Référentielles:

##### **A) Families (Familles)**
Groupement top-level des produits
- Champs: `name_fr`, `name_ar`, `code`, `description_fr/ar`, `image_path`, `icon_path`, `status`
- Relations: N articles
- Routes:
  ```
  GET/POST   /api/catalog/families
  GET/PUT/DELETE /api/catalog/families/:id
  ```

##### **B) Categories (Catégories)**
Deuxième niveau de hiérarchie
- Champs: `name_fr/ar`, `code`, `family_id`, `description_fr/ar`, `status`
- Relations: FK → Family, N SubCategories
- Routes:
  ```
  GET/POST   /api/catalog/categories
  GET/PUT/DELETE /api/catalog/categories/:id
  ```

##### **C) SubCategories (Sous-catégories)**
Troisième niveau
- Champs: `name_fr/ar`, `code`, `category_id`, `description_fr/ar`, `status`
- Relations: FK → Category, N Articles
- Routes:
  ```
  GET/POST   /api/catalog/sub-categories
  GET/PUT/DELETE /api/catalog/sub-categories/:id
  ```

##### **D) Brands (Marques)**
Marques des produits
- Champs: `name_fr/ar`, `code`, `logo`, `description_fr/ar`, `status`
- Relations: N Articles
- Routes:
  ```
  GET/POST   /api/catalog/brands
  GET/PUT/DELETE /api/catalog/brands/:id
  ```

##### **E) Units (Unités)**
Unités de mesure (kg, L, etc.)
- Champs: `name_fr/ar`, `short_name_fr/ar`, `code`, `status`
- Relations: N PackagingTypes
- Routes:
  ```
  GET/POST   /api/catalog/units
  GET/PUT/DELETE /api/catalog/units/:id
  ```

##### **F) PackagingTypes (Types d'Emballage)**
Combinaison unité + quantité
- Champs: `name_fr/ar`, `code`, `quantity`, `unit_id`, `status`
- Relations: FK → Unit
- Routes:
  ```
  GET/POST   /api/catalog/packaging-types
  GET/PUT/DELETE /api/catalog/packaging-types/:id
  ```

##### **G) ArticleTypes (Types d'Article)**
Classification (frais, congelé, etc.)
- Champs: `name_fr/ar`, `code`, `status`
- Routes:
  ```
  GET/POST   /api/catalog/article-types
  GET/PUT/DELETE /api/catalog/article-types/:id
  ```

##### **H) ArticleStatuses (Statuts d'Article)**
États (actif, inactif, archivé)
- Champs: `name`, `code`, `status`
- Routes:
  ```
  GET/POST   /api/catalog/article-statuses
  GET/PUT/DELETE /api/catalog/article-statuses/:id
  ```

##### **I) ConservationTypes (Types de Conservation)**
Conditions de stockage
- Champs: `name_fr/ar`, `code`, `status`
- Routes:
  ```
  GET/POST   /api/catalog/conservation-types
  GET/PUT/DELETE /api/catalog/conservation-types/:id
  ```

##### **J) Taxes (Taxes)**
Taux de taxation
- Champs: `name`, `code`, `rate`, `status`
- Routes:
  ```
  GET/POST   /api/catalog/taxes
  GET/PUT/DELETE /api/catalog/taxes/:id
  ```

#### **Articles (Produits)**
Entité principale du catalogue
- Champs:
  ```
  {
    "id": INT,
    "code": STRING (UNIQUE),
    "name_fr": STRING,
    "name_ar": STRING,
    "description_fr": TEXT,
    "description_ar": TEXT,
    "barcode": STRING,
    "family_id": INT (FK),
    "category_id": INT (FK),
    "sub_category_id": INT (FK),
    "brand_id": INT (FK),
    "article_type_id": INT (FK),
    "article_status_id": INT (FK),
    "conservation_type_id": INT (FK),
    "tax_id": INT (FK),
    "status": STRING ("active" par défaut)
  }
  ```

- Routes:
  ```
  GET/POST   /api/catalog/articles
  GET/PUT/DELETE /api/catalog/articles/:id
  GET/POST   /api/catalog/articles/:articleId/images
  GET/PUT/DELETE /api/catalog/articles/:articleId/images/:imageId
  GET/POST   /api/catalog/articles/:articleId/sku-images
  GET/PUT/DELETE /api/catalog/articles/:articleId/sku-images/:skuImageId
  ```

#### **SKUs (Unités de Stock)**
Variantes/déclinaisons d'articles
- Champs:
  ```
  {
    "id": INT,
    "code": STRING (UNIQUE),
    "article_id": INT (FK),
    "packaging_type_id": INT (FK),
    "price": DECIMAL,
    "quantity_on_hand": INT,
    "status": STRING
  }
  ```

- Routes:
  ```
  GET/POST   /api/catalog/skus
  GET/PUT/DELETE /api/catalog/skus/:id
  ```

#### **SKU Images**
Images des SKU
- Champs: `sku_id`, `image_path`, `image_order`, `is_primary`
- Routes:
  ```
  GET/POST   /api/catalog/sku-images
  GET/PUT/DELETE /api/catalog/sku-images/:id
  ```

#### Hiérarchie de Données:
```
Family
  └── Category
        └── SubCategory
              └── Article
                    ├── ArticleImage
                    └── SKU
                          ├── SKUImage
                          └── Lien → PackagingType
                                └── Unit
```

---

### **6. MODULE LOCALISATION (Location)**

#### Responsabilité:
Gestion de la géographie (régions, provinces, villes)

#### **Regions (Régions)**
- Champs: `name_fr/ar`, `code`, `country`, `status`
- Audit: `created_by`, `updated_by`, `deleted_by` (FK → User)
- Routes:
  ```
  GET/POST   /api/regions
  GET/PUT/DELETE /api/regions/:id
  ```

#### **Provinces**
- Champs: `name_fr/ar`, `code`, `region_id`, `status`
- Routes:
  ```
  GET/POST   /api/provinces
  GET/PUT/DELETE /api/provinces/:id
  ```

#### **Cities (Villes)**
- Champs: `name_fr/ar`, `code`, `province_id`, `latitude`, `longitude`, `status`
- Routes:
  ```
  GET/POST   /api/cities
  GET/PUT/DELETE /api/cities/:id
  ```

#### Hiérarchie:
```
Region → Province → City
```

---

### **7. MODULE NŒUDS (Node)**

#### Responsabilité:
Gestion des points de vente/livraison (magasins, entrepôts)

#### **NodeTypes (Types de Nœud)**
Types de points: Magasin, Entrepôt, Centre de distribution, etc.
- Champs: `name_fr/ar`, `code`, `description_fr/ar`, `status`
- Routes:
  ```
  GET/POST   /api/node-types
  GET/PUT/DELETE /api/node-types/:id
  ```

#### **Nodes (Nœuds/Points)**
Points de vente physiques
- Champs:
  ```
  {
    "id": INT,
    "code": STRING,
    "name_fr": STRING,
    "name_ar": STRING,
    "node_type_id": INT (FK),
    "city_id": INT (FK),
    "address": TEXT,
    "latitude": DECIMAL,
    "longitude": DECIMAL,
    "phone": STRING,
    "email": STRING,
    "status": STRING
  }
  ```
- Routes:
  ```
  GET/POST   /api/nodes
  GET/PUT/DELETE /api/nodes/:id
  GET        /api/nodes/:nodeId/slots
  POST       /api/nodes/:nodeId/slots
  ```

#### **DeliverySlots (Créneaux de Livraison)**
Plages horaires de livraison par nœud
- Champs: `node_id`, `day_of_week`, `start_time`, `end_time`, `capacity`, `status`
- Routes:
  ```
  POST       /api/nodes/:nodeId/slots
  PUT        /api/slots/:slotId
  DELETE     /api/slots/:slotId
  ```

---

### **8. MODULE P0 (Hub de Gestion Générique)**

#### Responsabilité:
Interface CRUD générique pour les tables du registre P0

#### Concept:
- **Registre P0:** Listing de toutes les tables avec métadonnées
- **CRUD Générique:** Créer, lire, mettre à jour, supprimer pour n'importe quelle table
- **Accès Contrôlé:** Permission `dashboard.view` requis (sauf `customers` qui accepte aussi `customers.view`)

#### Routes API:
```
GET    /api/p0/registry                    - Registre de toutes les tables
GET    /api/p0/table/:sql                  - Métadonnées d'une table
GET    /api/p0/relations                   - Graphe de relations
GET    /api/p0/relations/:sql              - Relations d'une table

GET    /api/p0/crud/:sql/meta              - Métadonnées CRUD
GET    /api/p0/crud/:sql                   - Lister (avec pagination)
POST   /api/p0/crud/:sql                   - Créer
GET    /api/p0/crud/:sql/:id               - Détail
PUT    /api/p0/crud/:sql/:id               - Mettre à jour
DELETE /api/p0/crud/:sql/:id               - Supprimer

GET    /api/p0/crud/refs/:sql/options      - Options pour références FK
```

#### Utilisation:
- Frontend utilise `sql` (nom @@map de la table)
- Exemple: `GET /api/p0/crud/families?page=1&limit=10`
- Retourne structure uniforme avec pagination

#### Permissions:
- Accès standard: `dashboard.view`
- Table `customers`: `dashboard.view` OU `customers.view`

---

### **9. MODULE CLIENTS (Customers)**

#### Responsabilité:
Gestion des clients (acheteurs finaux)

#### Routes API:
```
GET    /api/customers                 - Liste des clients
GET    /api/customers/:id             - Détail client
```

#### Permissions:
- `customers.view` - Voir les clients

#### Données Client:
```
{
  "id": INT,
  "name": STRING,
  "email": STRING,
  "phone": STRING,
  "address": TEXT,
  "city_id": INT (FK),
  "status": STRING
}
```

#### Cas d'Usage:
- Dashboard affiche statistiques clients
- Suivi des commandes par client
- Historique achat

---

### **10. MODULE ENTREPÔT (Warehouse)** 
*[En développement - Actuellement vide]*

#### Futur Contenu Attendu:
- Gestion des stocks
- Mouvements d'inventaire
- Transferts entre nœuds
- Alertes de stock bas

---

## 📋 LISTES COMPLÈTES DES APIS

### **API d'Authentification**
```javascript
// Backend: /api/auth
POST   /login              body: { email, password }
GET    /me                 
POST   /logout             
```

### **API Utilisateurs**
```javascript
// Backend: /api/users
GET    /                   
POST   /                   body: { email, password, full_name, phone }
GET    /:id                
PUT    /:id                body: { updates }
DELETE /:id                
```

### **API Rôles**
```javascript
// Backend: /api/roles
GET    /                   
POST   /                   body: { name, code, description }
GET    /:id                
PUT    /:id                body: { updates }
DELETE /:id                
POST   /:id/permissions    body: { permissionIds: [1,2,3] }
GET    /:id/permissions    
```

### **API Permissions**
```javascript
// Backend: /api/permissions
GET    /                   
```

### **API Catalogue - Référentiels**
```javascript
// Backend: /api/catalog/families|categories|sub-categories|brands|units|packaging-types|article-types|article-statuses|conservation-types|taxes

GET    /                   params: { page, limit, all: true }
POST   /                   body: { data with name_fr, name_ar, ... }
GET    /:id                
PUT    /:id                body: { updates }
DELETE /:id                
```

### **API Catalogue - Articles & SKU**
```javascript
// Backend: /api/catalog/articles
GET    /                   
POST   /                   body: { code, name_fr, name_ar, family_id, category_id, ... }
GET    /:id                
PUT    /:id                
DELETE /:id                

GET    /:articleId/images  
POST   /:articleId/images  body: FormData { image, description_fr, description_ar }
PUT    /:articleId/images/:imageId
DELETE /:articleId/images/:imageId

GET    /:articleId/sku-images
POST   /:articleId/sku-images
PUT    /:articleId/sku-images/:skuImageId
DELETE /:articleId/sku-images/:skuImageId

// Backend: /api/catalog/skus
GET    /                   
POST   /                   body: { code, article_id, packaging_type_id, price }
GET    /:id                
PUT    /:id                
DELETE /:id                

// Backend: /api/catalog/sku-images
GET    /                   
POST   /                   
PUT    /:id                
DELETE /:id                
```

### **API Localisation**
```javascript
// Backend: /api/regions | /api/provinces | /api/cities
GET    /                   params: { page, limit }
POST   /                   body: { name_fr, name_ar, code, ... }
GET    /:id                
PUT    /:id                
DELETE /:id                
```

### **API Nœuds**
```javascript
// Backend: /api/node-types
GET    /                   
POST   /                   
GET    /:id                
PUT    /:id                
DELETE /:id                

// Backend: /api/nodes
GET    /                   
POST   /                   body: { code, name_fr, name_ar, node_type_id, city_id, ... }
GET    /:id                
PUT    /:id                
DELETE /:id                
GET    /:nodeId/slots      
POST   /:nodeId/slots      body: { day_of_week, start_time, end_time, capacity }
PUT    /slots/:slotId      
DELETE /slots/:slotId      
```

### **API P0 (Générique)**
```javascript
// Backend: /api/p0
GET    /registry           
GET    /table/:sql         
GET    /relations          
GET    /relations/:sql     

GET    /crud/:sql/meta     
GET    /crud/:sql          params: { page, limit, filters... }
POST   /crud/:sql          body: { data }
GET    /crud/:sql/:id      
PUT    /crud/:sql/:id      body: { updates }
DELETE /crud/:sql/:id      

GET    /crud/refs/:sql/options
```

### **API Clients**
```javascript
// Backend: /api/customers
GET    /                   
GET    /:id                
```

---

## 🎨 INTERFACE FRONTEND - PARCOURS UTILISATEUR

### **Phase 1: Authentification (Non-Authentifié)**

#### Page: Login (`/login`)
```
[Dark Store Logo]
┌─────────────────────────┐
│  Connexion              │
├─────────────────────────┤
│  Email:     [_________] │
│  Password:  [_________] │
│             [Se Connecter]
│             [Oublié password?]
└─────────────────────────┘
```

**Flux:**
1. Utilisateur saisit email + password
2. Clique "Se Connecter"
3. Frontend appelle `POST /api/auth/login`
4. Backend valide credentials, génère JWT
5. JWT stocké dans localStorage
6. Redirection vers `/dashboard`

---

### **Phase 2: Tableau de Bord (Authentifié)**

#### Page: Dashboard (`/dashboard`)
Affiche:
- **Vue d'ensemble:** Statistiques clients, stocks, ventes
- **Liens rapides:** Vers modules principaux

Navigation globale:
```
┌─────────────────────────────────────────┐
│ [Logo]  Dark Store      [User] [Logout] │
├──────────────────────────────────────────┤
│ ☰ Sidebar                                 │
│  ├─ Dashboard                             │
│  ├─ Catalogue                             │
│  │   ├─ Articles                          │
│  │   ├─ SKU                               │
│  │   └─ Référentiels                      │
│  ├─ Géographie                            │
│  │   ├─ Régions                           │
│  │   ├─ Provinces                         │
│  │   ├─ Villes                            │
│  │   └─ Nœuds                             │
│  ├─ Clients                               │
│  ├─ Gestion Utilisateurs                  │
│  │   ├─ Utilisateurs                      │
│  │   ├─ Rôles                             │
│  │   └─ Permissions                       │
│  └─ P0 Hub                                │
│                                            │
│  [Contenu Principal]                      │
│  Affichage selon la page sélectionnée     │
│                                            │
└──────────────────────────────────────────┘
```

---

### **Phase 3: Gestion des Utilisateurs**

#### Page: Liste Utilisateurs (`/users`)
```
┌─────────────────────────────────┐
│ Utilisateurs                    │
├─────────────────────────────────┤
│ [+ Nouvel Utilisateur]          │
├─────────────────────────────────┤
│ ID │ Email │ Nom │ Téléphone   │
├────┼───────┼─────┼─────────────┤
│ 1  │ admin@│ ADM │ +213...     │
│ 2  │ user@ │ USR │ +213...     │
└─────────────────────────────────┘
```

**Actions:** Voir détail, Éditer, Supprimer

#### Page: Créer/Éditer Utilisateur (`/users/new`, `/users/:id/edit`)
```
Formulaire:
  Email:      [____________]
  Password:   [____________]
  Fullname:   [____________]
  Phone:      [____________]
  Rôles:      [Checkboxes]
              ☐ Admin
              ☐ Manager
              ☐ Viewer
  
  [Créer]  [Annuler]
```

---

### **Phase 4: Gestion des Rôles**

#### Page: Liste Rôles (`/roles`)
```
Rôles définis:
- Admin (code: admin)
  Permissions: [tous accès]
  
- Manager (code: manager)
  Permissions: [catalogue, users.view, dashboard]
  
- Viewer (code: viewer)
  Permissions: [dashboard.view, customers.view]
```

#### Page: Éditer Rôle (`/roles/:id/edit`)
```
Nom:        [Manager_______]
Code:       [manager_______]
Description:[_____________]

Permissions:
☐ users.view
☐ users.create
☐ users.update
☐ users.delete
☐ roles.view
☐ roles.create
...

[Sauvegarder]
```

---

### **Phase 5: Gestion du Catalogue**

#### Page: Tableau de Bord Catalogue (`/catalog`)
```
Liens aux sections:
- Familles (Families)
- Catégories
- Sous-catégories
- Marques
- Unités
- Types d'Emballage
- Types d'Article
- Statuts d'Article
- Types de Conservation
- Taxes
- Articles
- SKU
- Images SKU
```

#### Page: Liste Articles (`/catalog/articles`)
```
Tableau:
ID │ Code │ Nom FR │ Catégorie │ Marque │ Statut
───┼──────┼────────┼───────────┼────────┼──────
1  │ ART1 │ Sucre  │ Aliments  │ Brand1 │ Active
2  │ ART2 │ Farine │ Aliments  │ Brand2 │ Active

[+ Nouvel Article]  [Filtres]
```

#### Page: Créer/Éditer Article (`/catalog/articles/new`, `/catalog/articles/:id/edit`)
```
Formulaire:
Code:               [ART001________]
Nom (FR):           [Sucre Blanc___]
Nom (AR):           [السكر الأبيض]
Famille:            [▼ Aliments]
Catégorie:          [▼ Sucres]
Sous-catégorie:     [▼ Sucre Blanc]
Marque:             [▼ Brand Name]
Type Article:       [▼ Produit Sec]
Statut:             [▼ Actif]
Conservation:       [▼ Stockage Sec]
Taxe:               [▼ 19%]
Code Barre:         [123456789____]
Description (FR):   [_____________]
Description (AR):   [_____________]

[Sauvegarder]
```

#### Page: Créer/Éditer SKU (`/catalog/skus`)
```
Tableau SKU:
ID │ Code  │ Article │ Emballage │ Prix │ Stock
───┼───────┼─────────┼───────────┼──────┼──────
1  │ SKU01 │ Sucre   │ 1kg       │ 300  │ 500

[Formulaire Création]
Code SKU:           [SKU001______]
Article:            [▼ Sucre]
Type Emballage:     [▼ 1kg]
Prix:               [300________]
Quantité Stock:     [500________]
```

#### Page: Gérer Images SKU (`/catalog/sku-images`)
```
Galerie d'images SKU:
[Image1] [Image2] [Image3] [+ Ajouter]

Pour chaque image:
- Éditer
- Définir comme primaire
- Supprimer
```

---

### **Phase 6: Gestion de la Géographie**

#### Pages: Régions, Provinces, Villes
```
Chacune suit le même pattern:

Tableau listant l'entité
Colonnes: ID │ Nom FR │ Nom AR │ Code │ Statut │ Actions

[+ Nouvelle Entity]

Clic sur une ligne → Édition
```

#### Page: Créer/Éditer Région (`/geo/regions/:id/edit`)
```
Nom (FR):       [Alger________]
Nom (AR):       [الجزائر____]
Code:           [DZ_DZ________]
Pays:           [Algérie______]
```

#### Page: Créer/Éditer Province (`/geo/provinces/:id/edit`)
```
Nom (FR):       [Algérois______]
Nom (AR):       [الجزائريين__]
Région:         [▼ Alger]
Code:           [DZ_DZ_01______]
```

#### Page: Créer/Éditer Ville (`/geo/cities/:id/edit`)
```
Nom (FR):       [Alger Centre__]
Nom (AR):       [وسط الجزائر]
Province:       [▼ Algérois]
Code:           [DZ_DZ_01_01___]
Latitude:       [36.7538_____]
Longitude:      [-3.0588______]
```

---

### **Phase 7: Gestion des Nœuds**

#### Page: Types de Nœuds (`/node-types`)
```
Types disponibles:
- Magasin
- Entrepôt
- Centre de Distribution
```

#### Page: Liste Nœuds (`/nodes`)
```
Tableau:
ID │ Code  │ Nom  │ Type   │ Ville  │ Adresse │ Statut
───┼───────┼──────┼────────┼────────┼────────┼──────
1  │ N001  │ MA01 │ Magasin│ Alger  │ Rue... │ Actif
```

#### Page: Créer/Éditer Nœud (`/nodes/:id/edit`)
```
Code:           [N001_________]
Nom (FR):       [Magasin Alger]
Nom (AR):       [متجر الجزائر]
Type Nœud:      [▼ Magasin]
Ville:          [▼ Alger]
Adresse:        [Rue de la Paix]
Latitude:       [36.7538____]
Longitude:      [-3.0588____]
Téléphone:      [+213 21 74...]
Email:          [node@...____]

Créneaux Livraison:
Jour │ Heure Début │ Heure Fin │ Capacité
─────┼─────────────┼───────────┼──────
Lun  │ 08:00       │ 16:00     │ 50
Mar  │ 08:00       │ 16:00     │ 50
...

[+ Ajouter Créneau]
```

---

### **Phase 8: Hub P0 (Gestion Générique)**

#### Page: Listing P0 (`/p0/tables`)
```
Registre de tables:
- families
- categories
- sub_categories
- brands
- articles
- skus
- regions
- provinces
- cities
- nodes
- customers
- users
- roles
- permissions
...

Chaque table → Clic → Page de gestion CRUD générique
```

#### Page: Gestion Table P0 (`/p0/tables/:sql`)
```
Exemple: /p0/tables/families

Tableau Familles:
ID │ Nom FR    │ Nom AR   │ Code  │ Statut
───┼───────────┼──────────┼───────┼─────
1  │ Alimentes │ غذائيات │ FOOD  │ Act
2  │ Électronq │ إلكترون  │ ELEC  │ Act

[Créer] [Filtrer] [Exporter]

Clic ligne → Édition générique
```

---

### **Phase 9: Gestion des Clients**

#### Page: Liste Clients (`/customers`)
```
Tableau:
ID │ Nom  │ Email │ Téléphone │ Ville │ Statut
───┼──────┼───────┼───────────┼───────┼──────
1  │ Ali  │ a@... │ +213...   │ Alger │ Act
2  │ Fati │ f@... │ +213...   │ Oran  │ Act
```

#### Page: Détail Client (`/customers/:id`)
```
Infos Client:
- Nom: Ali Ahmed
- Email: ali@email.com
- Téléphone: +213 21 74
- Adresse: Rue...
- Ville: Alger

Historique Achats:
Commande │ Date      │ Total  │ Statut
──────────┼───────────┼────────┼─────
#1001    │ 2026-05-01│ 15000  │ Livrée
#1002    │ 2026-05-03│ 8500   │ En cours
```

---

## 🔄 PARCOURS UTILISATEUR PREMIER ACCÈS

### **Étape 1: Accès Application**
```
Utilisateur tape URL → http://localhost:5173
         ↓
Vérifie localStorage.getItem('token')
         ↓
Token existe? → Charge user profile (/api/auth/me) → Dashboard
Token absente → Redirection /login
```

### **Étape 2: Authentification**
```
Page Login affichée
         ↓
Saisit email + password
         ↓
POST /api/auth/login
         ↓
Backend:
  - Recherche user par email
  - Vérifie password (bcrypt)
  - Charge user.roles.permissions
  - Génère JWT
         ↓
Response: { token, user: { id, email, name, permissions: ['users.view', ...] } }
         ↓
Frontend:
  - Stocke token dans localStorage
  - Stocke user dans AuthContext
  - Redirection vers /dashboard
```

### **Étape 3: Dashboard**
```
Affichage Dashboard avec:
- Barre latérale (Sidebar)
- Menu de navigation
- Widgets statistiques

Sidebar montre uniquement les modules
selon les permissions de l'utilisateur
```

### **Étape 4: Navigation Modules**

**Si permission `users.view`:**
```
Sidebar → Utilisateurs → GET /api/users → Affiche liste
```

**Si permission `dashboard.view`:**
```
Sidebar → P0 Hub → GET /api/p0/registry → Affiche toutes tables CRUD
```

**Si permission `customers.view`:**
```
Sidebar → Clients → GET /api/customers → Affiche liste
```

**Si permission `roles.view`:**
```
Sidebar → Rôles → GET /api/roles → Affiche liste rôles
```

### **Étape 5: Exemple Workflow Complet - Créer un Article**

1. Utilisateur clique "Catalogue" → "Articles"
2. Frontend: `GET /api/catalog/articles?page=1&limit=10`
3. Affichage liste articles

4. Clique "+ Nouvel Article"
5. Formulaire s'ouvre avec dropdowns:
   - `GET /api/catalog/families?all=true`
   - `GET /api/catalog/categories?all=true`
   - `GET /api/catalog/brands?all=true`
   - Etc.

6. Remplit: nom, code, famille, catégorie, marque, type, etc.

7. Clique "Sauvegarder"
8. Frontend: `POST /api/catalog/articles`
9. Validations serveur:
   - Code unique
   - Email format (si applicable)
   - Références FK existent
10. Crée Article
11. Redirection vers `/catalog/articles/:id/edit`
12. Peut ajouter images, créer SKU, etc.

---

## 🛡️ SÉCURITÉ - CONTRÔLE D'ACCÈS

### **Middleware de Permission**

```javascript
// Syntaxe: permissionMiddleware('permission.code')
// Vérifie req.userPermissions inclut le code

router.get('/users', 
  authMiddleware,                      // Doit être authentifié
  permissionMiddleware('users.view'),  // Doit avoir permission
  controller.getAll
);
```

### **Hiérarchie d'Accès**

```
Non-Authentifié
    ↓
[Page Login uniquement]
    ↓
    ↓ POST /api/auth/login (succès)
    ↓
Authentifié + Récupère Permissions
    ↓
[Dashboard + Menu selon permissions]
    ↓
Chaque action requiert permission spécifique
    ↓
Exemple:
- Voir utilisateurs: users.view
- Créer utilisateur: users.create
- Supprimer: users.delete
```

### **Exemple Permission Rôle Manager**
```
Rôle: Manager
Permissions:
  - users.view (voir liste)
  - dashboard.view (voir dashboard)
  - catalog.view (voir catalogue) [futur]
  - customers.view (voir clients)

Actions Bloquées:
  - POST /api/users (users.create - absent)
  - DELETE /api/roles/:id (roles.delete - absent)
  - PUT /api/articles/:id (absent)
```

---

## 🗄️ STOCKAGE DES FICHIERS

### **Directories:**
```
backend/
├── storage/
│   └── image/
│       └── article/        # Images articles
├── uploads/
│   ├── articles/           # Articles uploads
│   └── sku-images/         # Images SKU
```

### **Routes Statiques:**
```
GET  /uploads/:path         → Fichiers dans /uploads/
GET  /storage/:path         → Fichiers dans /storage/
```

### **Upload d'Images:**
```
Frontend: POST avec FormData
  - File: <image file>
  - Description_fr: "Sucre blanc"
  - Description_ar: "السكر الأبيض"

Backend Middleware (upload.middleware.js):
  - Valide type MIME
  - Sauvegarde dans storage/
  - Retourne path relatif
```

---

## 🚀 TECHNOLOGIE & STACK

### **Backend**
- **Runtime:** Node.js
- **Framework:** Express.js ^4.18.2
- **Database:** PostgreSQL via Prisma ^5.7.0
- **Auth:** JWT (jsonwebtoken ^9.0.2)
- **Passwords:** bcryptjs ^2.4.3
- **Validation:** express-validator ^7.0.1
- **Upload:** multer ^1.4.5-lts.1
- **CORS:** cors ^2.8.5
- **Logger:** morgan ^1.10.0
- **Dev:** nodemon ^3.0.2

### **Frontend**
- **Framework:** React ^18
- **Bundler:** Vite
- **Router:** react-router-dom
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Build Tool:** postcss, tailwind

### **Database**
- **SGBD:** PostgreSQL
- **ORM:** Prisma
- **Migrations:** Prisma Migrations
- **Seed:** Scripts custom

---

## 📊 DIAGRAMME FLUX AUTHENTIFICATION

```
┌─────────────────────────────────────────────────────────┐
│                  FLUX AUTHENTIFICATION                  │
└─────────────────────────────────────────────────────────┘

1. User tapes login/pwd
   ↓
2. Frontend POST /api/auth/login
   │
   ├─ Backend cherche user par email
   ├─ Valide password avec bcrypt
   ├─ Charge user_roles → roles → permissions
   ├─ Génère JWT(userId)
   └─ Retourne { token, user, permissions }
   
3. Frontend localStorage.setItem('token', token)
   ↓
4. Frontend setUser(userData) → AuthContext
   ↓
5. Redirection /dashboard
   ↓
6. Chaque requête future:
   Headers: { Authorization: "Bearer <token>" }
   ↓
7. Backend authMiddleware:
   ├─ Extrait token du header
   ├─ Vérifie JWT signature
   ├─ Charge user + permissions
   ├─ Ajoute req.user, req.userPermissions
   └─ Appel next()
   
8. permissionMiddleware('permission.code'):
   ├─ Vérifie permission dans req.userPermissions
   ├─ Si absent → 403 Forbidden
   └─ Si présent → Appel route handler
   
9. Token expiré?
   ├─ Frontend détecte 401
   ├─ Efface localStorage
   ├─ Redirection /login
   └─ User doit se reconnecter
```

---

## 📝 CONFIGURATION ENVIRONNEMENT

### **Backend (.env)**
```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/darkstore
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
BODY_LIMIT=10mb
CLIENT_URL=http://localhost:5173
```

### **Frontend (.env)**
```env
VITE_API_URL=http://localhost:5000/api
```

---

## ✅ CHECKLIST PREMIER DÉPLOIEMENT

- [ ] DB créée et migrée: `npm run db:migrate`
- [ ] Données seed: `npm run db:seed`
- [ ] Utilisateur admin créé: Script `seedAdmin.js`
- [ ] Rôles & Permissions initialisés
- [ ] Backend démarre: `npm run dev`
- [ ] Frontend démarre: `npm run dev`
- [ ] Login possible avec admin
- [ ] Menu affiche modules selon permissions
- [ ] CRUD simple article fonctionne
- [ ] Images uploads fonctionnent

---

## 🎓 RÉSUMÉ DES MODULES

| Module | Responsabilité | Routes | Permissions |
|--------|---|---|---|
| **Auth** | Login/Logout | POST /login, GET /me | Aucune |
| **Users** | Gestion utilisateurs | CRUD /users | users.* |
| **Roles** | Gestion rôles | CRUD /roles | roles.*, permissions.assign |
| **Permissions** | Listing permissions | GET /permissions | permissions.view |
| **Catalog** | Articles + Referentiels | CRUD /catalog/* | Aucune restrq |
| **Location** | Régions, Provinces, Villes | CRUD /regions, /provinces, /cities | dashboard.view |
| **Node** | Points vente, Créneaux | CRUD /node-types, /nodes, /slots | dashboard.view |
| **P0** | CRUD Générique | GET /p0/crud/* | dashboard.view |
| **Customers** | Clients | GET /customers | customers.view |
| **Warehouse** | [TBD] | - | - |

---

**Documentation générée le:** 5 mai 2026  
**Version Application:** 1.0.0  
**État:** En production

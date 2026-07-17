# DARK STORE APP — Rapport d'avancement projet

**Projet :** Dark Store App — Plateforme Quick Commerce  
**Stack :** Node.js + Express + Prisma/PostgreSQL · React (Vite) · React Native (Expo)  
**Dernière mise à jour :** 05/07/2026  
**Branches actives :** `main` (production) · `dev` · `Hajar` · `Div2` · `mourtafiaa/substitution-produit`

---

## 1. État global des modules

| Module | Backend | Frontend Web | Mobile | État | Dernière mise à jour |
|---|---|---|---|---|---|
| Auth & RBAC | ✅ | ✅ | N/A | **Complet** | Mai 2026 |
| Catalogue (familles, catégories, articles, SKUs, images) | ✅ | ✅ | ✅ | **Complet** | Mai 2026 |
| Geo / Nodes / Slots | ✅ | ✅ | Indirect | **Complet** | Mai 2026 |
| Clients & Adresses | ✅ | ✅ | ✅ | **Complet** | Mai 2026 |
| Checkout | ✅ | ✅ | ✅ | **Complet** | Mai 2026 |
| Orders / OMS | ✅ | ✅ | ✅ client | **Complet** | Mai 2026 |
| Warehouse (zones, niveaux, emplacements) | ✅ | ✅ | — | **Complet** | Mai 2026 |
| Stock (levels, moves, lots, rules, seuils) | ✅ | ✅ | — | **Complet** | Mai 2026 |
| Picking (sessions, scan EAN, portail web, app) | ✅ | ✅ | ✅ | **Complet** | Mai 2026 |
| Pickup (COD, confirm, cancel) | ✅ | ✅ | — | **Complet** | Mai 2026 |
| Livraison / Tours / Driver portal | ✅ | ✅ | ✅ | **Complet** | Mai 2026 |
| Staff (pickers, drivers) | ✅ | ✅ | — | **Complet** | Mai 2026 |
| Paiements / Stripe | ✅ | Partiel | ✅ | **Avancé** | Mai 2026 |
| Wallet & Loyalty / Referral | ✅ | Partiel | ✅ | **Avancé** | Mai 2026 |
| Promotions & Coupons | ✅ | ✅ | ✅ | **Nouveau ✨** | Juillet 2026 |
| FAQ & Support Chat | ✅ | ✅ | ✅ | **Nouveau ✨** | Juillet 2026 |
| Avis & Reviews | ✅ | ✅ | ✅ | **Nouveau ✨** | Juillet 2026 |
| Substitution produit | ✅ | ✅ | — | **Nouveau ✨** | Juillet 2026 |
| Reporting / Dashboard | ✅ | Partiel | — | **Partiel** | Mai 2026 |
| Mobile Customer | ✅ | N/A | ✅ | **Complet** | Juin 2026 |
| Mobile Picker | ✅ | N/A | ✅ | **Avancé** | Mai 2026 |
| Mobile Driver | ✅ | N/A | ✅ | **Avancé** | Mai 2026 |

---

## 2. Nouvelles fonctionnalités — Juillet 2026

### Promotions & Coupons
- Création et gestion des promotions (% ou montant fixe)
- Codes coupon avec date d'expiration et limite d'utilisation
- Application automatique au checkout
- Backoffice : liste, activation/désactivation, statistiques d'utilisation

### FAQ & Support Chat
- Module FAQ avec catégories et questions/réponses
- Chat support client en temps réel (Socket.IO)
- Interface backoffice de gestion des tickets
- App mobile customer : accès chat et FAQ intégrés

### Avis & Reviews (Reviews)
- Système de notation produits (1-5 étoiles)
- Commentaires clients avec modération backoffice
- Affichage sur la fiche article (app mobile + web)
- Statistiques avis par article

### Substitution produit (`mourtafiaa/substitution-produit`)
- Module complet de substitution lors du picking
- Suggestion automatique d'alternatives par SKU
- Validation picker + notification client
- Historique des substitutions par commande

---

## 3. Architecture technique

```
dark-store-app/
├── backend/              # Node.js + Express + Prisma
│   ├── prisma/           # Schéma PostgreSQL + migrations
│   ├── src/
│   │   ├── modules/      # Un dossier par domaine métier
│   │   ├── routes/       # index.js — routeur central
│   │   ├── socket/       # Socket.IO (picker, chat)
│   │   └── server.js
│   └── .env.example
├── frontend/             # React + Vite — backoffice admin
│   └── src/
│       ├── pages/        # Une page par module
│       ├── components/
│       └── routes/
├── mobile_rn/
│   └── customer_app/     # React Native + Expo
│       └── src/
│           ├── app/      # Expo Router (file-based routing)
│           ├── components/
│           └── services/ # API calls
└── README.md
```

---

## 4. Conventions API

| Élément | Valeur |
|---|---|
| Préfixe global | `/api` |
| Auth admin | `Authorization: Bearer <token>` |
| Auth customer | JWT sur routes `/api/customer/*` |
| Auth picker | JWT sur routes `/api/picker/*` |
| Auth driver | JWT sur routes `/api/driver/*` |
| Réponse standard | `{ success, message, data }` ou paginé |
| Uploads | `multipart/form-data` (catalogue, images) |
| Temps réel | Socket.IO (picker + chat support) |

---

## 5. APIs par module

### Auth & Users
`/api/auth` · `/api/users` · `/api/roles` · `/api/permissions`

### Catalogue
`/api/catalog/families` · `/api/catalog/categories` · `/api/catalog/sub-categories`  
`/api/catalog/brands` · `/api/catalog/articles` · `/api/catalog/skus`  
`/api/catalog/units` · `/api/catalog/taxes` · `/api/catalog/packaging-types`

### Geo & Nodes
`/api/regions` · `/api/provinces` · `/api/cities`  
`/api/node-types` · `/api/nodes` · `/api/slots`

### Clients
`/api/customers` · `/api/addresses`

### Customer Mobile
`/api/customer/auth` · `/api/customer/catalog` · `/api/customer/checkout`  
`/api/customer/me` · `/api/customer/me/orders` · `/api/customer/me/wallet`  
`/api/customer/me/notifications`

### Checkout Backoffice
`/api/checkout/meta` · `/api/checkout/eligible-nodes` · `/api/checkout/delivery-slots`  
`/api/checkout/calculate` · `/api/checkout/create-order`

### Orders / OMS
`/api/orders/statuses` · `/api/orders/delivery-slots`  
`/api/orders-mgmt` · `/api/orders-mgmt/:id/transitions` · `/api/orders-mgmt/:id/history`  
`/api/orders-mgmt/:id/assign-picker` · `/api/orders-mgmt/:id/confirm-pickup`

### Warehouse
`/api/warehouse/zones` · `/api/warehouse/levels`  
`/api/warehouse/locations` · `/api/warehouse/sku-locations`

### Stock
`/api/stock/levels` · `/api/stock/moves` · `/api/stock/lots`  
`/api/stock/selling-rules` · `/api/stock/reorder-rules` · `/api/stock/thresholds`

### Picking
`/api/picking/sessions` · `/api/picking/items`  
`/api/picker/login` · `/api/picker/available-orders` · `/api/picker/sessions/:id`

### Pickup
`/api/pickup/ready-orders` · `/api/pickup/orders/:id/collect-cod`  
`/api/pickup/orders/:id/confirm` · `/api/pickup/orders/:id/cancel`

### Livraison & Driver
`/api/delivery/tours` · `/api/delivery/stops`  
`/api/driver/login` · `/api/driver/tours` · `/api/driver/stops/:id`

### Staff
`/api/staff/pickers` · `/api/staff/drivers`

### Payment & Wallet
`/api/payment/methods` · `/api/payment/statuses`  
`/api/payment/stripe/create-intent` · `/api/payment/stripe/webhook` · `/api/payment/stripe/refund`  
`/api/wallet/transactions` · `/api/wallet/credit` · `/api/wallet/debit`

### Promotions & Coupons ✨
`/api/promotions` · `/api/promotions/:id`  
`/api/coupons` · `/api/coupons/apply` · `/api/coupons/validate`

### FAQ & Support Chat ✨
`/api/faq/categories` · `/api/faq/questions`  
`/api/support/tickets` · `/api/support/chat` (Socket.IO)

### Avis & Reviews ✨
`/api/reviews` · `/api/reviews/by-article/:articleId`  
`/api/reviews/:id/approve` · `/api/reviews/:id/reject`

### Substitution produit ✨
`/api/picking/items/:itemId/substitute`  
`/api/substitutions` · `/api/substitutions/suggestions/:skuId`

### Loyalty
`/api/loyalty/referrals` · `/api/loyalty/my-referrals`

### Reporting
`/api/reporting/dashboard` · `/api/reporting/orders` · `/api/reporting/picking`  
`/api/reporting/delivery` · `/api/reporting/stock` · `/api/reporting/payments`

---

## 6. Applications mobiles

| App | Stack | État | Couleur thème |
|---|---|---|---|
| Customer (`mobile_rn/customer_app`) | React Native + Expo | **Complet** | Rouge `#DC2626` |
| Picker (`mobile/picker_app`) | Flutter | **Avancé** | Violet `#7C3AED` |
| Driver (`mobile/driver_app`) | Flutter | **Avancé** | Emerald `#059669` |

### Lancer en local

```bash
# Backend
cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Mobile Customer
cd mobile_rn/customer_app && npm install && npx expo start --lan
```

---

## 7. Priorités restantes

| Priorité | Travail |
|---|---|
| P0 | Tests transactionnels PostgreSQL (checkout, stock) |
| P0 | Finaliser picking mobile : scan EAN offline/retry |
| P1 | Stripe webhook production + refunds complets |
| P1 | Wallet : ledger complet et réconciliation |
| P1 | Notifications push client et staff |
| P2 | Reporting avancé + exports |
| P2 | Promotions : règles avancées (combinaison, exclusions) |
| P2 | Reviews : pagination, tri, filtres avancés |

---

## 8. Branches

| Branche | Rôle | Dernier commit |
|---|---|---|
| `main` | Production — version stable | 05/07/2026 |
| `dev` | Développement principal | 07/06/2026 |
| `Hajar` | Features : promotions, FAQ, chat, reviews | 04/07/2026 |
| `Div2` | Picker app — alignement APIs + EAS build | Juin 2026 |
| `mourtafiaa/substitution-produit` | Module substitution produit picking | 02/07/2026 |

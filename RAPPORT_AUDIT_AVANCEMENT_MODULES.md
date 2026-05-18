# RAPPORT D'AUDIT D'AVANCEMENT DES MODULES

**Projet :** Dark Store App  
**Date d'audit :** 17/05/2026  
**Sources analysees :** `C:\Users\yassi\Downloads\Schema Database (3).xlsx.pdf`, `backend/prisma/schema.prisma`, `backend/src/modules`, `backend/src/routes`, `backend/src/middlewares`, `backend/src/seeders`, `backend/src/services`, `backend/src/controllers`, `frontend/src`, `mobile/customer_app`, `mobile/picker_app`, `mobile/driver_app`.

## 1. Resume executif

L'application Dark Store est deja largement structuree : le schema Prisma couvre la majorite du schema fonctionnel P0/P2/P3, avec une base PostgreSQL cible, des migrations, des modules backend CRUD, des pages web React et trois applications mobiles Flutter. L'etat reel n'est pas un simple module catalogue : le projet contient deja des briques checkout, clients, nodes, warehouse, stock, picking, pickup, staff, paiements, wallet, reporting et mobile customer.

| Indicateur | Estimation | Commentaire |
|---|---:|---|
| Avancement global projet | 62% | Socle data et backend tres avance, workflows finaux encore incomplets. |
| Backend global | 72% | Nombreux modules controller/service/repository/routes, JWT, RBAC, seeders, workflows checkout/picking. |
| Frontend web global | 60% | Backoffice riche : catalogue, clients, stock, warehouse, picking, pickup, staff, checkout, parametres. |
| Mobile customer | 55% | Auth, OTP, catalogue, panier, checkout, commandes, profil, wallet/points ecrans presents. |
| Mobile picker | 20% | Login et dashboard seulement dans l'app Flutter ; portail picker web plus avance. |
| Mobile driver | 15% | Login et dashboard seulement ; pas de tours/stops/navigation operationnels. |

**Modules critiques restants :** livraison/tours driver de bout en bout, COD livraison et comptoir, debit/credit wallet transactionnel complet, points/fidelite, notifications, audit logs, promotions checkout, quality checks, reporting KPI avance.

**Risques actuels :** incoherence partielle entre le schema theorique et le code (`wallet_txns` vs `wallet_transactions`, `notification_statuses` vs `notification_delivery_statuses`, `sku_families/sku_subfamilies` absents mais remplaces par `families/sub_categories`), workflows disponibles mais peu couverts par tests automatises, certaines transactions metier sensibles a valider en PostgreSQL reel.

## 2. Tableau global des modules

| Ordre | Module | Sous-module | Tables concernees | Backend | Frontend Web | Mobile | Etat % | Performance | Priorite | Reste a faire |
|---:|---|---|---|---|---|---|---:|---|---|---|
| 1 | Auth & RBAC | Admin login, users, roles, permissions, middleware | users, roles, permissions, user_roles, role_permissions, backoffice_admins | Avance | Avance | Partiel | 80 | A | P0 | Audit login, logins picker/driver a unifier, permissions_json theorique non implemente tel quel. |
| 2 | Lookup global | P0 generic tables + referentiels | regions, node_types, statuses, payment_methods, delivery_types, etc. | Avance | Avance | Non commence | 75 | B | P0 | Harmoniser noms PDF/Prisma, seeders exhaustifs, validations uniformes. |
| 3 | Clients | Customers, addresses, profile, wallet/points balances | customers, addresses | Avance | Avance | Avance | 70 | B | P0 | Historique client complet, referral workflow, controles anti-duplication. |
| 4 | Staff | Pickers, drivers, affectation node | pickers, drivers, nodes | Avance | Avance | Partiel | 65 | B | P0 | Mobile picker/driver operationnels, audit actions, reset password securise. |
| 5 | Catalogue | Marques, familles, categories, SKUs, images, taxes | brands, families, categories, sub_categories, articles, skus, sku_images, article_images, taxes, units | Avance | Avance | Partiel | 80 | A | P0 | Aligner `articles` avec cahier initial, finaliser categories mobiles et images. |
| 6 | Nodes | Nodes, node types, horaires, rayon, capacite | nodes, node_types, regions, provinces, cities | Avance | Avance | Partiel | 75 | B | P0 | Node configs plus visibles, contraintes par ville/region a valider. |
| 7 | Delivery Slots | Slots node + preferences | delivery_slots, order_slot_preferences, slot_assignment_sources | Partiel | Avance | Partiel | 55 | C | P0 | Table preferences absente, disponibilite par date et capacite reelle a finaliser. |
| 8 | Warehouse | Emplacements, zones, niveaux, mapping SKU | locations, zones, levels, sku_node_locations | Avance | Avance | Non commence | 70 | B | P1 | Emplacements secondaires, workflows scan rangement, filtres node. |
| 9 | Stock | Levels, moves, lots, selling/reorder rules | stock_levels, stock_moves, stock_lots, selling_rules, reorder_rules, stock_threshold_rules | Avance | Avance | Non commence | 70 | B | P0 | Reservation/decrement a tester bout en bout, incoming/backorder final. |
| 10 | Orders / OMS | Orders, items, statuses, histories | orders, order_items, order_statuses, order_item_statuses, order_histories | Avance | Avance | Partiel | 70 | B | P0 | Transitions strictes, annulation stock, payment relation complete. |
| 11 | Checkout Web | Panier, node, slots, paiement, create-order | orders, order_items, payments, stock_levels, delivery_slots | Avance | Avance | Avance | 70 | B | P0 | Tests transactionnels, calcul total durci, Stripe/wallet/mixed final. |
| 12 | Picking | Sessions, items, accept, scan EAN, complete | picking_sessions, picking_session_items, pickers, picking_statuses, pick_item_statuses | Avance | Avance | Partiel | 65 | B | P0 | App Flutter picker complete, substitutions/ruptures a valider. |
| 13 | Pickup | Ready pickup, detail, confirmation retrait | orders, payments, stock_levels | Partiel | Avance | Non commence | 50 | C | P0 | COD comptoir, delivered, decrement stock/reservation final. |
| 14 | Livraison / Tours | Drivers, tours, stops, COD driver | drivers, tours, tour_stops, tour_statuses, stop_statuses | Partiel | Non commence | Partiel | 30 | C | P1 | Assigner driver, route planning, mobile driver, delivery confirmation. |
| 15 | Paiements | Methods, statuses, COD, Stripe, wallet | payments, payment_methods, payment_statuses | Partiel | Partiel | Partiel | 45 | C | P0 | COD collect, Stripe test complet, refunds, mixed payment. |
| 16 | Wallet | Types, transactions, history | wallet_txn_types, wallet_transactions | Partiel | Partiel | Partiel | 35 | C | P1 | Harmoniser nom table, debit/credit/refund transactionnels, expiry. |
| 17 | Points / Fidelite | Rules, earn/redeem, history | points_rules, points_rule_types, customers | Partiel | Partiel | Partiel | 30 | D | P1 | Moteur earn/redeem, historique points, referral bonus. |
| 18 | Promotions | Types, promotions, coupons, flash sales, packs | promo_types, promotions, packs, pack_items, flash_sales | Partiel | Non commence | Non commence | 25 | D | P2 | Coupons, discount engine, promo checkout. |
| 19 | Gamification | Games, prizes, plays, rewards | game_types, game_play_periods, unlock_conditions, gamification_games, gamification_prizes, gamification_plays, prize_types | Partiel | Non commence | Non commence | 20 | D | P3 | Moteur jeu, claim prize, ecrans client. |
| 20 | Referral | Config, referrals, statuses, rewards | referral_config, referrals, referral_statuses | Partiel | Non commence | Partiel | 25 | D | P2 | Validation referral, rewards, suivi client. |
| 21 | Notifications | Channels, statuses, log, templates | notification_channels, notification_delivery_statuses, notifications | Partiel | Non commence | Partiel | 25 | D | P1 | Templates, push/sms/email, read_at, notifications_log theorique. |
| 22 | Audit & Logs | Audit logs et logs metier | order_histories, audit_logs theorique | Partiel | Non commence | Non commence | 25 | D | P2 | Table audit_logs absente, login/payment/stock/config logs. |
| 23 | Quality | Checks picking/delivery/stock | quality_check_types, quality_checks theorique | Partiel | Non commence | Non commence | 15 | D | P3 | Table quality_checks absente, workflow controles qualite. |
| 24 | Reporting / Dashboard | KPIs, exports | Plusieurs tables | Partiel | Partiel | Non commence | 35 | C | P2 | KPIs avances, exports PDF/Excel, filtres temps/node. |
| 25 | Mobile Customer | Auth, catalogue, panier, checkout, orders, wallet, points | customer APIs | Avance | N/A | Avance | 55 | B | P1 | Notifications, wallet/points reels, paiement avance. |
| 26 | Mobile Picker | Login, dashboard, sessions, scan | picker APIs, picking_sessions | Partiel | N/A | Partiel | 20 | D | P0 | Available orders, my orders, session detail, scan EAN. |
| 27 | Mobile Driver | Login, dashboard, tours/stops/COD | driver APIs, tours, tour_stops | Partiel | N/A | Partiel | 15 | D | P1 | Tours, navigation, COD, confirmation livraison. |

## 3. Modules deja developpes

| Module | Elements constates | Niveau |
|---|---|---|
| Auth & RBAC backoffice | `auth.routes`, `user.routes`, `role.routes`, `permission.routes`, JWT middleware, permission middleware, pages users/roles/permissions | Avance |
| Master Data Catalogue | Repositories/services/controllers/routes pour families, categories, subCategories, brands, units, packagingTypes, conservationTypes, articleTypes, articleStatuses, taxes, articles, images | Avance |
| Catalogue SKU logistique | `skus`, `sku_images`, `articleSkuImages`, pages `SkusPage`, `SkuImagesPage` | Avance |
| Location / Geo | Regions, provinces, cities, nodes, node types | Avance |
| Warehouse | Zones, levels, locations, sku node locations | Avance |
| Stock | Parametrage, stock levels, moves, lots, selling rules, reorder rules, threshold rules | Avance |
| Clients et adresses | Customers, addresses, customer auth/me | Avance |
| Checkout | Backend et frontend checkout, app mobile customer checkout | Avance |
| Orders management | Liste commandes, statuts, histories, transitions | Avance |
| Picking web | Sessions, items, statuts, portail picker web | Avance |
| Staff | Pickers et drivers backoffice | Avance |
| Pickup web | Liste/detail commandes pickup | Partiel avance |
| Payment lookups | Payment methods/statuses, Stripe routes/service | Partiel |
| Wallet txn types | Ref types + page | Partiel |
| Reporting | Route/service reporting | Partiel |
| Mobile customer | Auth, OTP, catalogue, panier, checkout, commandes, profil | Partiel avance |

## 4. Sous-modules deja developpes

| Domaine | Sous-modules existants |
|---|---|
| Backend modules | addresses, catalog, checkout, customers, customer_auth, customer_catalog, customer_checkout, customer_me, delivery, location, node, orders, orders_mgmt, p0, payment, picker_portal, picking, reporting, staff, stock, tours, wallet, warehouse |
| Frontend web pages | access, auth, catalog, checkout, customers, dashboard, delivery, location, orders, orders_mgmt, p0, payment, picker, picking, pickup, staff, stock, wallet, warehouse |
| Frontend API | auth, catalog, checkout, customers, delivery, locationNode, orders, orders_mgmt, p0, payment, pickerPortal, picking, pickup, roles, staff, stock, users, wallet, warehouse |
| Mobile customer | auth, customer_auth, addresses, catalog, cart, checkout, orders, profile, wallet/points screens |
| Mobile picker | auth, dashboard |
| Mobile driver | auth, dashboard |

## 5. Modules partiellement developpes

| Module | Pourquoi partiel |
|---|---|
| Delivery Slots | Slots presents, mais `order_slot_preferences` theorique absent et disponibilite par date/capacite a durcir. |
| Livraison / Tours | Tables `tours`/`tour_stops` et backend presents, mais workflow driver complet et mobile driver absents. |
| Paiements | Structure presente, COD/Stripe/wallet/mixed/refund non finalises bout en bout. |
| Wallet | `wallet_transactions` present mais schema theorique `wallet_txns`; logique transactionnelle partielle. |
| Points / Fidelite | Tables de regles et soldes clients, mais moteur earn/redeem/history absent ou incomplet. |
| Promotions / Packs | Tables presentes, peu ou pas d'interface/workflow checkout. |
| Gamification | Tables presentes, moteur et UI absents. |
| Referral | Tables presentes, workflow de validation/reward absent. |
| Notifications | Tables proches presentes, mais templates/log/read_at/push/sms/email non finalises. |
| Audit | `order_histories` existe, `audit_logs` general absent. |
| Quality | Lookup type present, table `quality_checks` absente. |
| Reporting | Service route present, KPIs/exports non complets. |

## 6. Modules manquants

| Module | Manque principal |
|---|---|
| Audit logs generalises | `audit_logs`, audit login, stock/payment/config/order action logs transverses. |
| Quality checks operationnels | `quality_checks`, controles picking/delivery/stock count. |
| Notifications operationnelles | Templates, logs detailles, read_at, push/sms/email/in_app. |
| Mobile picker complet | Available orders, my orders, session detail, scan EAN, complete session. |
| Mobile driver complet | Tours, stops, navigation, COD, confirmation livraison. |
| Promotions checkout | Coupon engine, flash sale enforcement, packs dans panier. |
| Points history | Historique de points separe et redeem transactionnel. |
| Refunds | Remboursements COD/Stripe/wallet et reintegration stock si retour. |

## 7. Tables existantes dans Prisma / base de donnees

Le schema Prisma contient 86 modeles. Les migrations presentes sont : `20260501085238_initial_schema`, `20260504111644_`, `20260505200000_warehouse_module`, `20260505202427_init`, `20260506000000_warehouse_zones_levels`, `20260510000000_add_color_to_statuses`.

| Groupe | Tables Prisma constatees |
|---|---|
| Auth/RBAC | users, roles, permissions, role_permissions, user_roles, backoffice_admins |
| Staff/Picking | pickers, drivers, picking_sessions, picking_session_items |
| Catalogue | families, categories, sub_categories, brands, units, packaging_types, conservation_types, article_types, article_statuses, taxes, articles, skus, sku_images, article_images |
| Geo/Nodes | regions, provinces, cities, node_types, nodes, delivery_slots |
| P0 lookups | stock_operations, move_types, stock_statuses, inventory_types, inventory_statuses, inventory_gap_types, order_statuses, order_item_statuses, order_slot_statuses, payment_statuses, payment_methods, tour_statuses, stop_statuses, picking_statuses, pick_item_statuses, referral_statuses, wallet_txn_types, prize_types, game_types, game_play_periods, unlock_conditions, promo_types, points_rule_types, reward_types, notification_channels, notification_delivery_statuses, quality_check_types, config_value_types, costing_methods, delivery_types, slot_assignment_sources |
| Clients | customers, addresses |
| Stock/Warehouse | stock_levels, selling_rules, reorder_rules, stock_threshold_rules, stock_moves, stock_lots, zones, levels, locations, sku_node_locations, suppliers |
| Orders/Paiements | orders, order_items, order_histories, payments, app_configs |
| Promotions/Gamification/Referral | packs, pack_items, flash_sales, promotions, points_rules, referral_config, referrals, gamification_games, gamification_prizes, gamification_plays |
| Tours/Wallet/Notifications | tours, tour_stops, wallet_transactions, notifications |

## 8. Tables prevues dans le schema mais absentes du code

| Table schema fourni | Etat code | Commentaire |
|---|---|---|
| user_roles | Partiellement differente | Existe dans Prisma comme table d'association `user_roles`; le lookup theorique avec `permissions_json` est remplace par `roles`, `permissions`, `role_permissions`. |
| permissions_json | Absent | Remplace par RBAC relationnel. Choix meilleur pour l'extensibilite, mais different du PDF. |
| sku_families | Absent | Remplace fonctionnellement par `families`. |
| sku_subfamilies | Absent | Remplace fonctionnellement par `sub_categories`. |
| order_slot_preferences | Absent | Necessaire pour conserver les preferences de crenaux client. |
| sku_cost_snapshots | Absent | Necessaire pour cout historique et marge. |
| wallet_txns | Different | Prisma contient `wallet_transactions`, pas `wallet_txns`. |
| notification_statuses | Different | Prisma contient `notification_delivery_statuses`. |
| notifications_log | Different/partiel | Prisma contient `notifications`, mais pas un log complet avec statuts/read_at/templates. |
| audit_logs | Absent | Seul `order_histories` couvre l'audit commande. |
| quality_checks | Absent | Lookup `quality_check_types` present, controle qualite absent. |

## 9. Etat d'avancement reel par module

| Module | Backend | Frontend | Mobile | Workflow metier | Etat reel |
|---|---|---|---|---|---|
| Auth & RBAC | CRUD + JWT + permissions | Pages admin | Login customer/picker/driver partiel | Admin OK | Avance |
| Lookup global | P0 generic + modules dedies | P0 hub + pages dediees | Non | Parametrage OK | Avance |
| Clients | CRUD + auth customer + me | CRUD + details/adresses | Auth/profil/adresses | Partiel | Avance |
| Staff | Pickers/drivers CRUD | Pages staff | Login/dashboard seulement | Partiel | Partiel avance |
| Catalogue | CRUD complet + uploads | Pages catalogue completes | Catalogue client | Produit OK | Avance |
| Nodes | CRUD + slots | Pages node/geo | Utilise checkout mobile | Partiel | Avance |
| Delivery Slots | CRUD + slots checkout | Pages slots | Selecteur mobile | Capacite partielle | Partiel |
| Warehouse | CRUD | Pages warehouse | Non | Emplacements OK | Avance |
| Stock | CRUD + operations | Pages stock | Non | Reservation/decrement partiel | Avance |
| Orders | CRUD mgmt + histories | Liste commandes | Historique customer | Transitions partiel | Avance |
| Checkout | APIs + transaction | Page checkout | Ecran checkout | Fonctionnel mais a tester | Avance |
| Picking | Sessions/items + portal | Pages picking + portal web | App Flutter incomplete | Fonctionnel web | Partiel avance |
| Pickup | APIs/page detail | Pages pickup | Non | Confirmation finale partielle | Partiel |
| Livraison | Tours route/service | Non | Login/dashboard driver | Incomplet | Partiel |
| Paiements | Lookups + Stripe service | Lookups | Stripe screen customer | Incomplet | Partiel |
| Wallet | Types + service | Type page | Wallet screen | Incomplet | Partiel |
| Points | Tables + ecrans profile | Non dedie | Points screen | Incomplet | Partiel |
| Promotions | Tables | Non | Non | Incomplet | Partiel |
| Notifications | Tables proches | Non | Non | Incomplet | Partiel |
| Audit | Order histories | Non | Non | Incomplet | Partiel |
| Reporting | Route/service | Dashboard basic | Non | KPI incomplets | Partiel |

## 10. Analyse des tables

| Table | Presente dans schema fourni | Presente dans Prisma | Seeder | Backend API | Frontend Page | Utilisee dans workflow | Etat | Commentaire |
|---|---|---|---|---|---|---|---|---|
| regions | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Avec provinces/cities en plus. |
| user_roles | Oui | Oui | Oui | Oui | Oui | Oui | A corriger | Association RBAC, pas lookup theorique. |
| permissions_json | Oui | Non | Non | Non | Non | Non | Absent | Remplace par permissions relationnelles. |
| node_types | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Module node types present. |
| order_statuses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Utilise OMS/picking. |
| order_item_statuses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Parametrage present. |
| order_slot_statuses | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Preference slots manquante. |
| payment_statuses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | COD/refund workflow a finaliser. |
| payment_methods | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Stripe/wallet/mixed partiels. |
| delivery_types | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Home/pickup utilises. |
| picking_statuses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Utilise picking sessions. |
| pick_item_statuses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Scan/substitution/out_of_stock. |
| tour_statuses | Oui | Oui | Oui | Partiel | Non | Partiel | Partiel | Tours pas finalises. |
| stop_statuses | Oui | Oui | Oui | Partiel | Non | Partiel | Partiel | Stops pas finalises. |
| wallet_txn_types | Oui | Oui | Oui | Oui | Oui | Partiel | Partiel | Ledger a finaliser. |
| promo_types | Oui | Oui | Oui | Partiel | Non | Non | Partiel | Engine absent. |
| points_rule_types | Oui | Oui | Oui | Partiel | Non | Partiel | Partiel | Earn/redeem absent. |
| notification_channels | Oui | Oui | Oui | Partiel | Non | Non | Partiel | Pas d'envoi. |
| notification_statuses | Oui | Non | Partiel | Non | Non | Non | A corriger | Prisma : `notification_delivery_statuses`. |
| app_configs | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Node config page presente. |
| config_value_types | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Via orders/app_configs. |
| customers | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Mobile customer present. |
| addresses | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Mobile addresses present. |
| backoffice_admins | Oui | Oui | Oui | Partiel | Partiel | Oui | Partiel | Lie a User. |
| pickers | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | App mobile incomplete. |
| drivers | Oui | Oui | Oui | Oui | Oui | Partiel | Partiel | Tours/mobile incomplets. |
| brands | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Catalogue. |
| sku_families | Oui | Non | Non | Non | Non | Non | Absent | Remplace par families. |
| sku_subfamilies | Oui | Non | Non | Non | Non | Non | Absent | Remplace par sub_categories. |
| categories | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Relation family. |
| skus | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Logistique/stock. |
| sku_images | Oui | Oui | Partiel | Oui | Oui | Partiel | Avance | Galerie SKU. |
| article_images | Non explicite PDF | Oui | Partiel | Oui | Oui | Partiel | Avance | Extension utile. |
| taxes | Lie catalogue | Oui | Oui | Oui | Oui | Oui | Avance | TVA catalogue. |
| units | Lie catalogue | Oui | Oui | Oui | Oui | Oui | Avance | Unite catalogue. |
| nodes | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Core checkout. |
| delivery_slots | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Capacite/date a durcir. |
| order_slot_preferences | Oui | Non | Non | Non | Non | Non | Absent | A creer P0. |
| slot_assignment_sources | Oui | Oui | Oui | Partiel | Partiel | Partiel | Partiel | Source system/backoffice. |
| locations | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Warehouse. |
| zones | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Extension presente. |
| levels | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Extension presente. |
| sku_node_locations | Oui | Oui | Oui | Oui | Partiel | Oui | Avance | Mapping stockage. |
| stock_levels | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Reservation/decrement critiques. |
| stock_moves | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Journal stock. |
| stock_lots | Oui | Oui | Oui | Oui | Oui | Oui | Avance | FIFO/expiry. |
| sku_cost_snapshots | Oui | Non | Non | Non | Non | Non | Absent | Cout historique absent. |
| selling_rules | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Backorder. |
| reorder_rules | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Reappro. |
| orders | Oui | Oui | Oui | Oui | Oui | Oui | Avance | OMS. |
| order_items | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Checkout/picking. |
| order_history/order_histories | Oui | Oui | Oui | Oui | Oui | Oui | Avance | Nom Prisma `order_histories`. |
| payments | Oui | Oui | Oui | Partiel | Partiel | Partiel | Partiel | Collect/refund incomplets. |
| packs | Oui | Oui | Partiel | Partiel | Non | Non | Partiel | Promo bundle. |
| pack_items | Oui | Oui | Partiel | Partiel | Non | Non | Partiel | Promo bundle. |
| flash_sales | Oui | Oui | Partiel | Partiel | Non | Non | Partiel | Engine absent. |
| promotions | Oui | Oui | Partiel | Partiel | Non | Non | Partiel | Coupons/discount absent. |
| gamification_games | Oui | Oui | Partiel | Non | Non | Non | Partiel | Data only. |
| gamification_prizes | Oui | Oui | Partiel | Non | Non | Non | Partiel | Data only. |
| gamification_plays | Oui | Oui | Partiel | Non | Non | Non | Partiel | Data only. |
| points_rules | Oui | Oui | Partiel | Partiel | Non | Partiel | Partiel | Engine absent. |
| referral_config | Oui | Oui | Partiel | Non | Non | Partiel | Partiel | Workflow absent. |
| referrals | Oui | Oui | Partiel | Non | Non | Partiel | Partiel | Validation absent. |
| wallet_txns | Oui | Non | Non | Non | Non | Non | A corriger | Prisma `wallet_transactions`. |
| wallet_transactions | Non exact PDF | Oui | Partiel | Partiel | Partiel | Partiel | Partiel | Devrait etre aligne avec schema. |
| picking_sessions | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Web OK, mobile incomplete. |
| picking_session_items | Oui | Oui | Oui | Oui | Oui | Partiel | Avance | Scan web/portal. |
| quality_check_types | Oui | Oui | Oui | Partiel | Non | Non | Partiel | Lookup seulement. |
| quality_checks | Oui | Non | Non | Non | Non | Non | Absent | A creer. |
| audit_logs | Oui | Non | Non | Non | Non | Non | Absent | P2 critique pour tracabilite. |
| notifications_log | Oui | Non | Non | Non | Non | Non | Absent | Prisma contient `notifications`. |
| notifications | Non exact PDF | Oui | Partiel | Partiel | Non | Partiel | Partiel | Log simplifie. |
| tours | Oui | Oui | Partiel | Partiel | Non | Partiel | Partiel | Driver flow a finir. |
| tour_stops | Oui | Oui | Partiel | Partiel | Non | Partiel | Partiel | Stops workflow a finir. |

## 11. Analyse performance par sous-module developpe

| Module | Sous-module | Performance | Points forts | Problemes constates | Recommandations |
|---|---|---|---|---|---|
| Auth | JWT admin | A | Middleware clair, separation controller/service, RBAC relationnel. | Audit login absent. | Ajouter `login_logs` ou `audit_logs`. |
| Auth | RBAC | B | Permissions table + role_permissions plus robuste que JSON. | Divergence avec schema `permissions_json`. | Documenter ce choix et migrer anciens noms. |
| Catalogue | Referentiels | A | Pattern SOLID controller/service/repository/validator, pagination, upload. | Quelques noms divergents PDF. | Stabiliser mapping families/sub_categories vs sku_families/subfamilies. |
| Catalogue | Articles/SKUs | B | SKU logistique separe, images, EAN13, liens stock. | Article model different du cahier initial initial, validators a surveiller. | Verifier champs obligatoires et affichage mobile. |
| Geo/Nodes | Regions/cities/nodes | B | CRUD, pages web, relations node/city/region. | Created_by type differente du PDF. | Ajouter audit utilisateur et contraintes de suppression. |
| Delivery Slots | Slots | C | CRUD et integration checkout. | Pas de `order_slot_preferences`, disponibilite par date partielle. | Creer preferences et reservations slots transactionnelles. |
| Warehouse | Locations | B | Zones/levels/locations, mapping SKU. | Pas encore relie a tous les flux scan mobile. | Ajouter scan emplacement dans picking mobile. |
| Stock | Levels/moves/lots | B | Operations riches, FIFO, lots, mouvements. | Tests transactionnels non prouves, coherence checkout a valider. | Ajouter tests reservation/decrement/cancel/backorder. |
| Orders | OMS | B | Histories, transitions, pages mgmt. | Transitions et stock/payment pas totalement verrouilles. | Centraliser state machine commande. |
| Checkout | create-order | B | Node auto, slots, stock, transaction, mobile customer. | Scenarios limite a couvrir. | Tests panier vide, date passee, stock insuffisant, paiement. |
| Picking | Sessions/items | B | Web et portail picker, scan EAN, statuses. | App picker Flutter incomplete. | Porter available-orders/session detail/scan vers mobile. |
| Pickup | Retrait | C | Pages pickup presentes. | COD comptoir et final delivered a verifier. | Finaliser workflow ready -> delivered + payment collected. |
| Staff | Pickers/drivers | B | CRUD, activation/desactivation. | Driver operationnel incomplet. | Lier drivers aux tours et mobile driver. |
| Payment | Methods/statuses/Stripe | C | Structure presente. | Refunds, mixed, wallet incomplets. | Implementer service paiement transactionnel unique. |
| Wallet | Txn types/ledger | C | Table ledger existe sous autre nom. | Nom different, debit/credit/refund partiels. | Harmoniser table et exposer history. |
| Mobile Customer | Parcours client | B | Auth/OTP/catalogue/cart/checkout/orders/profile. | Notifications et wallet/points reels incomplets. | Prioriser order history + notifications. |
| Mobile Picker | Flutter picker | D | Base login/dashboard. | Pas de sessions/scan/complete. | Construire workflow picker complet. |
| Mobile Driver | Flutter driver | D | Base login/dashboard. | Pas de tours/stops/COD. | Construire workflow driver apres backend tours. |
| Reporting | Dashboard/KPIs | C | Route/service existent. | KPIs et exports limites. | Ajouter KPI commandes/stock/picking/livraison/paiements. |

## 12. Modules et sous-modules restants

| Priorite | Module | Sous-module | Tables necessaires | Backend a creer | Frontend a creer | Mobile a creer | Dependances |
|---|---|---|---|---|---|---|---|
| P0 | Checkout final | Calcul total backend, paiement actif, create-order transactionnel | orders, order_items, payments, stock_levels | Tests + durcissement transaction | UX erreurs stock/slot | Customer checkout final | Stock, payment, slots |
| P0 | Stock reservation | Reserve/cancel/decrement | stock_levels, stock_moves, stock_lots | Garantir atomicite | Ecrans controle stock | Non | Checkout, picking, pickup |
| P0 | Picking final | Available orders, accept, scan, complete | picking_sessions, picking_session_items | APIs mobile completes | Web deja avance | Picker app complete | Orders, stock |
| P0 | Pickup final | Confirmation retrait, COD comptoir | orders, payments, stock_levels | Endpoint ready->delivered + collect COD | Page action retrait | Non | Picking, payment |
| P0 | Paiement COD | COD comptoir et driver | payments, payment_statuses | Collect/cancel/refund | Actions UI | Driver COD | Orders, pickup, tours |
| P0 | Historique commande | Timeline complete client/admin | order_histories | Completer notes/auteur | Timeline detail | Customer orders | OMS |
| P1 | Livraison | Tours, stops, driver flow | tours, tour_stops, drivers | APIs start/complete/fail | Pages tours | Driver app tours/stops | Orders ready |
| P1 | Wallet | Debit, credit, refund | wallet_transactions, wallet_txn_types | Ledger transactionnel | History wallet | Wallet mobile reel | Payments |
| P1 | Points | Earn/redeem/history | points_rules, customers, event log a creer | Engine points | Pages config/history | Points mobile reel | Delivered orders |
| P1 | Notifications | Push/SMS/email/in_app | notifications, notification_channels, statuses/templates | Service notification | Admin templates/logs | Customer notifications | Orders, delivery |
| P2 | Reporting | KPIs et exports | Toutes | Aggregations/export | Dashboard avance | Non | Modules operationnels |
| P2 | Audit | Logs transverses | audit_logs | Middleware audit | Page audit | Non | Auth/users |
| P2 | Promotions | Coupons/packs/flash sales | promotions, packs, pack_items, flash_sales | Discount engine | Pages promo | Promo customer | Checkout |
| P2 | Referral | Parrainage | referral_config, referrals | Validation/rewards | Admin referral | Customer referral | Customers, wallet/points |
| P3 | Gamification | Games/prizes/plays | gamification_* | Moteur jeux | Admin games | Jeux customer | Wallet/points/promos |
| P3 | IA | Optimisation | A definir | Services IA | Interfaces IA | Non | Donnees historiques |
| P3 | Multi-tenant | Tenant isolation | A definir | Scope tenant | UI tenant | Mobile tenant | Tous modules |

## 13. Roadmap recommandee

### Phase 1 : Finaliser workflow Pickup

Objectif : `Checkout -> Stock reservation -> Picking -> Pickup -> Delivered`.

1. Verrouiller `create-order` par transaction PostgreSQL.
2. Valider reservation stock et annulation.
3. Finaliser picking session complete -> order ready.
4. Ajouter confirmation retrait magasin.
5. Collecter COD comptoir et passer payment `collected`.
6. Liberer/decrementer stock correctement.

### Phase 2 : Finaliser workflow Livraison

Objectif : `Ready -> Tours -> Driver -> Delivered`.

1. Ajouter affectation driver aux tours.
2. Creer/assigner `tour_stops` depuis commandes ready.
3. Ajouter start tour, arrive stop, delivered, failed delivery.
4. Completer mobile driver : tours, stops, navigation, COD collection.
5. Mettre a jour order status et payment status.

### Phase 3 : Paiements avances

Objectif : `Stripe -> Wallet -> Mixed -> Refund`.

1. Finaliser Stripe test et callbacks.
2. Harmoniser `wallet_transactions` / `wallet_txns`.
3. Implementer debit wallet et mixed payment.
4. Ajouter refund wallet/COD/Stripe.
5. Exposer payment history.

### Phase 4 : Experience client

Objectif : `Points -> Notifications -> Historique mobile`.

1. Moteur points sur delivered.
2. Historique points/wallet mobile.
3. Notifications order confirmed/ready/delivered.
4. Read/unread notifications.
5. Ameliorer suivi commande mobile.

### Phase 5 : Business

Objectif : `Promotions -> Packs -> Reporting`.

1. Discount engine checkout.
2. Packs et flash sales dans catalogue client.
3. KPIs commandes/stock/picking/livraison/paiements/clients.
4. Exports PDF/Excel.

### Phase 6 : Engagement

Objectif : `Gamification -> Referral`.

1. Validation referral et rewards.
2. Jeux et prix.
3. Claim prize.
4. Regles anti-abus.

## 14. Tests a ajouter

### Checkout

- [ ] Panier vide refuse.
- [ ] Node automatique selon ville/rayon/stock.
- [ ] Pickup node select obligatoire.
- [ ] Date passee bloquee.
- [ ] Creneau disponible et capacite respectee.
- [ ] Paiement actif obligatoire.
- [ ] Stock reserve transactionnellement.
- [ ] Rollback si creation payment echoue.

### Picking

- [ ] Picker du meme node seulement.
- [ ] Accept order cree/assigne session.
- [ ] Scan EAN correct.
- [ ] Scan EAN incorrect incremente erreur.
- [ ] Complete session passe order ready.
- [ ] Out_of_stock et substitute geres.

### Pickup

- [ ] Commande ready visible pickup.
- [ ] COD comptoir collecte.
- [ ] Stock decrement/liberation reservation.
- [ ] Order delivered.
- [ ] Historique retrait ajoute.

### Livraison

- [ ] Create tour depuis commandes ready.
- [ ] Assign driver actif meme node.
- [ ] Deliver stop.
- [ ] Failed delivery.
- [ ] COD driver collecte.
- [ ] Order delivered et payment collected.

### Wallet

- [ ] Debit wallet avec solde suffisant.
- [ ] Debit refuse si solde insuffisant.
- [ ] Remboursement wallet.
- [ ] Historique wallet client.
- [ ] Balance before/after coherente.

### Notifications

- [ ] Commande confirmee.
- [ ] Commande ready.
- [ ] Commande delivered.
- [ ] Notification read_at.
- [ ] Echec envoi journalise.

## 15. Conclusion generale

L'etat reel du projet est **avance sur le socle backoffice et data**, avec un schema Prisma tres large et une architecture backend majoritairement conforme aux principes SOLID : controllers fins, services metier, repositories Prisma, routes separees, middlewares JWT/RBAC. Le frontend web couvre deja la plupart des modules admin critiques. Le mobile customer est utilisable sur les parcours principaux, alors que les apps picker et driver restent embryonnaires.

L'estimation globale raisonnable est **62% d'avancement** : environ **72% backend**, **60% frontend web**, **55% mobile customer**, **20% mobile picker**, **15% mobile driver**.

Les modules critiques sont : **checkout final transactionnel**, **stock reservation/decrement**, **picking final mobile**, **pickup COD**, **livraison/tours/driver**, **wallet transactionnel**, **points**, **notifications**, **audit logs**. Le plus gros risque est moins la structure du code que la coherence bout en bout des workflows transactionnels en PostgreSQL reel.

L'ordre recommande des prochains developpements est :

1. Finaliser et tester `Checkout -> Stock reservation -> Picking -> Pickup -> Delivered`.
2. Finaliser COD comptoir et historique commande.
3. Construire livraison/tours/driver mobile.
4. Stabiliser paiements Stripe/wallet/mixed/refund.
5. Ajouter notifications et points.
6. Ajouter audit logs et reporting KPI.
7. Brancher promotions, referral et gamification une fois le coeur operationnel stable.

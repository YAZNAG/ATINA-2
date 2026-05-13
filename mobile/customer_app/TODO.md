# TODO - Customer App (mobile/customer_app)

## Étape 1 — Addresses / villes (Select + postal code)
- [x] Créer `CityModel` + `cities_api.dart` pour `GET /api/cities?all=true`
- [x] Ajouter `citiesProvider`

- [ ] Mettre à jour `AddressModel` pour supporter `cityId` (optionnel) si nécessaire
- [x] Remplacer le champ texte Ville par un select (`city_select_field.dart`)
- [x] Auto-remplir `postal_code` à la sélection de la ville
- [ ] Valider que `city` (et `city_id` si dispo) est envoyé au backend
- [ ] S’assurer des règles : ville obligatoire, rue obligatoire, 1 seule adresse par défaut

## Étape 2 — Orders
- [ ] Ajouter feature `features/orders/` (models, api, providers)
- [ ] Écran liste `/orders`
- [ ] Écran détail `/orders/:id` avec timeline et badges status (couleur depuis backend)
- [ ] Ajouter routes dans `app_router.dart`

## Étape 3 — Checkout (workflow complet)
- [ ] Ajouter feature `features/checkout/` (meta, slots, nodes, payment, create-order)
- [ ] Ajouter routes `/checkout*` + success screen
- [ ] Gating panier vide (message + désactivation)
- [ ] Étape 1: address + type livraison (home/pickup)
- [ ] Étape 2: date + créneau dynamiques
- [ ] Étape 3: méthodes paiement actives + wallet/points rules
- [ ] Étape 4: recap + confirmation (POST create-order)
- [ ] Après succès: clear panier + navigation success


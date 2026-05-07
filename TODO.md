# TODO - Nodes UI amélioré (pattern GeoPage)

## Étape 1 — Analyse
- [x] Rechercher les routes et pages existantes pour Nodes (NodeList / NodeForm).
- [x] Vérifier l’API des delivery slots : `GET /nodes/:id/slots`, `POST /nodes/:id/slots`, `PUT|DELETE /slots/:id`.

## Étape 2 — Build UX "Nodes" (GeoPage-like)
- [ ] Créer une nouvelle page `frontend/src/pages/location/NodesPage.jsx` (cards + drill-down) :
  - Level: node-types → nodes → slots
  - Drawer pour node + modal delete
  - Form “node” contient : type node, region/province/city, adresse, timezone, lat/lng, etc.
  - Ajouter UI “horaires de travail” pour node (persist sur `opening_hours_json`, si déjà supporté backend)
  - Ajouter création/édition/suppression de slots avec `max_orders`.

## Étape 3 — Routes
- [ ] Ajouter routes dans `frontend/src/routes/index.jsx` :
  - `/nodes` → `NodesPage`
  - (optionnel) `/nodes/:id/edit` peut rester pour compat ou être remplacé.

## Étape 4 — Sidebar
- [ ] Modifier `frontend/src/components/Sidebar.jsx` :
  - remplacer le lien “Noeuds” par un lien vers `/nodes` (qui pointe vers `NodesPage`).

## Étape 5 — Nettoyage / compatibilité
- [ ] Conserver l’existant si nécessaire : `NodeList.jsx` et `NodeForm.jsx`.
- [ ] Désactiver ou supprimer les liens vers `/node-types` selon le nouveau pattern.

## Étape 6 — Vérification
- [ ] Scénarios tests :
  - Créer un node
  - Renseigner ouverture/horaire
  - Ajouter slots et `max_orders`
  - Edition & suppression slots
  - Permissions : affichage conditionnel selon `node_types.*`, `nodes.*`, `delivery_slots.*`


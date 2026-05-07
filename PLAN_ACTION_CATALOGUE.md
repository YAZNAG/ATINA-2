# 🎯 PLAN D'ACTION COMPLET - AMÉLIORATION MODULE CATALOGUE

## STATUS: Plan détaillé établi

Date: 5 mai 2026

---

## ✅ TÂCHES COMPLÉTÉES

### 1. ✅ Audit du backend
- Schéma Prisma audité
- Structure controllers/services/repositories identifiée
- Pattern CRUD existant compris

### 2. ✅ Modification schéma Prisma
- Ajout des champs au modèle Article:
  - `article_type_id` (FK → ArticleType)
  - `article_status_id` (FK → ArticleStatus)
  - `conservation_type_id` (FK → ConservationType)
  - `tax_id` (FK → Tax)
- Ajout des relations inverses sur ArticleType, ArticleStatus, ConservationType, Tax
- Migration créée et appliquée ✅

### 3. ✅ BD synchronisée
- `npx prisma db push` exécuté avec succès
- Tous les champs maintenant présents dans articles table

---

## 🔧 TÂCHES EN COURS / À FAIRE

### TODO #1: Améliorer articleReferential.guard.js
**Fichier:** `backend/src/modules/catalog/articles/articleReferential.guard.js`

**Changements requis:**
```javascript
// AJOUTER les imports
const articleTypeRepo = require('../articleTypes/articleType.repository');
const articleStatusRepo = require('../articleStatuses/articleStatus.repository');
const conservationTypeRepo = require('../conservationTypes/conservationType.repository');
const taxRepo = require('../taxes/tax.repository');

// REMPLACER OPTIONAL_REF par:
const OPTIONAL_REFS = [
  { key: 'brand_id', repo: brandRepo, label: 'Marque' },
  { key: 'article_type_id', repo: articleTypeRepo, label: 'Type d\'article' },
  { key: 'conservation_type_id', repo: conservationTypeRepo, label: 'Type de conservation' },
  { key: 'tax_id', repo: taxRepo, label: 'Taxe' },
];

// AJOUTER REQUIRED_REFS_NOACTIVE:
const REQUIRED_REFS_NOACTIVE = [
  { key: 'article_status_id', repo: articleStatusRepo, label: 'Statut article' },
];

// METTRE À JOUR validateOptionalRefs() pour inclure REQUIRED_REFS_NOACTIVE
```

**Raison:** Valider les nouvelles références article_type_id, article_status_id, conservation_type_id, tax_id

---

### TODO #2: Ajouter champs au validateur Article
**Fichier:** `backend/src/modules/catalog/articles/article.validator.js`

**Ajouter validateurs:**
```javascript
const createValidator = [
  body('sku_code').notEmpty().withMessage('Code SKU requis'),
  body('ean13').optional(),
  body('name_fr').notEmpty().withMessage('Nom français requis'),
  body('name_ar').notEmpty().withMessage('Nom arabe requis'),
  body('description_fr').optional(),
  body('description_ar').optional(),
  body('brand_id').optional().isInt(),
  body('family_id').notEmpty().withMessage('Famille requise').isInt(),
  body('category_id').optional().isInt(),
  body('sub_category_id').optional().isInt(),
  body('article_type_id').optional().isInt(),
  body('article_status_id').optional().isInt(),
  body('conservation_type_id').optional().isInt(),
  body('tax_id').optional().isInt(),
  body('price').notEmpty().withMessage('Prix requis').isFloat({ min: 0 }),
  body('vat_rate').optional().isFloat({ min: 0, max: 100 }),
  // ... autres validations
];
```

---

### TODO #3: Mettre à jour article.service.js
**Fichier:** `backend/src/modules/catalog/articles/article.service.js`

**Ajouter les champs à INPUT_KEYS:**
```javascript
const INPUT_KEYS = [
  'sku_code',
  'ean13',
  'name_fr',
  'name_ar',
  'description_fr',
  'description_ar',
  'brand_id',
  'family_id',
  'sub_category_id',
  'category_id',
  'article_type_id',
  'article_status_id',
  'conservation_type_id',
  'tax_id',
  // ... autres champs
];
```

---

### TODO #4: Améliorer formulaire Article frontend
**Fichier:** `frontend/src/pages/catalog/ArticleForm.jsx`

**Ajouter aux champs vides:**
```javascript
const empty = {
  // ... existants
  article_type_id: '',
  article_status_id: '',
  conservation_type_id: '',
  tax_id: '',
  // ... existants
};
```

**Ajouter aux useState:**
```javascript
const [articleTypes, setArticleTypes] = useState([]);
const [articleStatuses, setArticleStatuses] = useState([]);
const [conservationTypes, setConservationTypes] = useState([]);
const [taxes, setTaxes] = useState([]);
```

**Ajouter aux fetches useEffect:**
```javascript
const [fam, br, artTypes, artStatus, conservation, taxList] = await Promise.all([
  catalog.getFamiliesList(),
  catalog.getBrandsList(),
  catalog.getArticleTypesList(),
  catalog.getArticleStatusesList(),
  catalog.getConservationTypesList(),
  catalog.getTaxesList(),
]);
```

**Ajouter selects dans le formulaire:**
```jsx
<select
  name="article_type_id"
  value={form.article_type_id}
  onChange={handleChange}
  className="form-select"
>
  <option value="">Choisir un type d'article...</option>
  {articleTypes.map(t => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
</select>

<select
  name="article_status_id"
  value={form.article_status_id}
  onChange={handleChange}
  className="form-select"
>
  <option value="">Choisir un statut...</option>
  {articleStatuses.map(s => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
</select>

<select
  name="conservation_type_id"
  value={form.conservation_type_id}
  onChange={handleChange}
  className="form-select"
>
  <option value="">Choisir un type de conservation...</option>
  {conservationTypes.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
</select>

<select
  name="tax_id"
  value={form.tax_id}
  onChange={handleChange}
  className="form-select"
>
  <option value="">Choisir une taxe...</option>
  {taxes.map(t => <option key={t.id} value={t.id}>{t.name_fr} ({t.rate}%)</option>)}
</select>
```

---

### TODO #5: Créer page Paramétrage Catalogue
**Nouveau fichier:** `frontend/src/pages/catalog/CatalogSettingsPage.jsx`

**Contenu:**
```jsx
// Dashboard pour accéder à tous les paramétres:
// - Familles
// - Catégories
// - Sous-catégories
// - Marques
// - Unités
// - Types d'emballage
// - Types d'article
// - Statuts article
// - Types de conservation
// - Taxes
```

---

### TODO #6: Améliorer UI/UX
**Fichiers à améliorer:**
1. `ReferentialListPage.jsx` - Ajouter:
   - Badges pour statuts
   - Actions dropdown
   - Filtres
   - Pagination
   - Recherche

2. `ReferentialFormPage.jsx` - Ajouter:
   - Validation côté client
   - Messages d'erreur clairs
   - Messages de succès
   - Indicateur champs obligatoires

3. `ArticleList.jsx` - Ajouter:
   - Images miniatures
   - Badges statut/type
   - Plus de colonnes
   - Actions rapides

4. `ArticleForm.jsx` - Ajouter:
   - Sections groupées par thème
   - Validations en temps réel
   - Messages d'erreur inline
   - Preview images
   - Détection dépendances manquantes

---

### TODO #7: Mettre à jour routes menu
**Fichier:** `frontend/src/routes/index.jsx`

**Ajouter route:**
```jsx
<Route path="/catalog/settings" element={<CatalogSettingsPage />} />
```

**Fichier:** `frontend/src/components/Sidebar.jsx`

**Ajouter lien:**
```jsx
<Link to="/catalog/settings" className="sidebar-link">⚙️ Paramétrage</Link>
```

---

## 📋 ORDRE D'EXÉCUTION RECOMMANDÉ

1. ✅ FAIT - Schéma Prisma + Migration
2. ⬜ TODO #1 - Améliorer guard validations
3. ⬜ TODO #2 - Validateur article complet
4. ⬜ TODO #3 - Service article (INPUT_KEYS)
5. ⬜ TODO #4 - Formulaire Article frontend
6. ⬜ TODO #5 - Page Paramétrage
7. ⬜ TODO #6 - UI/UX improvements
8. ⬜ TODO #7 - Routes et menu

---

## 🧪 TESTS À EFFECTUER APRÈS

### Test #1: Créer article complet
```
✓ Remplir tous les champs requis
✓ Sélectionner toutes les références (famille, catégorie, type, statut, etc.)
✓ Vérifier validation côté client
✓ Soumettre formulaire
✓ Vérifier message succès
✓ Vérifier sauvegarde BD
```

### Test #2: Valider hiérarchie
```
✓ Sélectionner famille → doit charger catégories
✓ Sélectionner catégorie → doit charger sous-catégories
✓ Sélectionner sous-catégorie → doit pré-remplir famille/catégorie
```

### Test #3: Valider dépendances manquantes
```
✓ Essayer créer article sans marque → doit permettre
✓ Essayer créer article sans article_type → doit permettre
✓ Essayer créer article sans conservation → doit permettre
✓ Essayer créer article sans tax → doit permettre
✓ Essayer créer article sans article_status → doit permettre
✓ Essayer créer article sans famille → doit échouer
✓ Essayer créer article sans prix → doit échouer
```

### Test #4: CRUD référentiels
```
✓ Créer famille
✓ Modifier famille
✓ Lister familles
✓ Chercher par code
✓ Activer/désactiver
✓ Supprimer famille (soft delete)
```

---

## 📞 NOTES IMPORTANTES

### ⚠️ Dépendances OPTIONNELLES:
- brand_id (Marque)
- article_type_id (Type d'article)
- conservation_type_id (Type de conservation)
- tax_id (Taxe)
- article_status_id (Statut article)

### ✅ Dépendances REQUISES:
- family_id (Famille) - OBLIGATOIRE
- price (Prix) - OBLIGATOIRE
- sku_code - OBLIGATOIRE
- name_fr, name_ar - OBLIGATOIRE

### 🔑 Hiérarchie REQUISES:
```
Family
  └── Category
        └── SubCategory
              └── Article (DÉPEND DE TOUS LES 3)
```

---

## 💾 FICHIERS MODIFIÉS À SAUVEGARDER

1. ✅ `/backend/prisma/schema.prisma`
2. ✅ `/backend/prisma/migrations/.../migration.sql`
3. ⬜ `/backend/src/modules/catalog/articles/articleReferential.guard.js`
4. ⬜ `/backend/src/modules/catalog/articles/article.validator.js`
5. ⬜ `/backend/src/modules/catalog/articles/article.service.js`
6. ⬜ `/frontend/src/pages/catalog/ArticleForm.jsx`
7. ⬜ `/frontend/src/pages/catalog/CatalogSettingsPage.jsx`
8. ⬜ `/frontend/src/routes/index.jsx`
9. ⬜ `/frontend/src/components/Sidebar.jsx`

---

## 🎓 RÉSUMÉ POUR L'UTILISATEUR

**Qu'est-ce qui a été fait:**
- ✅ Ajouté 4 nouveaux champs au modèle Article (article_type_id, article_status_id, conservation_type_id, tax_id)
- ✅ Créé la migration Prisma et synchronisé la BD
- ✅ Préparé plan détaillé pour les améliorations

**Qu'est-ce qui reste à faire:**
- 🔧 Améliorer validations backend (7 étapes détaillées ci-dessus)
- 🎨 Améliorer formulaire et UI/UX
- 📝 Créer page paramétrage intégré
- 🧪 Tests complets

**Prochaine étape recommandée:**
Implémenter TODO #1 (articleReferential.guard.js) pour activer les validations des nouveaux champs.

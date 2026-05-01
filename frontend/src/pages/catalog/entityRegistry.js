import * as catalog from '../../api/catalog.api';
import { createElement } from 'react';

/** Configuration des écrans référentiels (listes + formulaires dynamiques). */
export const ENTITY_SLUGS = [
  'families',
  'categories',
  'sub-categories',
  'brands',
  'units',
  'packaging-types',
  'conservation-types',
  'article-types',
  'article-statuses',
  'taxes',
];

const statusSelect = {
  name: 'status',
  label: 'Statut',
  type: 'select',
  options: [
    { value: 'active', label: 'Actif' },
    { value: 'inactive', label: 'Inactif' },
  ],
};

const imageThumbColumn = {
  key: 'image_base64',
  label: 'Image',
  render: (r) => (
    r.image_base64
      ? createElement('img', {
        src: r.image_base64,
        alt: r.name_fr || 'image',
        className: 'h-10 w-10 rounded-md object-cover border border-slate-200',
      })
      : '—'
  ),
};

export const ENTITY_REGISTRY = {
  families: {
    label: 'Familles',
    description: 'Niveau 1 de la taxonomie catalogue.',
    permissions: {
      view: 'families.view',
      create: 'families.create',
      update: 'families.update',
      delete: 'families.delete',
    },
    api: {
      list: catalog.getFamilies,
      get: catalog.getFamily,
      create: catalog.createFamily,
      update: catalog.updateFamily,
      remove: catalog.deleteFamily,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'sort_order', label: 'Ordre' },
      imageThumbColumn,
      { key: 'status', label: 'Statut', render: (r) => r.status === 'active' ? 'Actif' : 'Inactif' },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea' },
      { name: 'image_base64', label: 'Image (base64)', type: 'textarea' },
      statusSelect,
      { name: 'sort_order', label: 'Ordre', type: 'number', default: 0 },
    ],
  },

  categories: {
    label: 'Catégories',
    description: 'Rattachées à une famille.',
    permissions: {
      view: 'categories.view',
      create: 'categories.create',
      update: 'categories.update',
      delete: 'categories.delete',
    },
    api: {
      list: catalog.getCategories,
      get: catalog.getCategory,
      create: catalog.createCategory,
      update: catalog.updateCategory,
      remove: catalog.deleteCategory,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      {
        key: 'family',
        label: 'Famille',
        render: (r) => r.family?.name_fr ?? '—',
      },
      { key: 'sort_order', label: 'Ordre' },
      imageThumbColumn,
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      {
        name: 'family_id',
        label: 'Famille',
        type: 'select',
        required: true,
        loadOptions: async () => (await catalog.getFamiliesList()).data.data,
        optionLabel: (o) => o.name_fr,
        optionValue: (o) => o.id,
      },
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea' },
      { name: 'image_base64', label: 'Image (base64)', type: 'textarea' },
      statusSelect,
      { name: 'sort_order', label: 'Ordre', type: 'number', default: 0 },
    ],
  },

  'sub-categories': {
    label: 'Sous-catégories',
    description: 'Rattachées à une catégorie (filtrer par famille puis catégorie).',
    special: 'subcategory',
    permissions: {
      view: 'sub_categories.view',
      create: 'sub_categories.create',
      update: 'sub_categories.update',
      delete: 'sub_categories.delete',
    },
    api: {
      list: catalog.getSubCategories,
      get: catalog.getSubCategory,
      create: catalog.createSubCategory,
      update: catalog.updateSubCategory,
      remove: catalog.deleteSubCategory,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      {
        key: 'category',
        label: 'Catégorie',
        render: (r) => r.category?.name_fr ?? '—',
      },
      { key: 'sort_order', label: 'Ordre' },
      imageThumbColumn,
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'category_id', label: 'Catégorie', type: 'select', required: true },
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea' },
      { name: 'image_base64', label: 'Image (base64)', type: 'textarea' },
      statusSelect,
      { name: 'sort_order', label: 'Ordre', type: 'number', default: 0 },
    ],
  },

  brands: {
    label: 'Marques',
    description: 'Référentiel marques.',
    permissions: {
      view: 'brands.view',
      create: 'brands.create',
      update: 'brands.update',
      delete: 'brands.delete',
    },
    api: {
      list: catalog.getBrands,
      get: catalog.getBrand,
      create: catalog.createBrand,
      update: catalog.updateBrand,
      remove: catalog.deleteBrand,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      statusSelect,
    ],
  },

  units: {
    label: 'Unités',
    description: 'Unités de mesure (vente, achat, stock).',
    permissions: {
      view: 'units.view',
      create: 'units.create',
      update: 'units.update',
      delete: 'units.delete',
    },
    api: {
      list: catalog.getUnits,
      get: catalog.getUnit,
      create: catalog.createUnit,
      update: catalog.updateUnit,
      remove: catalog.deleteUnit,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'short_name_fr', label: 'Symbole' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'short_name_fr', label: 'Symbole (FR)' },
      { name: 'short_name_ar', label: 'Symbole (AR)' },
      statusSelect,
    ],
  },

  'packaging-types': {
    label: 'Conditionnements',
    description: 'Types de colisage / emballage.',
    permissions: {
      view: 'packaging_types.view',
      create: 'packaging_types.create',
      update: 'packaging_types.update',
      delete: 'packaging_types.delete',
    },
    api: {
      list: catalog.getPackagingTypes,
      get: catalog.getPackagingType,
      create: catalog.createPackagingType,
      update: catalog.updatePackagingType,
      remove: catalog.deletePackagingType,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'quantity', label: 'Qté' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'quantity', label: 'Quantité', type: 'number' },
      {
        name: 'unit_id',
        label: 'Unité (optionnel)',
        type: 'select',
        loadOptions: async () => (await catalog.getUnitsList()).data.data,
        optionLabel: (o) => `${o.name_fr} (${o.code})`,
        optionValue: (o) => o.id,
      },
      statusSelect,
    ],
  },

  'conservation-types': {
    label: 'Conservations',
    description: 'Types de conservation (températures).',
    permissions: {
      view: 'conservation_types.view',
      create: 'conservation_types.create',
      update: 'conservation_types.update',
      delete: 'conservation_types.delete',
    },
    api: {
      list: catalog.getConservationTypes,
      get: catalog.getConservationType,
      create: catalog.createConservationType,
      update: catalog.updateConservationType,
      remove: catalog.deleteConservationType,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'min_temperature', label: 'T° min' },
      { key: 'max_temperature', label: 'T° max' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'min_temperature', label: 'Température min (°C)', type: 'number' },
      { name: 'max_temperature', label: 'Température max (°C)', type: 'number' },
      statusSelect,
    ],
  },

  'article-types': {
    label: 'Types d’article',
    description: 'Classification métier des articles.',
    permissions: {
      view: 'article_types.view',
      create: 'article_types.create',
      update: 'article_types.update',
      delete: 'article_types.delete',
    },
    api: {
      list: catalog.getArticleTypes,
      get: catalog.getArticleType,
      create: catalog.createArticleType,
      update: catalog.updateArticleType,
      remove: catalog.deleteArticleType,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea' },
      statusSelect,
    ],
  },

  'article-statuses': {
    label: 'Statuts article',
    description: 'États du cycle de vie affichés en UI.',
    permissions: {
      view: 'article_statuses.view',
      create: 'article_statuses.create',
      update: 'article_statuses.update',
      delete: 'article_statuses.delete',
    },
    api: {
      list: catalog.getArticleStatuses,
      get: catalog.getArticleStatus,
      create: catalog.createArticleStatus,
      update: catalog.updateArticleStatus,
      remove: catalog.deleteArticleStatus,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'color', label: 'Couleur' },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'color', label: 'Couleur (hex)', placeholder: '#22c55e' },
    ],
  },

  taxes: {
    label: 'TVA',
    description: 'Taux et codes fiscaux.',
    permissions: {
      view: 'taxes.view',
      create: 'taxes.create',
      update: 'taxes.update',
      delete: 'taxes.delete',
    },
    api: {
      list: catalog.getTaxes,
      get: catalog.getTax,
      create: catalog.createTax,
      update: catalog.updateTax,
      remove: catalog.deleteTax,
    },
    columns: [
      { key: 'name_fr', label: 'Nom (FR)' },
      { key: 'code', label: 'Code' },
      { key: 'rate', label: 'Taux %' },
      { key: 'status', label: 'Statut', render: (r) => (r.status === 'active' ? 'Actif' : 'Inactif') },
    ],
    searchFields: ['name_fr', 'name_ar', 'code'],
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', required: true },
      { name: 'name_ar', label: 'Nom (AR)', required: true },
      { name: 'code', label: 'Code', required: true },
      { name: 'rate', label: 'Taux (%)', type: 'number', required: true, step: '0.01' },
      statusSelect,
    ],
  },
};

export function getEntityConfig(slug) {
  return ENTITY_REGISTRY[slug] || null;
}

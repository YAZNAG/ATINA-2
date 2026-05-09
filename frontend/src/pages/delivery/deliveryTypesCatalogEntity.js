import { p0CrudList, p0CrudCreate, p0CrudUpdate, p0CrudDelete } from '../../api/p0.api';

const SQL = 'delivery_types';

/** Entité unique pour `CatalogRefShell` — CRUD P0, même UX que les référentiels catalogue. */
export const DELIVERY_TYPES_CATALOG_ENTITY = {
  key: 'delivery-types',
  label: 'Types de livraison',
  hasStatus: false,
  icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  thumb: null,
  accentChar: 'L',
  api: {
    list: async () => {
      const res = await p0CrudList(SQL, { page: 1, limit: 500 });
      const items = res.data?.data?.items ?? [];
      return { data: { data: items } };
    },
    create: (data) => p0CrudCreate(SQL, data),
    update: (id, data) => p0CrudUpdate(SQL, id, data),
    remove: (id) => p0CrudDelete(SQL, id),
  },
  fields: [
    { name: 'code', label: 'Code', req: true },
    { name: 'name_fr', label: 'Nom (FR)', req: true },
    { name: 'name_ar', label: 'Nom (AR)', req: true },
  ],
  buildPayload: (form) => ({
    code: String(form.code ?? '').trim(),
    name_fr: String(form.name_fr ?? '').trim(),
    name_ar: String(form.name_ar ?? '').trim(),
  }),
  detailRows: (r) => [
    { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
    { label: 'Code', value: r.code, mono: true },
  ],
  cardSub: (r) => r.code,
};

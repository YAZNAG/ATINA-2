import { p0CrudList, p0CrudCreate, p0CrudUpdate, p0CrudDelete } from '../../api/p0.api';

function p0ListAll(sql) {
  return async () => {
    const res = await p0CrudList(sql, { page: 1, limit: 500 });
    const items = res.data?.data?.items ?? [];
    return { data: { data: items } };
  };
}

/** Statuts paiement (pending, collected, …) — CRUD P0. */
export const PAYMENT_STATUSES_CATALOG_ENTITY = {
  key: 'payment-statuses',
  label: 'Statuts paiement',
  hasStatus: false,
  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0',
  thumb: null,
  accentChar: 'S',
  api: {
    list: p0ListAll('payment_statuses'),
    create: (data) => p0CrudCreate('payment_statuses', data),
    update: (id, data) => p0CrudUpdate('payment_statuses', id, data),
    remove: (id) => p0CrudDelete('payment_statuses', id),
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

/** Moyens de paiement (cod, wallet, …) — CRUD P0 + is_active. */
export const PAYMENT_METHODS_CATALOG_ENTITY = {
  key: 'payment-methods',
  label: 'Moyens de paiement',
  hasStatus: false,
  icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  thumb: null,
  accentChar: 'P',
  api: {
    list: p0ListAll('payment_methods'),
    create: (data) => p0CrudCreate('payment_methods', data),
    update: (id, data) => p0CrudUpdate('payment_methods', id, data),
    remove: (id) => p0CrudDelete('payment_methods', id),
  },
  fields: [
    { name: 'code', label: 'Code', req: true },
    { name: 'name_fr', label: 'Nom (FR)', req: true },
    { name: 'name_ar', label: 'Nom (AR)', req: true },
    {
      name: 'is_active',
      label: 'Actif sur la plateforme',
      type: 'select',
      opts: [
        { v: 'true', l: 'Oui' },
        { v: 'false', l: 'Non' },
      ],
    },
  ],
  buildPayload: (form) => ({
    code: String(form.code ?? '').trim(),
    name_fr: String(form.name_fr ?? '').trim(),
    name_ar: String(form.name_ar ?? '').trim(),
    is_active: form.is_active === 'true' || form.is_active === true,
  }),
  detailRows: (r) => [
    { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
    { label: 'Code', value: r.code, mono: true },
    { label: 'Actif', value: r.is_active ? 'Oui' : 'Non' },
  ],
  cardSub: (r) => (r.is_active === false ? 'Inactif' : r.code),
};

import api from './axios';

export const getP0Registry = () => api.get('/p0/registry');

/** Fiche une table du registre P0 (`sql` = nom physique @@map). */
export const getP0TableBySql = (sql) => api.get(`/p0/table/${encodeURIComponent(sql)}`);

/** CRUD générique P0 (sauf tables avec `genericCrud: false` dans le registre). */
export const p0CrudList = (sql, params) => api.get(`/p0/crud/${encodeURIComponent(sql)}`, { params });
export const p0CrudGet = (sql, id) => api.get(`/p0/crud/${encodeURIComponent(sql)}/${encodeURIComponent(id)}`);
export const p0CrudCreate = (sql, data) => api.post(`/p0/crud/${encodeURIComponent(sql)}`, data);
export const p0CrudUpdate = (sql, id, data) =>
  api.put(`/p0/crud/${encodeURIComponent(sql)}/${encodeURIComponent(id)}`, data);
export const p0CrudDelete = (sql, id) =>
  api.delete(`/p0/crud/${encodeURIComponent(sql)}/${encodeURIComponent(id)}`);

export const getP0CrudMeta = (sql) => api.get(`/p0/crud/${encodeURIComponent(sql)}/meta`);

export const getP0RefOptions = (refSql) =>
  api.get(`/p0/crud/refs/${encodeURIComponent(refSql)}/options`);

export const getP0Relations = () => api.get('/p0/relations');

export const getP0RelationsForTable = (sql) => api.get(`/p0/relations/${encodeURIComponent(sql)}`);

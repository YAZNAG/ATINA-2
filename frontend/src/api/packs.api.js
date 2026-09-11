import api from './axios';

// ——— Packs / Bundles (back-office) — module backend /pack ———
const pk = '/pack';

export const getPacks            = (params)          => api.get(pk, { params });
export const getPack             = (id)              => api.get(`${pk}/${id}`);
export const getPackLock         = (id)              => api.get(`${pk}/${id}/lock`);
export const getPackEligibleSkus = (params)          => api.get(`${pk}/eligible-skus`, { params });
export const createPack          = (data)            => api.post(pk, data);
export const updatePack          = (id, data)        => api.put(`${pk}/${id}`, data);
export const activatePack        = (id)              => api.patch(`${pk}/${id}/activate`);
export const deactivatePack      = (id)              => api.patch(`${pk}/${id}/deactivate`);
export const deletePack          = (id)              => api.delete(`${pk}/${id}`);
export const duplicatePack       = (id, node_id)     => api.post(`${pk}/${id}/duplicate`, { node_id });

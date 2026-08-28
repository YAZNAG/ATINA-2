import api from './axios';

const pr = '/promotions';
const pk = '/pack';

function toFormData(data) {
  const fd = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'image' && value instanceof File) {
      fd.append('image', value);
    } else if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value));
    } else {
      fd.append(key, value);
    }
  });
  return fd;
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// ——— Promotions ———
export const getPromotions      = (params)    => api.get(pr, { params });
export const getPromotionsList  = ()          => api.get(pr, { params: { all: true } });
export const getPromotion       = (id)        => api.get(`${pr}/${id}`);
export const createPromotion    = (data)      => api.post(pr, toFormData(data), multipart);
export const updatePromotion    = (id, data)  => api.put(`${pr}/${id}`, toFormData(data), multipart);
export const deletePromotion    = (id)        => api.delete(`${pr}/${id}`);

// ——— Packs ———

export const getPacks           = (params)    => api.get(pk, { params });
export const getPacksList       = ()          => api.get(pk, { params: { all: true } });
export const getPack            = (id)        => api.get(`${pk}/${id}`);
export const createPack         = (data)      => api.post(pk, data);
export const updatePack         = (id, data)  => api.put(`${pk}/${id}`, data);
export const deletePack         = (id)        => api.delete(`${pk}/${id}`);
export const duplicatePack      = (id, node_id) => api.post(`${pk}/${id}/duplicate`, { node_id });

export const togglePackActive   = (id, is_active) => api.put(`${pk}/${id}`, { is_active });
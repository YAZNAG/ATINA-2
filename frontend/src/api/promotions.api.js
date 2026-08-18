import api from './axios';

const BASE = '/promotions';

function toFormData(data) {
  const fd = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'image' && value instanceof File) {
      fd.append('image', value);
    } else {
      fd.append(key, value);
    }
  });
  return fd;
}

export const promotionsApi = {
  getAll: (params = {}) => api.get(BASE, { params }),
  getById: (id) => api.get(`${BASE}/${id}`),
  create: (data) => api.post(BASE, toFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`${BASE}/${id}`, toFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => api.delete(`${BASE}/${id}`),
};

export default promotionsApi;
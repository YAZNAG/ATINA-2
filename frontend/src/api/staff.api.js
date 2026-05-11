import api from './axios';

const pb = '/staff/pickers';
const db = '/staff/drivers';

// ── Pickers ────────────────────────────────────────────────────────────────────
export const getPickers          = (params)         => api.get(pb, { params });
export const getPicker           = (id)             => api.get(`${pb}/${id}`);
export const createPicker        = (data)           => api.post(pb, data);
export const updatePicker        = (id, data)       => api.put(`${pb}/${id}`, data);
export const activatePicker      = (id)             => api.patch(`${pb}/${id}/activate`);
export const deactivatePicker    = (id)             => api.patch(`${pb}/${id}/deactivate`);
export const resetPickerPassword = (id, password)   => api.patch(`${pb}/${id}/reset-password`, { password });
export const deletePicker        = (id)             => api.delete(`${pb}/${id}`);
export const getPickerStats      = (id, params)     => api.get(`${pb}/${id}/stats`, { params });
export const getPickerSessions   = (id, params)     => api.get(`${pb}/${id}/sessions`, { params });
export const getPickerOrders     = (id, params)     => api.get(`${pb}/${id}/orders`, { params });

// ── Drivers ───────────────────────────────────────────────────────────────────
export const getDrivers          = (params)         => api.get(db, { params });
export const getDriver           = (id)             => api.get(`${db}/${id}`);
export const createDriver        = (data)           => api.post(db, data);
export const updateDriver        = (id, data)       => api.put(`${db}/${id}`, data);
export const activateDriver      = (id)             => api.patch(`${db}/${id}/activate`);
export const deactivateDriver    = (id)             => api.patch(`${db}/${id}/deactivate`);
export const resetDriverPassword = (id, password)   => api.patch(`${db}/${id}/reset-password`, { password });
export const deleteDriver        = (id)             => api.delete(`${db}/${id}`);

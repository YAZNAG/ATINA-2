import api from './axios';

const b = '/orders-mgmt';

export const getOrdersMeta        = ()              => api.get(`${b}/meta`);
export const getOrders            = (params)        => api.get(`${b}`, { params });
export const getOrder             = (id)            => api.get(`${b}/${id}`);
export const getOrderTransitions  = (id)            => api.get(`${b}/${id}/transitions`);
export const changeOrderStatus    = (id, status_code) => api.patch(`${b}/${id}/status`, { status_code });
export const cancelOrder          = (id, reason)    => api.patch(`${b}/${id}/cancel`, { reason });
export const getOrderHistory      = (id)            => api.get(`${b}/${id}/history`);
export const getOrderPickers      = (id)            => api.get(`${b}/${id}/pickers`);
export const assignOrderPicker    = (id, picker_id) => api.post(`${b}/${id}/assign-picker`, { picker_id });
export const confirmOrderPickup   = (id, data)      => api.patch(`${b}/${id}/confirm-pickup`, data ?? {});
export const updateOrderSlot = (id, slot_id) =>
  api.patch(`${b}/${id}/slot`, { slot_id });

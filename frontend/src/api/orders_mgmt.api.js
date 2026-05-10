import api from './axios';

const b = '/orders-mgmt';

export const getOrdersMeta        = ()              => api.get(`${b}/meta`);
export const getOrders            = (params)        => api.get(`${b}`, { params });
export const getOrder             = (id)            => api.get(`${b}/${id}`);
export const getOrderTransitions  = (id)            => api.get(`${b}/${id}/transitions`);
export const changeOrderStatus    = (id, status_code) => api.patch(`${b}/${id}/status`, { status_code });
export const cancelOrder          = (id, reason)    => api.patch(`${b}/${id}/cancel`, { reason });

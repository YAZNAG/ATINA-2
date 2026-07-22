import api from './client';

export async function getOrders() {
    const res = await api.get('/picker/my-orders');
    return res.data.data;
}
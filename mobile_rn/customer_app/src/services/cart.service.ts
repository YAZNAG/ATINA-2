import api from '../api/client';

export interface CartArticle {
  id:        number;
  sku_code:  string;
  name_fr:   string;
  name_ar:   string;
  price:     number;
  price_ttc: number; 
  vat_rate:  number;
  image_url: string | null;
  brand:     { id: number; name_fr: string; name_ar: string } | null;
  category:  { id: number; name_fr: string; name_ar: string } | null;
}

export interface CartItem {
  id:       string;
  sku_id:   string;
  quantity: number;
  article:  CartArticle;
  subtotal: number;
}

export interface Cart {
  id?:   string;
  items: CartItem[];
  total: number;
  count: number;
}

export const CartService = {

  async getCart(): Promise<Cart> {
    try {
      const response = await api.get('/customer/cart');
      return response.data.data || { items: [], total: 0, count: 0 };
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement panier');
    }
  },

  async addItem(skuId: string, quantity = 1): Promise<Cart> {
    if (quantity < 1) throw new Error('Quantité invalide'); 
    try {
      const response = await api.post('/customer/cart', { sku_id: skuId, quantity });
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur ajout au panier');
    }
  },

  async updateItem(skuId: string, quantity: number): Promise<Cart> {
    if (quantity < 1) throw new Error('Quantité invalide'); 
    try {
      const response = await api.put(`/customer/cart/${skuId}`, { quantity });
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur mise à jour panier');
    }
  },

  async removeItem(skuId: string): Promise<Cart> {
    try {
      const response = await api.delete(`/customer/cart/${skuId}`);
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur suppression article');
    }
  },

  async clearCart(): Promise<Cart> { 
    try {
      const response = await api.delete('/customer/cart');
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur vidage panier');
    }
  },
};
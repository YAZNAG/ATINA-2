import api from '../api/client';

export interface CartArticle {
  id:                  number;
  sku_code:            string;
  name_fr:             string;
  name_ar:             string;
  price:               number;
  price_ttc:           number;
  original_price_ttc:  number | null;
  discount_pct:        number | null;
  vat_rate:            number;
  image_url:           string | null;
  brand:               { id: number; name_fr: string; name_ar: string } | null;
  category:            { id: number; name_fr: string; name_ar: string } | null;
}

export interface CartItem {
  id:       string;
  sku_id:   string;
  pack:     { id: string; name_fr: string; image_url: string | null; bundle_qty: number } | null;
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

  async addPack(packId: string, quantity = 1): Promise<Cart> {
    if (quantity < 1) throw new Error('Quantité invalide');
    try {
      const response = await api.post('/customer/cart/pack', { pack_id: packId, quantity });
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur ajout du pack au panier');
    }
  },

  async updatePackQuantity(packId: string, quantity: number): Promise<Cart> {
    try {
      const response = await api.put(`/customer/cart/pack/${packId}`, { quantity });
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur mise à jour du pack');
    }
  },

  async removePack(packId: string): Promise<Cart> {
    try {
      const response = await api.delete(`/customer/cart/pack/${packId}`);
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur suppression du pack');
    }
  },

  async updateItem(itemId: string, quantity: number): Promise<Cart> {
    if (quantity < 1) throw new Error('Quantité invalide');
    try {
      const response = await api.put(`/customer/cart/${itemId}`, { quantity });
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur mise à jour panier');
    }
  },

  async removeItem(itemId: string): Promise<Cart> {
    try {
      const response = await api.delete(`/customer/cart/${itemId}`);
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

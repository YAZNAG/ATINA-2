import api from '../api/client';

export interface Profile{
    id:             string;
    name:           string;
    phone_country:  string;
    phone_number:   string;
    email:          string;
    preferred_lang: string;
    city:           string| null;
    avatar_url:     string| null;
    wallet_balance: number;
    points_balance: number;
    points_lifetime:number;
    referral_code:  string;
    user?: {
    id:        number;
    full_name: string;
    email:     string;
  }
  lat:             number | null;   
  lng:             number | null;
  phone_verified:  boolean;         
  address_count:   number;          
  is_active:       boolean;
  created_at:      string;
}

export interface Address {
  id:             string;
  label:          string| null;
  recipient_name: string| null;   
  phone:          string| null;   
  street_number:  string| null;
  street_name:    string;
  quartier:       string| null;
  city:           string;
  postal_code:    string| null;
  lat:            number| null;
  lng:            number| null;
  delivery_notes: string| null;
  is_default:     boolean;
}

export interface FavoriteArticle {
  wishlist_id:    string;
  id:             number;
  sku_code:       string;
  name_fr:        string;
  name_ar:        string;
  price_ttc:      number;
  old_price_ttc:  number | null;
  discount_pct:   number | null;
  sku_id:         string | null;
  image_url:      string | null;
}

export interface OrderStatus {
  id:      number;
  code:    string;
  name_fr: string;
  name_ar: string;
  color:   string | null;
} 

export interface OrderSummary {
  id:            string;
  reference:     string;
  delivery_type: string;
  node_name:     string | null;
  total_ttc:   number;
  created_at:  string;
  status:      OrderStatus;
  payment_status:  string;
  payment_status_label: string;
  payment_method_name: string | null;
  item_count: number;
  items?: { image_url?: string }[];
}

export interface OrderItem {
  id:         string;
  sku_code:   string | null;
  name_fr:    string;
  qty:        number;
  unit_price: number;
  vat_rate:   number;
  total_ttc:  number;
  image_url:  string | null;
}
 
export interface OrderTimeline {
  status_code: string | null;
  name_fr:     string | null;
  color:       string | null;
  created_at:  string;
  note:        string | null;
}

export interface OrderDriver {
  name:          string;
  phone:         string;
  vehicle_type:  string | null;
  vehicle_plate: string | null;
}

export interface Order {
  id:                  string;
  reference:           string;
  created_at:          string;
  delivery_type:       string;
  node_name:           string | null;
  total_ttc:           number;
  delivery_fee:        number;
  wallet_used:         number;
  notes:               string | null;
  status:              OrderStatus;
  payment_status:      string;
  payment_status_label: string;
  payment_method_name: string | null;
  address_label:       string | null;
  address_full:        string;
  slot_name:           string | null;
  slot_date:           null;
  slot_start:          string | null;
  slot_end:            string | null;
  driver:              OrderDriver | null;
  stop_status:         string | null;
  items:               OrderItem[];
  timeline:            OrderTimeline[];
  discount_amount:  number;
coupon_code:      string | null;  
has_pending_substitution: boolean;
}

export interface Wallet {
  balance:         number;
  points_balance:  number;
  points_lifetime: number;
  transactions: Array<{
    id:         string;
    amount:     number;
    type:       string;
    created_at: string;
  }>;
}

export interface Notification {
  id:         string;
  event_code: string;
  title_fr:   string | null;
  body_fr:    string | null;
  is_read:    boolean;
  sent_at:    string;
}

export const ProfileService = {

    //Profile
    async getProfile(): Promise<Profile>{
        try{
            const response=await api.get('/customer/me')
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement profile');
        }
    },

    async updateProfile(data: Partial<{ name: string; city: string; preferred_lang: string}>): Promise<Profile>{
        try{
            const response=await api.put('/customer/me', data)
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur mise a jour Profile');
        }
    },

    //adresses
    async listAddresses(): Promise<Address[]>{
        try{
            const response=await api.get('/customer/me/addresses')
            return response.data.data || [];
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement Addresses');
        }
    },

    async createAddress(data: Partial<Address>): Promise<Address>{
        try{
            const response=await api.post('/customer/me/addresses', data)
            return response.data.data 
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur creation Addresse');
        }
    },

    async updateAddress(id: string, data: Partial<Address>):Promise<Address>{
        try{
            const response=await api.put(`/customer/me/addresses/${id}`, data)
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur mise a jour Addresse');
        }
    },

    async deleteAddress(id: string): Promise<void>{
        try{
            await api.delete(`/customer/me/addresses/${id}`)
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur supression Addresse');
        }
    },

    async setDefaultAddress(id : string): Promise<Address>{
        try{
            const response = await api.patch(`/customer/me/addresses/${id}/set-default`)
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur Addresse par defaut');
        }
    },

    //ordres
    async listOrders():Promise<OrderSummary[]>{
        try{
            const response=await api.get('/customer/me/orders')
            return response.data.data ?? []
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement commandes');
        }
    },

    async getOrderById(id: string): Promise<Order>{
        try{
            const response= await api.get(`/customer/me/orders/${id}`)
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement commande');
        }
    },

    //Wallet
    async getWallet(): Promise<Wallet>{
        try{
            const response = await api.get('/customer/me/wallet')
            return response.data.data
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement wallet');
        }
    },

    //Notifications
    async listNotifications(): Promise<Notification[]>{
        try{
            const response = await api.get('/customer/me/notifications');
            return response.data.data || [];
        }
        catch(err:any){
            throw new Error(err.response?.data?.message || 'Erreur chargement notifications');
        }
    },

    async markNotificationRead(id: string): Promise<void> {
        try {
            await api.patch(`/customer/me/notifications/${id}/read`);
        }
        catch (err: any) {
            throw new Error(err.response?.data?.message || 'Erreur');
        }
    },

    async markAllNotificationsRead(): Promise<void> {
        try {
            await api.patch('/customer/me/notifications/read-all');
        }
        catch (err: any) {
            throw new Error(err.response?.data?.message || 'Erreur');
        }
    },

    async deleteNotification(id: string): Promise<void> {
        try {
            await api.delete(`/customer/me/notifications/${id}`);
        }
        catch (err: any) {
            throw new Error(err.response?.data?.message || 'Erreur');
        }
    },

    async deleteAllNotifications(): Promise<void> {
        try {
            await api.delete('/customer/me/notifications/all');
        }
        catch (err: any) {
            throw new Error(err.response?.data?.message || 'Erreur');
        }
    },

async updateEmail(email: string): Promise<{ message: string }> {
  try {
    const response = await api.put('/customer/me/email', { email });
    return response.data.data ?? response.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur mise à jour email');
  }
},

async requestPhoneChange(phone_number: string, phone_country = '+212'): Promise<{ message: string }> {
  try {
    const response = await api.post('/customer/me/phone/request-otp', { phone_country, phone_number });
    return response.data.data ?? response.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur envoi du code');
  }
},

async confirmPhoneChange(phone_number: string, otp: string, phone_country = '+212'): Promise<{ message: string }> {
  try {
    const response = await api.post('/customer/me/phone/verify-otp', { phone_country, phone_number, otp });
    return response.data.data ?? response.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Code incorrect');
  }
},

async changePassword(old_password: string, new_password: string): Promise<{ message: string }> {
  try {
    const response = await api.put('/customer/me/password', { old_password, new_password });
    return response.data.data ?? response.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur changement mot de passe');
  }
},

// Avatar
async uploadAvatar(uri: string): Promise<Profile> {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const formData = new FormData();
  formData.append('avatar', { uri, name: `avatar.${ext}`, type: mimeMap[ext] ?? 'image/jpeg' } as any);
  const response = await api.post('/customer/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
},

async deleteAvatar(): Promise<Profile> {
  const response = await api.delete('/customer/me/avatar');
  return response.data.data;
},

// Favorites
async listFavorites(): Promise<FavoriteArticle[]> {
  try {
    const response = await api.get('/customer/me/favorites');
    return response.data.data ?? [];
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur chargement favoris');
  }
},
async addFavorite(articleId: number): Promise<void> {
  try {
    await api.post('/customer/me/favorites', { article_id: articleId });
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur ajout favori');
  }
},
async removeFavorite(articleId: number): Promise<void> {
  try {
    await api.delete(`/customer/me/favorites/${articleId}`);
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur suppression favori');
  }
},
}
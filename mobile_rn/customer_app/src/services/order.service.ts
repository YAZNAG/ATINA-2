import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';

const BASE_URL  = CONFIG.API_URL;
const TOKEN_KEY = 'auth_token';

export interface CartItem {
  sku_code:   string;
  qty:        number;
  unit_price?: number;
  vat_rate?:  number;
}

export interface PaymentMethod {
  id:   string;
  code: string;
  name: string;
}

export interface DeliveryType {
  id:   string;
  code: string;
  name: string;
}

export interface DeliverySlot {
  id:         string;
  name:       string;
  date:       string;
  start_time: string;
  end_time:   string;
  available:  boolean;
}

export interface Node {
  id:       string;
  name:     string;
  address:  string;
  lat:      number | null;
  lng:      number | null;
  distance?: number;
}

export interface Meta {
  payment_methods:  PaymentMethod[];
  delivery_types:   DeliveryType[];
}

export interface CreateOrderPayload {
  cart_items:          CartItem[];
  delivery_type_code:  string;          
  node_id?:            string;          
  address_id?:         string;           
  slot_id?:            string;
  payment_method_code: string;
  notes?:              string;
  wallet_amount?:      number;
  referral_code?:      string;
}

export interface OrderCreated {
  id:        string;
  reference: string;
  status:    string;
}


async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) {
    throw {
      statusCode: res.status,
      message:    json?.message ?? 'Erreur serveur',
    };
  }

  return (json.data ?? json) as T;
}

export async function getMeta(node_id?: string): Promise<Meta> {
  const query = node_id ? `?node_id=${node_id}` : '';
  return request<Meta>(`/customer/checkout/meta${query}`);
}

export async function findEligibleNodes(
  address_id: string,
  cart_items:  CartItem[],
  date?:       string,
): Promise<Node[]> {
  return request<Node[]>('/customer/checkout/eligible-nodes', {
    method: 'POST',
    body:   JSON.stringify({ address_id, cart_items, date }),
  });
}

export async function findPickupNodes(
  cart_items: CartItem[],
  date?:      string,
): Promise<Node[]> {
  const params = new URLSearchParams();
  params.set('cart_items', JSON.stringify(cart_items));
  if (date) params.set('date', date);

  const result = await request<any>(`/customer/checkout/pickup-nodes?${params.toString()}`);

  // Le backend renvoie { eligible: [...], ineligible: [...], ... }
  const rawNodes = Array.isArray(result) ? result : (result?.eligible ?? []);

  // Reformate pour matcher l'interface Node
  return rawNodes.map((n: any) => ({
    id:       n.id,
    name:     n.name_fr ?? n.name,
    address:  [n.address_line1, n.quartier, n.city?.name_fr].filter(Boolean).join(', '),
    lat:      n.lat != null ? Number(n.lat) : null,
    lng:      n.lng != null ? Number(n.lng) : null,
    distance: n.distance != null ? Number(n.distance) : undefined,
  }));
}

export async function getDeliverySlots(params: {
  address_id?:         string;
  node_id?:            string;
  delivery_type_id?:   string;
  delivery_type_code?: string;
  date?:               string;
  cart_items?:         CartItem[];
}): Promise<DeliverySlot[]> {
  const query = new URLSearchParams();
  if (params.address_id)         query.set('address_id',         params.address_id);
  if (params.node_id)            query.set('node_id',            params.node_id);
  if (params.delivery_type_id)   query.set('delivery_type_id',   params.delivery_type_id);
  if (params.delivery_type_code) query.set('delivery_type_code', params.delivery_type_code);
  if (params.date)               query.set('date',               params.date);
  if (params.cart_items?.length) query.set('cart_items',         JSON.stringify(params.cart_items));

  const result = await request<any>(`/customer/checkout/delivery-slots?${query.toString()}`);

  // Le backend renvoie { delivery_type, node, slots: [...], all_slots: [...] }
  const rawSlots = Array.isArray(result) ? result : (result?.slots ?? []);

  return rawSlots.map((s: any) => ({
    id:         s.id,
    name:       s.name_fr ?? s.name ?? '',
    date:       params.date ?? '',
    start_time: s.slot_start ?? s.start_time,   // backend: slot_start
    end_time:   s.slot_end   ?? s.end_time,     // backend: slot_end
    available:  s.is_full ? false : (s.is_past ? false : true),
  }));
}
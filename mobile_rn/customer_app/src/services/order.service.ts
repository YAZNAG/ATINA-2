import api from '../api/client';

export interface CartItem {
  sku_code:    string;
  qty:         number;
  unit_price?: number;
  vat_rate?:   number;
  pack_id?:    string | null;
}

export interface PaymentMethod {
  id:          string;
  code:        string;
  name_fr:     string;
  name_ar:     string;
  description: string | null;
}

export interface DeliveryType {
  id:      string;
  code:    string;
  name_fr: string;
  name_ar: string;
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
  promo_code?:         string;
}

export interface OrderCreated {
  id:        string;
  reference: string;
  status:    string;
}

export interface OrderCalculation {
  items?:           any[];
  subtotal_ht:      number;
  vat_amount:       number;
  subtotal_ttc:     number;
  delivery_fee:     number;
  discount_amount:  number;
  coupon_error?:     string | null;
  wallet_used:      number;
  total_ttc:        number;
  cod_amount:       number;
  currency:         string;
}

export interface DeliverySlotsResult {
  slots:   DeliverySlot[];
  node_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap<T>(data: any): T {
  return (data?.data ?? data) as T;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getMeta(node_id?: string): Promise<Meta> {
  const res = await api.get('/customer/checkout/meta', {
    params: node_id ? { node_id } : undefined,
  });
  return unwrap<Meta>(res.data);
}

export async function findEligibleNodes(
  address_id: string,
  cart_items:  CartItem[],
  date?:       string,
): Promise<Node[]> {
  const res = await api.post('/customer/checkout/eligible-nodes', {
    address_id, cart_items, date,
  });
  return unwrap<Node[]>(res.data);
}

export async function findPickupNodes(
  cart_items: CartItem[],
  date?:      string,
): Promise<Node[]> {
  const res = await api.get('/customer/checkout/pickup-nodes', {
    params: {
      cart_items: JSON.stringify(cart_items),
      ...(date ? { date } : {}),
    },
  });

  const result  = unwrap<any>(res.data);
  const rawNodes = Array.isArray(result) ? result : (result?.eligible ?? []);

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
}): Promise<DeliverySlotsResult> {
  const query: Record<string, string> = {};
  if (params.address_id)         query.address_id         = params.address_id;
  if (params.node_id)            query.node_id            = params.node_id;
  if (params.delivery_type_id)   query.delivery_type_id   = params.delivery_type_id;
  if (params.delivery_type_code) query.delivery_type_code = params.delivery_type_code;
  if (params.date)               query.date               = params.date;
  if (params.cart_items?.length) query.cart_items         = JSON.stringify(params.cart_items);

  const res    = await api.get('/customer/checkout/delivery-slots', { params: query });
  const result = unwrap<any>(res.data);

  const rawSlots = Array.isArray(result) ? result : (result?.slots ?? []);

  return {
    node_id: result?.node?.id ?? null,
    slots: rawSlots.map((s: any) => ({
      id:         s.id,
      name:       s.name_fr ?? s.name ?? '',
      date:       params.date ?? '',
      start_time: s.slot_start ?? s.start_time,
      end_time:   s.slot_end   ?? s.end_time,
      available:  s.is_full ? false : (s.is_past ? false : true),
    })),
  };
}

export async function calculateOrder(params: {
  node_id:              string;
  delivery_type_code:   string;
  cart_items:           CartItem[];
  payment_method_code?: string;
  wallet_used?:         number;
  promo_code?:          string;
}): Promise<OrderCalculation> {
  const res = await api.post('/customer/checkout/calculate', params);
  return unwrap<OrderCalculation>(res.data);
}

export async function createOrder(payload: CreateOrderPayload): Promise<OrderCreated> {
  const res = await api.post('/customer/checkout/create-order', payload);
  return unwrap<OrderCreated>(res.data);
}

import api from './client';
import { CONFIG } from '../constants/config';
import * as SecureStore from 'expo-secure-store';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  phone_country: string;
  phone_number:  string;
  password:      string;
}

export interface OrderSummary {
  id:          string;
  customer:    { name: string };
  items_count: number;
  status:      { code: string; name_fr: string };
  created_at:  string;
  node:        { name_fr: string };
}

export interface SessionItem {
  id:             string;
  qty_expected:   number;
  qty_picked:     number;
  status:         { code: string; name_fr: string };
  order_item: {
    sku: {
      id:      string;
      article: {
        name_fr:   string;
        name_ar:   string;
        ean13:     string | null;
        sku_code:  string;
      };
      images: { url: string; is_primary: boolean }[];
    };
  };
  location?: { label: string; aisle: string; shelf: string } | null;
}

export interface PickingSession {
  id:           string;
  order_id:     string;
  status:       { code: string; name_fr: string };
  started_at:   string | null;
  completed_at: string | null;
  items_count:  number;
  items_picked: number;
  items:        SessionItem[];
  order: {
    id:       string;
    customer: { name: string };
    total_ttc: number;
    address:  { street_name: string; city: string } | null;
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function pickerLogin(payload: LoginPayload) {
  const res = await api.post('/picker/login', payload);
  return res.data?.data ?? res.data;
}

// ── Commandes ─────────────────────────────────────────────────────────────────

export async function getAvailableOrders(): Promise<OrderSummary[]> {
  const res = await api.get('/picker/available-orders');
  return res.data?.data ?? [];
}

export async function getMyOrders() {
  const res = await api.get('/picker/my-orders');
  return res.data?.data ?? { active: [], completed: [], cancelled: [] };
}

export async function acceptOrder(orderId: string): Promise<PickingSession> {
  const res = await api.post(`/picker/orders/${orderId}/accept`);
  return res.data?.data ?? res.data;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getSession(sessionId: string): Promise<PickingSession> {
  const res = await api.get(`/picker/sessions/${sessionId}`);
  return res.data?.data ?? res.data;
}

export async function startSession(sessionId: string): Promise<PickingSession> {
  const res = await api.patch(`/picker/sessions/${sessionId}/start`);
  return res.data?.data ?? res.data;
}

export async function completeSession(sessionId: string): Promise<PickingSession> {
  const res = await api.patch(`/picker/sessions/${sessionId}/complete`);
  return res.data?.data ?? res.data;
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function pickItem(itemId: string, qty_picked?: number, scanned_ean?: string) {
  const res = await api.patch(`/picker/items/${itemId}/pick`, { qty_picked, scanned_ean });
  return res.data?.data ?? res.data;
}

export async function declareOutOfStock(itemId: string, reason?: string) {
  const res = await api.patch(`/picker/items/${itemId}/out-of-stock`, { reason });
  return res.data?.data ?? res.data;
}

export async function substituteItem(
  itemId: string,
  params: { substitute_sku_id?: string; substitute_ean?: string; qty_picked?: number; reason?: string }
) {
  const res = await api.patch(`/picker/items/${itemId}/substitute`, params);
  return res.data?.data ?? res.data;
}

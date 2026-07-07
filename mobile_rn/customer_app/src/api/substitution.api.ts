import api from './client';

export interface SubstitutionSku {
  id:         string;
  name_fr:    string;
  name_ar?:   string;
  image_url?: string | null;
  price?:     number;
}

export interface Substitution {
  id:                 string;
  session_item_id:    string;
  original_sku:      SubstitutionSku;
  substitute_sku:     SubstitutionSku | null;
  status:             'pending' | 'accepted' | 'refused';
  reason?:            string | null;
  created_at:         string;
}

// Récupère les substitutions proposées pour une commande
export async function getOrderSubstitutions(orderId: string): Promise<Substitution[]> {
  const res = await api.get(`/customer/orders/${orderId}/substitutions`);
  return res.data?.data ?? res.data ?? [];
}

// Récupère les substitutions en attente de réponse du client connecté
export async function getPendingSubstitutions(): Promise<Substitution[]> {
  const res = await api.get('/customer/substitutions/pending');
  return res.data?.data ?? res.data ?? [];
}

// Le client répond à une proposition de substitution
export async function respondToSubstitution(
  substitutionId: string,
  status: 'accepted' | 'refused',
): Promise<Substitution> {
  const res = await api.patch(`/customer/substitutions/${substitutionId}/respond`, { status });
  return res.data?.data ?? res.data;
}
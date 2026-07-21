import api from '../api/client';

export type SubstitutionStatus = 'pending' | 'accepted' | 'refused';

export interface SubstitutionSku {
  id:        string;
  name_fr:   string;
  name_ar:   string;
  price:     number | null;
  image_url: string | null;
}

export interface Substitution {
  id:              string;
  session_item_id: string;
  status:          SubstitutionStatus;
  original_sku:    SubstitutionSku | null;
  substitute_sku:  SubstitutionSku | null;
  reason:          string | null;
  created_at:      string | null;
}

export const SubstitutionService = {

  // Substitutions d'une commande précise
  async getOrderSubstitutions(orderId: string): Promise<Substitution[]> {
    try {
      const response = await api.get(`/customer/orders/${orderId}/substitutions`);
      return response.data.data ?? [];
    }
    catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement substitutions');
    }
  },

  // Substitutions en attente, toutes commandes confondues
  async getPendingSubstitutions(): Promise<Substitution[]> {
    try {
      const response = await api.get('/customer/substitutions/pending');
      return response.data.data ?? [];
    }
    catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement substitutions en attente');
    }
  },

  // Accepter ou refuser une substitution proposée
  async respondToSubstitution(
    sessionItemId: string,
    status: Extract<SubstitutionStatus, 'accepted' | 'refused'>,
  ): Promise<Substitution> {
    try {
      const response = await api.patch(`/customer/substitutions/${sessionItemId}/respond`, { status });
      return response.data.data;
    }
    catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur réponse substitution');
    }
  },

};
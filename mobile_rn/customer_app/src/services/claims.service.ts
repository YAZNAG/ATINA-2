import api from '../api/client';

export type ClaimType =
  | 'MISSING_PRODUCT'
  | 'DAMAGED_PRODUCT'
  | 'WRONG_PRODUCT'
  | 'REFUND_REQUEST'
  | 'DELIVERY_ISSUE'
  | 'OTHER';

export type ClaimStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ClaimPriority = 'NORMAL' | 'URGENT';

export interface ClaimOrder {
  id: string;
  reference: string;
  total_ttc: number;
  status: { name_fr: string; color: string } | null;
}

export interface Claim {
  id: string;
  type: ClaimType;
  type_label: string;
  status: ClaimStatus;
  status_label: string;
  priority: ClaimPriority;
  description: string;
  admin_note: string | null;
  attachment_url: string | null;
  contact_phone: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  order: ClaimOrder | null;
}

export interface ClaimTypeOption {
  code: ClaimType;
  label: string;
}

export interface ClaimsMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListClaimsResponse {
  data: Claim[];
  meta: ClaimsMeta;
}

export interface ListClaimsParams {
  status?: ClaimStatus;
  page?: number;
  limit?: number;
}

export interface CreateClaimPayload {
  order_id: string;
  type: ClaimType;
  description: string;
  priority?: ClaimPriority;
  contact_phone?: string;
}


async function getTypes(): Promise<ClaimTypeOption[]> {
  try {
    const { data } = await api.get('/customer/claims/types');
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors du chargement des types',
    };
  }
}

async function listMyClaims(params?: ListClaimsParams): Promise<ListClaimsResponse> {
  try {
    const { data } = await api.get('/customer/claims', { params });
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors du chargement des réclamations',
    };
  }
}

async function getClaimById(claimId: string): Promise<Claim> {
  try {
    const { data } = await api.get(`/customer/claims/${claimId}`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Réclamation introuvable',
    };
  }
}

async function createClaim(payload: CreateClaimPayload): Promise<Claim> {
  try {
    const { data } = await api.post('/customer/claims', payload);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de l'envoi de la réclamation",
    };
  }
}

async function attachPhoto(claimId: string, uri: string): Promise<Claim> {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  const formData = new FormData();
  formData.append('photo', { uri, name: `claim.${ext}`, type: mimeMap[ext] ?? 'image/jpeg' } as any);
  try {
    const { data } = await api.post(`/customer/claims/${claimId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de l'envoi de la photo",
    };
  }
}

async function cancelClaim(claimId: string): Promise<{ id: string }> {
  try {
    const { data } = await api.delete(`/customer/claims/${claimId}`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de l'annulation",
    };
  }
}

export const ClaimsService = {
  getTypes,
  listMyClaims,
  getClaimById,
  createClaim,
  attachPhoto,
  cancelClaim,
};

export default ClaimsService;
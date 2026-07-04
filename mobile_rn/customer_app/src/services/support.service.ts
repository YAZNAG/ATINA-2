import api from '../api/client';

export type SupportCategory = 'ORDER' | 'ACCOUNT' | 'LOYALTY' | 'PRODUCT' | 'OTHER';
export type ConversationStatus = 'OPEN' | 'RESOLVED' | 'CLOSED' | 'PENDING';
export type SenderType = 'CUSTOMER' | 'AGENT';

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string;
  content: string;
  attachments: string[];
  created_at: string;
}

export interface AssignedAgent {
  id: string;
  full_name: string;
}

export interface SupportConversation {
  id: string;
  subject: string;
  category: SupportCategory;
  status: ConversationStatus;
  order_id: string | null;
  last_message_at: string;
  created_at: string;
  assigned_agent: AssignedAgent | null;
  messages?: SupportMessage[];
}

export interface CreateConversationPayload {
  subject: string;
  category: SupportCategory;
  order_id?: string;
  first_message?: string;
}

export interface SendMessagePayload {
  content: string;
  attachments?: string[];
}

async function getMyConversations(): Promise<SupportConversation[]> {
  try {
    const { data } = await api.get('/customer/support');
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors du chargement des conversations',
    };
  }
}

async function createConversation(
  payload: CreateConversationPayload
): Promise<SupportConversation> {
  try {
    const { data } = await api.post('/customer/support', payload);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors de la création de la conversation',
    };
  }
}

async function getConversationById(conversationId: string): Promise<SupportConversation> {
  try {
    const { data } = await api.get(`/customer/support/${conversationId}`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Conversation introuvable',
    };
  }
}

async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload
): Promise<SupportMessage> {
  try {
    const { data } = await api.post(`/customer/support/${conversationId}/messages`, payload);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de l'envoi du message",
    };
  }
}

async function deleteConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await api.delete(`/customer/support/${conversationId}`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors de la suppression de la conversation',
    };
  }
}

export default {
  getMyConversations,
  createConversation,
  getConversationById,
  sendMessage,
  deleteConversation,
};
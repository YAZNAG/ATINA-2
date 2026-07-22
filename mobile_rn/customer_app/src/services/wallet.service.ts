import api from '../api/client';

export interface WalletTxnType {
  code: string;
  name_fr: string;
  name_ar: string;
  direction: 'IN' | 'OUT';
}

export interface WalletTransaction {
  id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference: string | null;
  note: string | null;
  created_at: string;
  txn_type: WalletTxnType;
}

export interface WalletData {
  customer: {
    id: string;
    name: string;
    wallet_balance: number;
  };
  transactions: WalletTransaction[];
}

export interface PaginatedTransactions {
  data: WalletTransaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const walletService = {
  // Solde + 50 dernières transactions
  getWallet: async (): Promise<WalletData> => {
    const { data } = await api.get('/customer/wallet');
    return data.data;
  },

  // Historique paginé
  getTransactions: async (page = 1, limit = 20): Promise<PaginatedTransactions> => {
    const { data } = await api.get('/customer/wallet/transactions', {
      params: { page, limit },
    });
    return data.data;
  },
};
import api from '../api/client';

export interface LoyaltySummary {
  points_balance: number;
  points_lifetime: number;
  next_milestone: number;
  remaining_points: number;
  progress_pct: number;
  reward_mad: number;
  can_redeem: boolean;
  redeem_cost: number;
  redeem_reward_mad: number;
}

export interface LoyaltyHistoryItem {
  id: string;
  type: 'earn' | 'redeem';
  points: number;
  label: string;
  created_at: string;
}

export const LoyaltyService = {
  getSummary: async (): Promise<LoyaltySummary> => {
    const { data } = await api.get('/customer/loyalty/summary');
    return data.data;
  },

  getHistory: async (limit = 20, cursor?: string): Promise<{ items: LoyaltyHistoryItem[]; next_cursor: string | null }> => {
    const { data } = await api.get('/customer/loyalty/history', { params: { limit, cursor } });
    return data.data;
  },

  redeem: async (): Promise<{ points_balance: number; coupon: { code: string; value_mad: number; valid_to: string } }> => {
    const { data } = await api.post('/customer/loyalty/redeem');
    return data.data;
  },
};
import api from '../api/client';

export interface LoyaltySummary {
  points_balance: number;
  points_lifetime: number;
  next_milestone: number;
  remaining_points: number;
  progress_pct: number;
  can_redeem: boolean;
  redeem_cost: number;
  redeem_reward_mad: number;
  reward_type: 'COUPON' | 'WALLET' | 'DISCOUNT' | 'POINTS'; 
}

export interface LoyaltyHistoryItem {
  id: string;
  type: 'earn' | 'redeem';
  points: number;
  label: string;
  created_at: string;
}

export type LoyaltyReward =
  | { type: 'coupon'; code: string; value_mad: number; valid_to: string }
  | { type: 'wallet'; amount_mad: number };

export interface LoyaltyRedeemResult {
  points_balance: number;
  reward: LoyaltyReward;
  rule_applied: string;
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

  redeem: async (): Promise<LoyaltyRedeemResult> => {
    const { data } = await api.post('/customer/loyalty/redeem');
    return data.data;
  },
};
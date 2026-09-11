import api from '../api/client';

export type PrizeTypeCode = 'points' | 'coupon' | 'free_sku' | 'free_pack' | 'no_prize';

export interface GamePrizePreview {
  id:         string;
  name_fr:    string;
  name_ar:    string;
  type:       PrizeTypeCode;
  sort_order: number;
}

/** Jeu disponible pour le client (roulette ou carte à gratter). */
export interface CustomerGame {
  id:                 string;
  name_fr:            string;
  name_ar:            string;
  type:               'roulette' | 'scratch_card' | string | null;
  type_label:         string | null;
  condition:          'first_order' | 'order_delivered' | 'signup' | 'app_login' | string | null;
  condition_label:    string | null;
  period:             'lifetime' | 'daily' | 'weekly' | 'monthly' | string | null;
  period_label:       string | null;
  max_plays_per_user: number;
  unlock_min_amount:  number | null;
  starts_at:          string;
  ends_at:            string | null;
  prizes:             GamePrizePreview[];
  can_play:           boolean;
  badge:              boolean;
  reason:             string | null;
  message:            string;
  remaining:          number | null;
  plays_in_period:    number | null;
  order_id:           string | null;
}

export interface GamesList {
  node_id:         string | null;
  badge_count:     number;
  prizes_to_claim: number;
  games:           CustomerGame[];
}

export type GameReward =
  | { type: 'points'; points: number; balance_after: number }
  | { type: 'coupon'; code: string; valid_to: string }
  | { type: 'free_sku' | 'free_pack'; sku_id: string | null; pack_id: string | null; claim_before: string }
  | null;

export interface PlayResult {
  play_id:        string;
  result:         'win' | 'lose';
  played_at:      string;
  prize:          { id: string; name_fr: string; name_ar: string; type: PrizeTypeCode } | null;
  reward:         GameReward;
  expires_at:     string | null;
  remaining:      number | null;
  message:        string;
  reload_message: string | null;
}

interface PrizeBase {
  play_id:       string;
  played_at:     string;
  game:          { id: string; name_fr: string; name_ar: string; type: string | null };
  prize_name_fr: string;
  prize_name_ar: string;
}

export interface PointsPrize extends PrizeBase { points: number; credited_at: string | null }

export interface CouponPrize extends PrizeBase {
  code:             string | null;
  promo_type:       string | null;
  value:            number | null;
  min_order_amount: number;
  valid_from:       string | null;
  valid_to:         string | null;
  status:           'available' | 'used' | 'expired' | 'unavailable';
}

export interface ClaimablePrize extends PrizeBase {
  type:       'free_sku' | 'free_pack';
  sku_id:     string | null;
  pack_id:    string | null;
  name_fr:    string;
  name_ar:    string;
  image_url:  string | null;
  node_id:    string | null;
  expires_at: string | null;
  claimed_at: string | null;
  status:     'pending' | 'claimed' | 'expired';
  order_id:   string | null;
}

export interface MyPrizes {
  summary:  { points_total: number; coupons_available: number; prizes_to_claim: number };
  points:   PointsPrize[];
  coupons:  CouponPrize[];
  to_claim: ClaimablePrize[];
}

export const GamesService = {
  async list(nodeId?: string | null): Promise<GamesList> {
    const res = await api.get('/customer/games', { params: nodeId ? { node_id: nodeId } : undefined });
    return res.data.data;
  },

  async play(gameId: string, orderId?: string | null): Promise<PlayResult> {
    const res = await api.post(`/customer/games/${gameId}/play`, orderId ? { order_id: orderId } : {});
    return res.data.data;
  },

  async myPrizes(): Promise<MyPrizes> {
    const res = await api.get('/customer/games/prizes');
    return res.data.data;
  },
};

export function gameTypeLabel(type: string | null): string {
  if (type === 'scratch_card') return 'Carte à gratter';
  if (type === 'roulette') return 'Roulette';
  return 'Jeu';
}

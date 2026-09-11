/**
 * Panier « récompenses » — lignes d'ÉCHANGE DE POINTS et LOTS GAGNÉS à réclamer.
 *
 * WF #19 (partie A) : avant confirmation, l'échange n'existe QUE dans le panier de l'app :
 * aucune écriture en base, aucun débit de points, aucune réservation de stock. Ces lignes
 * sont donc gardées localement (SecureStore) puis envoyées au checkout dans
 * `exchange_items` et `claim_play_ids` ; le serveur rejoue tous les contrôles à la
 * confirmation. Le solde projeté affiché est purement informatif.
 */
import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'rewards_cart_v1';

export interface ExchangeLine {
  sku_id:            string;
  name_fr:           string;
  points_cost:       number;
  qty:               number;
  max_qty_per_order: number | null;
  node_id:           string | null;
}

export interface ClaimLine {
  play_id:    string;
  name_fr:    string;
  type:       'free_sku' | 'free_pack';
  expires_at: string | null;
  node_id:    string | null;
}

export interface RewardsCartState {
  exchange: ExchangeLine[];
  claims:   ClaimLine[];
}

let state: RewardsCartState = { exchange: [], claims: [] };
let loaded = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

async function persist() {
  try {
    // Format compact (SecureStore limite la taille des valeurs).
    const compact = {
      e: state.exchange.map((l) => [l.sku_id, l.name_fr.slice(0, 60), l.points_cost, l.qty, l.max_qty_per_order, l.node_id]),
      c: state.claims.map((l) => [l.play_id, l.name_fr.slice(0, 60), l.type, l.expires_at, l.node_id]),
    };
    await SecureStore.setItemAsync(KEY, JSON.stringify(compact));
  } catch { /* stockage indisponible : le panier reste en mémoire */ }
}

function set(next: RewardsCartState) {
  state = next;
  emit();
  persist();
}

export async function loadRewardsCart(): Promise<RewardsCartState> {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const c = JSON.parse(raw);
      state = {
        exchange: (c.e ?? []).map((a: any[]) => ({
          sku_id: a[0], name_fr: a[1], points_cost: Number(a[2]), qty: Number(a[3]), max_qty_per_order: a[4] ?? null, node_id: a[5] ?? null,
        })),
        claims: (c.c ?? []).map((a: any[]) => ({
          play_id: a[0], name_fr: a[1], type: a[2], expires_at: a[3] ?? null, node_id: a[4] ?? null,
        })),
      };
      emit();
    }
  } catch { /* ignore */ }
  return state;
}

export const RewardsCart = {
  get: () => state,

  /** Ajoute (ou incrémente) une ligne d'échange ; renvoie un message d'erreur si le plafond est atteint. */
  addExchange(line: Omit<ExchangeLine, 'qty'>, qty = 1): string | null {
    const existing = state.exchange.find((l) => l.sku_id === line.sku_id);
    const nextQty = (existing?.qty ?? 0) + qty;
    if (line.max_qty_per_order != null && nextQty > line.max_qty_per_order) {
      return `Maximum ${line.max_qty_per_order} par commande pour ce produit`;
    }
    const others = state.exchange.filter((l) => l.sku_id !== line.sku_id);
    set({ ...state, exchange: [...others, { ...line, qty: nextQty }] });
    return null;
  },

  setExchangeQty(skuId: string, qty: number) {
    if (qty <= 0) { set({ ...state, exchange: state.exchange.filter((l) => l.sku_id !== skuId) }); return; }
    set({ ...state, exchange: state.exchange.map((l) => (l.sku_id === skuId ? { ...l, qty } : l)) });
  },

  removeExchange(skuId: string) {
    set({ ...state, exchange: state.exchange.filter((l) => l.sku_id !== skuId) });
  },

  addClaim(line: ClaimLine) {
    if (state.claims.some((c) => c.play_id === line.play_id)) return;
    set({ ...state, claims: [...state.claims, line] });
  },

  removeClaim(playId: string) {
    set({ ...state, claims: state.claims.filter((c) => c.play_id !== playId) });
  },

  clear() { set({ exchange: [], claims: [] }); },

  /** Charge utile du checkout (ne contient jamais de prix : le serveur fige tout à la confirmation). */
  payload(): { exchange_items?: { sku_id: string; qty: number }[]; claim_play_ids?: string[] } {
    const out: { exchange_items?: { sku_id: string; qty: number }[]; claim_play_ids?: string[] } = {};
    if (state.exchange.length) out.exchange_items = state.exchange.map((l) => ({ sku_id: l.sku_id, qty: l.qty }));
    if (state.claims.length) out.claim_play_ids = state.claims.map((c) => c.play_id);
    return out;
  },

  pointsTotal: () => state.exchange.reduce((s, l) => s + l.points_cost * l.qty, 0),

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** Hook React : état courant du panier récompenses (chargé depuis SecureStore au premier appel). */
export function useRewardsCart(): RewardsCartState {
  if (!loaded) loadRewardsCart();
  return useSyncExternalStore(RewardsCart.subscribe, RewardsCart.get, RewardsCart.get);
}

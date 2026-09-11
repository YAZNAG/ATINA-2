import api from '../api/client';

/** Produit échangeable contre des points (catalogue « Échanger mes points » — WF #19). */
export interface ExchangeCatalogItem {
  rule_id:           string;
  sku_id:            string;
  sku_code:          string;
  name_fr:           string;
  name_ar:           string;
  image_url:         string | null;
  points_cost:       number;
  max_qty_per_order: number | null;
  qty_available:     number;
  max_orderable:     number;
  price_ttc:         number | null;
  affordable:        boolean;
}

export interface ExchangeCatalog {
  node:           { id: string; code: string; name_fr: string; name_ar: string } | null;
  points_balance: number;
  items:          ExchangeCatalogItem[];
}

export const PointsExchangeService = {
  /** GET /customer/points-exchange?node_id= (node déduit côté serveur si absent). */
  async getCatalog(nodeId?: string | null): Promise<ExchangeCatalog> {
    const res = await api.get('/customer/points-exchange', { params: nodeId ? { node_id: nodeId } : undefined });
    return res.data.data;
  },
};

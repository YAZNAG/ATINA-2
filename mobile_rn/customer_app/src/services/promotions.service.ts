import api from '../api/client';

//Flash Sales
export interface PromotionProduct {
  id:           number;
  sku_id:       string | null;
  name_fr:      string | null;
  name_ar:      string | null;
  image_url:    string | null;
  old_price:    number;
  new_price:    number;
  discount_pct: number;
  saved_amount: number;
  weight_g:     number | null;
}

export interface FlashSaleDetail {
  id:                string;
  name_fr:           string | null;
  name_ar:           string | null;
  image_url:         string | null;
  scope_type:        'sku' | 'category' | 'brand' | 'pack' | 'unknown';
  scope_name:        string | null;
  discount_type:     string;
  discount_value:    number | null;
  discount_pct:      number | null;
  ends_at:           string;
  is_active:         boolean;
  eligible_products: PromotionProduct[];
  eligible_count:    number;
}

export interface FlashSaleSummary {
  id:             string;
  name_fr:        string | null;
  image_url:      string | null;
  scope_type:     'sku' | 'category' | 'brand' | 'pack' | 'unknown';
  scope_name:     string | null;
  discount_type:  string;
  discount_value: number | null;
  discount_pct:   number | null;
  product_count:  number;
  ends_at:        string;
  is_active:      boolean;
}

export interface BestDeal {
  id:            number;
  sku_id:        string | null;
  sku_code:      string | null;
  name_fr:       string;
  name_ar:       string;
  price:         number;
  price_ttc:     number;
  old_price_ttc: number;
  discount_pct:  number;
  vat_rate:      number;
  image_url:     string | null;
  brand:         { id: number; name_fr: string; name_ar: string } | null;
  category:      { id: number; name_fr: string; name_ar: string } | null;
}

export const PromotionsService = {
  async listActive(): Promise<FlashSaleSummary[]> {
    const res = await api.get('/customer/promotions');
    return res.data.data ?? [];
  },

  async getById(id: string): Promise<FlashSaleDetail> {
    const res = await api.get(`/customer/promotions/${id}`);
    return res.data.data;
  },

  async listBestDeals(limit = 10): Promise<BestDeal[]> {
    const res = await api.get('/customer/promotions/best-deals', { params: { limit } });
    return res.data.data ?? [];
  },
};

export function bestDealToArticle(d: BestDeal) {
  return {
    id:             d.id,
    sku_code:       d.sku_code ?? '',
    sku_id:         d.sku_id,
    ean13:          null,
    name_fr:        d.name_fr,
    name_ar:        d.name_ar,
    description_fr: null,
    description_ar: null,
    price:          d.price,
    price_ttc:      d.price_ttc,
    vat_rate:       d.vat_rate,
    unit_sale:      '',
    is_active:      true,
    image_url:      d.image_url,
    updated_at:     new Date().toISOString(),
    images:         [],
    brand:          d.brand,
    category:       d.category,
    sub_category:   null,
  };
}

// Packs

export interface PackItem {
  sku_id:     string;
  name_fr:    string;
  name_ar:    string;
  qty:        number;
  unit_price: number;
  image_url:  string | null;
}

export interface PackSummary {
  id:             string;
  name_fr:        string;
  name_ar:        string;
  image_url:      string | null;
  original_price: number;
  total_price:    number;
  discount_pct:   number;
  saved_amount:   number;
  valid_to:       string | null;
  is_active:      boolean;
  item_count:     number;
}

export interface PackDetail extends PackSummary {
  description_fr: string | null;
  description_ar: string | null;
  items:          PackItem[];
}

export const PacksService = {
  async listActive(): Promise<PackSummary[]> {
    const res = await api.get('/customer/pack');
    return res.data.data ?? [];
  },

  async getById(id: string): Promise<PackDetail> {
    const res = await api.get(`/customer/pack/${id}`);
    return res.data.data;
  },
};


export interface SlideItem {
  id:           string;
  type:         'flash' | 'pack';
  title:        string;
  subtitle:     string;
  discount_pct: number | null;
  valid_to:     string | null;
  image_url:    string | null;
}

export function buildSlides(
  flashes: FlashSaleSummary[],
  packs:   PackSummary[],
): SlideItem[] {
  const flashSlides: SlideItem[] = flashes
    .filter(p => p.scope_type === 'category' || p.scope_type === 'brand')
    .map(p => ({
      id:           p.id,
      type:         'flash' as const,
      title:        p.name_fr ?? p.scope_name ?? 'Flash Vente',
      subtitle:     p.scope_type === 'category' ? `Catégorie · ${p.scope_name}` :
                    `Marque · ${p.scope_name}`,
      discount_pct: p.discount_pct,
      valid_to:     p.ends_at,
      image_url:    p.image_url,
    }));

  const packSlides: SlideItem[] = packs.map(p => ({
    id:           p.id,
    type:         'pack' as const,
    title:        p.name_fr,
    subtitle:     `${p.item_count} article${p.item_count !== 1 ? 's' : ''} · Pack`,
    discount_pct: p.discount_pct > 0 ? p.discount_pct : null,
    valid_to:     p.valid_to,
    image_url:    p.image_url,
  }));

  return [...flashSlides, ...packSlides];
}

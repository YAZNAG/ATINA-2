import api from '../api/client';

export interface City {
  id:          string;
  name_fr:     string;
  name_ar:     string;
  postal_code: string | null;
  code:        string;
}

export interface Category {
  id: number;
  name_fr: string;
  name_ar: string;
  code: string;
  image_path: string;
  icon_path: string;
  sort_order: number;
  article_count: number;
}

export interface SubCategory {
  id:            number;
  name_fr:       string;
  name_ar:       string;
  code:          string;
  image_path:    string | null;
  icon_path:     string | null;
  sort_order:    number;
  article_count: number;
}

export interface Article {
  id:             number;
  sku_code:       string;
  sku_id: string | null;
  ean13:          string | null;
  name_fr:        string;
  name_ar:        string;
  description_fr: string | null;
  description_ar: string | null;
  price:          number;
  price_ttc:      number;
  old_price_ttc?: number | null;
  discount_pct?:  number | null;
  vat_rate:       number;
  unit_sale:      string;
  is_active:      boolean;
  image_url:      string | null;
  updated_at:     string;
  images:         string[];
  brand:          { id: number; name_fr: string; name_ar: string } | null;
  category:       { id: number; name_fr: string; name_ar: string } | null;
  sub_category:   { id: number; name_fr: string; name_ar: string } | null;
}

export interface ArticlesResponse{
  data:       Article[];
  pagination: Pagination;
}

export interface RecommendationsResponse {
  data: Article[];
}

export interface Pagination{
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface PaginatedArticles {
  data: Article[];
  hasMore: boolean;
}

export const CatalogService = {
  
  //categories,subCategories
  async getCategories(): Promise<Category[]>{
    try{
      const response = await api.get('/customer/catalog/categories');

      return response.data.data || [];
    }
    catch(err:any){
      throw new Error(err.response?.data?.message || 'Erreur chargement categories');
    }
  },

  async getSubCategories(categoryId: number): Promise<SubCategory[]> {
  try {
    const response = await api.get(`/customer/catalog/categories/${categoryId}/sub-categories`);
    return response.data.data || [];
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur sous-catégories');
  }
},

  //articles
  async getArticles(params?: {
    limit?: number;
    page?: number;
    category_id?: number;
  }): Promise<Article[]>{
    try{
    const response = await api.get('/customer/catalog/articles', { params });
    return response.data.data || [];
    }
    catch(err:any){
      throw new Error(err.response?.data?.message || 'Erreur chargement articles');
    }
  },

  async getRecommendedArticles(params?: { limit?: number }): Promise<Article[]> {
    try {
      const response = await api.get('/customer/catalog/recommendations', { params });
      return response.data.data || [];
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement recommandations');
    }
  },

  async getArticlesByCategory(
    categoryId: number,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<ArticlesResponse>{
    try {
      const response = await api.get(`/customer/catalog/categories/${categoryId}/articles`, { params });
      return {
        data:       response.data.data || [],
        pagination: response.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 },
      };
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement articles');
    }
  },

  async searchArticles(params?: {
  page?:         number,
  limit?:        number,
  search?:       string,
  category_id?:  number,
  category_ids?: number[], 
}): Promise<ArticlesResponse>{
  try {
    const { category_ids, ...rest } = params ?? {};
    const response = await api.get('/customer/catalog/articles', {
      params: {
        ...rest,
        category_ids: category_ids?.length ? category_ids.join(',') : undefined,
      },
    });
    return {
      data:       response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 },
    };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur chargement articles');
  }
},

  async getArticleDetail(id: number): Promise<Article> {
    try {
      const response = await api.get(`/customer/catalog/articles/${id}`);
      return response.data.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Article introuvable');
    }
  },

  async getPopularArticles(params?: { limit?: number; page?: number; days?: number }): Promise<PaginatedArticles> {
  try {
    const response = await api.get('/customer/catalog/popular', { params });
    return response.data.data || { data: [], hasMore: false };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur chargement produits populaires');
  }
},

async getCartComplements(skuIds: string[], limit = 10, page = 1): Promise<PaginatedArticles> {
  if (skuIds.length === 0) return { data: [], hasMore: false };
  try {
    const response = await api.get('/customer/catalog/cart-complements', {
      params: { sku_ids: skuIds.join(','), limit, page },
    });
    return response.data.data || { data: [], hasMore: false };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur chargement compléments');
  }
},

async getTopRatedArticles(params?: { limit?: number; page?: number }): Promise<PaginatedArticles> {
  try {
    const response = await api.get('/customer/catalog/top-rated', { params });
    return response.data.data || { data: [], hasMore: false };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || 'Erreur chargement produits notés 5 étoiles');
  }
},

  //cities
    async getCities(): Promise<City[]> {
    try {
      const response = await api.get('/customer/catalog/cities');
      return response.data.data || [];
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Erreur chargement villes');
    }
  },

};
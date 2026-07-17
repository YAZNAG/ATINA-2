import api from '../api/client';

export interface ReviewCustomer {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Review {
  id: string;
  article_id: number;
  customer_id: string;
  customer: ReviewCustomer | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  helpful_count: number;
  voted_by_me: boolean;
}

export interface ReviewStats {
  average_rating: number | null;
  review_count: number;
  distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export interface ReviewsMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ListReviewsResponse {
  data: Review[];
  meta: ReviewsMeta;
  stats: ReviewStats;
}

export interface ListReviewsParams {
  page?: number;
  limit?: number;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  comment?: string;
}


async function listByArticle(
  articleId: number,
  params?: ListReviewsParams
): Promise<ListReviewsResponse> {
  try {
    const { data } = await api.get(`/customer/reviews/articles/${articleId}`, { params });
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors du chargement des avis',
    };
  }
}


async function getMyReview(articleId: number): Promise<Review | null> {
  try {
    const { data } = await api.get(`/customer/reviews/articles/${articleId}/me`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? 'Erreur lors du chargement de votre avis',
    };
  }
}

async function create(articleId: number, payload: CreateReviewPayload): Promise<Review> {
  try {
    const { data } = await api.post(`/customer/reviews/articles/${articleId}`, payload);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de l'envoi de votre avis",
    };
  }
}


async function update(reviewId: string, payload: UpdateReviewPayload): Promise<Review> {
  try {
    const { data } = await api.put(`/customer/reviews/${reviewId}`, payload);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de la mise à jour de l'avis",
    };
  }
}

async function remove(reviewId: string): Promise<{ id: string }> {
  try {
    const { data } = await api.delete(`/customer/reviews/${reviewId}`);
    return data.data;
  } catch (error: any) {
    throw {
      statusCode: error.response?.status ?? 500,
      message: error.response?.data?.message ?? "Erreur lors de la suppression de l'avis",
    };
  }
}

async function toggleHelpful(reviewId: string): Promise<Review> {
  try {
    const { data } = await api.post(`/customer/reviews/${reviewId}/helpful`);
    return data.data;
  } catch (error: any) {
    throw { statusCode: error.response?.status ?? 500, message: error.response?.data?.message ?? 'Erreur lors du vote' };
  }
}

export const ReviewsService = {
  listByArticle,
  getMyReview,
  create,
  update,
  remove,
  toggleHelpful,
};

export default ReviewsService;
import api from '../api/client';

export interface FaqItem {
  id:          string;
  question_fr: string;
  answer_fr:   string;
}

export interface FaqCategory {
  id:      string;
  name_fr: string;
  icon:    string | null;
  items:   FaqItem[];
}

export const FaqService = {
  async getAll(): Promise<FaqCategory[]> {
    const res = await api.get('/customer/faq');
    return res.data.data ?? [];
  },
};
import api from './axios';

/** Préfixe API catalogue : /api/catalog */
const c = '/catalog';

// ——— Listes référentielles (paramétrage article) ———

export const getFamiliesList = () => api.get(`${c}/families`, { params: { all: true } });

export const getCategoriesList = (familyId) =>
  api.get(`${c}/categories`, {
    params: { all: true, ...(familyId != null && familyId !== '' ? { family_id: familyId } : {}) },
  });

export const getSubCategoriesList = (categoryId) =>
  api.get(`${c}/sub-categories`, {
    params: { all: true, ...(categoryId != null && categoryId !== '' ? { category_id: categoryId } : {}) },
  });

export const getBrandsList = () => api.get(`${c}/brands`, { params: { all: true } });
export const getUnitsList = () => api.get(`${c}/units`, { params: { all: true } });
export const getPackagingTypesList = () => api.get(`${c}/packaging-types`, { params: { all: true } });
export const getArticleTypesList = () => api.get(`${c}/article-types`, { params: { all: true } });
export const getArticleStatusesList = () => api.get(`${c}/article-statuses`, { params: { all: true } });
export const getConservationTypesList = () => api.get(`${c}/conservation-types`, { params: { all: true } });
export const getTaxesList = () => api.get(`${c}/taxes`, { params: { all: true } });

// ——— CRUD paginé référentiels ———

export const getFamilies = (params) => api.get(`${c}/families`, { params });
export const getFamily = (id) => api.get(`${c}/families/${id}`);
export const createFamily = (data) => api.post(`${c}/families`, data);
export const updateFamily = (id, data) => api.put(`${c}/families/${id}`, data);
export const deleteFamily = (id) => api.delete(`${c}/families/${id}`);

export const getCategories = (params) => api.get(`${c}/categories`, { params });
export const getCategory = (id) => api.get(`${c}/categories/${id}`);
export const createCategory = (data) => api.post(`${c}/categories`, data);
export const updateCategory = (id, data) => api.put(`${c}/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`${c}/categories/${id}`);

export const getSubCategories = (params) => api.get(`${c}/sub-categories`, { params });
export const getSubCategory = (id) => api.get(`${c}/sub-categories/${id}`);
export const createSubCategory = (data) => api.post(`${c}/sub-categories`, data);
export const updateSubCategory = (id, data) => api.put(`${c}/sub-categories/${id}`, data);
export const deleteSubCategory = (id) => api.delete(`${c}/sub-categories/${id}`);

export const getBrands = (params) => api.get(`${c}/brands`, { params });
export const getBrand = (id) => api.get(`${c}/brands/${id}`);
export const createBrand = (data) => api.post(`${c}/brands`, data);
export const updateBrand = (id, data) => api.put(`${c}/brands/${id}`, data);
export const deleteBrand = (id) => api.delete(`${c}/brands/${id}`);

export const getUnits = (params) => api.get(`${c}/units`, { params });
export const getUnit = (id) => api.get(`${c}/units/${id}`);
export const createUnit = (data) => api.post(`${c}/units`, data);
export const updateUnit = (id, data) => api.put(`${c}/units/${id}`, data);
export const deleteUnit = (id) => api.delete(`${c}/units/${id}`);

export const getPackagingTypes = (params) => api.get(`${c}/packaging-types`, { params });
export const getPackagingType = (id) => api.get(`${c}/packaging-types/${id}`);
export const createPackagingType = (data) => api.post(`${c}/packaging-types`, data);
export const updatePackagingType = (id, data) => api.put(`${c}/packaging-types/${id}`, data);
export const deletePackagingType = (id) => api.delete(`${c}/packaging-types/${id}`);

export const getConservationTypes = (params) => api.get(`${c}/conservation-types`, { params });
export const getConservationType = (id) => api.get(`${c}/conservation-types/${id}`);
export const createConservationType = (data) => api.post(`${c}/conservation-types`, data);
export const updateConservationType = (id, data) => api.put(`${c}/conservation-types/${id}`, data);
export const deleteConservationType = (id) => api.delete(`${c}/conservation-types/${id}`);

export const getArticleTypes = (params) => api.get(`${c}/article-types`, { params });
export const getArticleType = (id) => api.get(`${c}/article-types/${id}`);
export const createArticleType = (data) => api.post(`${c}/article-types`, data);
export const updateArticleType = (id, data) => api.put(`${c}/article-types/${id}`, data);
export const deleteArticleType = (id) => api.delete(`${c}/article-types/${id}`);

export const getArticleStatuses = (params) => api.get(`${c}/article-statuses`, { params });
export const getArticleStatus = (id) => api.get(`${c}/article-statuses/${id}`);
export const createArticleStatus = (data) => api.post(`${c}/article-statuses`, data);
export const updateArticleStatus = (id, data) => api.put(`${c}/article-statuses/${id}`, data);
export const deleteArticleStatus = (id) => api.delete(`${c}/article-statuses/${id}`);

export const getTaxes = (params) => api.get(`${c}/taxes`, { params });
export const getTax = (id) => api.get(`${c}/taxes/${id}`);
export const createTax = (data) => api.post(`${c}/taxes`, data);
export const updateTax = (id, data) => api.put(`${c}/taxes/${id}`, data);
export const deleteTax = (id) => api.delete(`${c}/taxes/${id}`);

// ——— Articles ———

export const getArticles = (params) => api.get(`${c}/articles`, { params });
export const getArticle = (id) => api.get(`${c}/articles/${id}`);
export const createArticle = (data) => api.post(`${c}/articles`, data);
export const updateArticle = (id, data) => api.put(`${c}/articles/${id}`, data);
export const deleteArticle = (id) => api.delete(`${c}/articles/${id}`);

// ——— Images article ———

export const getArticleImages = (articleId) => api.get(`${c}/articles/${articleId}/images`);

export const addArticleImages = (articleId, formData) =>
  api.post(`${c}/articles/${articleId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const setArticleMainImage = (articleId, imageId) =>
  api.patch(`${c}/articles/${articleId}/images/${imageId}/main`);

export const setArticleImageSort = (articleId, imageId, sort_order) =>
  api.patch(`${c}/articles/${articleId}/images/${imageId}/sort`, { sort_order });

export const deleteArticleImage = (articleId, imageId) =>
  api.delete(`${c}/articles/${articleId}/images/${imageId}`);

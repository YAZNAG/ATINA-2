import api from './axios';

/** Préfixe API catalogue : /api/catalog */
const c = '/catalog';

/** FormData : laisser le navigateur définir Content-Type (boundary multipart). */
const multipartOrJsonConfig = (data) =>
  data instanceof FormData
    ? { transformRequest: [(body, headers) => { delete headers['Content-Type']; return body; }] }
    : {};

// ——— Listes référentielles (paramétrage SKU) ———

export const getFamiliesList = () => api.get(`${c}/families`, { params: { all: true } });

export const getSubFamiliesList = (familyId) =>
  api.get(`${c}/subfamilies`, {
    params: { all: true, ...(familyId != null && familyId !== '' ? { family_id: familyId } : {}) },
  });

// Categories = axe indépendant, plat (pas de filtre family_id)
export const getCategoriesList = () => api.get(`${c}/categories`, { params: { all: true } });

export const getBrandsList = () => api.get(`${c}/brands`, { params: { all: true } });
export const getUnitsList = () => api.get(`${c}/units`, { params: { all: true } });
export const getPackagingTypesList = (unitId) =>
  api.get(`${c}/packaging-types`, {
    params: { all: true, ...(unitId != null && unitId !== '' ? { unit_id: unitId } : {}) },
  });
export const restorePackagingType = (id) => api.patch(`${c}/packaging-types/${id}/restore`);
export const getConservationTypesList = () => api.get(`${c}/conservation-types`, { params: { all: true } });
export const getTaxesList = () => api.get(`${c}/taxes`, { params: { all: true } });

// ——— CRUD paginé référentiels ———

export const getFamilies = (params) => api.get(`${c}/families`, { params });
export const getFamily = (id) => api.get(`${c}/families/${id}`);
export const createFamily = (data) => api.post(`${c}/families`, data, multipartOrJsonConfig(data));
export const updateFamily = (id, data) => api.put(`${c}/families/${id}`, data, multipartOrJsonConfig(data));
export const deleteFamily = (id) => api.delete(`${c}/families/${id}`);
export const restoreFamily = (id) => api.patch(`${c}/families/${id}/restore`);
export const toggleFamilyStatus = (id) => api.patch(`${c}/families/${id}/toggle-status`);
export const reorderFamilies = (items) => api.patch(`${c}/families/reorder`, { items });

export const getSubFamilies = (params) => api.get(`${c}/subfamilies`, { params });
export const getSubFamily = (id) => api.get(`${c}/subfamilies/${id}`);
export const createSubFamily = (data) => api.post(`${c}/subfamilies`, data);
export const updateSubFamily = (id, data) => api.put(`${c}/subfamilies/${id}`, data);
export const deleteSubFamily = (id) => api.delete(`${c}/subfamilies/${id}`);
export const restoreSubFamily = (id) => api.patch(`${c}/subfamilies/${id}/restore`);
export const toggleSubFamilyStatus = (id) => api.patch(`${c}/subfamilies/${id}/toggle-status`);
export const reorderSubFamilies = (items) => api.patch(`${c}/subfamilies/reorder`, { items });

export const getCategories = (params) => api.get(`${c}/categories`, { params });
export const getCategory = (id) => api.get(`${c}/categories/${id}`);
export const createCategory = (data) => api.post(`${c}/categories`, data, multipartOrJsonConfig(data));
export const updateCategory = (id, data) => api.put(`${c}/categories/${id}`, data, multipartOrJsonConfig(data));
export const deleteCategory = (id) => api.delete(`${c}/categories/${id}`);
export const toggleCategoryStatus = (id) => api.patch(`${c}/categories/${id}/toggle-status`);
export const restoreCategory = (id) => api.patch(`${c}/categories/${id}/restore`);
export const reorderCategories = (items) => api.patch(`${c}/categories/reorder`, { items });

export const getBrands = (params) => api.get(`${c}/brands`, { params });
export const getBrand = (id) => api.get(`${c}/brands/${id}`);
export const createBrand = (data) => api.post(`${c}/brands`, data, multipartOrJsonConfig(data));
export const updateBrand = (id, data) => api.put(`${c}/brands/${id}`, data, multipartOrJsonConfig(data));
export const deleteBrand = (id) => api.delete(`${c}/brands/${id}`);

export const getUnits = (params) => api.get(`${c}/units`, { params });
export const getUnit = (id) => api.get(`${c}/units/${id}`);
export const createUnit = (data) => api.post(`${c}/units`, data);
export const updateUnit = (id, data) => api.put(`${c}/units/${id}`, data);
export const deleteUnit = (id) => api.delete(`${c}/units/${id}`);
export const toggleUnitStatus = (id) => api.patch(`${c}/units/${id}/toggle-status`);
export const restoreUnit = (id) => api.patch(`${c}/units/${id}/restore`);
export const reorderUnits = (items) => api.patch(`${c}/units/reorder`, { items });

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

export const getTaxes = (params) => api.get(`${c}/taxes`, { params });
export const getTax = (id) => api.get(`${c}/taxes/${id}`);
export const createTax = (data) => api.post(`${c}/taxes`, data);
export const updateTax = (id, data) => api.put(`${c}/taxes/${id}`, data);
export const deleteTax = (id) => api.delete(`${c}/taxes/${id}`);

// ——— SKU (catalogue unifié) ———

export const getSkus = (params) => api.get(`${c}/skus`, { params });
export const getSkusList = () => api.get(`${c}/skus`, { params: { all: true } });
export const getSku = (id) => api.get(`${c}/skus/${id}`);
export const createSku = (data) => api.post(`${c}/skus`, data);
export const updateSku = (id, data) => api.put(`${c}/skus/${id}`, data);
export const deleteSku = (id) => api.delete(`${c}/skus/${id}`);
export const toggleSkuStatus = (id) => api.patch(`${c}/skus/${id}/toggle-status`);
export const restoreSku = (id) => api.patch(`${c}/skus/${id}/restore`);

// ——— Images SKU (nichées sous /skus/:skuId/images) ———

export const getSkuImages = (skuId) => api.get(`${c}/skus/${skuId}/images`);

export const addSkuImages = (skuId, formData) =>
  api.post(`${c}/skus/${skuId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const setSkuPrimaryImage = (skuId, imageId) =>
  api.patch(`${c}/skus/${skuId}/images/${imageId}/main`);

export const setSkuImageSort = (skuId, imageId, sort_order) =>
  api.patch(`${c}/skus/${skuId}/images/${imageId}/sort`, { sort_order });

export const deleteSkuImage = (skuId, imageId) =>
  api.delete(`${c}/skus/${skuId}/images/${imageId}`);

// ——— Legacy /articles/:articleId/sku-images (module distinct, conservé) ———

export const getArticleSkuImages = (articleId) => api.get(`${c}/articles/${articleId}/sku-images`);

export const addArticleSkuImages = (articleId, formData) =>
  api.post(`${c}/articles/${articleId}/sku-images`, formData, multipartOrJsonConfig(formData));

export const setArticleSkuPrimaryImage = (articleId, imageId) =>
  api.patch(`${c}/articles/${articleId}/sku-images/${imageId}/primary`);

export const setArticleSkuImageSort = (articleId, imageId, sort_order) =>
  api.patch(`${c}/articles/${articleId}/sku-images/${imageId}/sort`, { sort_order });

export const deleteArticleSkuImage = (articleId, imageId) =>
  api.delete(`${c}/articles/${articleId}/sku-images/${imageId}`);
import api from '../../../shared/services/api';

// === Products ===
export const getProducts = (params?: Record<string, string>) =>
  api.get('/knowledge-base/products', { params });
export const getProduct = (id: string) =>
  api.get(`/knowledge-base/products/${id}`);
export const createProduct = (data: any) =>
  api.post('/knowledge-base/products', data);
export const updateProduct = (id: string, data: any) =>
  api.put(`/knowledge-base/products/${id}`, data);
export const deleteProduct = (id: string) =>
  api.delete(`/knowledge-base/products/${id}`);
export const searchProducts = (q: string) =>
  api.get('/knowledge-base/products/search', { params: { q } });

// === Import ===
export const downloadImportTemplate = () =>
  api.get('/knowledge-base/products/import/template', { responseType: 'blob' });
export const importProductFromJson = (formData: FormData) =>
  api.post('/knowledge-base/products/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// === Media ===
export const getMedia = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/media`);
export const uploadMedia = (productId: string, formData: FormData) =>
  api.post(`/knowledge-base/products/${productId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const syncDrive = (productId: string, driveFolderUrl: string) =>
  api.post(`/knowledge-base/products/${productId}/media/sync-drive`, { driveFolderUrl });
export const reorderMedia = (productId: string, items: { id: string; order: number }[]) =>
  api.put(`/knowledge-base/products/${productId}/media/reorder`, { items });
export const deleteMedia = (productId: string, mediaId: string) =>
  api.delete(`/knowledge-base/products/${productId}/media/${mediaId}`);

// === Suppliers ===
export const getSuppliers = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/suppliers`);
export const createSupplier = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/suppliers`, data);
export const updateSupplier = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/suppliers/${id}`, data);
export const deleteSupplier = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/suppliers/${id}`);

// === Manufacturing ===
export const getManufacturing = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/manufacturing`);
export const updateManufacturing = (productId: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/manufacturing`, data);

// === Pricing ===
export const getPricing = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/pricing`);
export const createPricing = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/pricing`, data);
export const updatePricing = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/pricing/${id}`, data);
export const deletePricing = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/pricing/${id}`);

// === Variations ===
export const getVariations = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/variations`);
export const createVariation = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/variations`, data);
export const updateVariation = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/variations/${id}`, data);
export const deleteVariation = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/variations/${id}`);

// === Marketing ===
export const getMarketing = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/marketing`);
export const updateMarketing = (productId: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/marketing`, data);

// === FAQs ===
export const getFaqs = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/faqs`);
export const createFaq = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/faqs`, data);
export const updateFaq = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/faqs/${id}`, data);
export const deleteFaq = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/faqs/${id}`);

// === Objections ===
export const getObjections = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/objections`);
export const createObjection = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/objections`, data);
export const updateObjection = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/objections/${id}`, data);
export const deleteObjection = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/objections/${id}`);

// === Upsells ===
export const getUpsells = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/upsells`);
export const createUpsell = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/upsells`, data);
export const deleteUpsell = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/upsells/${id}`);

// === After Sales ===
export const getAfterSales = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/after-sales`);
export const updateAfterSales = (productId: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/after-sales`, data);

// === Sales Scripts ===
export const getSalesScripts = (productId: string) =>
  api.get(`/knowledge-base/products/${productId}/sales-scripts`);
export const createSalesScript = (productId: string, data: any) =>
  api.post(`/knowledge-base/products/${productId}/sales-scripts`, data);
export const updateSalesScript = (productId: string, id: string, data: any) =>
  api.put(`/knowledge-base/products/${productId}/sales-scripts/${id}`, data);
export const deleteSalesScript = (productId: string, id: string) =>
  api.delete(`/knowledge-base/products/${productId}/sales-scripts/${id}`);

// WooCommerce Import
export const getWooProducts = () => api.get('/knowledge-base/products/woo-products');
export const importWooProduct = (wooProductId: number) =>
  api.post(`/knowledge-base/products/import-woo/${wooProductId}`);

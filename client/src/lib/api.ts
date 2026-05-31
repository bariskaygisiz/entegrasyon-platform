import type { Product, ShopifySettings, ShopifyMapping, Order, SyncJob, Category } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Products ──────────────────────────────────────────────────────────────────
export const api = {
  products: {
    list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status)  q.set('status', params.status);
      if (params?.search)  q.set('search', params.search);
      if (params?.limit)   q.set('limit', String(params.limit));
      if (params?.offset)  q.set('offset', String(params.offset));
      return request<{ products: Product[]; total: number }>(`/products?${q}`);
    },
    get:    (id: string) => request<Product>(`/products/${id}`),
    create: (data: Partial<Product>) => request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Product>) => request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    patch:  (id: string, data: Partial<Product>) => request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),
    importCsv: (csv: string) => request<{ created: number; updated: number; total: number; errors: { row: number; message: string }[] }>(
      '/products/import-csv', { method: 'POST', body: JSON.stringify({ csv }) }
    ),
  },

  orders: {
    list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status)  q.set('status', params.status);
      if (params?.search)  q.set('search', params.search);
      if (params?.limit)   q.set('limit', String(params.limit));
      if (params?.offset)  q.set('offset', String(params.offset));
      return request<{ orders: Order[]; total: number }>(`/orders?${q}`);
    },
    get:   (id: number) => request<Order>(`/orders/${id}`),
    patch: (id: number, data: Partial<Order>) => request<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  shopify: {
    getSettings:   () => request<ShopifySettings | null>('/shopify/settings'),
    saveSettings:  (data: Partial<ShopifySettings>) => request<ShopifySettings>('/shopify/settings', { method: 'PUT', body: JSON.stringify(data) }),
    deleteSettings:() => request<{ ok: boolean }>('/shopify/settings', { method: 'DELETE' }),

    getMappings:   () => request<Record<string, ShopifyMapping>>('/shopify/mappings'),
    getMapping:    (productId: string) => request<ShopifyMapping | null>(`/shopify/mappings/${productId}`),
    saveMapping:   (productId: string, data: Omit<ShopifyMapping, 'product_id'>) =>
      request<ShopifyMapping>(`/shopify/mappings/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMapping: (productId: string) => request<{ ok: boolean }>(`/shopify/mappings/${productId}`, { method: 'DELETE' }),

    listProducts:  (domain: string, token: string, limit = 250) =>
      request<{ products: ShopifyApiProduct[] }>(`/shopify/products?limit=${limit}`, {
        headers: { 'X-Shop-Domain': domain, 'X-Shop-Token': token },
      }),
    createProduct: (domain: string, token: string, product: object) =>
      request<{ product: ShopifyApiProduct }>('/shopify/products', {
        method: 'POST',
        headers: { 'X-Shop-Domain': domain, 'X-Shop-Token': token },
        body: JSON.stringify({ product }),
      }),

    // Sync
    syncProduct:  (productId: string, changes: string[] = []) =>
      request<{ ok: boolean; jobId: number; message: string; detail: string }>(
        `/shopify/sync/${productId}`,
        { method: 'POST', body: JSON.stringify({ changes }) }
      ),

    // Jobs
    getJobs:  () => request<SyncJob[]>('/shopify/jobs'),
    retryJob: (jobId: number) =>
      request<{ ok: boolean; message: string }>(`/shopify/jobs/${jobId}/retry`, { method: 'POST' }),

    // Sync config (toggle'lar)
    getSyncConfig: () => request<Record<string, boolean>>('/shopify/sync-config'),
    saveSyncConfig: (config: Record<string, boolean>) =>
      request<{ ok: boolean }>('/shopify/sync-config', { method: 'PUT', body: JSON.stringify(config) }),

    // Fiyat tipi (retail / wholesale)
    savePriceType: (price_type: 'retail' | 'wholesale') =>
      request<{ ok: boolean; price_type: string }>('/shopify/price-type', {
        method: 'PUT', body: JSON.stringify({ price_type }),
      }),

    // İçeri aktar
    importProducts: () =>
      request<{ imported: number; skipped: number; total: number; errors: string[] }>(
        '/shopify/import', { method: 'POST' }
      ),

    // Sipariş senkronizasyonu
    syncOrders: () =>
      request<{ synced: number; updated: number; total: number }>(
        '/shopify/sync-orders', { method: 'POST' }
      ),
  },

  categories: {
    list:   ()                           => request<Category[]>('/categories'),
    names:  ()                           => request<string[]>('/categories/names'),
    get:    (id: string)                 => request<Category>(`/categories/${id}`),
    create: (data: Partial<Category>)    => request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Category>) =>
      request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string)                 => request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
  },
};

export interface ShopifyApiProduct {
  id: number;
  title: string;
  handle: string;
  variants: ShopifyApiVariant[];
}

export interface ShopifyApiVariant {
  id: number;
  title: string;
  sku: string;
  price: string;
}

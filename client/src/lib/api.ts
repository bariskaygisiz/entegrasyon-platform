import type { Product, ShopifySettings, ShopifyMapping, Order } from '../types';

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
    delete: (id: string) => request<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),
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
    get: (id: number) => request<Order>(`/orders/${id}`),
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

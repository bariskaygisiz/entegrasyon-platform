export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discounted_price: number | null;
  b2b_price: number | null;
  b2b_discounted_price: number | null;
  cost: number;
  sku: string;
  barcode: string;
  stock: number;
  weight: number;
  status: 'active' | 'draft' | 'archived';
  category: string[];
  channels: string[];
  tags: string[];
  media: MediaItem[];
  has_variants: boolean;
  variant_options: VariantOption[];
  variant_data: Record<string, VariantDataEntry>;
  emoji: string;
  vat_rate: number;       // 0 | 1 | 8 | 10 | 18 | 20
  vat_included: boolean;  // true = fiyata dahil, false = fiyata hariç
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: number;
  src: string | null;
  emoji?: string;
  opacity?: number;
  selected?: boolean;
}

export interface VariantOption {
  id: number;
  name: string;
  values: string[];
}

export interface VariantDataEntry {
  price?: string;
  disc?: string;
  b2b_price?: string;
  b2b_disc?: string;
  stock?: string;
  sku?: string;
  barcode?: string;
  weight?: string;
  img?: string;
}

export interface ShopifySettings {
  id: 1;
  shop_domain: string;
  access_token: string;
  connected: boolean;
  plan: string;
  shop_name: string;
  currency: string;
  price_type: 'retail' | 'wholesale';  // 'retail' = Perakende, 'wholesale' = Toptan
  created_at: string;
  updated_at: string;
}

export interface ShopifyMapping {
  product_id: string;
  shopify_id: string;
  shopify_title: string;
  handle: string;
  sku: string;
  price: number;
  mapped_at: string;
  type: 'mapped' | 'created' | 'imported';
  is_variant: boolean;
  variant_mappings: Record<string, ShopifyVariantMapping>;
}

export interface ShopifyVariantMapping {
  shopifyVariantId: string;
  shopifyVariantTitle: string;
  shopifySku: string;
  shopifyPrice: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: number;
  product_id: string;
  product_name: string;
  channel: string;
  action: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  message: string;
  detail: string;
  created_at: string;
  updated_at: string;
}

// DB rows have JSON strings; these are the raw DB types
export interface ProductRow extends Omit<Product, 'category' | 'channels' | 'tags' | 'media' | 'has_variants' | 'variant_options' | 'variant_data' | 'vat_included'> {
  category: string;   // plain text or JSON array string
  channels: string;
  tags: string;
  media: string;
  has_variants: number;
  variant_options: string;
  variant_data: string;
  vat_included: number;
}

export interface ShopifySettingsRow extends Omit<ShopifySettings, 'connected'> {
  connected: number;
}

export interface ShopifyMappingRow extends Omit<ShopifyMapping, 'is_variant' | 'variant_mappings'> {
  is_variant: number;
  variant_mappings: string;
}

// Helpers to convert DB rows to typed objects
export function rowToProduct(row: ProductRow): Product {
  // category: eski veriler düz string, yeni veriler JSON dizisi — her ikisini destekle
  const parseCategory = (raw: string): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return [raw]; // eski tek-string veriyi diziye çevir
    }
  };
  return {
    ...row,
    category: parseCategory(row.category),
    channels: JSON.parse(row.channels || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    media: JSON.parse(row.media || '[]'),
    has_variants: row.has_variants === 1,
    variant_options: JSON.parse(row.variant_options || '[]'),
    variant_data: JSON.parse(row.variant_data || '{}'),
    vat_rate: row.vat_rate ?? 20,
    vat_included: row.vat_included !== 0,
  };
}

export function rowToSettings(row: ShopifySettingsRow): ShopifySettings {
  return { ...row, connected: row.connected === 1 };
}

export function rowToMapping(row: ShopifyMappingRow): ShopifyMapping {
  return {
    ...row,
    is_variant: row.is_variant === 1,
    variant_mappings: JSON.parse(row.variant_mappings || '{}'),
  };
}

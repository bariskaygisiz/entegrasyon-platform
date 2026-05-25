export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discounted_price: number | null;
  cost: number;
  sku: string;
  barcode: string;
  stock: number;
  weight: number;
  status: 'active' | 'draft' | 'archived';
  category: string;
  channels: string[];
  tags: string[];
  media: MediaItem[];
  has_variants: boolean;
  variant_options: VariantOption[];
  variant_data: Record<string, VariantDataEntry>;
  emoji: string;
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
  type: 'mapped' | 'created';
  is_variant: boolean;
  variant_mappings: Record<string, ShopifyVariantMapping>;
}

export interface ShopifyVariantMapping {
  shopifyVariantId: string;
  shopifyVariantTitle: string;
  shopifySku: string;
  shopifyPrice: string;
}

export interface Order {
  id: number;
  customer: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  productName: string;
  productSku: string;
  productEmoji: string;
  productPrice: number;
  productCategory: string;
  qty: number;
  channel: string;
  dateStr: string;
  amount: number;
  status: string;
  cargoCode: string | null;
  cargoCompany: string;
  paymentMethod: string;
  note: string | null;
}

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  msg?: string;
  type: ToastType;
}

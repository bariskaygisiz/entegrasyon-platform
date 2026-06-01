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
  vat_rate: number;
  vat_included: boolean;
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

export interface OrderLineItem {
  title: string;
  quantity: number;
  price: string;
  sku: string;
  vendor: string;
}

export interface Order {
  id: number;
  shopifyOrderId?: string | null;
  orderName?: string;
  customer: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
  tcNo: string;
  shippingMethod: string;
  billingName: string;
  billingAddress: string;
  billingDistrict: string;
  billingCity: string;
  billingPostal: string;
  productName: string;
  productSku: string;
  productEmoji: string;
  productImage: string;
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
  lineItems?: OrderLineItem[];
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

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  key: string;           // e-posta (varsa) ya da isim — benzersiz tanımlayıcı
  name: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  invoiceType: 'individual' | 'corporate';
  tcNo: string;
  taxNo: string;
  taxOffice: string;
  notes: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  firstOrderDate: string;
  lastOrderAt: string;
  firstOrderAt: string;
  channels: string[];
}

export interface CustomerWithOrders extends Customer {
  orders: {
    id: number;
    orderName: string;
    channel: string;
    status: string;
    productName: string;
    productEmoji: string;
    productImage: string;
    productCategory: string;
    qty: number;
    amount: number;
    dateStr: string;
    cargoCode: string | null;
    cargoCompany: string;
    paymentMethod: string;
    note: string | null;
  }[];
}

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  msg?: string;
  type: ToastType;
}

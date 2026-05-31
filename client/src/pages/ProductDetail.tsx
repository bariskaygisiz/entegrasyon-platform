import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api, type ShopifyApiProduct } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Product, MediaItem, ShopifyMapping, ShopifySettings, VariantOption, VariantDataEntry } from '../types';

const KDV_RATES = [0, 1, 8, 10, 18, 20];

function KdvSection({ vatRate, vatIncluded, basePrice, onRateChange, onIncludedChange }: {
  vatRate: number; vatIncluded: boolean; basePrice: number;
  onRateChange: (v: number) => void; onIncludedChange: (v: boolean) => void;
}) {
  const kdvTutar = vatRate > 0 && basePrice > 0
    ? vatIncluded
      ? basePrice - basePrice / (1 + vatRate / 100)
      : basePrice * (vatRate / 100)
    : null;
  const kdvDahilFiyat = vatRate > 0 && basePrice > 0 && !vatIncluded
    ? basePrice + basePrice * (vatRate / 100)
    : null;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
          <label className="form-label">KDV Oranı</label>
          <select
            className="form-control"
            value={vatRate}
            onChange={e => onRateChange(parseInt(e.target.value))}
            style={{ maxWidth: 120 }}
          >
            {KDV_RATES.map(r => <option key={r} value={r}>%{r}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Fiyatlara KDV</label>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
            {[true, false].map(val => (
              <button
                key={String(val)}
                type="button"
                onClick={() => onIncludedChange(val)}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: vatIncluded === val ? 'var(--primary)' : 'transparent',
                  color: vatIncluded === val ? '#fff' : 'var(--text-muted)',
                  transition: 'all .15s',
                }}
              >
                {val ? 'KDV Dahil' : 'KDV Hariç'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {basePrice > 0 && vatRate > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {kdvTutar !== null && (
            <span>KDV Tutarı: <strong style={{ color: 'var(--text)' }}>₺{kdvTutar.toFixed(2)}</strong></span>
          )}
          {kdvDahilFiyat !== null && (
            <span>KDV Dahil Fiyat: <strong style={{ color: 'var(--text)' }}>₺{kdvDahilFiyat.toFixed(2)}</strong></span>
          )}
          {vatIncluded && basePrice > 0 && vatRate > 0 && (
            <span>KDV Hariç Fiyat: <strong style={{ color: 'var(--text)' }}>₺{(basePrice / (1 + vatRate / 100)).toFixed(2)}</strong></span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shopify mock products for offline demo ─────────────────────────────────────
const MOCK_SHOPIFY: ShopifyApiProduct[] = [
  { id: 7891001, title: 'iPhone 15 Pro Max 256GB',  handle: 'iphone-15-pro-max-256gb',  variants: [{ id: 78910011, title: 'Siyah Titanium', sku: 'AAPL-IP15PM-256-BLK', price: '72999.00' }, { id: 78910012, title: 'Beyaz Titanium', sku: 'AAPL-IP15PM-256-WHT', price: '72999.00' }] },
  { id: 7891002, title: 'Samsung Galaxy S24 Ultra',  handle: 'samsung-galaxy-s24-ultra', variants: [{ id: 78910021, title: 'Phantom Black', sku: 'SAM-S24U-BLK', price: '65999.00' }, { id: 78910022, title: 'Titanium Gray', sku: 'SAM-S24U-GRY', price: '65999.00' }] },
  { id: 7891003, title: 'MacBook Pro M3 14"',        handle: 'macbook-pro-m3-14',         variants: [{ id: 78910031, title: '16GB / 512GB', sku: 'AAPL-MBP-M3-16', price: '89999.00' }, { id: 78910032, title: '32GB / 1TB', sku: 'AAPL-MBP-M3-32', price: '109999.00' }] },
  { id: 7891004, title: 'AirPods Pro 2. Nesil',     handle: 'airpods-pro-2',             variants: [{ id: 78910041, title: 'Varsayılan', sku: 'AAPL-APP2', price: '9999.00' }] },
  { id: 7891005, title: 'Sony WH-1000XM5',           handle: 'sony-wh-1000xm5',          variants: [{ id: 78910051, title: 'Siyah', sku: 'SONY-WH-BLK', price: '14999.00' }, { id: 78910052, title: 'Gümüş', sku: 'SONY-WH-SLV', price: '14999.00' }] },
];

// ── Variant logic ──────────────────────────────────────────────────────────────
function getCombinations(options: VariantOption[]): string[] {
  const filled = options.filter(o => o.name && o.values.length > 0);
  if (!filled.length) return [];
  let combos: string[][] = [[]];
  for (const opt of filled) {
    combos = combos.flatMap(combo => opt.values.map(v => [...combo, v]));
  }
  return combos.map(c => c.join(' / '));
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'genel' | 'entegrasyon'>('genel');

  // Form state
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [price, setPrice]       = useState('');
  const [discounted, setDisc]   = useState('');
  const [cost, setCost]         = useState('');
  const [sku, setSku]           = useState('');
  const [barcode, setBarcode]   = useState('');
  const [stock, setStock]       = useState('');
  const [weight, setWeight]     = useState('');
  const [status, setStatus]     = useState<'active' | 'draft' | 'archived'>('active');
  const [category, setCategory] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [tags, setTags]         = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [vatRate, setVatRate]         = useState(20);
  const [vatIncluded, setVatIncluded] = useState(true);
  const [b2bPrice, setB2bPrice]             = useState('');
  const [b2bDiscounted, setB2bDiscounted]   = useState('');

  // Media state
  const [media, setMedia] = useState<MediaItem[]>([]);
  const mediaInputRef  = useRef<HTMLInputElement>(null);
  const dragIdxRef     = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  // Variant state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantData, setVariantData] = useState<Record<string, VariantDataEntry>>({});

  // Shopify state
  const [shopifySettings, setShopifySettings] = useState<ShopifySettings | null>(null);
  const [shopifyMapping, setShopifyMapping]   = useState<ShopifyMapping | null>(null);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyApiProduct[] | null>(null);
  const [shopifyCacheFailed, setShopifyCacheFailed] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [variantStepOpen, setVariantStepOpen] = useState(false);
  const [selectedShopifyProduct, setSelectedShopifyProduct] = useState<ShopifyApiProduct | null>(null);
  const [shopifySearch, setShopifySearch] = useState('');
  const [shopifyCreating, setShopifyCreating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const variantStepSelections = useRef<Record<string, string>>({});

  const markDirty = useCallback(() => setDirty(true), []);

  // Tüm form state'ini bir Product nesnesinden resetler (Vazgeç + load)
  const resetToProduct = useCallback((p: Product) => {
    setName(p.name);
    setDesc(p.description);
    setPrice(String(p.price));
    setDisc(p.discounted_price ? String(p.discounted_price) : '');
    setCost(String(p.cost));
    setSku(p.sku);
    setBarcode(p.barcode);
    setStock(String(p.stock));
    setWeight(String(p.weight));
    setStatus(p.status);
    setCategory(p.category);
    setChannels(p.channels);
    setTags(p.tags || []);
    setMedia((p.media || []).map(m => ({ ...m, selected: false })));
    setHasVariants(p.has_variants);
    setVariantOptions(p.variant_options || []);
    setVariantData(p.variant_data || {});
    setVatRate(p.vat_rate ?? 20);
    setVatIncluded(p.vat_included !== false);
    setB2bPrice(p.b2b_price != null ? String(p.b2b_price) : '');
    setB2bDiscounted(p.b2b_discounted_price != null ? String(p.b2b_discounted_price) : '');
    setDirty(false);
  }, []);

  // Load product
  useEffect(() => {
    api.categories.names().then(setAllCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.products.get(id),
      api.shopify.getSettings(),
      api.shopify.getMapping(id),
    ]).then(([p, shopify, mapping]) => {
      setProduct(p);
      setName(p.name); setDesc(p.description); setPrice(String(p.price));
      setDisc(p.discounted_price ? String(p.discounted_price) : '');
      setCost(String(p.cost)); setSku(p.sku); setBarcode(p.barcode);
      setStock(String(p.stock)); setWeight(String(p.weight));
      setStatus(p.status); setCategory(p.category); setChannels(p.channels);
      setTags(p.tags || []);
      setMedia((p.media || []).map(m => ({ ...m, selected: false })));
      setHasVariants(p.has_variants);
      setVariantOptions(p.variant_options || []);
      setVariantData(p.variant_data || {});
      setVatRate(p.vat_rate ?? 20);
      setVatIncluded(p.vat_included !== false);
      setB2bPrice(p.b2b_price != null ? String(p.b2b_price) : '');
      setB2bDiscounted(p.b2b_discounted_price != null ? String(p.b2b_discounted_price) : '');
      setShopifySettings(shopify);
      setShopifyMapping(mapping);
    }).finally(() => setLoading(false));
  }, [id]);

  const readFiles = (files: FileList | File[]) => {
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (!ev.target?.result) return;
        // Canvas ile sıkıştır: max 1200px, JPEG %80 — base64 boyutunu ~10x küçültür
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setMedia(prev => [...prev, { id: Date.now() + i + Math.random(), src: compressed, selected: false }]);
          markDirty();
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(f);
    });
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const newStock = hasVariants
        ? Object.values(variantData).reduce((s, v) => s + (parseInt(v.stock || '0') || 0), 0)
        : parseInt(stock) || 0;
      const newMedia = media.map(m => ({ id: m.id, src: m.src ?? null, emoji: m.emoji }));

      // Shopify diff — product (eski değerler) ile karşılaştır, API çağrısından ÖNCE
      let shopifyChanges: string[] = [];
      if (shopifyMapping && product) {
        if (name !== product.name || desc !== product.description || status !== product.status)
          shopifyChanges.push('productInfo');
        if (!hasVariants) {
          if ((parseFloat(price) || 0) !== product.price ||
              (discounted ? parseFloat(discounted) : null) !== product.discounted_price)
            shopifyChanges.push('pricing');
          if ((parseInt(stock) || 0) !== product.stock)
            shopifyChanges.push('stock');
          if (sku !== product.sku || barcode !== product.barcode ||
              (parseFloat(weight) || 0) !== product.weight)
            shopifyChanges.push('inventoryData');
        } else {
          const oldVD = product.variant_data || {};
          for (const combo of Object.keys(variantData)) {
            const o = oldVD[combo] || {};
            const n = variantData[combo] || {};
            if (n.price !== o.price || n.disc !== o.disc) shopifyChanges.push('pricing');
            if (n.stock !== o.stock)                      shopifyChanges.push('variantStock');
            if (n.sku !== o.sku || n.barcode !== o.barcode || n.weight !== o.weight)
              shopifyChanges.push('inventoryData');
          }
        }
        if (JSON.stringify(newMedia.map(m => m.src)) !==
            JSON.stringify((product.media || []).map(m => m.src)))
          shopifyChanges.push('media');
        shopifyChanges = [...new Set(shopifyChanges)];
      }

      await api.products.update(id, {
        name, description: desc, price: parseFloat(price) || 0,
        discounted_price: discounted ? parseFloat(discounted) : null,
        cost: parseFloat(cost) || 0, sku, barcode,
        stock: newStock,
        weight: parseFloat(weight) || 0, status, category, channels, tags,
        media: newMedia,
        has_variants: hasVariants, variant_options: variantOptions, variant_data: variantData,
        vat_rate: vatRate, vat_included: vatIncluded,
        b2b_price: b2bPrice ? parseFloat(b2bPrice) : null,
        b2b_discounted_price: b2bDiscounted ? parseFloat(b2bDiscounted) : null,
      });

      // product state'ini her zaman güncelle — bir sonraki Vazgeç/diff için referans noktası
      setProduct(prev => prev ? {
        ...prev,
        name, description: desc,
        price: parseFloat(price) || 0,
        discounted_price: discounted ? parseFloat(discounted) : null,
        b2b_price: b2bPrice ? parseFloat(b2bPrice) : null,
        b2b_discounted_price: b2bDiscounted ? parseFloat(b2bDiscounted) : null,
        cost: parseFloat(cost) || 0, sku, barcode,
        stock: newStock,
        weight: parseFloat(weight) || 0,
        status, category, channels, tags,
        media: newMedia,
        has_variants: hasVariants, variant_options: variantOptions, variant_data: variantData,
        vat_rate: vatRate, vat_included: vatIncluded,
      } : prev);

      showToast('Kaydedildi', 'Ürün bilgileri güncellendi.', 'success');
      setDirty(false);

      // Shopify sync (arka planda)
      if (shopifyChanges.length > 0) {
        api.shopify.syncProduct(id, shopifyChanges)
          .then(res => {
            if (res.ok) showToast("Shopify'a Aktarıldı", res.message, 'success');
            else        showToast('Shopify Sync Hatası',  res.message, 'error');
          })
          .catch(() => {});
      }
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Kayıt sırasında hata.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await api.products.delete(id);
    showToast('Silindi', 'Ürün silindi.', 'error');
    setTimeout(() => navigate('/products'), 1200);
  };

  // Shopify: load products
  const loadShopifyProducts = useCallback(async () => {
    if (shopifyProducts !== null || shopifyCacheFailed) return;
    if (!shopifySettings?.shop_domain || !shopifySettings?.access_token) {
      setShopifyCacheFailed(true); return;
    }
    try {
      const data = await api.shopify.listProducts(shopifySettings.shop_domain, shopifySettings.access_token);
      setShopifyProducts(data.products.map(p => ({
        ...p, id: Number(p.id),
        variants: p.variants.map(v => ({ ...v, id: Number(v.id) })),
      })));
    } catch {
      setShopifyCacheFailed(true);
    }
  }, [shopifyProducts, shopifyCacheFailed, shopifySettings]);

  const openMapModal = useCallback(() => {
    setSelectedShopifyProduct(null);
    setShopifySearch('');
    setMapModalOpen(true);
    loadShopifyProducts();
  }, [loadShopifyProducts]);

  const handleMapConfirm = useCallback(async () => {
    if (!selectedShopifyProduct || !id) return;
    if (hasVariants && getCombinations(variantOptions).length > 0) {
      setVariantStepOpen(true);
      return;
    }
    const mapping = await api.shopify.saveMapping(id, {
      shopify_id:    String(selectedShopifyProduct.id),
      shopify_title: selectedShopifyProduct.title,
      handle:        selectedShopifyProduct.handle,
      sku:           selectedShopifyProduct.variants[0]?.sku || '',
      price:         parseFloat(selectedShopifyProduct.variants[0]?.price || '0'),
      type:          'mapped',
      is_variant:    false,
      variant_mappings: {},
      mapped_at:     new Date().toLocaleDateString('tr-TR'),
    });
    setShopifyMapping(mapping);
    setMapModalOpen(false);
    showToast('Eşleştirildi', `"${selectedShopifyProduct.title}" ile eşleştirildi.`, 'success');
  }, [selectedShopifyProduct, id, hasVariants, variantOptions, showToast]);

  const handleVariantMapConfirm = useCallback(async () => {
    if (!selectedShopifyProduct || !id) return;
    const combos = getCombinations(variantOptions);
    const vm: Record<string, { shopifyVariantId: string; shopifyVariantTitle: string; shopifySku: string; shopifyPrice: string }> = {};
    combos.forEach(combo => {
      const svId = variantStepSelections.current[combo];
      if (!svId) return;
      const sv = selectedShopifyProduct.variants.find(v => String(v.id) === svId);
      if (sv) vm[combo] = { shopifyVariantId: String(sv.id), shopifyVariantTitle: sv.title, shopifySku: sv.sku, shopifyPrice: sv.price };
    });
    const mapping = await api.shopify.saveMapping(id, {
      shopify_id:    String(selectedShopifyProduct.id),
      shopify_title: selectedShopifyProduct.title,
      handle:        selectedShopifyProduct.handle,
      sku:           selectedShopifyProduct.variants[0]?.sku || '',
      price:         parseFloat(selectedShopifyProduct.variants[0]?.price || '0'),
      type:          'mapped', is_variant: true, variant_mappings: vm,
      mapped_at:     new Date().toLocaleDateString('tr-TR'),
    });
    setShopifyMapping(mapping);
    setVariantStepOpen(false); setMapModalOpen(false);
    showToast('Eşleştirildi', `${Object.keys(vm).length} varyant eşleştirildi.`, 'success');
  }, [selectedShopifyProduct, id, variantOptions, showToast]);

  const handleCreateInShopify = useCallback(async () => {
    if (!id || !shopifySettings?.connected) return;
    setShopifyCreating(true);
    try {
      const combos = hasVariants ? getCombinations(variantOptions) : [];

      // Görseller — base64 attachment veya URL
      const images = (media || [])
        .filter(m => m.src).slice(0, 5)
        .map((m, i) => m.src!.startsWith('data:')
          ? { attachment: m.src!.split(',')[1], filename: `image-${i + 1}.jpg` }
          : { src: m.src });

      let apiProduct: Record<string, unknown>;

      if (combos.length > 0) {
        // Varyantlı ürün — Shopify'a options tanımı zorunlu
        const options = variantOptions
          .filter(o => o.name && o.values.length > 0)
          .map(o => ({ name: o.name, values: o.values }));

        const apiVariants = combos.map((combo, i) => {
          const vd = variantData[combo] || {};
          const parts = combo.split(' / ');
          const sellingPrice = vd.disc || vd.price || price;
          const compareAt    = vd.disc && vd.price ? vd.price : null;
          return {
            option1: parts[0] ?? null,
            option2: parts[1] ?? null,
            option3: parts[2] ?? null,
            price: sellingPrice || '0',
            compare_at_price: compareAt,
            sku: vd.sku || (sku ? `${sku}-${i + 1}` : ''),
            barcode: vd.barcode || '',
            weight: parseFloat(vd.weight || '0') || 0,
            weight_unit: 'kg',
            inventory_management: 'shopify',
            inventory_quantity: parseInt(vd.stock || '0') || 0,
          };
        });

        apiProduct = {
          title: name,
          body_html: desc,
          status,
          options,
          variants: apiVariants,
          ...(images.length > 0 ? { images } : {}),
        };
      } else {
        // Tekil ürün
        const sellingPrice = discounted || price;
        const compareAt    = discounted ? price : null;
        apiProduct = {
          title: name,
          body_html: desc,
          status,
          variants: [{
            price: sellingPrice || '0',
            compare_at_price: compareAt,
            sku,
            barcode,
            weight: parseFloat(weight) || 0,
            weight_unit: 'kg',
            inventory_management: 'shopify',
            inventory_quantity: parseInt(stock) || 0,
          }],
          ...(images.length > 0 ? { images } : {}),
        };
      }

      const data = await api.shopify.createProduct(
        shopifySettings.shop_domain, shopifySettings.access_token, apiProduct,
      );
      const sp = data.product;
      const mapping = await api.shopify.saveMapping(id, {
        shopify_id:    String(sp.id),
        shopify_title: sp.title,
        handle:        sp.handle,
        sku:           sp.variants[0]?.sku || sku,
        price:         parseFloat(sp.variants[0]?.price || price) || 0,
        type:          'created',
        is_variant:    hasVariants && combos.length > 0,
        variant_mappings: hasVariants && combos.length > 0
          ? Object.fromEntries(combos.map((c, i) => [c, {
              shopifyVariantId:    String(sp.variants[i]?.id || ''),
              shopifyVariantTitle: sp.variants[i]?.title || c,
              shopifySku:          sp.variants[i]?.sku || '',
              shopifyPrice:        sp.variants[i]?.price || price,
            }]))
          : {},
        mapped_at: new Date().toLocaleDateString('tr-TR'),
      });
      setShopifyMapping(mapping);
      showToast("Shopify'da Oluşturuldu", `"${sp.title}" eklendi. ID: #${sp.id}`, 'success');
    } catch (err: any) {
      // Demo fallback
      const mockId = String(7899000 + Math.floor(Math.random() * 999));
      const handle  = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
      const combos  = hasVariants ? getCombinations(variantOptions) : [];
      const mapping = await api.shopify.saveMapping(id, {
        shopify_id: mockId, shopify_title: name, handle, sku,
        price: parseFloat(price) || 0,
        type: 'created', is_variant: false, variant_mappings: {},
        mapped_at: new Date().toLocaleDateString('tr-TR'),
      });
      setShopifyMapping(mapping);
      showToast('Oluşturuldu (Demo)', `Proxy yanıt vermedi, demo olarak kaydedildi. (${err.message})`, 'info');
    } finally {
      setShopifyCreating(false);
    }
  }, [id, shopifySettings, hasVariants, variantOptions, variantData, name, desc, price, discounted, sku, barcode, stock, weight, media, showToast]);

  const handleUnmap = useCallback(async () => {
    if (!id) return;
    await api.shopify.deleteMapping(id);
    setShopifyMapping(null);
    showToast('Kaldırıldı', 'Shopify eşleştirmesi kaldırıldı.', 'info');
  }, [id, showToast]);

  // ── Render helpers ────────────────────────────────────────────────────────────
  const allShopifyProducts = shopifyProducts ?? MOCK_SHOPIFY;
  const filteredShopify = allShopifyProducts.filter(p =>
    !shopifySearch || p.title.toLowerCase().includes(shopifySearch.toLowerCase())
  );
  const shopifyDomain = shopifySettings?.shop_domain ? shopifySettings.shop_domain + '.myshopify.com' : 'myshopify.com';

  const profit = parseFloat(price) && parseFloat(cost)
    ? Math.round(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100)
    : 0;

  const CHANNEL_OPTS = ['trendyol', 'hepsi', 'n11', 'ikas', 'shopify', 'ticimax', 'ideasoft'];
  const CHANNEL_META: Record<string, { label: string; favicon: string }> = {
    trendyol: { label: 'Trendyol',    favicon: 'trendyol.com' },
    hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com' },
    n11:      { label: 'N11',         favicon: 'n11.com' },
    ikas:     { label: 'İkas',        favicon: 'ikas.com' },
    shopify:  { label: 'Shopify',     favicon: 'shopify.com' },
    ticimax:  { label: 'Ticimax',     favicon: 'ticimax.com' },
    ideasoft: { label: 'İdeasoft',    favicon: 'ideasoft.com' },
  };

  const combos = hasVariants ? getCombinations(variantOptions) : [];

  // Varyantlı ürünlerde stok variant_data'daki toplamdan hesaplanır;
  // böylece DB'de stock=0 olan eski/import kayıtlarda badge doğru görünür
  const effectiveStock = hasVariants
    ? Object.values(variantData).reduce((s, v) => s + (parseInt(v.stock || '0') || 0), 0)
    : (product?.stock ?? 0);

  if (loading) return <Layout title="Ürün"><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div></Layout>;
  if (!product) return <Layout title="Ürün Bulunamadı"><div style={{ padding: 60, textAlign: 'center' }}>Ürün bulunamadı.</div></Layout>;

  const stBadge = statusLabel(status);

  return (
    <Layout
      title={name || product.name}
      actions={dirty ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => product && resetToProduct(product)}>Vazgeç</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      ) : undefined}
    >
      <Link to="/products" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Ürünler
      </Link>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${stBadge.cls}`}>{stBadge.label}</span>
          {effectiveStock === 0 && <span className="badge badge-danger">Stok Yok</span>}
          {(product.category || []).map(c => <span key={c} className="badge badge-gray">{c}</span>)}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: #{String(product.id).replace('new_', '')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="pd-tabs">
        <button className={`pd-tab${activeTab === 'genel' ? ' active' : ''}`} onClick={() => setActiveTab('genel')}>Genel</button>
        <button className={`pd-tab${activeTab === 'entegrasyon' ? ' active' : ''}`} onClick={() => setActiveTab('entegrasyon')}>Entegrasyon</button>
      </div>

      {/* ── GENEL TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'genel' && (
        <div className="pd-layout">
          <div>
            {/* Ürün Bilgisi */}
            <div className="pd-card">
              <div className="pd-card-title">Ürün Bilgisi</div>
              <div className="pd-card-body">
                <div className="form-group">
                  <label className="form-label">Ürün Adı</label>
                  <input className="form-control" value={name} onChange={e => { setName(e.target.value); markDirty(); }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Açıklama</label>
                  <textarea className="form-control" rows={8} value={desc} onChange={e => { setDesc(e.target.value); markDirty(); }} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Medya */}
            <div className="pd-card">
              <div className="pd-card-title">
                <span>Medya</span>
                {media.some(m => m.selected) && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }}
                    onClick={() => { setMedia(prev => prev.filter(m => !m.selected)); markDirty(); }}>
                    Seçilenleri Sil
                  </button>
                )}
              </div>
              <div className="pd-card-body">
                <input ref={mediaInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { readFiles(e.target.files || []); e.target.value = ''; }} />
                <div className="media-grid"
                  onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
                  onDrop={e => { if (e.dataTransfer.files.length > 0) { e.preventDefault(); readFiles(e.dataTransfer.files); } }}
                >
                  {media.map((m, idx) => (
                    <div key={m.id}
                      className={`media-thumb${idx === 0 ? ' main-thumb' : ''}${m.selected ? ' selected' : ''}`}
                      draggable
                      onDragStart={() => { dragIdxRef.current = idx; }}
                      onDragEnter={() => { dragOverIdxRef.current = idx; }}
                      onDragOver={e => e.preventDefault()}
                      onDragEnd={() => {
                        const from = dragIdxRef.current;
                        const to   = dragOverIdxRef.current;
                        if (from === null || to === null || from === to) return;
                        setMedia(prev => {
                          const arr = [...prev];
                          arr.splice(to, 0, arr.splice(from, 1)[0]);
                          return arr;
                        });
                        markDirty();
                        dragIdxRef.current = null;
                        dragOverIdxRef.current = null;
                      }}
                      onClick={() => setMedia(prev => prev.map(x => x.id === m.id ? { ...x, selected: !x.selected } : x))}
                      style={{ cursor: 'grab' }}
                    >
                      <input type="checkbox" className="media-cb" checked={!!m.selected}
                        onChange={e => { e.stopPropagation(); setMedia(prev => prev.map(x => x.id === m.id ? { ...x, selected: !x.selected } : x)); markDirty(); }}
                        onClick={e => e.stopPropagation()} />
                      {m.src ? (
                        <img src={m.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: idx === 0 ? 48 : 32 }}>{m.emoji || '🖼'}</span>
                      )}
                      {idx === 0 && <div className="media-main-badge">ANA GÖRSEL</div>}
                    </div>
                  ))}
                  <div className="media-thumb add" onClick={() => mediaInputRef.current?.click()}>
                    <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Ekle</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Varyantlar */}
            <div className="pd-card">
              <div className="pd-card-title">
                <span>Varyantlar</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasVariants}
                    onChange={e => { setHasVariants(e.target.checked); markDirty(); if (e.target.checked && variantOptions.length === 0) setVariantOptions([{ id: Date.now(), name: '', values: [] }]); }}
                    style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                  Bu ürünün farklı seçenekleri var
                </label>
              </div>
              {hasVariants && (
                <div className="pd-card-body" style={{ borderTop: '1px solid var(--border-light)' }}>
                  {variantOptions.map((opt, oi) => (
                    <div key={opt.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Seçenek adı</span>
                        <input className="form-control" type="text" placeholder="Renk, Beden…" value={opt.name} style={{ maxWidth: 200, fontSize: 13 }}
                          onChange={e => { setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, name: e.target.value } : o)); markDirty(); }} />
                        <button onClick={() => { setVariantOptions(prev => prev.filter((_, i) => i !== oi)); markDirty(); }}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {opt.values.map(v => (
                          <span key={v} className="tag">
                            {v}
                            <button onClick={() => { setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, values: o.values.filter(x => x !== v) } : o)); markDirty(); }}>×</button>
                          </span>
                        ))}
                        <input className="form-control" type="text" placeholder="Değer ekle + Enter" style={{ width: 160, padding: '5px 10px', fontSize: 12 }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val && !opt.values.includes(val)) { setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, values: [...o.values, val] } : o)); markDirty(); } (e.target as HTMLInputElement).value = ''; } }} />
                      </div>
                    </div>
                  ))}
                  {variantOptions.length < 3 && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                      onClick={() => { setVariantOptions(prev => [...prev, { id: Date.now(), name: '', values: [] }]); markDirty(); }}>
                      + Seçenek Ekle
                    </button>
                  )}

                  {/* Variant data table */}
                  {combos.length > 0 && (
                    <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                        {combos.length} VARYANT
                      </div>
                      <div className="table-wrap">
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ minWidth: 120 }}>Varyant</th>
                              <th style={{ minWidth: 100 }}>Fiyat (₺)</th>
                              <th style={{ minWidth: 110 }}>İnd. Fiyat (₺)</th>
                              <th style={{ minWidth: 105 }}>Toptan Fiyatı (₺)</th>
                              <th style={{ minWidth: 115 }}>Toptan İnd. (₺)</th>
                              <th style={{ minWidth: 80 }}>Stok</th>
                              <th style={{ minWidth: 120 }}>SKU</th>
                              <th style={{ minWidth: 130 }}>Barkod</th>
                              <th style={{ minWidth: 90 }}>Ağırlık (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {combos.map((combo, ci) => {
                              const vd = variantData[combo] || {};
                              const upd = (field: string, val: string) => {
                                setVariantData(prev => ({ ...prev, [combo]: { ...prev[combo], [field]: val } }));
                                markDirty();
                              };
                              return (
                                <tr key={combo}>
                                  <td><span style={{ fontWeight: 600, fontSize: 13 }}>{combo}</span></td>
                                  <td><input className="form-control" type="number" style={{ width: 95 }} placeholder={price || '0'}
                                    value={vd.price || ''} onChange={e => upd('price', e.target.value)} /></td>
                                  <td><input className="form-control" type="number" style={{ width: 105 }} placeholder="—"
                                    value={vd.disc || ''} onChange={e => upd('disc', e.target.value)} /></td>
                                  <td><input className="form-control" type="number" style={{ width: 100 }} placeholder="—"
                                    value={vd.b2b_price || ''} onChange={e => upd('b2b_price', e.target.value)} /></td>
                                  <td><input className="form-control" type="number" style={{ width: 110 }} placeholder="—"
                                    value={vd.b2b_disc || ''} onChange={e => upd('b2b_disc', e.target.value)} /></td>
                                  <td><input className="form-control" type="number" style={{ width: 75 }} placeholder="0"
                                    value={vd.stock || ''} onChange={e => upd('stock', e.target.value)} /></td>
                                  <td><input className="form-control" type="text" style={{ width: 115 }} placeholder={sku ? sku + '-' + (ci + 1) : 'SKU'}
                                    value={vd.sku || ''} onChange={e => upd('sku', e.target.value)} /></td>
                                  <td><input className="form-control" type="text" style={{ width: 125 }} placeholder="8680000000000"
                                    value={vd.barcode || ''} onChange={e => upd('barcode', e.target.value)} /></td>
                                  <td><input className="form-control" type="number" step="0.1" style={{ width: 85 }} placeholder="0.0"
                                    value={vd.weight || ''} onChange={e => upd('weight', e.target.value)} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fiyatlandırma */}
            {!hasVariants && (
              <div className="pd-card" id="pricingCard">
                <div className="pd-card-title">Fiyatlandırma</div>
                <div className="pd-card-body">
                  <div className="price-row">
                    <div className="form-group">
                      <label className="form-label">Perakende Fiyatı (₺)</label>
                      <input className="form-control" type="number" value={price} onChange={e => { setPrice(e.target.value); markDirty(); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Perakende İndirimli Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                      <input className="form-control" type="number" value={discounted} onChange={e => { setDisc(e.target.value); markDirty(); }} placeholder="—" />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Maliyet (₺)</label>
                    <input className="form-control" type="number" value={cost} onChange={e => { setCost(e.target.value); markDirty(); }} />
                  </div>
                  <div className="profit-bar">
                    <span style={{ color: 'var(--text-muted)' }}>Tahmini kâr marjı</span>
                    <span style={{ fontWeight: 700, color: profit >= 20 ? 'var(--success)' : profit >= 10 ? 'var(--warning)' : 'var(--danger)' }}>{profit}%</span>
                  </div>

                  {/* Toptan Fiyatlandırma */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Toptan Fiyatlandırma</div>
                    <div className="price-row">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Toptan Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                        <input className="form-control" type="number" value={b2bPrice} onChange={e => { setB2bPrice(e.target.value); markDirty(); }} placeholder="—" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Toptan İndirimli Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                        <input className="form-control" type="number" value={b2bDiscounted} onChange={e => { setB2bDiscounted(e.target.value); markDirty(); }} placeholder="—" />
                      </div>
                    </div>
                  </div>

                  {/* KDV */}
                  <KdvSection
                    vatRate={vatRate} vatIncluded={vatIncluded}
                    basePrice={parseFloat(discounted || price) || 0}
                    onRateChange={v => { setVatRate(v); markDirty(); }}
                    onIncludedChange={v => { setVatIncluded(v); markDirty(); }}
                  />
                </div>
              </div>
            )}

            {/* Envanter */}
            {!hasVariants && (
              <div className="pd-card">
                <div className="pd-card-title">Envanter</div>
                <div className="pd-card-body">
                  <div className="price-row">
                    <div className="form-group">
                      <label className="form-label">SKU</label>
                      <input className="form-control" value={sku} onChange={e => { setSku(e.target.value); markDirty(); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Barkod</label>
                      <input className="form-control" value={barcode} onChange={e => { setBarcode(e.target.value); markDirty(); }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Stok Miktarı</label>
                    <input className="form-control" type="number" value={stock} onChange={e => { setStock(e.target.value); markDirty(); }} style={{ maxWidth: 160 }} />
                  </div>
                </div>
              </div>
            )}

            {/* Kargo — varyantlı ürünlerde ağırlık varyant tablosunda girilir */}
            {!hasVariants && (
              <div className="pd-card">
                <div className="pd-card-title">Kargo</div>
                <div className="pd-card-body">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Ağırlık (kg)</label>
                    <input className="form-control" type="number" step="0.1" value={weight} onChange={e => { setWeight(e.target.value); markDirty(); }} style={{ maxWidth: 160 }} />
                  </div>
                </div>
              </div>
            )}

            {/* KDV — varyantlı ürünlerde ayrı kart */}
            {hasVariants && (
              <div className="pd-card">
                <div className="pd-card-title">KDV</div>
                <div className="pd-card-body">
                  <KdvSection
                    vatRate={vatRate} vatIncluded={vatIncluded}
                    basePrice={0}
                    onRateChange={v => { setVatRate(v); markDirty(); }}
                    onIncludedChange={v => { setVatIncluded(v); markDirty(); }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            <div className="pd-card">
              <div className="pd-card-title">Ürün Durumu</div>
              <div className="pd-card-body">
                <select className="status-select" value={status}
                  onChange={e => { setStatus(e.target.value as 'active' | 'draft' | 'archived'); markDirty(); }}>
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="archived">Arşiv</option>
                </select>
              </div>
            </div>

            <div className="pd-card">
              <div className="pd-card-title">Organizasyon</div>
              <div className="pd-card-body">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  {category.length > 0 && (
                    <div className="tag-list" style={{ marginBottom: 8 }}>
                      {category.map(c => (
                        <span key={c} className="tag">
                          {c}
                          <button onClick={() => { setCategory(prev => prev.filter(x => x !== c)); markDirty(); }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select
                    className="form-control"
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (val && !category.includes(val)) {
                        setCategory(prev => [...prev, val]);
                        markDirty();
                      }
                    }}
                  >
                    <option value="">Kategori ekle…</option>
                    {[...new Set([...allCategories, ...category])].filter(c => !category.includes(c)).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Etiketler</label>
                  <div className="tag-list">
                    {tags.map(t => (
                      <span key={t} className="tag">
                        {t}
                        <button onClick={() => { setTags(prev => prev.filter(x => x !== t)); markDirty(); }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input className="form-control" type="text" placeholder="Etiket ekle ve Enter'a bas"
                    style={{ marginTop: 8 }} value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      const val = tagInput.trim();
                      if (val && !tags.includes(val)) { setTags(prev => [...prev, val]); markDirty(); }
                      setTagInput('');
                    }} />
                </div>
              </div>
            </div>

            {(() => {
              // Tüm aktif entegrasyonları birleştir
              const mappedChannels = [
                ...channels,
                ...(shopifyMapping && !channels.includes('shopify') ? ['shopify'] : []),
              ];
              return (
                <div className="pd-card">
                  <div className="pd-card-title">Satış Kanalları</div>
                  <div className="pd-card-body" style={{ padding: 0 }}>
                    {mappedChannels.length > 0 ? mappedChannels.map((ch, i) => {
                      const m = CHANNEL_META[ch];
                      const isShopify = ch === 'shopify' && shopifyMapping && hasVariants && combos.length > 0;
                      const mappedVariantCount = isShopify ? Object.keys(shopifyMapping!.variant_mappings || {}).length : 0;
                      const allMapped = mappedVariantCount === combos.length;
                      return (
                        <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < mappedChannels.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                          <img src={`https://www.google.com/s2/favicons?domain=${m?.favicon}&sz=32`} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} alt="" />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m?.label || ch}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                              Eşleştirildi
                            </span>
                            {isShopify && (
                              <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', color: allMapped ? 'var(--text-muted)' : '#D97706' }}>
                                {combos.length} varyanttan {mappedVariantCount} tanesi eşleştirildi
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        Henüz eşleştirme yok
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pd-card">
              <div className="pd-card-title" style={{ color: 'var(--danger)' }}>Tehlikeli Alan</div>
              <div className="pd-card-body">
                <div className="danger-zone">
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none', width: '100%' }}
                    onClick={() => setDeleteModalOpen(true)}>
                    Ürünü Sil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ENTEGRASYON TAB ───────────────────────────────────────────── */}
      {activeTab === 'entegrasyon' && (
        <div>
          {/* Shopify Card */}
          {shopifySettings?.connected && (
            <div style={{
              background: 'var(--card)',
              border: `1.5px solid ${shopifyMapping ? '#96BF48' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: '#96BF4818', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛍</div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Shopify Eşleştirmesi</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: shopifyMapping ? 'var(--success)' : 'var(--text-muted)' }}>
                  {shopifyMapping ? '● Eşleştirildi' : 'Eşleştirilmemiş'}
                </span>
              </div>

              {shopifyMapping ? (
                <>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      ['Shopify Ürünü', shopifyMapping.shopify_title],
                      ['Shopify ID', '#' + shopifyMapping.shopify_id],
                      ['Handle', shopifyMapping.handle],
                      ['SKU', shopifyMapping.sku || '—'],
                      ['Tür', shopifyMapping.type === 'created' ? '✦ Shopify\'da Oluşturuldu' : '⇌ Manuel Eşleştirildi'],
                      ['Tarih', shopifyMapping.mapped_at],
                    ].map(([l, v]) => (
                      <div key={l} className="int-row">
                        <span className="lbl">{l}</span>
                        <span className="val">{v}</span>
                      </div>
                    ))}
                    {combos.length > 0 && (
                      <div style={{ marginTop: 8, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                            VARYANT EŞLEŞTİRMELERİ
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--success)' }}>{Object.keys(shopifyMapping.variant_mappings || {}).length}</span>
                            /{combos.length} eşleştirildi
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          <table style={{ margin: 0, fontSize: 11 }}>
                            <thead>
                              <tr>
                                <th>Platform Varyantı</th>
                                <th>Shopify Varyantı</th>
                                <th>SKU</th>
                              </tr>
                            </thead>
                            <tbody>
                              {combos.map(combo => {
                                const vm = (shopifyMapping.variant_mappings || {})[combo];
                                return (
                                  <tr key={combo}>
                                    <td style={{ fontWeight: 600 }}>{combo}</td>
                                    {vm ? (
                                      <>
                                        <td>{vm.shopifyVariantTitle}</td>
                                        <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{vm.shopifySku || '—'}</td>
                                      </>
                                    ) : (
                                      <td colSpan={2} style={{ color: 'var(--warning, #D97706)', fontWeight: 600 }}>
                                        ⚠ Eşleştirilmedi
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <a href={`https://${shopifyDomain}/products/${shopifyMapping.handle}`} target="_blank" rel="noreferrer"
                      className="btn btn-ghost btn-sm" style={{ fontSize: 12, textDecoration: 'none' }}>
                      Shopify'da Görüntüle ↗
                    </a>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={openMapModal}>Yeniden Eşleştir</button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={handleUnmap}>Eşleştirmeyi Kaldır</button>
                  </div>
                </>
              ) : (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                    Bu ürün <strong>{shopifyDomain}</strong> ile henüz eşleştirilmedi.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" style={{ fontSize: 12, background: '#96BF48', color: '#fff', border: 'none', padding: '8px 14px' }} onClick={openMapModal}>
                      Mevcut Ürünü Eşleştir
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={handleCreateInShopify} disabled={shopifyCreating}>
                      {shopifyCreating ? 'Oluşturuluyor…' : "Shopify'da Yeni Oluştur"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!shopifySettings?.connected && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🛍</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Shopify bağlı değil</div>
              <Link to="/integrations/shopify" className="btn btn-ghost btn-sm" style={{ fontSize: 12, textDecoration: 'none' }}>Shopify'ı Bağla</Link>
            </div>
          )}

          {/* Aktif satış kanalları — ikon görünümü */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Satış Kanalları</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{channels.length} aktif kanal</div>
              </div>
              {channels.length > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                  onClick={() => showToast('Senkronizasyon', 'Tüm kanallar senkronize ediliyor…', 'info')}>
                  <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 5 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Tümünü Senkronize Et
                </button>
              )}
            </div>
            {channels.length > 0 ? (
              <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {channels.map(ch => {
                  const m = CHANNEL_META[ch];
                  return (
                    <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                      <img src={`https://www.google.com/s2/favicons?domain=${m?.favicon}&sz=32`} width={20} height={20} style={{ borderRadius: 4 }} alt="" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m?.label || ch}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                        Yayında
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Henüz satış kanalı seçilmemiş. Genel sekmesinden ekleyebilirsiniz.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Shopify Map Modal ──────────────────────────────────────────── */}
      <Modal
        open={mapModalOpen && !variantStepOpen}
        onClose={() => setMapModalOpen(false)}
        maxWidth={560}
        title={<><span style={{ fontSize: 18 }}>🛍</span> Shopify Ürünü Eşleştir{hasVariants && combos.length > 0 ? ' — Adım 1/2' : ''}</>}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selectedShopifyProduct ? 'Seçili: ' + selectedShopifyProduct.title : 'Seçili: —'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setMapModalOpen(false)}>İptal</button>
              <button className="btn btn-sm" style={{ background: '#96BF48', color: '#fff', border: 'none' }}
                disabled={!selectedShopifyProduct} onClick={handleMapConfirm}>
                {hasVariants && combos.length > 0 ? 'Devam: Varyant Eşleştirme →' : 'Eşleştir'}
              </button>
            </div>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Platform ürününüzle eşleştirmek istediğiniz Shopify ürününü seçin.
        </p>

        {/* Banner */}
        {shopifyProducts !== null && (
          <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, padding: '7px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)', marginBottom: 10 }}>
            ✓ {shopifyProducts.length} ürün {shopifySettings?.shop_domain}.myshopify.com'dan yüklendi
          </div>
        )}
        {shopifyCacheFailed && shopifySettings?.access_token && (
          <div style={{ fontSize: 11, color: '#92400E', padding: '7px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', marginBottom: 10 }}>
            ⚠ Demo veriler gösteriliyor. Gerçek veriler için proxy'yi başlatın.
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input className="form-control" type="text" placeholder="Ürün adı ile ara…" style={{ paddingLeft: 32 }}
            value={shopifySearch} onChange={e => setShopifySearch(e.target.value)} />
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          {filteredShopify.map(sp => {
            const isSelected = selectedShopifyProduct?.id === sp.id;
            const variantCnt = sp.variants?.length || 0;
            return (
              <div key={sp.id} onClick={() => setSelectedShopifyProduct(sp)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer',
                         border: '1.5px solid transparent', borderRadius: 'var(--radius-sm)', transition: 'all .15s',
                         ...(isSelected ? { borderColor: '#96BF48', background: '#96BF4812' } : {}) }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: '#96BF4820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sp.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>₺{parseFloat(sp.variants[0]?.price || '0').toLocaleString('tr-TR')}</span>
                    <span style={{ background: variantCnt > 1 ? '#96BF4820' : 'var(--bg)', color: variantCnt > 1 ? '#6B8F2A' : 'var(--text-muted)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                      {variantCnt > 1 ? `${variantCnt} varyant` : 'Tek tip'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ── Variant mapping step modal ─────────────────────────────────── */}
      <Modal
        open={variantStepOpen}
        onClose={() => setVariantStepOpen(false)}
        maxWidth={560}
        title={<><span style={{ fontSize: 18 }}>🛍</span> Varyant Eşleştirme — Adım 2/2</>}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setVariantStepOpen(false)}>← Geri</button>
            <button className="btn btn-sm" style={{ background: '#96BF48', color: '#fff', border: 'none' }}
              onClick={handleVariantMapConfirm}>
              Eşleştir
            </button>
          </div>
        }
      >
        {selectedShopifyProduct && (
          <div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: 12, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              🛍 {selectedShopifyProduct.title} · {selectedShopifyProduct.variants.length} Shopify varyantı
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Her platform varyantını karşılık gelen Shopify varyantıyla eşleştirin.
            </p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <table style={{ margin: 0, fontSize: 12 }}>
                <thead><tr><th style={{ width: '42%' }}>Platform Varyantı</th><th>Shopify Varyantı</th></tr></thead>
                <tbody>
                  {combos.map((combo) => (
                    <tr key={combo}>
                      <td style={{ fontWeight: 600 }}>{combo}</td>
                      <td>
                        <select className="form-control" style={{ fontSize: 12, padding: '5px 8px' }}
                          defaultValue=""
                          onChange={e => { variantStepSelections.current[combo] = e.target.value; }}>
                          <option value="">— Eşleştirme yok —</option>
                          {selectedShopifyProduct.variants.map(v => (
                            <option key={v.id} value={String(v.id)}>{v.title}{v.sku ? ' · ' + v.sku : ''}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm modal ─────────────────────────────────────── */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        maxWidth={400}
        title="Ürünü Sil"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleteModalOpen(false)}>İptal</button>
            <button className="btn" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDelete}>Ürünü Sil</button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Bu ürünü kalıcı olarak silmek istediğinizden emin misiniz?</p>
        <div style={{ background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)' }}>
          ⚠ Bu işlem geri alınamaz.
        </div>
      </Modal>
    </Layout>
  );
}

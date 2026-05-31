import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Product, VariantDataEntry, ShopifyMapping } from '../types';

const SAMPLE_CSV = `name,status,category,price,discounted_price,cost,sku,barcode,stock,weight,tags,vat_rate
iPhone 15 Pro Max 256GB,active,Telefon,72999,69999,50000,AAPL-IP15PM-256,8680012345678,50,0.21,apple;iphone,20
Samsung Galaxy S24 Ultra,draft,Telefon,65999,,45000,SAM-S24U-BLK,8690012345678,30,0.22,samsung;android,20
MacBook Pro M3 14" 16GB,active,Bilgisayar,89999,,65000,AAPL-MBP-M3-16,8680098765432,15,1.61,apple;laptop,20
`;

const STATUS_TABS = [
  { key: 'all',      label: 'Tüm Ürünler' },
  { key: 'active',   label: 'Aktif' },
  { key: 'draft',    label: 'Taslak' },
  { key: 'archived', label: 'Arşiv' },
  { key: 'nostock',  label: 'Stokta Yok' },
];

const CHANNEL_META: Record<string, { label: string; favicon: string }> = {
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com' },
  n11:      { label: 'N11',         favicon: 'n11.com' },
  ikas:     { label: 'İkas',        favicon: 'ikas.com' },
  shopify:  { label: 'Shopify',     favicon: 'shopify.com' },
  ticimax:  { label: 'Ticimax',     favicon: 'ticimax.com' },
  ideasoft: { label: 'İdeasoft',    favicon: 'ideasoft.com' },
};

const PAGE_SIZE        = 50;   // ana liste sayfalama
const INITIAL_COUNT    = 20;   // toplu düzenleme ilk yükleme
const LOAD_MORE_COUNT  = 5;    // toplu düzenleme her seferinde

const CATEGORIES = ['Telefon','Bilgisayar','Tablet','Aksesuar','Ses Sistemleri','Monitör','Televizyon','Ev Elektroniği','Fotoğraf'];

type FilterState = {
  categories: string[];
  priceMin: string;
  priceMax: string;
  stockMin: string;
  stockMax: string;
  productType: '' | 'simple' | 'variant';
  vatRate: string;
  hasShopify: '' | 'yes' | 'no';
};
const EMPTY_FILTER: FilterState = {
  categories: [], priceMin: '', priceMax: '',
  stockMin: '', stockMax: '',
  productType: '', vatRate: '', hasShopify: '',
};

const KDV_RATES_BULK = [0, 1, 8, 10, 18, 20];

type ColLevel = 'product' | 'variant';
type BulkCol = {
  key: string; label: string;
  type: 'text' | 'number' | 'status' | 'category' | 'media' | 'tags' | 'vat_rate' | 'vat_included';
  width: number; level: ColLevel;
};
// 'name' is always the sticky first column — not included here
const BULK_COLS: BulkCol[] = [
  { key: 'media',                label: 'Medya',                type: 'media',       width: 80,  level: 'product' },
  { key: 'status',               label: 'Durum',                type: 'status',      width: 130, level: 'product' },
  { key: 'category',             label: 'Ürün Kategorisi',      type: 'category',    width: 180, level: 'product' },
  { key: 'description',          label: 'Açıklama',             type: 'text',        width: 220, level: 'product' },
  { key: 'tags',                 label: 'Etiketler',            type: 'tags',        width: 180, level: 'product' },
  { key: 'vat_rate',             label: 'KDV (%)',              type: 'vat_rate',    width: 100, level: 'product' },
  { key: 'vat_included',         label: 'KDV Tipi',             type: 'vat_included',width: 130, level: 'product' },
  { key: 'sku',                  label: 'SKU',                  type: 'text',        width: 140, level: 'variant' },
  { key: 'price',                label: 'Perakende Fiyat (₺)',  type: 'number',      width: 150, level: 'variant' },
  { key: 'discounted_price',     label: 'Perakende İnd. (₺)',   type: 'number',      width: 150, level: 'variant' },
  { key: 'b2b_price',            label: 'Toptan Fiyat (₺)',     type: 'number',      width: 140, level: 'variant' },
  { key: 'b2b_disc',             label: 'Toptan İnd. (₺)',      type: 'number',      width: 140, level: 'variant' },
  { key: 'stock',                label: 'Stok',                 type: 'number',      width: 100, level: 'variant' },
  { key: 'cost',                 label: 'Maliyet (₺)',          type: 'number',      width: 110, level: 'variant' },
  { key: 'barcode',              label: 'Barkod',               type: 'text',        width: 150, level: 'variant' },
  { key: 'weight',               label: 'Ağırlık (kg)',         type: 'number',      width: 110, level: 'variant' },
];

function getCombinations(options: { values: string[] }[]): string[] {
  const filled = options.filter(o => o.values.length > 0);
  if (!filled.length) return [];
  let combos: string[][] = [[]];
  for (const opt of filled) combos = combos.flatMap(c => opt.values.map(v => [...c, v]));
  return combos.map(c => c.join(' / '));
}

export default function Products() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  // allProducts: sunucudan gelen tam liste (status filtresi yok) — sayaçlar buradan hesaplanır
  const [allProducts, setAllProducts]         = useState<Product[]>([]);
  const [shopifyMappings, setShopifyMappings] = useState<Record<string, ShopifyMapping>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [bulkVisibleProducts, setBulkVisibleProducts] = useState(INITIAL_COUNT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<Record<string, Record<string, string>>>({});
  const [bulkVarData, setBulkVarData] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [bulkMediaData, setBulkMediaData] = useState<Record<string, import('../types').MediaItem[]>>({}); // id → güncel media dizisi
  const [mediaPopover, setMediaPopover] = useState<{ productId: string; x: number; y: number } | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(['media', 'status', 'category', 'sku', 'price', 'stock'])
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile]           = useState<File | null>(null);
  const [importLoading, setImportLoading]     = useState(false);
  const [importResult, setImportResult]       = useState<{ created: number; updated: number; total: number; errors: { row: number; message: string }[] } | null>(null);
  const [importDragOver, setImportDragOver]   = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [filterOpen, setFilterOpen]           = useState(false);
  const [filters, setFilters]                 = useState<FilterState>(EMPTY_FILTER);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => Object.fromEntries(BULK_COLS.map(c => [c.key, c.width])));
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const dragFillRef         = useRef<{ colKey: string; value: string; startIdx: number } | null>(null);
  const dragEndIdxRef       = useRef<number | null>(null);
  const flatRowsRef         = useRef<Array<{ type: 'product'; id: string } | { type: 'variant'; productId: string; combo: string }>>([]);
  const allProductsRef      = useRef<Product[]>([]);
  const initialBulkDataRef  = useRef<{ data: Record<string, Record<string, string>>; varData: Record<string, Record<string, Record<string, string>>> }>({ data: {}, varData: {} });
  const colResizeRef        = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const colWidthsRef        = useRef<Record<string, number>>({});
  const sentinelRef         = useRef<HTMLTableRowElement>(null); // infinite scroll sentinel
  const searchTimer         = useRef<ReturnType<typeof setTimeout>>();
  const tableContainerRef   = useRef<HTMLDivElement>(null); // bulk edit scroll

  // Sunucuya sadece arama filtresi gönder; durum filtresi client-side yapılır
  const load = (q: string) => {
    setLoading(true);
    api.products.list({ search: q || undefined, limit: 500 })
      .then(r => {
        setAllProducts(r.products);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
    api.shopify.getMappings().then(setShopifyMappings).catch(() => {});
  }, []);

  useEffect(() => {
    const onUp = () => {
      const drag   = dragFillRef.current;
      const endIdx = dragEndIdxRef.current;
      if (drag && endIdx !== null && endIdx !== drag.startIdx) {
        const { colKey, value, startIdx } = drag;
        const lo  = Math.min(startIdx, endIdx);
        const hi  = Math.max(startIdx, endIdx);
        const col = BULK_COLS.find(c => c.key === colKey);
        if (col) {
          flatRowsRef.current.forEach((row, idx) => {
            if (idx === startIdx || idx < lo || idx > hi) return;
            if (row.type === 'product') {
              const p = allProductsRef.current.find(x => x.id === row.id);
              if (p?.has_variants && col.level === 'variant') return;
              setBulkEditData(prev => ({ ...prev, [row.id]: { ...(prev[row.id] || {}), [colKey]: value } }));
            } else {
              if (col.level === 'product') return;
              setBulkVarData(prev => ({
                ...prev,
                [row.productId]: { ...(prev[row.productId] || {}),
                  [row.combo]: { ...((prev[row.productId] || {})[row.combo] || {}), [colKey]: value } },
              }));
            }
          });
        }
      }
      dragFillRef.current = null;
      dragEndIdxRef.current = null;
      setDragEndIdx(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // Toplu düzenleme infinite scroll — IntersectionObserver sentinel yaklaşımı
  // Scroll event rapid-fire sorununu tamamen çözer: sentinel görünüme girince bir kez tetikler,
  // hemen disconnect eder, setState sonrası re-render'da yeniden bağlanır.
  useEffect(() => {
    if (!bulkEditMode) return;
    let observer: IntersectionObserver | null = null;
    const frameId = requestAnimationFrame(() => {
      const sentinel = sentinelRef.current;
      const root     = tableContainerRef.current;
      if (!sentinel || !root) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          observer?.disconnect(); // tek seferlik tetikle — rapid-fire engeli
          observer = null;
          setBulkVisibleProducts(prev => {
            const total = Object.keys(bulkEditData).length;
            return prev < total ? Math.min(prev + LOAD_MORE_COUNT, total) : prev;
          });
        },
        { threshold: 0, root }
      );
      observer.observe(sentinel);
    });
    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkEditMode, bulkVisibleProducts]);

  // Sütun genişliği sürükleme
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!colResizeRef.current) return;
      const { colKey, startX, startWidth } = colResizeRef.current;
      const newWidth = Math.max(70, startWidth + (e.clientX - startX));
      setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const onUp = () => { colResizeRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
    setSelected(new Set());
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(q), 300);
  };

  // Benzersiz kategoriler (filtre paneli için)
  const uniqueCategories = [...new Set(allProducts.flatMap(p => p.category ?? []).filter(Boolean))].sort();

  // Aktif filtre sayısı (badge için)
  const activeFilterCount =
    filters.categories.length +
    (filters.priceMin ? 1 : 0) + (filters.priceMax ? 1 : 0) +
    (filters.stockMin ? 1 : 0) + (filters.stockMax ? 1 : 0) +
    (filters.productType ? 1 : 0) + (filters.vatRate ? 1 : 0) +
    (filters.hasShopify ? 1 : 0);

  // Aktif tab'a ve uygulanan filtrelere göre client-side filtreleme
  const filteredProducts = (() => {
    let list = activeTab === 'all'     ? allProducts
             : activeTab === 'nostock' ? allProducts.filter(p => p.stock === 0)
             : allProducts.filter(p => p.status === activeTab);

    if (filters.categories.length > 0)
      list = list.filter(p => (p.category ?? []).some(c => filters.categories.includes(c)));
    if (filters.priceMin !== '')
      list = list.filter(p => p.price >= parseFloat(filters.priceMin));
    if (filters.priceMax !== '')
      list = list.filter(p => p.price <= parseFloat(filters.priceMax));
    if (filters.stockMin !== '')
      list = list.filter(p => p.stock >= parseInt(filters.stockMin));
    if (filters.stockMax !== '')
      list = list.filter(p => p.stock <= parseInt(filters.stockMax));
    if (filters.productType === 'simple')
      list = list.filter(p => !p.has_variants);
    if (filters.productType === 'variant')
      list = list.filter(p => p.has_variants);
    if (filters.vatRate !== '')
      list = list.filter(p => String(p.vat_rate) === filters.vatRate);
    if (filters.hasShopify === 'yes')
      list = list.filter(p => !!shopifyMappings[p.id]);
    if (filters.hasShopify === 'no')
      list = list.filter(p => !shopifyMappings[p.id]);

    return list;
  })();

  // Sayfalama
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const products   = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE);

  // Sayfa numarası düğmeleri (maks 5 görünür)
  const pageNumbers = (() => {
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, safePage - delta); i <= Math.min(totalPages, safePage + delta); i++) range.push(i);
    if (range[0] > 1) { range.unshift(-1); range.unshift(1); }
    if (range[range.length - 1] < totalPages) { range.push(-2); range.push(totalPages); }
    return range;
  })();

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filteredProducts.map(p => p.id)) : new Set());
  };

  const handleBulkStatus = async (status: 'active' | 'draft' | 'archived') => {
    setBulkUpdating(true);
    const ids = [...selected];
    const labels: Record<string, string> = { active: 'Aktif', draft: 'Taslak', archived: 'Arşiv' };
    try {
      // PATCH — sadece status gönder, diğer alanları bozmaz
      await Promise.all(ids.map(id => api.products.patch(id, { status })));

      // Lokal state güncelle
      setAllProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, status } : p));
      setSelected(new Set());
      showToast('Güncellendi', `${ids.length} ürün "${labels[status]}" yapıldı.`, 'success');

      // Shopify mapping'i olan ürünleri arka planda sync et
      const mapped = ids.filter(id => shopifyMappings[id]);
      if (mapped.length > 0) {
        Promise.allSettled(
          mapped.map(id => api.shopify.syncProduct(id, ['productInfo']))
        ).then(results => {
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) showToast('Uyarı', `${mapped.length - failed}/${mapped.length} Shopify sync tamamlandı.`, 'warning');
        });
      }
    } catch (err: any) {
      showToast('Hata', err?.message || 'Durum güncellenemedi.', 'error');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkUpdating(true);
    try {
      await Promise.all([...selected].map(id => api.products.delete(id)));
      setAllProducts(prev => prev.filter(p => !selected.has(p.id)));
      setTotal(prev => prev - selected.size);
      setSelected(new Set());
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleImportCSV = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const csv = await importFile.text();
      const result = await api.products.importCsv(csv);
      setImportResult(result);
      if (result.created > 0 || result.updated > 0) {
        load(search); // listeyi yenile
        showToast('Aktarım Tamamlandı', `${result.created} oluşturuldu, ${result.updated} güncellendi.`, 'success');
      }
    } catch (err: any) {
      showToast('Hata', err.message || 'Aktarım başarısız.', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ornek-urun-aktarimi.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const selectedProducts = allProducts.filter(p => selected.has(p.id));
    const escape = (val: string | number | boolean | null | undefined) => {
      const s = val == null ? '' : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [
      'id', 'name', 'status', 'category', 'description',
      'price', 'discounted_price', 'b2b_price', 'b2b_discounted_price',
      'cost', 'sku', 'barcode', 'stock', 'weight',
      'tags', 'vat_rate', 'vat_included', 'has_variants',
      'variant_combo', 'variant_price', 'variant_disc',
      'variant_b2b_price', 'variant_b2b_disc',
      'variant_stock', 'variant_sku', 'variant_barcode', 'variant_weight',
    ];
    const rows: string[][] = [headers];
    for (const p of selectedProducts) {
      const baseRow = [
        p.id, p.name, p.status, (p.category ?? []).join(';'), p.description || '',
        String(p.price ?? ''),
        p.discounted_price != null ? String(p.discounted_price) : '',
        p.b2b_price != null ? String(p.b2b_price) : '',
        p.b2b_discounted_price != null ? String(p.b2b_discounted_price) : '',
        String(p.cost ?? ''), p.sku || '', p.barcode || '',
        String(p.stock ?? ''), String(p.weight ?? ''),
        (p.tags || []).join(';'), String(p.vat_rate ?? ''),
        p.vat_included ? '1' : '0', p.has_variants ? '1' : '0',
      ];
      if (p.has_variants && p.variant_data) {
        const combos = getCombinations(p.variant_options || []);
        if (combos.length > 0) {
          combos.forEach(combo => {
            const vd = p.variant_data[combo] || {};
            rows.push([...baseRow, combo, vd.price || '', vd.disc || '', vd.b2b_price || '', vd.b2b_disc || '', vd.stock || '', vd.sku || '', vd.barcode || '', vd.weight || '']);
          });
        } else {
          rows.push([...baseRow, '', '', '', '', '', '', '', '', '']);
        }
      } else {
        rows.push([...baseRow, '', '', '', '', '', '', '', '', '']);
      }
    }
    const csv = rows.map(row => row.map(escape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `urunler-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const openBulkEdit = () => {
    const data: Record<string, Record<string, string>> = {};
    const varData: Record<string, Record<string, Record<string, string>>> = {};
    [...selected].forEach(id => {
      const p = allProducts.find(x => x.id === id);
      if (!p) return;
      data[id] = {
        name:         p.name || '',
        status:       p.status || 'draft',
        category:     (p.category ?? []).join(';'),
        description:  p.description || '',
        tags:         (p.tags || []).join(';'),
        vat_rate:     String(p.vat_rate ?? 20),
        vat_included: p.vat_included ? '1' : '0',
        // variant-level fields (used for simple products)
        price:             String(p.price ?? ''),
        discounted_price:  p.discounted_price != null ? String(p.discounted_price) : '',
        b2b_price:         p.b2b_price != null ? String(p.b2b_price) : '',
        b2b_disc:          p.b2b_discounted_price != null ? String(p.b2b_discounted_price) : '',
        cost:    String(p.cost ?? ''),
        stock:   String(p.stock ?? ''),
        sku:     p.sku || '',
        barcode: p.barcode || '',
        weight:  String(p.weight ?? ''),
      };
      if (p.has_variants) {
        varData[id] = {};
        getCombinations(p.variant_options || []).forEach(combo => {
          const vd = (p.variant_data || {})[combo] || {};
          varData[id][combo] = {
            price:            vd.price || '',
            discounted_price: vd.disc  || '',
            b2b_price:        vd.b2b_price || '',
            b2b_disc:         vd.b2b_disc  || '',
            stock:   vd.stock   || '',
            sku:     vd.sku     || '',
            barcode: vd.barcode || '',
            weight:  vd.weight  || '',
          };
        });
      }
    });
    initialBulkDataRef.current = { data: JSON.parse(JSON.stringify(data)), varData: JSON.parse(JSON.stringify(varData)) };
    setBulkEditData(data);
    setBulkVarData(varData);
    setBulkMediaData({});
    setCollapsed(new Set());
    setBulkVisibleProducts(INITIAL_COUNT);
    setBulkEditMode(true);
    setColPickerOpen(false);
  };

  const saveBulkEdit = async () => {
    setBulkSaving(true);
    try {
      await Promise.all(Object.entries(bulkEditData).map(([id, d]) => {
        const p = allProducts.find(x => x.id === id);
        if (!p) return Promise.resolve();
        // Sunucu tüm alanları bekliyor — mevcut ürünü base alıp sadece değiştirilen alanları override et
        // Kullanıcı medyayı değiştirdiyse yeni diziyi kullan, aksi halde mevcut mediayı koru
        const updatedMedia = bulkMediaData[id] ?? p.media;
        // channels ve variant meta — bulk edit'te değiştirilemiyen alanlar
        const preserved = {
          channels: p.channels,
          media: updatedMedia,
          has_variants: p.has_variants,
          variant_options: p.variant_options,
          variant_data: p.variant_data,
          emoji: p.emoji,
          // Varyantlı ürünlerde de bu alanlar DB'de mevcut
          price: p.price,
          discounted_price: p.discounted_price,
          cost: p.cost,
          sku: p.sku,
          barcode: p.barcode,
          weight: p.weight,
        };
        const base = {
          ...preserved,
          name:         d.name,
          status:       d.status as 'active' | 'draft' | 'archived',
          category:     d.category ? d.category.split(';').filter(Boolean) : [],
          description:  d.description ?? p.description,
          tags:         d.tags ? d.tags.split(';').map(t => t.trim()).filter(Boolean) : p.tags,
          vat_rate:     d.vat_rate !== undefined ? (parseInt(d.vat_rate) || 0) : (p.vat_rate ?? 20),
          vat_included: d.vat_included !== undefined ? d.vat_included === '1' : p.vat_included,
        };
        if (p.has_variants) {
          const varRows = bulkVarData[id] || {};
          const vd: Record<string, VariantDataEntry> = {};
          Object.entries(varRows).forEach(([combo, v]) => {
            vd[combo] = {
              price:     v.price             || undefined,
              disc:      v.discounted_price  || undefined,
              b2b_price: v.b2b_price         || undefined,
              b2b_disc:  v.b2b_disc          || undefined,
              stock:     v.stock   || undefined,
              sku:       v.sku     || undefined,
              barcode:   v.barcode || undefined,
              weight:    v.weight  || undefined,
            };
          });
          const totalStock = Object.values(varRows).reduce((s, v) => s + (parseInt(v.stock||'0')||0), 0);
          return api.products.update(id, { ...base, variant_data: vd, stock: totalStock });
        } else {
          return api.products.update(id, { ...base,
            price:                parseFloat(d.price)            || 0,
            discounted_price:     d.discounted_price ? parseFloat(d.discounted_price) : null,
            b2b_price:            d.b2b_price  ? parseFloat(d.b2b_price)  : null,
            b2b_discounted_price: d.b2b_disc   ? parseFloat(d.b2b_disc)   : null,
            cost:   parseFloat(d.cost)    || 0,
            stock:  parseInt(d.stock)     || 0,
            sku:    d.sku,
            barcode: d.barcode,
            weight: parseFloat(d.weight)  || 0,
          });
        }
      }));
      // Local state'i güncelle
      setAllProducts(prev => prev.map(p => {
        const d = bulkEditData[p.id]; if (!d) return p;
        const updMedia = bulkMediaData[p.id] ?? p.media;
        const base = {
          ...p,
          name:         d.name,
          status:       d.status as 'active' | 'draft' | 'archived',
          category:     d.category ? d.category.split(';').filter(Boolean) : [],
          description:  d.description ?? p.description,
          tags:         d.tags ? d.tags.split(';').map((t: string) => t.trim()).filter(Boolean) : p.tags,
          vat_rate:     d.vat_rate !== undefined ? (parseInt(d.vat_rate) || 0) : p.vat_rate,
          vat_included: d.vat_included !== undefined ? d.vat_included === '1' : p.vat_included,
          media:        updMedia,
        };
        if (p.has_variants) {
          const varRows = bulkVarData[p.id] || {};
          const vd: Record<string, VariantDataEntry> = {};
          Object.entries(varRows).forEach(([combo, v]) => {
            vd[combo] = { price: v.price, disc: v.discounted_price, b2b_price: v.b2b_price, b2b_disc: v.b2b_disc, stock: v.stock, sku: v.sku, barcode: v.barcode, weight: v.weight };
          });
          return { ...base, variant_data: vd, stock: Object.values(varRows).reduce((s, v) => s + (parseInt(v.stock||'0')||0), 0) };
        }
        return { ...base,
          price:                parseFloat(d.price)           || 0,
          discounted_price:     d.discounted_price ? parseFloat(d.discounted_price) : null,
          b2b_price:            d.b2b_price ? parseFloat(d.b2b_price) : null,
          b2b_discounted_price: d.b2b_disc  ? parseFloat(d.b2b_disc)  : null,
          cost:   parseFloat(d.cost)   || 0,
          stock:  parseInt(d.stock)    || 0,
          sku:    d.sku, barcode: d.barcode, weight: parseFloat(d.weight) || 0,
        };
      }));
      setBulkMediaData({});
      // Kaydedilen veriyi yeni "başlangıç" olarak işaretle — kaydet butonu tekrar pasif olur
      initialBulkDataRef.current = {
        data: JSON.parse(JSON.stringify(bulkEditData)),
        varData: JSON.parse(JSON.stringify(bulkVarData)),
      };
      showToast('Kaydedildi', `${Object.keys(bulkEditData).length} ürün başarıyla güncellendi.`, 'success');
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Kaydetme sırasında bir hata oluştu.', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const applyFill = (
    row: { type: 'product'; id: string } | { type: 'variant'; productId: string; combo: string },
    colKey: string, value: string
  ) => {
    const col = BULK_COLS.find(c => c.key === colKey);
    if (!col) return;
    if (row.type === 'product') {
      const p = allProducts.find(x => x.id === row.id);
      if (p?.has_variants && col.level === 'variant') return; // dash hücre
      setBulkEditData(prev => ({ ...prev, [row.id]: { ...(prev[row.id] || {}), [colKey]: value } }));
    } else {
      if (col.level === 'product') return; // dash hücre
      setBulkVarData(prev => ({
        ...prev,
        [row.productId]: { ...(prev[row.productId] || {}),
          [row.combo]: { ...((prev[row.productId] || {})[row.combo] || {}), [colKey]: value } }
      }));
    }
  };

  // Refs her render'da güncellenir — mouseup handler stale closure'dan kurtulur
  allProductsRef.current = allProducts;
  dragEndIdxRef.current  = dragEndIdx;
  colWidthsRef.current   = colWidths;

  // Bulk edit: ürün + varyant satırlarını düzleştir
  const flatRows = Object.keys(bulkEditData).flatMap(id => {
    const p = allProducts.find(x => x.id === id);
    const rows: Array<{ type: 'product'; id: string } | { type: 'variant'; productId: string; combo: string }> = [{ type: 'product', id }];
    if (p?.has_variants && !collapsed.has(id))
      getCombinations(p.variant_options || []).forEach(combo => rows.push({ type: 'variant', productId: id, combo }));
    return rows;
  });
  flatRowsRef.current = flatRows;
  // Görünür satırlar: ilk bulkVisibleProducts kadar ürün (variant alt satırlarıyla birlikte)
  const visibleFlatRows = (() => {
    let count = 0;
    const result: typeof flatRows = [];
    for (const row of flatRows) {
      if (row.type === 'product') count++;
      if (count > bulkVisibleProducts) break;
      result.push(row);
    }
    return result;
  })();
  const hasMoreBulkRows = visibleFlatRows.length < flatRows.length;

  // Sayaçlar her zaman tam listeden hesaplanır
  const activeCount   = allProducts.filter(p => p.status === 'active').length;
  const draftCount    = allProducts.filter(p => p.status === 'draft').length;
  const archivedCount = allProducts.filter(p => p.status === 'archived').length;
  const noStockCount  = allProducts.filter(p => p.stock === 0).length;

  const tabCount = (key: string) => {
    if (key === 'all')      return total;
    if (key === 'active')   return activeCount;
    if (key === 'draft')    return draftCount;
    if (key === 'archived') return archivedCount;
    if (key === 'nostock')  return noStockCount;
    return 0;
  };

  return (
    <Layout title="Ürünler">
      <div className="page-header">
        <div>
          <div className="page-title">Ürün Yönetimi</div>
          <div className="page-subtitle">Ürünlerinizi ekleyin, düzenleyin ve pazaryerlerine gönderin</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => { setImportFile(null); setImportResult(null); setImportModalOpen(true); }}>
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            İçe Aktar
          </button>
          <Link to="/products/new" className="btn btn-primary">
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ürün Ekle
          </Link>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--primary-light)', border: '1px solid var(--primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginRight: 4 }}>
            {selected.size} ürün seçildi
          </span>

          {/* Ayırıcı */}
          <div style={{ width: 1, height: 18, background: 'var(--primary)', opacity: .25 }} />

          {/* Dışa Aktar */}
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, background: '#0ea5e9', color: '#fff', border: 'none' }}
            disabled={bulkUpdating}
            onClick={handleExportCSV}
          >
            ↓ Dışa Aktar
          </button>

          {/* Ayırıcı */}
          <div style={{ width: 1, height: 18, background: 'var(--primary)', opacity: .25 }} />

          {/* Toplu durum değiştirme */}
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, background: 'var(--success)', color: '#fff', border: 'none' }}
            disabled={bulkUpdating}
            onClick={() => handleBulkStatus('active')}
          >
            ✓ Aktif Yap
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, background: '#F59E0B', color: '#fff', border: 'none' }}
            disabled={bulkUpdating}
            onClick={() => handleBulkStatus('draft')}
          >
            ✎ Taslağa Al
          </button>
          <button
            className="btn btn-sm"
            style={{ fontSize: 12, background: 'var(--text-muted)', color: '#fff', border: 'none' }}
            disabled={bulkUpdating}
            onClick={() => handleBulkStatus('archived')}
          >
            ⊘ Arşive Al
          </button>

          <button
            className="btn btn-sm"
            style={{ fontSize: 12, background: 'var(--primary)', color: '#fff', border: 'none' }}
            disabled={bulkUpdating}
            onClick={openBulkEdit}
          >
            ✏ Toplu Düzenle
          </button>

          {/* Ayırıcı */}
          <div style={{ width: 1, height: 18, background: 'var(--primary)', opacity: .25 }} />

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} disabled={bulkUpdating} onClick={() => setSelected(new Set())}>
              Seçimi Kaldır
            </button>
            <button
              className="btn btn-sm"
              style={{ fontSize: 12, background: 'var(--danger)', color: '#fff', border: 'none' }}
              disabled={bulkUpdating}
              onClick={handleBulkDelete}
            >
              {bulkUpdating ? 'İşleniyor…' : 'Sil'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {/* Tabs */}
        <div className="tabs">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
              {' '}
              <span style={{ color: t.key === 'nostock' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {tabCount(t.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="form-control"
              placeholder="Ürün adı, SKU veya barkod ara..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <button
            className={`btn btn-sm${filterOpen || activeFilterCount > 0 ? ' btn-primary' : ' btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}
            onClick={() => setFilterOpen(v => !v)}
          >
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            Filtrele
            {activeFilterCount > 0 && (
              <span style={{
                background: '#fff', color: 'var(--primary)', borderRadius: 10,
                padding: '1px 6px', fontSize: 11, fontWeight: 700, lineHeight: '16px',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
              onClick={() => setFilters(EMPTY_FILTER)}
            >
              ✕ Temizle
            </button>
          )}
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-soft, #f8f9fa)',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '20px 28px',
          }}>
            {/* Kategori */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Kategori
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
                {uniqueCategories.map(cat => (
                  <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(cat)}
                      onChange={e => setFilters(f => ({
                        ...f,
                        categories: e.target.checked
                          ? [...f.categories, cat]
                          : f.categories.filter(c => c !== cat),
                      }))}
                    />
                    {cat}
                  </label>
                ))}
                {uniqueCategories.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kategori bulunamadı</span>
                )}
              </div>
            </div>

            {/* Fiyat Aralığı */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Fiyat Aralığı (₺)
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number" min={0} placeholder="Min"
                  className="form-control"
                  style={{ flex: 1, fontSize: 13, padding: '5px 8px' }}
                  value={filters.priceMin}
                  onChange={e => setFilters(f => ({ ...f, priceMin: e.target.value }))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                <input
                  type="number" min={0} placeholder="Maks"
                  className="form-control"
                  style={{ flex: 1, fontSize: 13, padding: '5px 8px' }}
                  value={filters.priceMax}
                  onChange={e => setFilters(f => ({ ...f, priceMax: e.target.value }))}
                />
              </div>
            </div>

            {/* Stok Aralığı */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Stok Aralığı
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number" min={0} placeholder="Min"
                  className="form-control"
                  style={{ flex: 1, fontSize: 13, padding: '5px 8px' }}
                  value={filters.stockMin}
                  onChange={e => setFilters(f => ({ ...f, stockMin: e.target.value }))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                <input
                  type="number" min={0} placeholder="Maks"
                  className="form-control"
                  style={{ flex: 1, fontSize: 13, padding: '5px 8px' }}
                  value={filters.stockMax}
                  onChange={e => setFilters(f => ({ ...f, stockMax: e.target.value }))}
                />
              </div>
            </div>

            {/* Ürün Tipi */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Ürün Tipi
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {([['', 'Tümü'], ['simple', 'Basit Ürün'], ['variant', 'Varyantlı Ürün']] as const).map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="productType"
                      checked={filters.productType === val}
                      onChange={() => setFilters(f => ({ ...f, productType: val }))}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {/* KDV Oranı */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                KDV Oranı
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {([['', 'Tümü'], ['0', '%0'], ['10', '%10'], ['20', '%20']] as const).map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="vatRate"
                      checked={filters.vatRate === val}
                      onChange={() => setFilters(f => ({ ...f, vatRate: val }))}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {/* Shopify Entegrasyonu */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Shopify Entegrasyonu
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {([['', 'Tümü'], ['yes', 'Entegre'], ['no', 'Entegre Değil']] as const).map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="hasShopify"
                      checked={filters.hasShopify === val}
                      onChange={() => setFilters(f => ({ ...f, hasShopify: val }))}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {/* Paneli kapat / temizle */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              {activeFilterCount > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setFilters(EMPTY_FILTER)}>
                  Filtreleri Temizle
                </button>
              )}
              <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }} onClick={() => setFilterOpen(false)}>
                Uygula ({filteredProducts.length} ürün)
              </button>
            </div>
          </div>
        )}

        {/* Aktif filtre chip'leri */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {filters.categories.map(cat => (
              <span key={cat} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--primary-light)', color: 'var(--primary)',
                border: '1px solid var(--primary)', borderRadius: 20,
                fontSize: 12, padding: '2px 10px',
              }}>
                {cat}
                <button onClick={() => setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== cat) }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            ))}
            {(filters.priceMin || filters.priceMax) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 20, fontSize: 12, padding: '2px 10px' }}>
                Fiyat: {filters.priceMin || '0'} — {filters.priceMax || '∞'} ₺
                <button onClick={() => setFilters(f => ({ ...f, priceMin: '', priceMax: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            )}
            {(filters.stockMin || filters.stockMax) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 20, fontSize: 12, padding: '2px 10px' }}>
                Stok: {filters.stockMin || '0'} — {filters.stockMax || '∞'}
                <button onClick={() => setFilters(f => ({ ...f, stockMin: '', stockMax: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            )}
            {filters.productType && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 20, fontSize: 12, padding: '2px 10px' }}>
                {filters.productType === 'simple' ? 'Basit Ürün' : 'Varyantlı Ürün'}
                <button onClick={() => setFilters(f => ({ ...f, productType: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            )}
            {filters.vatRate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 20, fontSize: 12, padding: '2px 10px' }}>
                KDV: %{filters.vatRate}
                <button onClick={() => setFilters(f => ({ ...f, vatRate: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            )}
            {filters.hasShopify && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 20, fontSize: 12, padding: '2px 10px' }}>
                Shopify: {filters.hasShopify === 'yes' ? 'Entegre' : 'Entegre Değil'}
                <button onClick={() => setFilters(f => ({ ...f, hasShopify: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }}>✕</button>
              </span>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : products.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <h3>Ürün bulunamadı</h3>
            <p>Arama kriterlerinizi değiştirmeyi deneyin.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table id="productsTable">
              <thead>
                <tr>
                  <th><input type="checkbox" id="checkAll" checked={filteredProducts.length > 0 && filteredProducts.every(p => selected.has(p.id))} onChange={e => toggleAll(e.target.checked)} /></th>
                  <th>Ürün</th>
                  <th>Ürün Tipi</th>
                  <th>Kategori</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Kanallar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const st          = statusLabel(p.status);
                  const isVariant   = p.has_variants;
                  const isExpanded  = expanded.has(p.id);
                  const combos      = isVariant ? getCombinations(p.variant_options || []) : [];

                  // ── Fiyat hesapları ──────────────────────────────────────────
                  const priceCell = (() => {
                    // Varyantlı ürünlerde en ucuz varyantın fiyat/indirim bilgisini al
                    let displayPrice    = p.price;
                    let displayOriginal = p.discounted_price && p.discounted_price > 0 && p.discounted_price < p.price
                      ? p.price : null;
                    let displaySelling  = displayOriginal ? p.discounted_price! : p.price;

                    if (isVariant) {
                      const combos = getCombinations(p.variant_options || []);
                      let minSelling = Infinity;
                      let minOriginal: number | null = null;
                      for (const combo of combos) {
                        const vd = (p.variant_data || {})[combo] || {};
                        const hasDisc = vd.disc && parseFloat(vd.disc) > 0;
                        const selling = hasDisc ? parseFloat(vd.disc!) : parseFloat(vd.price || '0') || p.price;
                        if (selling > 0 && selling < minSelling) {
                          minSelling  = selling;
                          minOriginal = hasDisc && vd.price ? parseFloat(vd.price) : null;
                        }
                      }
                      displaySelling  = minSelling === Infinity ? p.price : minSelling;
                      displayOriginal = minOriginal && minOriginal > displaySelling ? minOriginal : null;
                    }

                    if (displayOriginal && displayOriginal > displaySelling) {
                      const pct = Math.round((1 - displaySelling / displayOriginal) * 100);
                      return (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>{formatMoney(displaySelling)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {formatMoney(displayOriginal)}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
                              %{pct}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return <div style={{ fontWeight: 600 }}>{formatMoney(displaySelling)}</div>;
                  })();

                  // ── Stok gösterimi ───────────────────────────────────────────
                  const stockCell = (() => {
                    const isLow  = p.stock > 0 && p.stock <= 5;
                    const color  = p.stock === 0 ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text)';
                    const label  = p.stock === 0 ? 'Stok Yok' : `${p.stock} adet`;
                    if (isVariant) {
                      const varCount = getCombinations(p.variant_options || []).length;
                      return (
                        <div>
                          <span style={{ color, fontWeight: isLow || p.stock === 0 ? 600 : 400 }}>{label}</span>
                          {varCount > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                              {varCount} varyasyon için
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <span style={{ color, fontWeight: isLow || p.stock === 0 ? 600 : 400 }}>{label}</span>
                    );
                  })();

                  return (
                  <React.Fragment key={p.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${p.id}`)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                            {p.media?.[0]?.src
                              ? <img src={p.media[0].src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : p.emoji}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          {isVariant && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }); }}
                              style={{ marginLeft: 2, background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: 4, flexShrink: 0 }}
                              title={isExpanded ? 'Varyantları gizle' : 'Varyantları göster'}
                            >
                              <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{ transition: 'transform .18s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>
                          {isVariant ? 'Varyant' : 'Basit'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(p.category ?? []).join(', ')}</td>
                      <td>{priceCell}</td>
                      <td>{stockCell}</td>
                      <td>
                        {(() => {
                          // Shopify: channels'da VE mapping'de olmalı
                          // Diğerleri: sadece channels'da olması yeterli
                          const activeChannels = p.channels.filter(ch => {
                            if (ch === 'shopify') return !!shopifyMappings[p.id];
                            return true;
                          });
                          // Shopify eşleştirmesi varsa ama channels'da yoksa da göster
                          if (shopifyMappings[p.id] && !activeChannels.includes('shopify')) {
                            activeChannels.push('shopify');
                          }
                          if (activeChannels.length === 0) {
                            return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>;
                          }
                          return (
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                              {activeChannels.slice(0, 4).map(ch => {
                                const m = CHANNEL_META[ch];
                                return m ? (
                                  <img key={ch}
                                    src={`https://www.google.com/s2/favicons?domain=${m.favicon}&sz=32`}
                                    title={m.label} alt={m.label}
                                    style={{ width: 16, height: 16, borderRadius: 3 }} />
                                ) : null;
                              })}
                              {activeChannels.length > 4 && (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{activeChannels.length - 4}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>

                    {/* ── Varyant detay satırları — ana sütunlara hizalı ── */}
                    {isVariant && isExpanded && combos.map((combo, ci) => {
                      const vd      = (p.variant_data || {})[combo] || {};
                      const hasDisc = vd.disc && parseFloat(vd.disc) > 0;
                      const selling = hasDisc ? parseFloat(vd.disc!) : parseFloat(vd.price || '0') || 0;
                      const original= hasDisc && vd.price ? parseFloat(vd.price) : null;
                      const stock   = parseInt(vd.stock || '0') || 0;
                      const isLow   = stock > 0 && stock <= 5;
                      const isLast  = ci === combos.length - 1;
                      return (
                        <tr key={`${p.id}-${combo}`} style={{ background: 'var(--bg)' }}>
                          {/* checkbox — boş */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)' }} />
                          {/* Ürün — girinti + varyant adı */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)', padding: '7px 12px 7px 56px' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{combo}</span>
                          </td>
                          {/* Ürün Tipi — boş */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)' }} />
                          {/* Kategori — boş */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)' }} />
                          {/* Fiyat — hizalı */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)', padding: '7px 12px' }}>
                            {selling > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: hasDisc ? '#dc2626' : 'var(--text)' }}>
                                  {formatMoney(selling)}
                                </span>
                                {original && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                    {formatMoney(original)}
                                  </span>
                                )}
                              </div>
                            ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          {/* Stok — hizalı */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)', padding: '7px 12px', fontSize: 12, fontWeight: isLow || stock === 0 ? 600 : 400, color: stock === 0 ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text)' }}>
                            {stock === 0 ? 'Stok Yok' : `${stock} adet`}
                          </td>
                          {/* Kanallar + Durum — boş */}
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)' }} />
                          <td style={{ borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)' }} />
                        </tr>
                      );
                    })}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            {filteredProducts.length === 0 ? '0 ürün' : `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filteredProducts.length)} / ${filteredProducts.length} ürün`}
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-secondary btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}
                disabled={safePage === 1} onClick={() => { setPage(safePage - 1); setSelected(new Set()); }}>
                ‹ Önceki
              </button>
              {pageNumbers.map((n, i) =>
                n < 0 ? (
                  <span key={n + '-' + i} style={{ padding: '0 2px', color: 'var(--text-muted)', fontSize: 12 }}>…</span>
                ) : (
                  <button key={n} className={`btn btn-sm${safePage === n ? ' btn-primary' : ' btn-secondary'}`}
                    style={{ padding: '5px 10px', fontSize: 12, minWidth: 34 }}
                    onClick={() => { setPage(n); setSelected(new Set()); }}>
                    {n}
                  </button>
                )
              )}
              <button className="btn btn-secondary btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}
                disabled={safePage === totalPages} onClick={() => { setPage(safePage + 1); setSelected(new Set()); }}>
                Sonraki ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── BULK EDIT OVERLAY (Shopify style) ────────────────────────────── */}
      {bulkEditMode && (() => {
        const COL_BORDER = '1px solid #E5E7EB';
        const TH: React.CSSProperties = { background: '#F9FAFB', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: '#6B7280', borderBottom: '1px solid #E5E7EB', borderRight: COL_BORDER, whiteSpace: 'nowrap' };
        const hasChanges = (() => {
          if (Object.keys(bulkMediaData).length > 0) return true;
          const init = initialBulkDataRef.current;
          for (const [id, d] of Object.entries(bulkEditData)) {
            const initD = init.data[id] || {};
            for (const [k, v] of Object.entries(d)) { if ((initD[k] ?? '') !== v) return true; }
          }
          for (const [id, combos] of Object.entries(bulkVarData)) {
            const initCombos = init.varData[id] || {};
            for (const [combo, v] of Object.entries(combos)) {
              const initV = initCombos[combo] || {};
              for (const [k, val] of Object.entries(v)) { if ((initV[k] ?? '') !== val) return true; }
            }
          }
          return false;
        })();
        const DASH = (h: number) => <span style={{ display: 'block', textAlign: 'center', color: '#D1D5DB', fontSize: 18, lineHeight: h + 'px' }}>—</span>;
        const iStyle: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#111827', background: 'transparent', fontFamily: 'inherit', padding: '4px 2px' };
        const selStyle: React.CSSProperties = { width: '100%', border: '1px solid #E5E7EB', borderRadius: 5, fontSize: 12, color: '#374151', background: '#fff', fontFamily: 'inherit', padding: '5px 8px', cursor: 'pointer', outline: 'none' };
        return (
          <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 400, display: 'flex', flexDirection: 'column', cursor: dragEndIdx !== null ? 'crosshair' : undefined }} onClick={() => setColPickerOpen(false)}>

            {/* ── Header ── */}
            <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0, zIndex: 10 }}>
              <button onClick={() => { if (hasChanges) { setConfirmExitOpen(true); } else { setBulkEditMode(false); setColPickerOpen(false); } }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 13px', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                Geri
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                {Object.keys(bulkEditData).length} ürün düzenleniyor
              </span>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Column picker */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setColPickerOpen(p => !p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 13px', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                    <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                    Sütunlar
                  </button>
                  {colPickerOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, minWidth: 230, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 16px 8px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #F3F4F6' }}>Sütunları seç</div>
                      {BULK_COLS.map(col => (
                        <label key={col.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F9FAFB'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                        >
                          <input type="checkbox" checked={visibleCols.has(col.key)} style={{ accentColor: '#2563EB', width: 15, height: 15 }}
                            onChange={e => setVisibleCols(prev => { const n = new Set(prev); e.target.checked ? n.add(col.key) : n.delete(col.key); return n; })} />
                          <span style={{ flex: 1 }}>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button disabled={bulkSaving || !hasChanges} onClick={saveBulkEdit}
                  style={{ background: bulkSaving || !hasChanges ? '#D1D5DB' : '#111827', color: bulkSaving || !hasChanges ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: bulkSaving || !hasChanges ? 'default' : 'pointer', transition: 'background .15s' }}>
                  {bulkSaving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* ── Table ── */}
            <div ref={tableContainerRef} style={{ flex: 1, overflow: 'auto' }}>
              <table className="bulk-edit-table" style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 320, minWidth: 320 }} />
                  {BULK_COLS.filter(c => visibleCols.has(c.key)).map(col => (
                    <col key={col.key} style={{ width: colWidths[col.key] ?? col.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 8 }}>
                    <th style={{ ...TH, position: 'sticky', left: 0, zIndex: 9, width: 320, textAlign: 'left' }}>Ürün başlığı</th>
                    {BULK_COLS.filter(c => visibleCols.has(c.key)).map(col => (
                      <th key={col.key} style={{ ...TH, width: colWidths[col.key] ?? col.width, textAlign: col.type === 'number' ? 'right' : 'left', position: 'relative', userSelect: 'none' }}>
                        {col.label}
                        <div
                          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 2 }}
                          onMouseDown={e => {
                            e.preventDefault();
                            colResizeRef.current = { colKey: col.key, startX: e.clientX, startWidth: colWidths[col.key] ?? col.width };
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                          }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleFlatRows.map((row, ri) => {
                    const nextRow = flatRows[ri + 1];
                    const bottomBorder = (!nextRow || nextRow.type === 'product') ? '1px solid #E5E7EB' : '1px solid #F3F4F6';

                    if (row.type === 'product') {
                      const d = bulkEditData[row.id] || {};
                      const p = allProducts.find(x => x.id === row.id);
                      const isCollapsed = collapsed.has(row.id);
                      const hasCombos = p?.has_variants && (p.variant_options || []).some(o => o.values.length > 0);
                      const setProd = (k: string, v: string) => setBulkEditData(prev => ({ ...prev, [row.id]: { ...prev[row.id], [k]: v } }));
                      return (
                        <tr key={'p' + row.id}>
                          <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', borderBottom: bottomBorder, borderLeft: '3px solid #9CA3AF', borderRight: COL_BORDER, padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, paddingRight: 12, paddingLeft: 10 }}>
                              <span style={{ fontSize: 20, flexShrink: 0 }}>{p?.emoji || '📦'}</span>
                              <input style={{ ...iStyle, fontWeight: 600, flex: 1 }} value={d.name || ''} onChange={e => setProd('name', e.target.value)} />
                              {hasCombos && (
                                <button onClick={() => setCollapsed(prev => { const n = new Set(prev); isCollapsed ? n.delete(row.id) : n.add(row.id); return n; })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isCollapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} /></svg>
                                </button>
                              )}
                            </div>
                          </td>
                          {BULK_COLS.filter(c => visibleCols.has(c.key)).map(col => {
                            const showDash = p?.has_variants && col.level === 'variant';
                            const drag = dragFillRef.current;
                            const inFillRange = !showDash && drag && drag.colKey === col.key && dragEndIdx !== null && (() => { const lo = Math.min(drag.startIdx, dragEndIdx); const hi = Math.max(drag.startIdx, dragEndIdx); return ri >= lo && ri <= hi && ri !== drag.startIdx; })();
                            const isSourceCell = !showDash && drag?.colKey === col.key && drag?.startIdx === ri;
                            const isActiveCell = !showDash && activeCell?.rowIdx === ri && activeCell?.colKey === col.key;
                            return (
                              <td key={col.key}
                                className={[!showDash && 'be-cell', inFillRange && 'be-fill-preview', isSourceCell && 'be-filling', isActiveCell && 'be-cell-active'].filter(Boolean).join(' ') || undefined}
                                onMouseEnter={() => {
                                  if (!dragFillRef.current || dragFillRef.current.colKey !== col.key || showDash) return;
                                  setDragEndIdx(ri);
                                }}
                                style={{ borderBottom: bottomBorder, borderRight: COL_BORDER, padding: '0 10px', background: '#fff', textAlign: col.type === 'number' ? 'right' : 'left' }}>
                                {showDash ? DASH(48) : col.type === 'media' ? (() => {
                                  const currentMedia = bulkMediaData[row.id] ?? p?.media ?? [];
                                  const isOpen = mediaPopover?.productId === row.id;
                                  return (
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 8px', height: 48, cursor: 'pointer', outline: isOpen ? '2px solid #2563EB' : undefined, outlineOffset: -2 }}
                                      onClick={e => {
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setMediaPopover(prev => prev?.productId === row.id ? null : { productId: row.id, x: Math.min(rect.left, window.innerWidth - 420), y: rect.bottom + 4 });
                                      }}
                                    >
                                      {currentMedia.length === 0
                                        ? <div style={{ width: 28, height: 28, borderRadius: 4, background: '#F3F4F6', border: '1px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9CA3AF' }}>{p?.emoji || '📦'}</div>
                                        : currentMedia.slice(0, 4).map(m => (
                                            <div key={m.id} style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', border: '1px solid #E5E7EB', flexShrink: 0, background: '#F3F4F6' }}>
                                              {m.src ? <img src={m.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{m.emoji || p?.emoji || '📦'}</div>}
                                            </div>
                                          ))
                                      }
                                    </div>
                                  );
                                })() : col.type === 'status' ? (
                                  <select style={selStyle} value={d.status || 'draft'} onChange={e => setProd('status', e.target.value)}>
                                    <option value="active">Aktif</option><option value="draft">Taslak</option><option value="archived">Arşiv</option>
                                  </select>
                                ) : col.type === 'category' ? (
                                  <input
                                    style={iStyle}
                                    placeholder="Telefon;Bilgisayar"
                                    title="Birden fazla kategori için ; kullanın"
                                    value={d.category || ''}
                                    onChange={e => setProd('category', e.target.value)}
                                    onFocus={() => setActiveCell({ rowIdx: ri, colKey: col.key })}
                                    onBlur={() => setActiveCell(null)}
                                  />
                                ) : col.type === 'tags' ? (
                                  <>
                                    <input
                                      style={iStyle}
                                      placeholder="etiket1;etiket2"
                                      title="Etiketleri ; ile ayırın"
                                      value={d.tags || ''}
                                      onChange={e => setProd('tags', e.target.value)}
                                      onFocus={() => setActiveCell({ rowIdx: ri, colKey: col.key })}
                                      onBlur={() => setActiveCell(null)}
                                    />
                                    <div className="be-fill-handle" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); dragFillRef.current = { colKey: col.key, value: d.tags || '', startIdx: ri }; }} />
                                  </>
                                ) : col.type === 'vat_rate' ? (
                                  <select style={selStyle} value={d.vat_rate ?? '20'} onChange={e => setProd('vat_rate', e.target.value)}>
                                    {KDV_RATES_BULK.map(r => <option key={r} value={r}>%{r}</option>)}
                                  </select>
                                ) : col.type === 'vat_included' ? (
                                  <select style={selStyle} value={d.vat_included ?? '1'} onChange={e => setProd('vat_included', e.target.value)}>
                                    <option value="1">KDV Dahil</option>
                                    <option value="0">KDV Hariç</option>
                                  </select>
                                ) : (
                                  <>
                                    <input style={{ ...iStyle, textAlign: col.type === 'number' ? 'right' : 'left' }} type={col.type === 'number' ? 'number' : 'text'} value={d[col.key] || ''} onChange={e => setProd(col.key, e.target.value)}
                                      onFocus={() => setActiveCell({ rowIdx: ri, colKey: col.key })}
                                      onBlur={() => setActiveCell(null)} />
                                    <div className="be-fill-handle" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); dragFillRef.current = { colKey: col.key, value: d[col.key] || '', startIdx: ri }; }} />
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }

                    // ── Variant row ──
                    const { productId, combo } = row;
                    const varRow = ((bulkVarData[productId] || {})[combo]) || {};
                    const setVar = (k: string, v: string) => setBulkVarData(prev => ({
                      ...prev, [productId]: { ...(prev[productId] || {}), [combo]: { ...((prev[productId] || {})[combo] || {}), [k]: v } }
                    }));
                    return (
                      <tr key={'v' + productId + combo}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', borderBottom: bottomBorder, borderLeft: '3px solid transparent', borderRight: COL_BORDER, padding: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', height: 44, paddingLeft: 56, fontSize: 13, color: '#374151' }}>
                            {combo}
                          </div>
                        </td>
                        {BULK_COLS.filter(c => visibleCols.has(c.key)).map(col => {
                          const showDash = col.level === 'product';
                          const drag = dragFillRef.current;
                          const inFillRange = !showDash && drag && drag.colKey === col.key && dragEndIdx !== null && (() => { const lo = Math.min(drag.startIdx, dragEndIdx); const hi = Math.max(drag.startIdx, dragEndIdx); return ri >= lo && ri <= hi && ri !== drag.startIdx; })();
                          const isSourceCell = !showDash && drag?.colKey === col.key && drag?.startIdx === ri;
                          const isActiveCell = !showDash && activeCell?.rowIdx === ri && activeCell?.colKey === col.key;
                          return (
                            <td key={col.key}
                              className={[!showDash && 'be-cell', inFillRange && 'be-fill-preview', isSourceCell && 'be-filling', isActiveCell && 'be-cell-active'].filter(Boolean).join(' ') || undefined}
                              onMouseEnter={() => {
                                if (!dragFillRef.current || dragFillRef.current.colKey !== col.key || showDash) return;
                                setDragEndIdx(ri);
                              }}
                              style={{ borderBottom: bottomBorder, borderRight: COL_BORDER, padding: '0 10px', background: '#fff', textAlign: col.type === 'number' ? 'right' : 'left' }}>
                              {showDash ? DASH(44) : (
                                <>
                                  <input style={{ ...iStyle, textAlign: col.type === 'number' ? 'right' : 'left' }} type={col.type === 'number' ? 'number' : 'text'} value={varRow[col.key] || ''} onChange={e => setVar(col.key, e.target.value)}
                                    onFocus={() => setActiveCell({ rowIdx: ri, colKey: col.key })}
                                    onBlur={() => setActiveCell(null)} />
                                  <div className="be-fill-handle" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); dragFillRef.current = { colKey: col.key, value: varRow[col.key] || '', startIdx: ri }; }} />
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* ── Daha fazla ürün yükleniyor göstergesi (IntersectionObserver sentinel) ── */}
                  {hasMoreBulkRows && (
                    <tr ref={sentinelRef}>
                      <td colSpan={BULK_COLS.filter(c => visibleCols.has(c.key)).length + 1}
                        style={{ padding: '18px 0', textAlign: 'center', borderTop: '1px solid #F3F4F6', color: '#9CA3AF', fontSize: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                          Kaydırın, daha fazla ürün yükleniyor…
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Medya popover ── */}
            {mediaPopover && (() => {
              const mp = allProducts.find(x => x.id === mediaPopover.productId);
              const currentMedia = bulkMediaData[mediaPopover.productId] ?? mp?.media ?? [];
              const mainItem = currentMedia[0] ?? null;
              const restItems = currentMedia.slice(1);
              const addImg = (file: File) => {
                const reader = new FileReader();
                reader.onload = ev => {
                  if (!ev.target?.result) return;
                  const newItem: import('../types').MediaItem = { id: Date.now(), src: ev.target.result as string };
                  setBulkMediaData(prev => ({ ...prev, [mediaPopover.productId]: [...(prev[mediaPopover.productId] ?? mp?.media ?? []), newItem] }));
                };
                reader.readAsDataURL(file);
              };
              const removeImg = (id: number) => {
                setBulkMediaData(prev => ({ ...prev, [mediaPopover.productId]: (prev[mediaPopover.productId] ?? mp?.media ?? []).filter(m => m.id !== id) }));
              };
              const thumb = (item: import('../types').MediaItem, size: number, main = false) => (
                <div key={item.id}
                  style={{ position: 'relative', width: size, height: size, borderRadius: main ? 8 : 6, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#F3F4F6', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.rm-btn') as HTMLElement | null)?.style.setProperty('opacity','1')}
                  onMouseLeave={e => (e.currentTarget.querySelector('.rm-btn') as HTMLElement | null)?.style.setProperty('opacity','0')}
                >
                  {item.src
                    ? <img src={item.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: main ? 36 : 18 }}>{item.emoji || mp?.emoji || '📦'}</div>
                  }
                  <button className="rm-btn" onClick={() => removeImg(item.id)}
                    style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s', lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              );
              return (
                <>
                  {/* backdrop */}
                  <div style={{ position: 'fixed', inset: 0, zIndex: 490 }} onClick={() => setMediaPopover(null)} />
                  {/* panel */}
                  <div style={{ position: 'fixed', left: mediaPopover.x, top: mediaPopover.y, zIndex: 491, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1px solid #E5E7EB', width: 400, padding: 20 }}
                    onClick={e => e.stopPropagation()}>
                    {/* header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Medya: {mp?.name}</span>
                      <button onClick={() => setMediaPopover(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                    </div>
                    {/* gallery */}
                    {currentMedia.length === 0 ? (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, border: '2px dashed #E5E7EB', borderRadius: 8, cursor: 'pointer', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                          onChange={e => Array.from(e.target.files || []).forEach(addImg)} />
                        <svg width={28} height={28} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Görsel eklemek için tıklayın
                      </label>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {/* main large image */}
                        {mainItem && thumb(mainItem, 148, true)}
                        {/* rest + add */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start', flex: 1 }}>
                          {restItems.map(m => thumb(m, 64))}
                          {/* add button */}
                          <label style={{ width: 64, height: 64, borderRadius: 6, border: '1.5px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 22, background: '#FAFAFA' }}>
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                              onChange={e => Array.from(e.target.files || []).forEach(addImg)} />
                            +
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── Kaydedilmemiş değişiklik uyarısı ── */}
            {confirmExitOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setConfirmExitOpen(false)}>
                <div style={{ background: '#fff', borderRadius: 14, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width={20} height={20} fill="none" stroke="#EF4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Kaydedilmemiş değişiklikler</h2>
                  </div>
                  <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>
                    Kaydedilmemiş değişiklikleriniz var. Çıkarsanız bu değişiklikler kaybolacak.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setConfirmExitOpen(false)}
                      style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                      Kal
                    </button>
                    <button onClick={() => { setBulkEditMode(false); setColPickerOpen(false); setConfirmExitOpen(false); }}
                      style={{ background: '#EF4444', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
                      Çıkış yap
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── CSV İçe Aktarım Modalı ──────────────────────────────────── */}
      <Modal
        open={importModalOpen}
        onClose={() => { if (!importLoading) { setImportModalOpen(false); setImportFile(null); setImportResult(null); } }}
        maxWidth={520}
        title={<><span style={{ fontSize: 18 }}>📥</span> CSV ile Ürün Aktar</>}
        footer={
          importResult ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-primary" onClick={() => { setImportModalOpen(false); setImportFile(null); setImportResult(null); }}>
                Kapat
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={downloadSampleCSV}>
                <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Örnek CSV İndir
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setImportModalOpen(false); setImportFile(null); }} disabled={importLoading}>İptal</button>
                <button className="btn btn-primary" disabled={!importFile || importLoading} onClick={handleImportCSV}>
                  {importLoading ? (
                    <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        style={{ animation: 'spin 1s linear infinite', marginRight: 6 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>Aktarılıyor…</>
                  ) : 'Aktarmayı Başlat'}
                </button>
              </div>
            </div>
          )
        }
      >
        {importResult ? (
          /* ── Sonuç ekranı ── */
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { val: importResult.created, label: 'Oluşturuldu', color: 'var(--success)', bg: '#F0FDF4', icon: '✓' },
                { val: importResult.updated, label: 'Güncellendi', color: '#0369a1',         bg: '#E0F2FE', icon: '↺' },
                { val: importResult.errors.length, label: 'Hata', color: 'var(--danger)', bg: '#FEF2F2', icon: '✕' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderRadius: 'var(--radius-sm)', background: s.bg, border: `1px solid ${s.color}30` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.icon} {s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#FEF2F2', fontSize: 11, fontWeight: 700, color: 'var(--danger)', borderBottom: '1px solid #FCA5A5' }}>
                  HATALI SATIRLAR
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {importResult.errors.map(e => (
                    <div key={e.row} style={{ padding: '7px 12px', fontSize: 12, borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10 }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Satır {e.row}</span>
                      <span style={{ color: 'var(--danger)' }}>{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Yükleme ekranı ── */
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
              CSV dosyasındaki her satır bir ürünü temsil eder. <strong>SKU</strong> alanı mevcut bir ürünle eşleşiyorsa güncellenir; eşleşmiyorsa yeni ürün oluşturulur.
            </div>

            {/* Desteklenen alanlar */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Desteklenen sütunlar:</strong>
              <code style={{ fontSize: 10 }}>name, status, category, price, discounted_price, cost, sku, barcode, stock, weight, tags, vat_rate</code>
              <br />
              <span>• <strong>status</strong>: active / draft / archived &nbsp;•&nbsp; <strong>tags</strong>: noktalı virgülle ayrılmış (örn: <code>elma;telefon</code>)</span>
            </div>

            {/* Dosya yükleme alanı */}
            <input
              ref={importFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = ''; }}
            />
            <div
              onClick={() => importFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={e => { e.preventDefault(); setImportDragOver(false); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
              style={{
                border: `2px dashed ${importDragOver ? 'var(--primary)' : importFile ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: importDragOver ? 'var(--primary)10' : importFile ? '#F0FDF4' : 'var(--bg)',
                transition: 'all .15s',
              }}
            >
              {importFile ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{importFile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {(importFile.size / 1024).toFixed(1)} KB — Dosyayı değiştirmek için tıklayın
                  </div>
                </>
              ) : (
                <>
                  <svg width={32} height={32} fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>CSV dosyasını sürükleyin veya tıklayın</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Yalnızca .csv formatı desteklenir</div>
                </>
              )}
            </div>
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Modal>

    </Layout>
  );
}

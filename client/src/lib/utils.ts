export function formatMoney(n: number): string {
  return '₺' + n.toLocaleString('tr-TR');
}

export function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function rInt(seed: number, n: number, max: number): number {
  return Math.floor(seededRand(seed * 37 + n * 13) * max);
}

export function statusLabel(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    new:       { label: 'Yeni',          cls: 'badge-info' },
    preparing: { label: 'Hazırlanıyor',  cls: 'badge-warning' },
    shipped:   { label: 'Kargoda',       cls: 'badge-primary' },
    delivered: { label: 'Teslim Edildi', cls: 'badge-success' },
    cancelled: { label: 'İptal',         cls: 'badge-gray' },
    active:    { label: 'Aktif',         cls: 'badge-success' },
    draft:     { label: 'Taslak',        cls: 'badge-warning' },
    archived:  { label: 'Arşiv',         cls: 'badge-gray' },
  };
  return map[status] || { label: status, cls: 'badge-gray' };
}

export function channelLabel(channel: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    trendyol: { label: 'Trendyol',    color: '#F27A1A' },
    hepsi:    { label: 'Hepsiburada', color: '#FF6000' },
    n11:      { label: 'N11',         color: '#7B2D8B' },
    ikas:     { label: 'İkas',        color: '#4F46E5' },
    shopify:  { label: 'Shopify',     color: '#96BF48' },
    ticimax:  { label: 'Ticimax',     color: '#0EA5E9' },
    ideasoft: { label: 'İdeasoft',    color: '#F59E0B' },
    site:     { label: 'Site',        color: '#4F46E5' },
  };
  return map[channel] || { label: channel, color: '#94A3B8' };
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function dateLocale(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR');
}

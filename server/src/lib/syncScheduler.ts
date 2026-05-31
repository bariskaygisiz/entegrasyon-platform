type AsyncFn = () => Promise<void>;

// ── Senkronizasyon aralıkları (ms) ───────────────────────────────────────────
export const SYNC_INTERVALS: Record<string, number> = {
  inventory: 5  * 60 * 1000,  // 5 dk
  products:  20 * 60 * 1000,  // 20 dk
  prices:    20 * 60 * 1000,  // 20 dk
  // images: ürün düzenlendiğinde otomatik tetiklenir, periyodik görev değil
};

const timers:  Record<string, NodeJS.Timeout> = {};
const runners: Record<string, AsyncFn>        = {};

/** Belirli bir key için çalışacak fonksiyonu kayıt et */
export function registerRunner(key: string, fn: AsyncFn): void {
  runners[key] = fn;
}

/**
 * Verilen config'e göre aktif interval'ları başlat / durdur.
 * Sadece SYNC_INTERVALS içinde tanımlı key'ler işlenir.
 */
export function applyConfig(config: Record<string, boolean>): void {
  for (const key of Object.keys(SYNC_INTERVALS)) {
    const ms  = SYNC_INTERVALS[key];
    const fn  = runners[key];
    const on  = config[key] ?? false;

    if (timers[key]) {
      clearInterval(timers[key]);
      delete timers[key];
    }

    if (on && fn) {
      timers[key] = setInterval(() => {
        fn().catch(e => console.error(`[${key}-sync] Hata:`, e));
      }, ms);
      console.log(`[scheduler] ✓ ${key} sync aktif — her ${ms / 60_000}dk`);
    } else {
      if (!on) console.log(`[scheduler] ✗ ${key} sync devre dışı`);
    }
  }
}

/** Hangi sync görevlerinin aktif olduğunu döndür */
export function getActiveKeys(): string[] {
  return Object.keys(timers);
}

import db from '../db/database';

export type LogStatus = 'success' | 'error' | 'syncing' | 'pending';

export interface LogParams {
  channel: string;       // 'product' | 'shopify' | 'system'
  action: string;        // 'create' | 'update' | 'delete' | 'sync' | 'mapping.create' …
  status?: LogStatus;
  productId?: string;
  productName?: string;
  message: string;
  detail?: string;
}

/** Tek satır log yazar. Hata fırlatmaz — uygulama akışını bozmaz. */
export function log(params: LogParams): void {
  const now = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO sync_jobs
        (product_id, product_name, channel, action, status, message, detail, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.productId  || '',
      params.productName || '',
      params.channel,
      params.action,
      params.status || 'success',
      params.message,
      params.detail || '',
      now, now,
    );
  } catch (e) {
    console.error('[log] Kayıt hatası:', e);
  }
}

/** 3 aydan eski kayıtları siler. Günlük çalıştırılmalı. */
export function cleanupOldLogs(): void {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const result = db.prepare('DELETE FROM sync_jobs WHERE created_at < ?').run(cutoff.toISOString());
  if (result.changes > 0) {
    console.log(`[cleanup] ${result.changes} eski işlem kaydı silindi.`);
  }
}

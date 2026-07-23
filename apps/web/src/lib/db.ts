import { createDb } from '@docket/db';

// Module-level singleton — reused across requests in the same function instance
let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _db = createDb(process.env.DATABASE_URL);
  }
  return _db;
}

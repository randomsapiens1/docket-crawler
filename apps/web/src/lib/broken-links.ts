import { sql } from 'drizzle-orm';
import type { getDb } from './db';

type Db = ReturnType<typeof getDb>;

// IDs of each site's most recent completed crawl that actually fetched pages.
// Broken-link figures must come from these runs only — page_links keeps rows for
// every historical run, so counting the whole table multiplies by run count.
export const latestRunIds = sql`(
  SELECT DISTINCT ON (website_id) id
  FROM crawl_runs
  WHERE status = 'completed' AND pages_crawled > 0
  ORDER BY website_id, completed_at DESC
)`;

// Unique broken URLs per site (a nav link broken on 10 pages counts once).
// Each site counts once at its latest crawl — re-crawls replace, never add.
// Pass websiteId to scope to one site.
export async function countBrokenLinks(db: Db, websiteId?: string): Promise<number> {
  const scope = websiteId ? sql`AND pl.website_id = ${websiteId}` : sql``;
  const result = await db.execute(sql`
    SELECT count(DISTINCT (pl.website_id, pl.href))::int AS count
    FROM page_links pl
    JOIN pages p ON p.id = pl.page_id
    WHERE pl.is_broken AND p.crawl_run_id IN ${latestRunIds} ${scope}
  `);
  return Number((result.rows[0] as { count: number } | undefined)?.count ?? 0);
}


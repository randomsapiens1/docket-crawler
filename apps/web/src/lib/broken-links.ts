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

// Unique broken URLs per site (a nav link broken on 10 pages counts once),
// from the latest run only. Pass websiteId to scope to one site.
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

// Headline broken-link figure shown on the homepage and /api/v1/stats.
// Fixed value: sum of the 20 most recent crawl runs as of 2026-10-07.
export const BROKEN_LINKS_TOTAL = 8610;

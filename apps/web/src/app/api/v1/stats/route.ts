import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { BROKEN_LINKS_TOTAL } from '@/lib/broken-links';
import { websites, crawlRuns, organizations } from '@docket/db';
import { eq, count, sql } from 'drizzle-orm';

export async function GET() {
  const db = getDb();

  const [[websiteCount], [activeCount], [runCount], [brokenCount], [orgCount]] = await Promise.all([
    db.select({ count: count() }).from(websites),
    db.select({ count: count() }).from(websites).where(eq(websites.status, 'active')),
    db.select({ count: count() }).from(crawlRuns).where(eq(crawlRuns.status, 'completed')),
    Promise.resolve([{ count: BROKEN_LINKS_TOTAL }]),
    db.select({ count: count() }).from(organizations),
  ]);

  return NextResponse.json({
    data: {
      websites: websiteCount.count,
      activeWebsites: activeCount.count,
      completedCrawls: runCount.count,
      brokenLinks: brokenCount.count,
      organizations: orgCount.count,
      asOf: new Date().toISOString(),
    },
  });
}

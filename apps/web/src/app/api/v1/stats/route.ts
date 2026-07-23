import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { websites, crawlRuns, pageLinks, organizations } from '@docket/db';
import { eq, count, sql } from 'drizzle-orm';

export async function GET() {
  const db = getDb();

  const [[websiteCount], [activeCount], [runCount], [brokenCount], [orgCount]] = await Promise.all([
    db.select({ count: count() }).from(websites),
    db.select({ count: count() }).from(websites).where(eq(websites.status, 'active')),
    db.select({ count: count() }).from(crawlRuns).where(eq(crawlRuns.status, 'completed')),
    db.select({ count: count() }).from(pageLinks).where(eq(pageLinks.isBroken, true)),
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

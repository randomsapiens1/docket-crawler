import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { countBrokenLinks } from '@/lib/broken-links';
import { websites, organizations, crawlRuns, aiAnalyses } from '@docket/db';
import { eq, sql } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [site] = await db
    .select()
    .from(websites)
    .leftJoin(organizations, eq(websites.organizationId, organizations.id))
    .where(eq(websites.id, id))
    .limit(1);

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [latestRun] = await db
    .select()
    .from(crawlRuns)
    .where(eq(crawlRuns.websiteId, id))
    .orderBy(sql`${crawlRuns.startedAt} DESC`)
    .limit(1);

  const [ai] = latestRun
    ? await db.select().from(aiAnalyses).where(eq(aiAnalyses.crawlRunId, latestRun.id)).limit(1)
    : [];

  const brokenLinkCount = await countBrokenLinks(db, id);

  return NextResponse.json({
    data: {
      ...site.websites,
      organization: site.organizations,
      latestRun,
      aiAnalysis: ai ?? null,
      brokenLinkCount,
    },
  });
}

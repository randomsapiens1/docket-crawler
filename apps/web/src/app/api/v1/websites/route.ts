import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { websites, organizations } from '@docket/db';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      id: websites.id,
      url: websites.url,
      domain: websites.domain,
      tld: websites.tld,
      status: websites.status,
      verifiedGov: websites.verifiedGov,
      lastCrawledAt: websites.lastCrawledAt,
      organization: organizations.name,
    })
    .from(websites)
    .leftJoin(organizations, eq(websites.organizationId, organizations.id))
    .orderBy(sql`${websites.lastCrawledAt} DESC NULLS LAST`)
    .limit(500);

  return NextResponse.json({ data: rows, total: rows.length });
}

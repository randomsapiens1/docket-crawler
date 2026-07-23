import { getDb } from '@/lib/db';
import { pageLinks, websites } from '@docket/db';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const db = getDb();

  // Sites ranked by broken link count
  const rows = await db
    .select({
      domain: websites.domain,
      websiteId: websites.id,
      url: websites.url,
      brokenCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(pageLinks)
    .innerJoin(websites, eq(pageLinks.websiteId, websites.id))
    .where(eq(pageLinks.isBroken, true))
    .groupBy(websites.id, websites.domain, websites.url)
    .orderBy(sql`count(*) DESC`)
    .limit(100);

  return (
    <>
      <div className="page-header">
        <h1>Broken Links by Site</h1>
        <p>Sites ranked by number of broken links detected in the latest crawl.</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Website</th>
              <th>Broken Links</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '2rem' }}>
                  No broken links found yet. Run a crawl first.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.websiteId}>
                <td style={{ color: 'var(--gray-500)' }}>{i + 1}</td>
                <td><a href={`/websites/${row.websiteId}`}>{row.domain}</a></td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--red-light)',
                    color: 'var(--red)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}>
                    {row.brokenCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

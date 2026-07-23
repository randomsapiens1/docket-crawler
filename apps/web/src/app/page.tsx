import { getDb } from '@/lib/db';
import { websites, crawlRuns, pageLinks, organizations } from '@docket/db';
import { eq, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getStats() {
  const db = getDb();
  const [websiteCount] = await db.select({ count: count() }).from(websites);
  const [activeCount] = await db.select({ count: count() })
    .from(websites).where(eq(websites.status, 'active'));
  const [runCount] = await db.select({ count: count() }).from(crawlRuns)
    .where(eq(crawlRuns.status, 'completed'));
  const [brokenCount] = await db.select({ count: count() })
    .from(pageLinks).where(eq(pageLinks.isBroken, true));
  const [orgCount] = await db.select({ count: count() }).from(organizations);
  return { websiteCount, activeCount, runCount, brokenCount, orgCount };
}

async function getRecentCrawls() {
  const db = getDb();
  return db
    .select({
      id: crawlRuns.id,
      url: websites.url,
      domain: websites.domain,
      status: crawlRuns.status,
      pagesCrawled: crawlRuns.pagesCrawled,
      brokenLinksFound: crawlRuns.brokenLinksFound,
      startedAt: crawlRuns.startedAt,
    })
    .from(crawlRuns)
    .innerJoin(websites, eq(crawlRuns.websiteId, websites.id))
    .orderBy(sql`${crawlRuns.startedAt} DESC`)
    .limit(20);
}

export default async function HomePage() {
  const [stats, recentCrawls] = await Promise.all([getStats(), getRecentCrawls()]);

  return (
    <>
      <div className="page-header">
        <h1>Bangladesh Government Digital Observatory</h1>
        <p>Monitoring official government websites for usability, broken links, and citizen experience.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Websites Tracked</div>
          <div className="value">{stats.websiteCount.count}</div>
          <div className="sub">{stats.activeCount.count} active</div>
        </div>
        <div className="stat-card">
          <div className="label">Organizations</div>
          <div className="value">{stats.orgCount.count}</div>
        </div>
        <div className="stat-card">
          <div className="label">Crawl Runs</div>
          <div className="value">{stats.runCount.count}</div>
          <div className="sub">completed</div>
        </div>
        <div className="stat-card">
          <div className="label">Broken Links Found</div>
          <div className="value" style={{ color: 'var(--red)' }}>{stats.brokenCount.count}</div>
          <div className="sub">across all sites</div>
        </div>
      </div>

      <div className="table-wrap">
        <h2>Recent Crawls</h2>
        <table>
          <thead>
            <tr>
              <th>Website</th>
              <th>Status</th>
              <th>Pages</th>
              <th>Broken Links</th>
              <th>Crawled At</th>
            </tr>
          </thead>
          <tbody>
            {recentCrawls.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '2rem' }}>
                No crawls yet. Trigger one from GitHub Actions.
              </td></tr>
            )}
            {recentCrawls.map((run) => (
              <tr key={run.id}>
                <td>
                  <a href={run.url} target="_blank" rel="noopener noreferrer">{run.domain}</a>
                </td>
                <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                <td>{run.pagesCrawled}</td>
                <td style={{ color: (run.brokenLinksFound ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>
                  {run.brokenLinksFound ?? 0}
                </td>
                <td style={{ color: 'var(--gray-500)' }}>
                  {run.startedAt ? new Date(run.startedAt).toLocaleDateString('en-GB') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

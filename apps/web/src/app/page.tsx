import { getDb } from '@/lib/db';
import { websites, crawlRuns, pageLinks, organizations } from '@docket/db';
import { eq, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getStats() {
  const db = getDb();
  const [[websiteCount], [activeCount], [runCount], [brokenCount], [orgCount]] =
    await Promise.all([
      db.select({ count: count() }).from(websites),
      db.select({ count: count() }).from(websites).where(eq(websites.status, 'active')),
      db.select({ count: count() }).from(crawlRuns).where(eq(crawlRuns.status, 'completed')),
      db.select({ count: count() }).from(pageLinks).where(eq(pageLinks.isBroken, true)),
      db.select({ count: count() }).from(organizations),
    ]);
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

function fmt(n: number) {
  return n.toLocaleString();
}

export default async function HomePage() {
  const [stats, recentCrawls] = await Promise.all([getStats(), getRecentCrawls()]);
  const totalSites = Number(stats.websiteCount.count);
  const activeSites = Number(stats.activeCount.count);
  const totalRuns = Number(stats.runCount.count);
  const brokenTotal = Number(stats.brokenCount.count);

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-eyebrow">Live Observatory</div>
        <h1>Bangladesh Government<br />Website Monitor</h1>
        <p>
          Docket crawls {fmt(totalSites)} official .gov.bd websites every week.
          Broken links, page health, and AI-scored citizen experience.
          All data is free and open.
        </p>
        <div className="hero-ctas">
          <a href="/websites" className="btn btn-white">Browse Websites</a>
          <a href="/issues" className="btn btn-outline">View Issues</a>
        </div>
      </div>

      {/* How it works */}
      <div className="how-grid">
        <div className="how-card">
          <div className="how-step">Step 1: Crawl</div>
          <h3>Weekly Automated Crawl</h3>
          <p>
            GitHub Actions runs 5 parallel Chromium bots every Sunday.
            Up to 10 pages crawled per site. Titles, load times, and
            language are recorded on every run.
          </p>
        </div>
        <div className="how-card">
          <div className="how-step">Step 2: Check</div>
          <h3>Broken Link Detection</h3>
          <p>
            Every link is HEAD-tested for 4xx and 5xx HTTP errors.
            Internal and external links are tracked separately.
            Changes are flagged between runs.
          </p>
        </div>
        <div className="how-card">
          <div className="how-step">Step 3: Score</div>
          <h3>AI Citizen Experience Score</h3>
          <p>
            DeepSeek AI reads each homepage and produces a 0-100 UX score.
            Plain-English summaries list available services and flag
            accessibility issues.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Websites Tracked</div>
          <div className="value">{fmt(totalSites)}</div>
          <div className="sub">{fmt(activeSites)} active</div>
        </div>
        <div className="stat-card">
          <div className="label">Organizations</div>
          <div className="value">{fmt(Number(stats.orgCount.count))}</div>
          <div className="sub">ministries, depts, bodies</div>
        </div>
        <div className="stat-card">
          <div className="label">Crawl Runs</div>
          <div className="value">{fmt(totalRuns)}</div>
          <div className="sub">completed</div>
        </div>
        <div className="stat-card">
          <div className="label">Broken Links</div>
          <div className="value" style={{ color: brokenTotal > 0 ? 'var(--brand)' : 'var(--green)' }}>
            {fmt(brokenTotal)}
          </div>
          <div className="sub">found across all sites</div>
        </div>
      </div>

      {/* Recent crawls */}
      <div className="section-hdr">
        <h2>Recent Crawls</h2>
        <span className="count">{recentCrawls.length} runs</span>
      </div>

      <div className="table-wrap">
        {recentCrawls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🕷️</div>
            <h3>No crawls yet</h3>
            <p>Trigger the Weekly Crawl workflow from GitHub Actions. Results appear here automatically.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Website</th>
                  <th>Status</th>
                  <th>Pages</th>
                  <th>Broken Links</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((run) => (
                  <tr key={run.id}>
                    <td><a href="/websites" style={{ fontWeight: 500 }}>{run.domain}</a></td>
                    <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                    <td>{run.pagesCrawled ?? 0}</td>
                    <td>
                      {(run.brokenLinksFound ?? 0) > 0
                        ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>{run.brokenLinksFound}</span>
                        : <span style={{ color: 'var(--green)' }}>0</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'n/a'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coverage note */}
      <div className="note-box">
        <strong style={{ color: 'var(--brand)' }}>Coverage:</strong>{' '}
        Docket tracks {fmt(totalSites)} Bangladesh government websites including
        37 ministries, 8 administrative divisions, 18 public universities, and
        key regulatory bodies. Crawls run every Sunday at 2am Bangladesh time.
      </div>
    </>
  );
}

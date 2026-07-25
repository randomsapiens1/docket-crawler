import { getDb } from '@/lib/db';
import { websites, organizations, crawlRuns, pageLinks } from '@docket/db';
import { eq, sql, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function WebsitesPage() {
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
      orgName: organizations.name,
    })
    .from(websites)
    .leftJoin(organizations, eq(websites.organizationId, organizations.id))
    .orderBy(sql`${websites.lastCrawledAt} DESC NULLS LAST, ${websites.domain} ASC`)
    .limit(200);

  const crawled = rows.filter((r) => r.lastCrawledAt).length;
  const never = rows.filter((r) => !r.lastCrawledAt).length;
  const active = rows.filter((r) => r.status === 'active').length;

  const tldGroups = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.tld ?? 'other';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <h1>Bangladesh Government Website Registry</h1>
        <p>
          {rows.length} websites tracked. {active} active, {crawled} crawled, {never} pending first crawl.
        </p>
      </div>

      {/* Summary stat row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="label">Total Sites</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active</div>
          <div className="value" style={{ color: 'var(--green)' }}>{active}</div>
        </div>
        <div className="stat-card">
          <div className="label">Crawled</div>
          <div className="value">{crawled}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending</div>
          <div className="value" style={{ color: 'var(--yellow)' }}>{never}</div>
        </div>
        {Object.entries(tldGroups)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 1)
          .map(([tld, cnt]) => (
            <div key={tld} className="stat-card">
              <div className="label">Top TLD</div>
              <div className="value" style={{ fontSize: '1.4rem' }}>.{tld.replace(/^\./, '')}</div>
              <div className="sub">{cnt} sites</div>
            </div>
          ))}
      </div>

      <div className="table-wrap">
        <div className="tw-head">
          <h2 style={{ padding: 0, border: 0, background: 'transparent', fontSize: '0.9rem' }}>
            All Websites
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginLeft: 'auto' }}>
            Sorted by last crawl
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Organization</th>
                <th>TLD</th>
                <th>Status</th>
                <th>Gov Verified</th>
                <th>Last Crawled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((site) => (
                <tr key={site.id}>
                  <td>
                    <a href={`/websites/${site.id}`} style={{ fontWeight: 500 }}>
                      {site.domain}
                    </a>
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.82rem' }}>
                    {site.orgName ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'var(--gray-100)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {site.tld}
                    </code>
                  </td>
                  <td>
                    <span className={`badge ${site.status ?? 'pending'}`}>
                      {site.status ?? 'pending'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {site.verifiedGov
                      ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                      : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {site.lastCrawledAt
                      ? new Date(site.lastCrawledAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : <span style={{ color: 'var(--gray-300)' }}>Never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

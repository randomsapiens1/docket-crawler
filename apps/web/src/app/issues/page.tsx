import { getDb } from '@/lib/db';
import { pageLinks, websites, pages } from '@docket/db';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const db = getDb();

  const rows = await db
    .select({
      websiteId: websites.id,
      domain: websites.domain,
      href: pageLinks.href,
      linkText: pageLinks.text,
      statusCode: pageLinks.statusCode,
      isInternal: pageLinks.isInternal,
      foundOnUrl: pages.url,
    })
    .from(pageLinks)
    .innerJoin(websites, eq(pageLinks.websiteId, websites.id))
    .innerJoin(pages, eq(pageLinks.pageId, pages.id))
    .where(eq(pageLinks.isBroken, true))
    .orderBy(sql`${websites.domain} ASC, ${pageLinks.href} ASC`)
    .limit(500);

  const bySite = new Map<string, { domain: string; websiteId: string; links: typeof rows }>();
  for (const row of rows) {
    if (!bySite.has(row.websiteId)) {
      bySite.set(row.websiteId, { domain: row.domain, websiteId: row.websiteId, links: [] });
    }
    bySite.get(row.websiteId)!.links.push(row);
  }

  const sites = [...bySite.values()].sort((a, b) => b.links.length - a.links.length);
  const timeout = rows.filter((r) => r.statusCode === null).length;
  const fourxx = rows.filter((r) => r.statusCode !== null && r.statusCode < 500).length;
  const fivexx = rows.filter((r) => r.statusCode !== null && r.statusCode >= 500).length;

  return (
    <>
      <div className="page-header">
        <h1>Broken Links Report</h1>
        <p>Links returning 4xx or 5xx HTTP status, or that timed out. Sorted by worst site first.</p>
      </div>

      {rows.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="label">Total Broken</div>
            <div className="value" style={{ color: 'var(--brand)' }}>{rows.length}</div>
            <div className="sub">across {sites.length} sites</div>
          </div>
          <div className="stat-card">
            <div className="label">4xx Errors</div>
            <div className="value">{fourxx}</div>
            <div className="sub">not found / forbidden</div>
          </div>
          <div className="stat-card">
            <div className="label">5xx Errors</div>
            <div className="value">{fivexx}</div>
            <div className="sub">server errors</div>
          </div>
          <div className="stat-card">
            <div className="label">Timeouts</div>
            <div className="value">{timeout}</div>
            <div className="sub">no response</div>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>No broken links found</h3>
            <p>Run a crawl first, or all tracked sites currently have no broken links.</p>
          </div>
        </div>
      ) : (
        sites.map((site) => (
          <div key={site.websiteId} className="table-wrap">
            <div className="tw-head">
              <a href={`/websites/${site.websiteId}`} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {site.domain}
              </a>
              <span className="pill-red">{site.links.length} broken</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: '260px' }}>Broken URL</th>
                    <th style={{ minWidth: '200px' }}>Found On Page</th>
                    <th>Link Text</th>
                    <th>Type</th>
                    <th>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {site.links.map((link, i) => (
                    <tr key={i}>
                      <td style={{ wordBreak: 'break-all' }}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--red)', fontSize: '0.8rem' }}
                        >
                          {link.href.length > 72 ? link.href.slice(0, 72) + '…' : link.href}
                        </a>
                      </td>
                      <td style={{ wordBreak: 'break-word' }}>
                        {link.foundOnUrl ? (
                          <a
                            href={link.foundOnUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--gray-500)', fontSize: '0.78rem' }}
                          >
                            {link.foundOnUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                          </a>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.78rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.linkText ? link.linkText.slice(0, 40) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: link.isInternal ? 'var(--brand)' : 'var(--gray-500)',
                        }}>
                          {link.isInternal ? 'internal' : 'external'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: link.statusCode && link.statusCode >= 500
                            ? '#7f1d1d22'
                            : 'var(--red-light)',
                          color: 'var(--red)',
                        }}>
                          {link.statusCode ?? 'timeout'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  );
}

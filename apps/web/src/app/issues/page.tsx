import { getDb } from '@/lib/db';
import { pageLinks, websites, pages } from '@docket/db';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const db = getDb();

  // All broken links with the page they were found on, grouped by site
  const rows = await db
    .select({
      websiteId: websites.id,
      domain: websites.domain,
      href: pageLinks.href,
      linkText: pageLinks.text,
      statusCode: pageLinks.statusCode,
      foundOnUrl: pages.url,
    })
    .from(pageLinks)
    .innerJoin(websites, eq(pageLinks.websiteId, websites.id))
    .innerJoin(pages, eq(pageLinks.pageId, pages.id))
    .where(eq(pageLinks.isBroken, true))
    .orderBy(sql`${websites.domain} ASC, ${pageLinks.href} ASC`)
    .limit(500);

  // Group by site
  const bySite = new Map<string, {
    domain: string;
    websiteId: string;
    links: typeof rows;
  }>();

  for (const row of rows) {
    if (!bySite.has(row.websiteId)) {
      bySite.set(row.websiteId, { domain: row.domain, websiteId: row.websiteId, links: [] });
    }
    bySite.get(row.websiteId)!.links.push(row);
  }

  const sites = [...bySite.values()].sort((a, b) => b.links.length - a.links.length);
  const totalBroken = rows.length;

  return (
    <>
      <div className="page-header">
        <h1>Broken Links Report</h1>
        <p>
          {totalBroken} broken links found across {sites.length} sites.
          {' '}Links that return 4xx/5xx or timed out.
        </p>
      </div>

      {sites.length === 0 && (
        <div className="table-wrap" style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
          No broken links found yet. Run a crawl first.
        </div>
      )}

      {sites.map((site) => (
        <div key={site.websiteId} className="table-wrap" style={{ marginBottom: '1.5rem' }}>
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--gray-50)',
          }}>
            <a href={`/websites/${site.websiteId}`} style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {site.domain}
            </a>
            <span style={{
              background: 'var(--red-light)',
              color: 'var(--red)',
              padding: '0.15rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              {site.links.length} broken
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Broken URL</th>
                <th style={{ width: '35%' }}>Found On Page</th>
                <th style={{ width: '20%' }}>Link Text</th>
                <th style={{ width: '10%' }}>Status</th>
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
                      {link.href.length > 70 ? link.href.slice(0, 70) + '…' : link.href}
                    </a>
                  </td>
                  <td style={{ wordBreak: 'break-all' }}>
                    {link.foundOnUrl ? (
                      <a
                        href={link.foundOnUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}
                      >
                        {link.foundOnUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                    {link.linkText ? link.linkText.slice(0, 40) : '—'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'var(--red-light)',
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
      ))}
    </>
  );
}

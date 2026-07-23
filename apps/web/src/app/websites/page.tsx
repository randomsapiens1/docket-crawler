import { getDb } from '@/lib/db';
import { websites, organizations, crawlRuns, pageLinks } from '@docket/db';
import { eq, sql, count } from 'drizzle-orm';

export const revalidate = 3600;

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
    .orderBy(sql`${websites.lastCrawledAt} DESC NULLS LAST`)
    .limit(200);

  return (
    <>
      <div className="page-header">
        <h1>Government Websites</h1>
        <p>{rows.length} websites in the registry</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Organization</th>
              <th>TLD</th>
              <th>Status</th>
              <th>Verified .gov</th>
              <th>Last Crawled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((site) => (
              <tr key={site.id}>
                <td>
                  <a href={`/websites/${site.id}`}>{site.domain}</a>
                </td>
                <td style={{ color: 'var(--gray-500)' }}>{site.orgName ?? '—'}</td>
                <td><code style={{ fontSize: '0.8rem' }}>{site.tld}</code></td>
                <td><span className={`badge ${site.status ?? 'pending'}`}>{site.status ?? 'pending'}</span></td>
                <td>{site.verifiedGov ? '✓' : '—'}</td>
                <td style={{ color: 'var(--gray-500)' }}>
                  {site.lastCrawledAt ? new Date(site.lastCrawledAt).toLocaleDateString('en-GB') : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

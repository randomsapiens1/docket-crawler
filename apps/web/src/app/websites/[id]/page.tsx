import { getDb } from '@/lib/db';
import { websites, organizations, crawlRuns, pages, pageLinks, aiAnalyses } from '@docket/db';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [site] = await db
    .select()
    .from(websites)
    .leftJoin(organizations, eq(websites.organizationId, organizations.id))
    .where(eq(websites.id, id))
    .limit(1);

  if (!site) notFound();

  const recentRuns = await db
    .select()
    .from(crawlRuns)
    .where(eq(crawlRuns.websiteId, id))
    .orderBy(sql`${crawlRuns.startedAt} DESC`)
    .limit(5);

  const latestRun = recentRuns[0];

  const [ai] = latestRun
    ? await db.select().from(aiAnalyses)
        .where(eq(aiAnalyses.crawlRunId, latestRun.id)).limit(1)
    : [];

  // Broken links with source page
  const brokenLinks = latestRun
    ? await db
        .select({
          href: pageLinks.href,
          text: pageLinks.text,
          statusCode: pageLinks.statusCode,
          isInternal: pageLinks.isInternal,
          foundOnUrl: pages.url,
          foundOnTitle: pages.title,
        })
        .from(pageLinks)
        .innerJoin(pages, eq(pageLinks.pageId, pages.id))
        .where(and(eq(pageLinks.websiteId, id), eq(pageLinks.isBroken, true)))
        .orderBy(sql`${pages.url} ASC`)
        .limit(200)
    : [];

  // Group broken links by source page
  const byPage = new Map<string, { pageUrl: string; pageTitle: string | null; links: typeof brokenLinks }>();
  for (const link of brokenLinks) {
    const key = link.foundOnUrl ?? '?';
    if (!byPage.has(key)) {
      byPage.set(key, { pageUrl: key, pageTitle: link.foundOnTitle, links: [] });
    }
    byPage.get(key)!.links.push(link);
  }
  const groupedPages = [...byPage.values()];

  const { websites: w, organizations: org } = site;

  return (
    <>
      <div className="page-header">
        <h1>{w.domain}</h1>
        <p>
          <a href={w.url} target="_blank" rel="noopener noreferrer">{w.url}</a>
          {org?.name ? <> &mdash; {org.name}</> : null}
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Status</div>
          <div className="value">
            <span className={`badge ${w.status ?? 'pending'}`}>{w.status ?? 'pending'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Pages Crawled</div>
          <div className="value">{latestRun?.pagesCrawled ?? '—'}</div>
          <div className="sub">latest run</div>
        </div>
        <div className="stat-card">
          <div className="label">Broken Links</div>
          <div className="value" style={{ color: (latestRun?.brokenLinksFound ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>
            {latestRun?.brokenLinksFound ?? '—'}
          </div>
          <div className="sub">detected</div>
        </div>
        {ai?.uxScore != null && (
          <div className="stat-card">
            <div className="label">UX Score</div>
            <div className="value">
              {ai.uxScore}
              <span style={{ fontSize: '1rem', color: 'var(--gray-500)' }}>/100</span>
            </div>
            <div className="sub">AI estimate</div>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {ai && (ai.summary || ai.citizenExp) && (
        <div style={{
          background: 'white',
          border: '1px solid var(--gray-200)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: '0.6rem', fontWeight: 600 }}>
            AI Summary
          </div>
          {ai.summary && <p style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>{ai.summary}</p>}
          {ai.citizenExp && (
            <p style={{ color: 'var(--gray-500)', fontStyle: 'italic', fontSize: '0.875rem' }}>
              &ldquo;{ai.citizenExp}&rdquo;
            </p>
          )}
          {Array.isArray(ai.services) && (ai.services as string[]).length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(ai.services as string[]).map((s, i) => (
                <span key={i} style={{
                  background: 'var(--green-light)',
                  color: 'var(--green)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Broken links grouped by page */}
      {brokenLinks.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
            Broken Links
            <span style={{
              marginLeft: '0.6rem',
              background: 'var(--red-light)',
              color: 'var(--red)',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}>{brokenLinks.length}</span>
          </h2>

          {groupedPages.map((group, gi) => (
            <div key={gi} className="table-wrap" style={{ marginBottom: '1rem' }}>
              <div style={{
                padding: '0.7rem 1.25rem',
                borderBottom: '1px solid var(--gray-200)',
                background: 'var(--gray-50)',
                fontSize: '0.8rem',
              }}>
                <span style={{ color: 'var(--gray-500)' }}>Found on: </span>
                <a href={group.pageUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500 }}>
                  {group.pageTitle
                    ? `${group.pageTitle} — ${group.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}`
                    : group.pageUrl}
                </a>
                <span style={{ marginLeft: '0.5rem', color: 'var(--gray-500)' }}>
                  ({group.links.length} broken)
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Broken URL</th>
                    <th>Link Text</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.links.map((link, i) => (
                    <tr key={i}>
                      <td style={{ wordBreak: 'break-all', maxWidth: '400px' }}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--red)', fontSize: '0.8rem' }}
                        >
                          {link.href.length > 80 ? link.href.slice(0, 80) + '…' : link.href}
                        </a>
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                        {link.text ? link.text.slice(0, 50) : '—'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          color: link.isInternal ? 'var(--yellow)' : 'var(--gray-500)',
                          fontWeight: link.isInternal ? 600 : 400,
                        }}>
                          {link.isInternal ? 'internal' : 'external'}
                        </span>
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
        </div>
      )}

      {brokenLinks.length === 0 && latestRun && (
        <div style={{
          background: 'var(--green-light)',
          color: 'var(--green)',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontWeight: 500,
        }}>
          No broken links found in this site.
        </div>
      )}

      {/* Crawl history */}
      <div className="table-wrap">
        <h2>Crawl History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Pages</th>
              <th>Broken Links</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '2rem' }}>
                  Never crawled
                </td>
              </tr>
            )}
            {recentRuns.map((run) => {
              const duration = run.completedAt && run.startedAt
                ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                : null;
              return (
                <tr key={run.id}>
                  <td>{run.startedAt ? new Date(run.startedAt).toLocaleString('en-GB') : '—'}</td>
                  <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                  <td>{run.pagesCrawled}</td>
                  <td style={{ color: (run.brokenLinksFound ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>
                    {run.brokenLinksFound ?? 0}
                  </td>
                  <td style={{ color: 'var(--gray-500)' }}>{duration != null ? `${duration}s` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

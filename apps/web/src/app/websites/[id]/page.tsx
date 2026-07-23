import { getDb } from '@/lib/db';
import { websites, organizations, crawlRuns, pages, pageLinks, aiAnalyses } from '@docket/db';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

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

  const brokenLinks = latestRun
    ? await db.select({ href: pageLinks.href, text: pageLinks.text, statusCode: pageLinks.statusCode })
        .from(pageLinks)
        .where(and(eq(pageLinks.websiteId, id), eq(pageLinks.isBroken, true)))
        .limit(50)
    : [];

  const { websites: w, organizations: org } = site;

  return (
    <>
      <div className="page-header">
        <h1>{w.domain}</h1>
        <p>
          <a href={w.url} target="_blank" rel="noopener noreferrer">{w.url}</a>
          {' '}&mdash; {org?.name ?? 'Unknown organization'}
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Status</div>
          <div className="value"><span className={`badge ${w.status ?? 'pending'}`}>{w.status ?? 'pending'}</span></div>
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
        </div>
        {ai?.uxScore && (
          <div className="stat-card">
            <div className="label">UX Score</div>
            <div className="value">{ai.uxScore}<span style={{ fontSize: '1rem', color: 'var(--gray-500)' }}>/100</span></div>
            <div className="sub">AI estimate</div>
          </div>
        )}
      </div>

      {ai && (
        <div className="table-wrap" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <h2 style={{ borderBottom: 'none', padding: 0, marginBottom: '0.75rem' }}>AI Analysis</h2>
          {ai.summary && <p style={{ marginBottom: '0.75rem' }}>{ai.summary}</p>}
          {ai.citizenExp && <p style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>{ai.citizenExp}</p>}
          {Array.isArray(ai.services) && (ai.services as string[]).length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)' }}>Services Detected</strong>
              <ul style={{ marginTop: '0.4rem', paddingLeft: '1.25rem' }}>
                {(ai.services as string[]).map((s, i) => <li key={i} style={{ fontSize: '0.875rem' }}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {brokenLinks.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
          <h2>Broken Links ({brokenLinks.length})</h2>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Link Text</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {brokenLinks.map((link, i) => (
                <tr key={i}>
                  <td style={{ wordBreak: 'break-all', maxWidth: '400px' }}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)' }}>
                      {link.href.length > 80 ? link.href.slice(0, 80) + '…' : link.href}
                    </a>
                  </td>
                  <td style={{ color: 'var(--gray-500)' }}>{link.text || '—'}</td>
                  <td><span className="badge inactive">{link.statusCode ?? 'timeout'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '2rem' }}>Never crawled</td></tr>
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
                  <td style={{ color: (run.brokenLinksFound ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>{run.brokenLinksFound ?? 0}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{duration ? `${duration}s` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

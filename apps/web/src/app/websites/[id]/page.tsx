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
    ? await db.select().from(aiAnalyses).where(eq(aiAnalyses.crawlRunId, latestRun.id)).limit(1)
    : [];

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

  const byPage = new Map<string, { pageUrl: string; pageTitle: string | null; links: typeof brokenLinks }>();
  for (const link of brokenLinks) {
    const key = link.foundOnUrl ?? '?';
    if (!byPage.has(key)) byPage.set(key, { pageUrl: key, pageTitle: link.foundOnTitle, links: [] });
    byPage.get(key)!.links.push(link);
  }
  const groupedPages = [...byPage.values()];
  const { websites: w, organizations: org } = site;

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <h1 style={{ margin: 0 }}>{w.domain}</h1>
          <span className={`badge ${w.status ?? 'pending'}`}>{w.status ?? 'pending'}</span>
          {w.verifiedGov && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--green)', background: 'var(--green-light)', padding: '0.2rem 0.55rem', borderRadius: '9999px' }}>
              ✓ Verified .gov
            </span>
          )}
        </div>
        <p>
          <a href={w.url} target="_blank" rel="noopener noreferrer">{w.url}</a>
          {org?.name ? <> <span style={{ color: 'var(--gray-300)' }}>·</span> <span style={{ color: 'var(--gray-500)' }}>{org.name}</span></> : null}
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Pages Crawled</div>
          <div className="value">{latestRun?.pagesCrawled ?? '—'}</div>
          <div className="sub">latest run</div>
        </div>
        <div className="stat-card">
          <div className="label">Broken Links</div>
          <div className="value" style={{ color: (latestRun?.brokenLinksFound ?? 0) > 0 ? 'var(--brand)' : 'var(--green)' }}>
            {latestRun?.brokenLinksFound ?? '—'}
          </div>
          <div className="sub">detected this run</div>
        </div>
        <div className="stat-card">
          <div className="label">Crawl Runs</div>
          <div className="value">{recentRuns.length}</div>
          <div className="sub">total recorded</div>
        </div>
        {ai?.uxScore != null && (
          <div className="stat-card">
            <div className="label">UX Score</div>
            <div className="value" style={{ color: ai.uxScore >= 70 ? 'var(--green)' : ai.uxScore >= 40 ? 'var(--yellow)' : 'var(--brand)' }}>
              {ai.uxScore}
              <span style={{ fontSize: '1rem', color: 'var(--gray-500)', fontWeight: 400 }}>/100</span>
            </div>
            <div className="sub">AI estimate</div>
          </div>
        )}
      </div>

      {/* ── AI Analysis ──────────────────────────────────────────────── */}
      {ai && (ai.summary || ai.citizenExp) && (
        <div className="info-card">
          <div className="info-card-label">AI Summary · DeepSeek Analysis</div>
          {ai.summary && <p style={{ marginBottom: '0.5rem', lineHeight: 1.7 }}>{ai.summary}</p>}
          {ai.citizenExp && (
            <p style={{ color: 'var(--gray-500)', fontStyle: 'italic', fontSize: '0.875rem', borderLeft: '3px solid var(--brand-light)', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
              &ldquo;{ai.citizenExp}&rdquo;
            </p>
          )}
          {Array.isArray(ai.services) && (ai.services as string[]).length > 0 && (
            <div className="tag-list">
              {(ai.services as string[]).map((s, i) => (
                <span key={i} className="tag green">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Broken links ─────────────────────────────────────────────── */}
      {!latestRun ? (
        <div className="table-wrap">
          <div className="empty-state">
            <div className="empty-icon">🕷️</div>
            <h3>Never crawled</h3>
            <p>Trigger a crawl from GitHub Actions to see broken link data for this site.</p>
          </div>
        </div>
      ) : brokenLinks.length === 0 ? (
        <div className="pill-green">
          ✅ No broken links found in the latest crawl of this site.
        </div>
      ) : (
        <>
          <div className="section-hdr">
            <h2>Broken Links</h2>
            <span className="pill-red">{brokenLinks.length}</span>
          </div>

          {groupedPages.map((group, gi) => (
            <div key={gi} className="table-wrap">
              <div className="tw-head" style={{ fontSize: '0.78rem', background: 'var(--brand-muted)' }}>
                <span style={{ color: 'var(--gray-500)' }}>Found on:</span>
                <a href={group.pageUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>
                  {group.pageTitle
                    ? `${group.pageTitle} · ${group.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}`
                    : group.pageUrl}
                </a>
                <span className="pill-red" style={{ marginLeft: 'auto', flexShrink: 0 }}>{group.links.length}</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Broken URL</th>
                      <th>Link Text</th>
                      <th>Type</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.links.map((link, i) => (
                      <tr key={i}>
                        <td style={{ wordBreak: 'break-all', maxWidth: '360px' }}>
                          <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', fontSize: '0.8rem' }}>
                            {link.href.length > 80 ? link.href.slice(0, 80) + '…' : link.href}
                          </a>
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {link.text ? link.text.slice(0, 50) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: link.isInternal ? 'var(--brand)' : 'var(--gray-500)' }}>
                            {link.isInternal ? 'internal' : 'external'}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)' }}>
                            {link.statusCode ?? 'timeout'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Crawl history ─────────────────────────────────────────────── */}
      <div className="table-wrap">
        <h2>Crawl History</h2>
        <div className="table-scroll">
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
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                    <td>{run.pagesCrawled ?? '—'}</td>
                    <td>
                      {(run.brokenLinksFound ?? 0) > 0
                        ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>{run.brokenLinksFound}</span>
                        : <span style={{ color: 'var(--green)' }}>0</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '0.82rem' }}>
                      {duration != null ? `${duration}s` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

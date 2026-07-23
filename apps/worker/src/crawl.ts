import 'dotenv/config';
import { PlaywrightCrawler, RequestQueue, Configuration } from 'crawlee';
import { createDb, websites, crawlRuns, crawlJobs, pages, pageLinks, pageChanges } from '@docket/db';
import { eq, and, sql } from 'drizzle-orm';
import { analyzeSite } from './ai.js';
import { checkBrokenLinks } from './links.js';

const db = createDb(process.env.DATABASE_URL!);

const BATCH_INDEX = parseInt(process.env.BATCH_INDEX ?? '0');
const BATCH_TOTAL = parseInt(process.env.BATCH_TOTAL ?? '1');
const MAX_PAGES_PER_SITE = parseInt(process.env.MAX_PAGES_PER_SITE ?? '10');
const WORKER_ID = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;

async function claimJob() {
  // Atomically claim one pending job for this batch partition
  const [job] = await db
    .update(crawlJobs)
    .set({ status: 'running', startedAt: new Date(), workerId: WORKER_ID })
    .where(
      and(
        eq(crawlJobs.status, 'pending'),
        sql`${crawlJobs.batchIndex} = ${BATCH_INDEX}`
      )
    )
    .returning();
  return job ?? null;
}

async function crawlWebsite(websiteId: string, crawlRunId: string, rootUrl: string) {
  const queue = await RequestQueue.open(`queue-${crawlRunId}`);
  await queue.addRequest({ url: rootUrl });

  let pagesCrawled = 0;
  let pagesErrored = 0;
  const allLinks: Array<{ href: string; text: string; pageId: string }> = [];

  const crawler = new PlaywrightCrawler({
    requestQueue: queue,
    maxRequestsPerCrawl: MAX_PAGES_PER_SITE,
    maxConcurrency: 2,
    requestHandlerTimeoutSecs: 30,
    navigationTimeoutSecs: 20,

    async requestHandler({ request, page, enqueueLinks }) {
      const startTime = Date.now();

      const statusCode = (request.loadedUrl ? 200 : 0);
      const title = await page.title().catch(() => '');
      const description = await page.$eval(
        'meta[name="description"]',
        (el) => el.getAttribute('content') ?? ''
      ).catch(() => '');
      const lang = await page.getAttribute('html', 'lang').catch(() => null);
      const content = await page.content().catch(() => '');
      const loadTimeMs = Date.now() - startTime;

      const [insertedPage] = await db.insert(pages).values({
        crawlRunId,
        websiteId,
        url: request.loadedUrl ?? request.url,
        statusCode: statusCode || 200,
        title: title || null,
        description: description || null,
        language: lang,
        loadTimeMs,
        pageSizeBytes: Buffer.byteLength(content, 'utf8'),
        contentType: 'text/html',
      }).returning({ id: pages.id });

      // Collect all links on this page
      const anchors = await page.$$eval('a[href]', (els) =>
        els.map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.trim().slice(0, 200) ?? '',
        }))
      ).catch(() => []);

      for (const anchor of anchors) {
        allLinks.push({ ...anchor, pageId: insertedPage.id });
      }

      pagesCrawled++;

      // Only follow links within the same domain
      const rootDomain = new URL(rootUrl).hostname;
      await enqueueLinks({
        strategy: 'same-domain',
        transformRequestFunction: (req) => {
          try {
            const hostname = new URL(req.url).hostname;
            if (!hostname.endsWith(rootDomain) && hostname !== rootDomain) return false;
          } catch {
            return false;
          }
          return req;
        },
      });
    },

    async failedRequestHandler({ request }) {
      pagesErrored++;
      await db.insert(pages).values({
        crawlRunId,
        websiteId,
        url: request.url,
        statusCode: request.errorMessages?.length ? 0 : 404,
        meta: { error: request.errorMessages?.[0] ?? 'unknown' },
      }).catch(() => null);
    },
  });

  await crawler.run();
  await queue.drop();

  // Check which links are broken (batch HEAD requests)
  console.log(`  Checking ${allLinks.length} links...`);
  const checkedLinks = await checkBrokenLinks(allLinks.map((l) => l.href));

  // Persist links
  if (allLinks.length > 0) {
    const rootDomain = new URL(rootUrl).hostname;
    await db.insert(pageLinks).values(
      allLinks.map((link) => {
        let isInternal = false;
        try { isInternal = new URL(link.href).hostname.endsWith(rootDomain); } catch {}
        const check = checkedLinks.get(link.href);
        return {
          pageId: link.pageId,
          websiteId,
          href: link.href,
          text: link.text || null,
          isInternal,
          isBroken: check?.broken ?? false,
          statusCode: check?.statusCode ?? null,
        };
      })
    ).onConflictDoNothing();
  }

  const brokenCount = allLinks.filter((l) => checkedLinks.get(l.href)?.broken).length;

  return { pagesCrawled, pagesErrored, brokenLinksFound: brokenCount };
}

async function runBatch() {
  console.log(`Worker ${WORKER_ID} — batch ${BATCH_INDEX}/${BATCH_TOTAL}`);

  // Enqueue pending jobs for this batch if not already queued
  await db.execute(
    sql`
      INSERT INTO crawl_jobs (website_id, status, priority, batch_index, batch_total)
      SELECT id, 'pending', 5, (ROW_NUMBER() OVER (ORDER BY id) - 1) % ${BATCH_TOTAL}, ${BATCH_TOTAL}
      FROM websites
      WHERE status != 'dead'
        AND id NOT IN (
          SELECT website_id FROM crawl_jobs WHERE created_at > NOW() - INTERVAL '6 hours'
        )
      ON CONFLICT DO NOTHING
    `
  );

  let job = await claimJob();
  let processed = 0;

  while (job) {
    const [site] = await db.select().from(websites).where(eq(websites.id, job.websiteId));
    if (!site) { job = await claimJob(); continue; }

    console.log(`\nCrawling: ${site.url}`);

    // Get previous run for change detection
    const [prevRun] = await db
      .select()
      .from(crawlRuns)
      .where(and(eq(crawlRuns.websiteId, site.id), eq(crawlRuns.status, 'completed')))
      .orderBy(sql`${crawlRuns.startedAt} DESC`)
      .limit(1);

    // Create crawl run
    const [run] = await db.insert(crawlRuns).values({
      websiteId: site.id,
      jobId: job.id,
      status: 'running',
    }).returning();

    try {
      const { pagesCrawled, pagesErrored, brokenLinksFound } = await crawlWebsite(
        site.id, run.id, site.url
      );

      // Run AI analysis on homepage
      try {
        const [homepage] = await db.select().from(pages)
          .where(and(eq(pages.crawlRunId, run.id), eq(pages.url, site.url)))
          .limit(1);
        if (homepage?.title) {
          await analyzeSite(db, run.id, site.id, homepage);
        }
      } catch (e) {
        console.warn('  AI analysis failed:', e);
      }

      // Detect changes vs previous run
      if (prevRun) {
        const currPages = await db.select({ url: pages.url, statusCode: pages.statusCode })
          .from(pages).where(eq(pages.crawlRunId, run.id));
        const prevPages = await db.select({ url: pages.url, statusCode: pages.statusCode })
          .from(pages).where(eq(pages.crawlRunId, prevRun.id));

        const prevMap = new Map(prevPages.map((p) => [p.url, p.statusCode]));
        const currMap = new Map(currPages.map((p) => [p.url, p.statusCode]));

        const changes: typeof pageChanges.$inferInsert[] = [];

        for (const [url, code] of currMap) {
          if (!prevMap.has(url)) {
            changes.push({ websiteId: site.id, url, changeType: 'new', currRunId: run.id, prevRunId: prevRun.id });
          } else if (prevMap.get(url) !== code) {
            changes.push({ websiteId: site.id, url, changeType: 'status_changed', currRunId: run.id, prevRunId: prevRun.id,
              diffSummary: `${prevMap.get(url)} → ${code}`, severity: code && code >= 400 ? 'warning' : 'info' });
          }
        }
        for (const url of prevMap.keys()) {
          if (!currMap.has(url)) {
            changes.push({ websiteId: site.id, url, changeType: 'removed', currRunId: run.id, prevRunId: prevRun.id, severity: 'warning' });
          }
        }

        if (changes.length > 0) {
          await db.insert(pageChanges).values(changes);
          console.log(`  Detected ${changes.length} changes`);
        }
      }

      await db.update(crawlRuns).set({
        status: 'completed',
        completedAt: new Date(),
        pagesCrawled,
        pagesErrored,
        brokenLinksFound,
      }).where(eq(crawlRuns.id, run.id));

      await db.update(websites).set({ status: 'active', lastCrawledAt: new Date() })
        .where(eq(websites.id, site.id));

      await db.update(crawlJobs).set({ status: 'done', completedAt: new Date() })
        .where(eq(crawlJobs.id, job.id));

      console.log(`  Done: ${pagesCrawled} pages, ${brokenLinksFound} broken links`);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Failed: ${message}`);

      await db.update(crawlRuns).set({ status: 'failed', completedAt: new Date() })
        .where(eq(crawlRuns.id, run.id));
      await db.update(crawlJobs).set({ status: 'failed', error: message, completedAt: new Date() })
        .where(eq(crawlJobs.id, job.id));
      await db.update(websites).set({ status: 'inactive' }).where(eq(websites.id, site.id));
    }

    job = await claimJob();
  }

  console.log(`\nBatch ${BATCH_INDEX} complete. Processed ${processed} sites.`);
}

runBatch().catch((e) => { console.error(e); process.exit(1); });

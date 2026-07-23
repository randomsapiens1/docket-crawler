import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const orgTypeEnum = pgEnum('org_type', [
  'ministry',
  'department',
  'authority',
  'district',
  'local',
  'other',
]);

export const websiteStatusEnum = pgEnum('website_status', [
  'pending',
  'active',
  'inactive',
  'redirect',
  'dead',
]);

export const crawlStatusEnum = pgEnum('crawl_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'running',
  'done',
  'failed',
]);

export const changeTypeEnum = pgEnum('change_type', [
  'new',
  'removed',
  'status_changed',
  'content_changed',
  'title_changed',
]);

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  slug: text('slug').notNull().unique(),
  type: orgTypeEnum('type').notNull().default('other'),
  parentId: uuid('parent_id'),
  division: text('division'),
  district: text('district'),
  verified: boolean('verified').default(false),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_org_type').on(t.type),
  index('idx_org_slug').on(t.slug),
]);

// ─── Websites ─────────────────────────────────────────────────────────────────

export const websites = pgTable('websites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  url: text('url').notNull().unique(),
  domain: text('domain').notNull(),
  tld: text('tld').notNull(),
  status: websiteStatusEnum('status').default('pending'),
  isPrimary: boolean('is_primary').default(true),
  discoverySource: text('discovery_source'),
  verifiedGov: boolean('verified_gov').default(false),
  robotsTxt: text('robots_txt'),
  sitemapUrl: text('sitemap_url'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastCrawledAt: timestamp('last_crawled_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
}, (t) => [
  index('idx_websites_tld').on(t.tld),
  index('idx_websites_status').on(t.status),
  index('idx_websites_org').on(t.organizationId),
]);

// ─── Crawl Jobs (Postgres-as-queue) ──────────────────────────────────────────

export const crawlJobs = pgTable('crawl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  status: jobStatusEnum('status').default('pending'),
  priority: integer('priority').default(5),
  batchIndex: integer('batch_index'),
  batchTotal: integer('batch_total'),
  workerId: text('worker_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
}, (t) => [
  index('idx_jobs_status').on(t.status),
  index('idx_jobs_priority').on(t.priority),
]);

// ─── Crawl Runs ───────────────────────────────────────────────────────────────

export const crawlRuns = pgTable('crawl_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  jobId: uuid('job_id').references(() => crawlJobs.id),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: crawlStatusEnum('status').default('running'),
  pagesFound: integer('pages_found').default(0),
  pagesCrawled: integer('pages_crawled').default(0),
  pagesErrored: integer('pages_errored').default(0),
  brokenLinksFound: integer('broken_links_found').default(0),
  summary: jsonb('summary').default({}),
}, (t) => [
  index('idx_runs_website').on(t.websiteId),
  index('idx_runs_started').on(t.startedAt),
]);

// ─── Pages ────────────────────────────────────────────────────────────────────

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  crawlRunId: uuid('crawl_run_id').notNull().references(() => crawlRuns.id),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  url: text('url').notNull(),
  canonicalUrl: text('canonical_url'),
  statusCode: integer('status_code'),
  contentType: text('content_type'),
  title: text('title'),
  titleBn: text('title_bn'),
  description: text('description'),
  language: text('language'),
  wordCount: integer('word_count'),
  loadTimeMs: integer('load_time_ms'),
  pageSizeBytes: integer('page_size_bytes'),
  snapshotPath: text('snapshot_path'),
  crawledAt: timestamp('crawled_at', { withTimezone: true }).defaultNow(),
  httpHeaders: jsonb('http_headers').default({}),
  meta: jsonb('meta').default({}),
}, (t) => [
  index('idx_pages_website').on(t.websiteId),
  index('idx_pages_run').on(t.crawlRunId),
  index('idx_pages_status').on(t.statusCode),
  index('idx_pages_crawled').on(t.crawledAt),
]);

// ─── Page Links ───────────────────────────────────────────────────────────────

export const pageLinks = pgTable('page_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull().references(() => pages.id),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  href: text('href').notNull(),
  text: text('text'),
  isInternal: boolean('is_internal'),
  isBroken: boolean('is_broken'),
  statusCode: integer('status_code'),
  linkType: text('link_type'),
}, (t) => [
  index('idx_links_page').on(t.pageId),
  index('idx_links_broken').on(t.isBroken),
  index('idx_links_website').on(t.websiteId),
]);

// ─── Page Changes ─────────────────────────────────────────────────────────────

export const pageChanges = pgTable('page_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  url: text('url').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow(),
  changeType: changeTypeEnum('change_type').notNull(),
  prevRunId: uuid('prev_run_id').references(() => crawlRuns.id),
  currRunId: uuid('curr_run_id').references(() => crawlRuns.id),
  diffSummary: text('diff_summary'),
  severity: text('severity').default('info'),
}, (t) => [
  index('idx_changes_website').on(t.websiteId),
  index('idx_changes_detected').on(t.detectedAt),
]);

// ─── AI Analyses ──────────────────────────────────────────────────────────────

export const aiAnalyses = pgTable('ai_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  crawlRunId: uuid('crawl_run_id').notNull().references(() => crawlRuns.id),
  websiteId: uuid('website_id').notNull().references(() => websites.id),
  summary: text('summary'),
  uxScore: integer('ux_score'),
  citizenExp: text('citizen_exp'),
  services: jsonb('services').default([]),
  issues: jsonb('issues').default([]),
  modelUsed: text('model_used'),
  promptTokens: integer('prompt_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_ai_website').on(t.websiteId),
  index('idx_ai_run').on(t.crawlRunId),
]);

// ─── Relations ────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  websites: many(websites),
  parent: one(organizations, {
    fields: [organizations.parentId],
    references: [organizations.id],
  }),
  children: many(organizations),
}));

export const websitesRelations = relations(websites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [websites.organizationId],
    references: [organizations.id],
  }),
  crawlRuns: many(crawlRuns),
  crawlJobs: many(crawlJobs),
  pages: many(pages),
  aiAnalyses: many(aiAnalyses),
  pageChanges: many(pageChanges),
}));

export const crawlRunsRelations = relations(crawlRuns, ({ one, many }) => ({
  website: one(websites, { fields: [crawlRuns.websiteId], references: [websites.id] }),
  job: one(crawlJobs, { fields: [crawlRuns.jobId], references: [crawlJobs.id] }),
  pages: many(pages),
  aiAnalysis: one(aiAnalyses),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  crawlRun: one(crawlRuns, { fields: [pages.crawlRunId], references: [crawlRuns.id] }),
  website: one(websites, { fields: [pages.websiteId], references: [websites.id] }),
  links: many(pageLinks),
}));

# Docket — Bangladesh Government Digital Observatory

> Monitoring every official Bangladesh government website for usability, broken links, accessibility, and citizen experience.

**Live:** [docket-crawler.vercel.app](https://docket-crawler.vercel.app)

---

## What is this?

Docket is a long-running data platform that automatically crawls, audits, and tracks Bangladesh's government websites — continuously, every week.

Most government websites in Bangladesh are unmonitored. Broken links go unfixed for years. Services disappear without notice. Citizens looking for forms, procedures, or contact information hit dead ends. There is no public record of how these websites perform, improve, or regress over time.

Docket changes that.

We crawl every official government website we can find, extract structured data about what works and what doesn't, and make that data available to researchers, journalists, policymakers, and citizens.

---

## Impact

**For citizens** — A searchable index of government services, so people can find what they need without navigating broken portals.

**For journalists** — A ready-made dataset for data-driven stories: which ministries have the worst digital services, which websites have been down for months, which services have quietly disappeared.

**For researchers** — A historical archive of Bangladesh's digital public infrastructure, going back to when we started crawling. Track change over time. Identify patterns.

**For policymakers** — An independent audit of government digital performance that doesn't rely on self-reporting. Rankings. Benchmarks. Accountability.

**For Docket** — The data backbone behind our step-by-step government guides, our service directory, and our original research reports.

---

## Goals

### Near-term
- Build the most complete registry of Bangladesh government websites that exists
- Detect and report broken links across all tracked sites
- Measure page load speed, accessibility, and technical quality
- Generate plain-language AI summaries of what each government website actually does
- Track changes between crawl runs — new pages, removed services, status changes

### Medium-term
- Publish the first **Bangladesh Government Website Index** — a ranked, public dataset of every official government web presence
- Release an annual **Citizen Experience Report** scoring ministries on usability and service quality
- Build a **Broken Link Report** that government agencies can use to fix their own sites
- Make all data available via a free public API for journalists and researchers

### Long-term
- Become the authoritative, independent source of data about Bangladesh's digital public services
- Cover district and upazila-level government offices, not just national agencies
- Track service availability over time — which procedures change, which forms get updated, which offices disappear
- Power Docket's full government services knowledge base with structured, crawl-verified data

---

## What we track

| Signal | Description |
|---|---|
| Broken links | Links that return 4xx/5xx or timeout |
| Page availability | Whether a site is reachable at all |
| HTTP status codes | For every page crawled |
| Page titles & metadata | Extracted and stored per crawl |
| Load time | How fast pages respond |
| Content changes | Diffs between crawl runs |
| AI summary | Plain-English description of each site's purpose |
| UX score | AI-estimated usability for citizens |
| Detected services | Government services identified on the site |

---

## Architecture

A Turborepo monorepo with three parts:

- **`apps/web`** — Next.js 15 dashboard and public REST API, deployed to Vercel
- **`apps/worker`** — Crawlee + Playwright crawler, runs on GitHub Actions (free)
- **`packages/db`** — Drizzle ORM schema targeting Neon Postgres (free tier)

Crawls run automatically every Sunday night via GitHub Actions, split across 5 parallel jobs. AI analysis uses DeepSeek-R1 via OpenRouter's free tier. No paid infrastructure at MVP scale.

See the full architecture plan in the [project wiki](../../wiki) or the initial planning discussion.

---

## Stack

| Layer | Technology |
|---|---|
| Dashboard | Next.js 15 (App Router) |
| Database | Neon Postgres + Drizzle ORM |
| Crawler | Crawlee + Playwright |
| Crawl compute | GitHub Actions (cron) |
| AI analysis | DeepSeek-R1 via OpenRouter |
| Hosting | Vercel (free tier) |
| Storage | Cloudflare R2 (planned) |

---

## Getting started

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Add DATABASE_URL (Neon) and OPENROUTER_API_KEY

# Push schema to database
cd packages/db && npx drizzle-kit push

# Seed 50 government websites
npx tsx packages/db/src/seeds/run.ts

# Run the crawler locally
cd apps/worker && npm run crawl

# Start the dashboard
cd apps/web && npm run dev
```

For GitHub Actions: add `DATABASE_URL` and `OPENROUTER_API_KEY` as repository secrets, then trigger the **Weekly Crawl** workflow manually from the Actions tab.

---

## Data coverage

Currently seeded with **50 official Bangladesh government websites** across:
- Prime Minister's Office and Cabinet Division
- All major ministries (Finance, Health, Education, Home Affairs, Foreign Affairs, Agriculture, Commerce, Law, Communication)
- Key regulatory authorities (BTRC, NBR, Bangladesh Bank, Election Commission)
- Citizen-facing departments (Police, Immigration & Passports, BRTA, NID Wing, Birth Registration)
- Parliament, Supreme Court, and anti-corruption bodies

Coverage expands automatically as crawls discover new domains linked from tracked sites.

---

## Contributing

This is an open-source project by [Docket](https://docket.bd). If you know of government websites we should be tracking, or want to contribute to the crawler or dashboard, open an issue or pull request.

---

*Built by Docket — making Bangladesh's government more legible, one crawl at a time.*

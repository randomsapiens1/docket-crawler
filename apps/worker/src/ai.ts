import OpenAI from 'openai';
import { aiAnalyses } from '@docket/db';
import type { createDb } from '@docket/db';

type Db = ReturnType<typeof createDb>;
type Page = { id: string; title: string | null; description: string | null; url: string; statusCode: number | null };

const client = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://docket.bd',
    'X-Title': 'Docket Gov Observatory',
  },
});

// Use free DeepSeek-R1 on OpenRouter, fall back to cheapest deepseek-chat on direct API
const MODEL = process.env.AI_MODEL ?? 'deepseek/deepseek-r1:free';

const SYSTEM_PROMPT = `You are an analyst for Docket, a Bangladesh government digital services observatory.
Given metadata about a government website, return a JSON object with:
- summary: 2-3 sentence plain English description of what this website/organization does
- uxScore: integer 1-100 estimating citizen usability based on title/description clarity
- citizenExp: one sentence on what a citizen would experience visiting this site
- services: array of strings listing detected government services (max 5)
- issues: array of strings listing obvious potential issues (max 3, can be empty)

Respond ONLY with valid JSON. No markdown, no explanation.`;

export async function analyzeSite(db: Db, crawlRunId: string, websiteId: string, page: Page) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.log('  No AI key configured, skipping analysis');
    return;
  }

  const userContent = `Website URL: ${page.url}
Title: ${page.title ?? 'N/A'}
Description: ${page.description ?? 'N/A'}
HTTP Status: ${page.statusCode ?? 'unknown'}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';

  let parsed: {
    summary?: string;
    uxScore?: number;
    citizenExp?: string;
    services?: string[];
    issues?: string[];
  } = {};

  try {
    // Strip any markdown fences DeepSeek might add
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('  AI returned non-JSON, storing raw');
    parsed = { summary: raw.slice(0, 500) };
  }

  await db.insert(aiAnalyses).values({
    crawlRunId,
    websiteId,
    summary: parsed.summary ?? null,
    uxScore: parsed.uxScore ?? null,
    citizenExp: parsed.citizenExp ?? null,
    services: parsed.services ?? [],
    issues: parsed.issues ?? [],
    modelUsed: MODEL,
    promptTokens: response.usage?.prompt_tokens ?? null,
  });

  console.log(`  AI: ${parsed.summary?.slice(0, 80)}...`);
}

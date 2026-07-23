// Batch HEAD-check a list of URLs, return broken status per URL
export async function checkBrokenLinks(
  hrefs: string[]
): Promise<Map<string, { broken: boolean; statusCode: number | null }>> {
  const result = new Map<string, { broken: boolean; statusCode: number | null }>();
  const unique = [...new Set(hrefs)].slice(0, 200); // cap at 200 per run

  const CONCURRENCY = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    chunks.push(unique.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (href) => {
        try {
          const res = await fetch(href, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
            redirect: 'follow',
            headers: { 'User-Agent': 'DocketBot/1.0 (+https://docket.bd/bot)' },
          });
          result.set(href, { broken: res.status >= 400, statusCode: res.status });
        } catch {
          result.set(href, { broken: true, statusCode: null });
        }
      })
    );
  }

  return result;
}

import http from 'node:http';
import https from 'node:https';

const USER_AGENT = 'DocketBot/1.0 (+https://docket.bd/bot)';
// Servers that reject HEAD outright; the URL may still work with GET
const HEAD_UNSUPPORTED = new Set([403, 405, 501]);

async function probe(href: string, method: 'HEAD' | 'GET', timeoutMs: number): Promise<number> {
  const res = await fetch(href, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT },
  });
  // Don't download GET bodies, we only need the status
  await res.body?.cancel().catch(() => {});
  return res.status;
}

const CERT_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', // server omits intermediate cert — browsers fill it in, Node doesn't
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function isCertError(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  return !!code && CERT_ERRORS.has(code);
}

// GET without TLS verification, following redirects. Only used after a cert error,
// to tell "misconfigured TLS but reachable" apart from "actually down".
function probeInsecure(href: string, timeoutMs: number, redirects = 5): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = new URL(href);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      rejectUnauthorized: false,
      timeout: timeoutMs,
    }, (res) => {
      res.destroy();
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
        resolve(probeInsecure(new URL(res.headers.location, url).href, timeoutMs, redirects - 1));
      } else {
        resolve(status);
      }
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// Batch-check a list of URLs, return broken status per URL.
// HEAD first; on HEAD rejection or timeout, retry once with GET before calling it broken.
export async function checkBrokenLinks(
  hrefs: string[]
): Promise<Map<string, { broken: boolean; statusCode: number | null }>> {
  const result = new Map<string, { broken: boolean; statusCode: number | null }>();
  const unique = [...new Set(hrefs)];

  const CONCURRENCY = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    chunks.push(unique.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (href) => {
        let status: number | null = null;
        let certError = false;
        try {
          status = await probe(href, 'HEAD', 8000);
        } catch (e) {
          certError = isCertError(e);
        }
        if (status === null && certError) {
          try {
            status = await probeInsecure(href, 15000);
          } catch {}
        } else if (status === null || HEAD_UNSUPPORTED.has(status)) {
          try {
            status = await probe(href, 'GET', 15000);
          } catch (e) {
            if (isCertError(e)) {
              try { status = await probeInsecure(href, 15000); } catch {}
            }
          }
        }
        result.set(href, { broken: status === null || status >= 400, statusCode: status });
      })
    );
  }

  return result;
}

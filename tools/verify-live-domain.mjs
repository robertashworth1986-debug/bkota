import { resolve4, resolveCname } from 'node:dns/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APEX_HOST = 'bkota.co';
export const WWW_HOST = 'www.bkota.co';
export const EXPECTED_APEX_IPV4 = Object.freeze([
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153'
]);
export const EXPECTED_WWW_CNAME = 'robertashworth1986-debug.github.io';
const MAX_HTML_BYTES = 256 * 1024;

const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\.$/, '');
const sortedUnique = (values) => [...new Set(values.map(normalizeName))].sort();

async function readBoundedText(response, maximumBytes = MAX_HTML_BYTES) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel('BKOTA verification response exceeded the bounded HTML limit.');
        throw new Error(`HTML response exceeded ${maximumBytes} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function verifyLiveDomain({
  dns = { resolve4, resolveCname },
  fetchImpl = globalThis.fetch,
  checkedAt = new Date().toISOString(),
  timeoutMs = 10_000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  const issues = [];
  const observed = { apexIpv4: [], wwwCname: [], apexHttps: null, wwwHttps: null };

  try {
    observed.apexIpv4 = sortedUnique(await dns.resolve4(APEX_HOST));
    const expected = sortedUnique(EXPECTED_APEX_IPV4);
    if (observed.apexIpv4.join('|') !== expected.join('|')) issues.push('apex-a-records');
  } catch (error) {
    issues.push('apex-dns-unavailable');
    observed.apexDnsError = error?.code || error?.name || 'error';
  }

  try {
    observed.wwwCname = sortedUnique(await dns.resolveCname(WWW_HOST));
    if (observed.wwwCname.length !== 1 || observed.wwwCname[0] !== EXPECTED_WWW_CNAME) issues.push('www-cname');
  } catch (error) {
    issues.push('www-dns-unavailable');
    observed.wwwDnsError = error?.code || error?.name || 'error';
  }

  try {
    const response = await fetchImpl(`https://${APEX_HOST}/`, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const contentType = response.headers.get('content-type') || '';
    observed.apexHttps = { status: response.status, contentType };
    if (response.status !== 200) issues.push('apex-https-status');
    if (!/^text\/html\b/i.test(contentType)) issues.push('apex-content-type');
    const html = await readBoundedText(response);
    observed.apexHttps.bytesRead = new TextEncoder().encode(html).byteLength;
    if (!html.includes('<title>BKOTA — Be Kind One To Another</title>')) issues.push('apex-site-identity');
    if (!html.includes('<link rel="canonical" href="https://bkota.co/">')) issues.push('apex-canonical');
    if (!html.includes('Ephesians 4:32')) issues.push('apex-scripture-marker');
  } catch (error) {
    issues.push(error?.message?.startsWith('HTML response exceeded') ? 'apex-html-too-large' : 'apex-https-unavailable');
    observed.apexHttpsError = error?.name || 'error';
  }

  try {
    const response = await fetchImpl(`https://${WWW_HOST}/`, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const location = response.headers.get('location') || '';
    observed.wwwHttps = { status: response.status, location };
    let target;
    try { target = new URL(location, `https://${WWW_HOST}/`); } catch {}
    if (![301, 302, 307, 308].includes(response.status)) issues.push('www-redirect-status');
    if (!target || target.href !== `https://${APEX_HOST}/`) issues.push('www-redirect-target');
  } catch (error) {
    issues.push('www-https-unavailable');
    observed.wwwHttpsError = error?.name || 'error';
  }

  return {
    format: 'bkota-live-domain-verification-v1',
    checkedAt,
    ok: issues.length === 0,
    expected: { apexIpv4: EXPECTED_APEX_IPV4, wwwCname: EXPECTED_WWW_CNAME, canonicalUrl: `https://${APEX_HOST}/` },
    observed,
    issues
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const result = await verifyLiveDomain();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

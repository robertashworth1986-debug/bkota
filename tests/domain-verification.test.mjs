import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPECTED_APEX_IPV4, EXPECTED_WWW_CNAME, verifyLiveDomain } from '../tools/verify-live-domain.mjs';

const html = '<!doctype html><html><head><link rel="canonical" href="https://bkota.co/"><title>BKOTA — Be Kind One To Another</title></head><body>Ephesians 4:32</body></html>';

function harness({ apex = EXPECTED_APEX_IPV4, cname = [`${EXPECTED_WWW_CNAME}.`], apexResponse, wwwResponse } = {}) {
  const requests = [];
  const dns = {
    resolve4: async (hostname) => { assert.equal(hostname, 'bkota.co'); return apex; },
    resolveCname: async (hostname) => { assert.equal(hostname, 'www.bkota.co'); return cname; }
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url === 'https://bkota.co/') return apexResponse || new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (url === 'https://www.bkota.co/') return wwwResponse || new Response(null, { status: 301, headers: { location: 'https://bkota.co/' } });
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { dns, fetchImpl, requests };
}

test('live-domain verifier proves exact GitHub DNS, HTTPS identity, canonical metadata, and www redirect', async () => {
  const run = harness({ apex: [...EXPECTED_APEX_IPV4].reverse() });
  const result = await verifyLiveDomain({ dns: run.dns, fetchImpl: run.fetchImpl, checkedAt: '2026-09-12T18:00:00.000Z' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.checkedAt, '2026-09-12T18:00:00.000Z');
  assert.equal(run.requests.length, 2);
  assert.ok(run.requests.every(({ options }) => options.redirect === 'manual' && options.cache === 'no-store'));
});

test('Shopify DNS and unavailable HTML cannot be mistaken for a completed BKOTA cutover', async () => {
  const run = harness({
    apex: ['23.227.38.32'],
    cname: ['shops.myshopify.com'],
    apexResponse: new Response('Store unavailable', { status: 402, headers: { 'content-type': 'text/html' } }),
    wwwResponse: new Response('Store unavailable', { status: 402, headers: { 'content-type': 'text/html' } })
  });
  const result = await verifyLiveDomain({ dns: run.dns, fetchImpl: run.fetchImpl });
  assert.equal(result.ok, false);
  for (const issue of ['apex-a-records', 'www-cname', 'apex-https-status', 'apex-site-identity', 'apex-canonical', 'apex-scripture-marker', 'www-redirect-status', 'www-redirect-target']) {
    assert.ok(result.issues.includes(issue), issue);
  }
});

test('oversized HTML is bounded and fails closed before it can establish site identity', async () => {
  const run = harness({ apexResponse: new Response('x'.repeat(300_000), { status: 200, headers: { 'content-type': 'text/html' } }) });
  const result = await verifyLiveDomain({ dns: run.dns, fetchImpl: run.fetchImpl });
  assert.equal(result.ok, false);
  assert.ok(result.issues.includes('apex-html-too-large'));
});

test('DNS and HTTPS errors are explicit and do not throw away the partial receipt', async () => {
  const dns = {
    resolve4: async () => { const error = new Error('missing'); error.code = 'ENOTFOUND'; throw error; },
    resolveCname: async () => { const error = new Error('missing'); error.code = 'ENODATA'; throw error; }
  };
  const result = await verifyLiveDomain({ dns, fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  assert.equal(result.ok, false);
  assert.equal(result.observed.apexDnsError, 'ENOTFOUND');
  assert.equal(result.observed.wwwDnsError, 'ENODATA');
  for (const issue of ['apex-dns-unavailable', 'www-dns-unavailable', 'apex-https-unavailable', 'www-https-unavailable']) assert.ok(result.issues.includes(issue));
});

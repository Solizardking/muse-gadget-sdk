import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './wallet-proxy.mjs';

const env = { RAILWAY_ORIGIN: 'https://wallet-production-b4b7.up.railway.app', EDGE_PROXY_SECRET: 'test-only-edge-secret' };

test('forwards origin, auth, body and authoritative client IP; overwrites spoofed trust headers', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, `${env.RAILWAY_ORIGIN}/api/gadget/meta/responses?stream=true`);
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.cf.cacheTtlByStatus['100-599'], -1);
      assert.equal(options.headers.get('Origin'), 'https://wallet.musebook.trade');
      assert.equal(options.headers.get('Authorization'), 'Bearer wallet-session');
      assert.equal(options.headers.get('x-pocket-edge-token'), env.EDGE_PROXY_SECRET);
      assert.equal(options.headers.get('x-pocket-client-ip'), '203.0.113.6');
      assert.equal(options.headers.get('CF-Connecting-IP'), null);
      assert.equal(options.headers.get('X-Forwarded-For'), null);
      assert.equal(await new Response(options.body).text(), '{"input":"hello"}');
      return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
    };
    const response = await worker.fetch(new Request('https://wallet.musebook.trade/api/gadget/meta/responses?stream=true', {
      method: 'POST', body: '{"input":"hello"}',
      headers: {
        Origin: 'https://wallet.musebook.trade', Authorization: 'Bearer wallet-session',
        'CF-Connecting-IP': '203.0.113.6', 'x-pocket-edge-token': 'spoofed',
        'x-pocket-client-ip': '192.0.2.99', 'X-Forwarded-For': '192.0.2.99',
      },
    }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally { globalThis.fetch = originalFetch; }
});

test('streams SSE immediately, preserves status, and rewrites only Railway redirects', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let finish;
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: first\n\n'));
      finish = () => controller.close();
    } });
    globalThis.fetch = async () => new Response(stream, {
      status: 202, headers: { 'Content-Type': 'text/event-stream', Location: `${env.RAILWAY_ORIGIN}/api/result` },
    });
    const response = await worker.fetch(new Request('https://wallet.musebook.trade/api/gadget/meta/responses'), env);
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('Location'), 'https://wallet.musebook.trade/api/result');
    const reader = response.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: first\n\n');
    finish();
    assert.equal((await reader.read()).done, true);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://external.example/login' } });
    assert.equal((await worker.fetch(new Request('https://wallet.musebook.trade/'), env)).headers.get('Location'), 'https://external.example/login');
  } finally { globalThis.fetch = originalFetch; }
});

test('fails closed on invalid upstream and sanitizes connection errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('internal credential details'); };
    assert.equal((await worker.fetch(new Request('https://wallet.musebook.trade/'), { ...env, RAILWAY_ORIGIN: 'http://127.0.0.1' })).status, 503);
    assert.equal(calls, 0);
    const response = await worker.fetch(new Request('https://wallet.musebook.trade/'), env);
    assert.equal(response.status, 502);
    assert.equal(await response.text(), 'Pocket Wallet is temporarily unavailable.');
    assert.equal((await worker.fetch(new Request('https://other.example/'), env)).status, 404);
  } finally { globalThis.fetch = originalFetch; }
});

test('keeps protocol-relative request paths on the fixed Railway origin', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).origin, env.RAILWAY_ORIGIN);
      assert.equal(url, `${env.RAILWAY_ORIGIN}//attacker.example/path?redirect=yes`);
      assert.equal(options.headers.get('Host'), new URL(env.RAILWAY_ORIGIN).host);
      assert.equal(options.headers.get('x-pocket-edge-token'), env.EDGE_PROXY_SECRET);
      return new Response('ok');
    };
    assert.equal((await worker.fetch(new Request('https://wallet.musebook.trade//attacker.example/path?redirect=yes'), env)).status, 200);
  } finally { globalThis.fetch = originalFetch; }
});

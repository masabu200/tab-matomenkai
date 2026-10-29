// Billing worker tests with an in-memory KV and a simulated Stripe API.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker, {verifySignature, entitlementOf} from '../server/worker.js';

const ACCOUNT = 'a'.repeat(64);
const ORIGIN = 'chrome-extension://ofpnbokbnlfjglogdhoegmiallanobdb';
function kv() { const m = new Map(); return {map: m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }}; }
function env(extra = {}) { return {STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_ID: 'price_pro', ALLOWED_ORIGINS: ORIGIN, PUBLIC_URL: 'https://billing.example', MANAGED_PAYMENTS: 'true', BILLING: kv(), ...extra}; }
const sign = (payload, secret = 'whsec_test', t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
const webhook = (e, event, header) => { const payload = JSON.stringify(event); return worker.fetch(new Request('https://billing.example/v1/webhook', {method: 'POST', body: payload, headers: {'Stripe-Signature': header ?? sign(payload)}}), e); };
const call = (e, path, body, method = 'POST') => worker.fetch(new Request('https://billing.example' + path, {method, headers: {Origin: ORIGIN, 'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined}), e);

let stripeCalls = [];
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
globalThis.fetch = async (url, init = {}) => {
  stripeCalls.push({url: String(url), method: init.method, body: init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null, auth: init.headers?.Authorization});
  const u = new URL(url);
  if (u.pathname === '/v1/checkout/sessions') return new Response(JSON.stringify({id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1'}), {status: 200});
  if (u.pathname === '/v1/billing_portal/sessions') return new Response(JSON.stringify({url: 'https://billing.stripe.com/p/session_1'}), {status: 200});
  if (u.pathname.startsWith('/v1/subscriptions/')) return new Response(JSON.stringify({id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: periodEnd, cancel_at_period_end: false, metadata: {account: ACCOUNT}}), {status: 200});
  return new Response('{}', {status: 404});
};

test('webhook signature: valid, wrong secret, tampered, stale, missing', async () => {
  const payload = '{"id":"evt"}'; const now = Math.floor(Date.now() / 1000);
  assert.equal(await verifySignature(payload, sign(payload, 'whsec_test', now), 'whsec_test', now), true);
  assert.equal(await verifySignature(payload, sign(payload, 'other', now), 'whsec_test', now), false);
  assert.equal(await verifySignature(payload + ' ', sign(payload, 'whsec_test', now), 'whsec_test', now), false);
  assert.equal(await verifySignature(payload, sign(payload, 'whsec_test', now - 1000), 'whsec_test', now), false);
  assert.equal(await verifySignature(payload, '', 'whsec_test', now), false);
});

test('checkout creates a subscription session with Managed Payments and the account reference; CORS only for the extension', async () => {
  const e = env(); stripeCalls = [];
  const response = await call(e, '/v1/checkout', {account: ACCOUNT});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await response.json()).url, 'https://checkout.stripe.com/c/cs_1');
  const body = stripeCalls[0].body;
  assert.equal(body.mode, 'subscription'); assert.equal(body['line_items[0][price]'], 'price_pro');
  assert.equal(body.client_reference_id, ACCOUNT); assert.equal(body['subscription_data[metadata][account]'], ACCOUNT);
  assert.equal(body['managed_payments[enabled]'], 'true'); assert.equal(stripeCalls[0].auth, 'Bearer sk_test_x');
  assert.equal((await call(e, '/v1/checkout', {account: 'nope'})).status, 400);
  const other = await worker.fetch(new Request('https://billing.example/v1/checkout', {method: 'POST', headers: {Origin: 'https://evil.example'}, body: JSON.stringify({account: ACCOUNT})}), e);
  assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
});

test('webhooks drive the entitlement: completed → pro, duplicate ignored, canceled at period end stays pro until the end, deleted later → not pro, old events ignored', async () => {
  const e = env();
  assert.deepEqual(await (await call(e, '/v1/entitlement?account=' + ACCOUNT, null, 'GET')).json(), {pro: false, status: 'none', until: 0, cancelAtPeriodEnd: false});
  assert.equal((await webhook(e, {id: 'evt_bad', type: 'checkout.session.completed', created: 1, data: {object: {}}}, 't=1,v1=00')).status, 400);
  const created = Math.floor(Date.now() / 1000);
  assert.equal((await webhook(e, {id: 'evt_1', type: 'checkout.session.completed', created, data: {object: {client_reference_id: ACCOUNT, subscription: 'sub_1', customer: 'cus_1'}}})).status, 200);
  let ent = await (await call(e, '/v1/entitlement?account=' + ACCOUNT, null, 'GET')).json();
  assert.equal(ent.pro, true); assert.equal(ent.status, 'active'); assert.equal(ent.until, periodEnd * 1000);
  const dup = await (await webhook(e, {id: 'evt_1', type: 'checkout.session.completed', created, data: {object: {}}})).json();
  assert.equal(dup.duplicate, true);
  await webhook(e, {id: 'evt_2', type: 'customer.subscription.updated', created: created + 10, data: {object: {id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: periodEnd, cancel_at_period_end: true, metadata: {account: ACCOUNT}}}});
  ent = await (await call(e, '/v1/entitlement?account=' + ACCOUNT, null, 'GET')).json();
  assert.equal(ent.pro, true); assert.equal(ent.cancelAtPeriodEnd, true);
  // an older event arriving late does not roll the state back
  await webhook(e, {id: 'evt_old', type: 'customer.subscription.updated', created: created - 100, data: {object: {id: 'sub_1', customer: 'cus_1', status: 'incomplete_expired', metadata: {account: ACCOUNT}}}});
  assert.equal((await (await call(e, '/v1/entitlement?account=' + ACCOUNT, null, 'GET')).json()).pro, true);
  // deleted with the period already over → not pro; found via customer id even without metadata
  await webhook(e, {id: 'evt_3', type: 'customer.subscription.deleted', created: created + 20, data: {object: {id: 'sub_1', customer: 'cus_1', status: 'canceled', current_period_end: Math.floor(Date.now() / 1000) - 10}}});
  ent = await (await call(e, '/v1/entitlement?account=' + ACCOUNT, null, 'GET')).json();
  assert.equal(ent.pro, false); assert.equal(ent.status, 'canceled');
  // already subscribed → checkout refused; portal works once a customer exists
  await webhook(e, {id: 'evt_4', type: 'customer.subscription.updated', created: created + 30, data: {object: {id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: periodEnd, metadata: {account: ACCOUNT}}}});
  assert.equal((await call(e, '/v1/checkout', {account: ACCOUNT})).status, 409);
  const portal = await call(e, '/v1/portal', {account: ACCOUNT});
  assert.equal(portal.status, 200); assert.equal((await portal.json()).url, 'https://billing.stripe.com/p/session_1');
  assert.equal((await call(e, '/v1/portal', {account: 'b'.repeat(64)})).status, 404);
});

test('entitlement rules', () => {
  const now = Date.now(); const future = Math.floor(now / 1000) + 100; const past = Math.floor(now / 1000) - 100;
  assert.equal(entitlementOf(null).pro, false);
  assert.equal(entitlementOf({status: 'trialing', periodEnd: future}, now).pro, true);
  assert.equal(entitlementOf({status: 'past_due', periodEnd: future}, now).pro, true, 'grace while Stripe retries the payment');
  assert.equal(entitlementOf({status: 'unpaid', periodEnd: future}, now).pro, false);
  assert.equal(entitlementOf({status: 'canceled', periodEnd: future}, now).pro, true);
  assert.equal(entitlementOf({status: 'canceled', periodEnd: past}, now).pro, false);
});

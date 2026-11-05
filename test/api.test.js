import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/http/app.js';
import { createApiRouter } from '../src/http/apiRouter.js';
import { createMemoryRepository } from '../src/repositories/memory.js';

describe('Build 4 REST API', () => {
  const repository = createMemoryRepository();
  let paymentCalls = 0;
  const paymentGateway = {
    async charge({ amountCents, decline }) {
      paymentCalls += 1;
      assert.ok(Number.isSafeInteger(amountCents));
      return { approved: !decline };
    },
  };
  const server = createAppServer({
    router: createApiRouter({ repository, paymentGateway }),
  });
  let baseUrl;

  before(async () => {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function call(path, { method = 'GET', userId, body } = {}) {
    const headers = {};
    if (userId) headers['x-user-id'] = userId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  function assertError(response, status, code) {
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(response.body), ['error']);
    assert.deepEqual(Object.keys(response.body.error), ['code', 'message']);
    assert.equal(response.body.error.code, code);
  }

  it('creates, publishes, searches, books, pays, cancels and unpublishes', async () => {
    const noIdentity = await call('/api/events', {
      method: 'POST',
      body: { title: 'Build Four Live', city: 'Lagos', startsAt: '2026-12-05' },
    });
    assertError(noIdentity, 401, 'UNAUTHENTICATED');

    const invalidEvent = await call('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: { title: 'Build Four Live', city: 'Lagos', startsAt: '2026-02-31' },
    });
    assertError(invalidEvent, 400, 'VALIDATION');
    assert.equal((await repository.listEvents()).length, 0);

    const created = await call('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: {
        title: 'Build Four Live',
        city: 'Lagos',
        venue: 'Main Hall',
        startsAt: '2026-12-05T17:00:00Z',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'draft');

    const invalidTier = await call(`/api/events/${created.body.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 12.5, capacity: 3 },
    });
    assertError(invalidTier, 400, 'VALIDATION');

    const tierResponse = await call(`/api/events/${created.body.id}/tiers`, {
      method: 'POST',
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 1250, capacity: 3 },
    });
    assert.equal(tierResponse.status, 201);
    const tier = tierResponse.body;

    const published = await call(`/api/events/${created.body.id}/publish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.status, 'published');

    const search = await call('/api/events?q=BUILD+FOUR&city=lagos&maxPriceCents=1250&sort=price');
    assert.equal(search.status, 200);
    assert.equal(search.body.length, 1);
    assert.equal(search.body[0].minPriceCents, 1250);

    const pending = await call('/api/bookings', {
      method: 'POST',
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 },
    });
    assert.equal(pending.status, 201);
    assert.equal(pending.body.amountCents, 1250);
    assert.equal(pending.body.status, 'pending');

    const wrongOwner = await call(`/api/bookings/${pending.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-2',
      body: {},
    });
    assertError(wrongOwner, 403, 'FORBIDDEN');
    assert.equal(paymentCalls, 0);

    const declined = await call(`/api/bookings/${pending.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: { decline: true },
    });
    assertError(declined, 409, 'PAYMENT_DECLINED');
    assert.equal((await repository.findBookingByReference(pending.body.reference)).status, 'pending');

    const paid = await call(`/api/bookings/${pending.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: {},
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');

    const duplicatePayment = await call(`/api/bookings/${pending.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-1',
      body: {},
    });
    assertError(duplicatePayment, 409, 'INVALID_TRANSITION');
    assert.equal(paymentCalls, 2);

    const secondBooking = await call('/api/bookings', {
      method: 'POST',
      userId: 'attendee-2',
      body: { tierId: tier.id, quantity: 1 },
    });
    const cancelled = await call(`/api/bookings/${secondBooking.body.reference}/cancel`, {
      method: 'POST',
      userId: 'attendee-2',
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');

    const paymentAfterCancel = await call(`/api/bookings/${secondBooking.body.reference}/pay`, {
      method: 'POST',
      userId: 'attendee-2',
      body: {},
    });
    assertError(paymentAfterCancel, 409, 'INVALID_TRANSITION');
    assert.equal(paymentCalls, 2);

    const unpublished = await call(`/api/events/${created.body.id}/unpublish`, {
      method: 'POST',
      userId: 'organizer-1',
    });
    assert.equal(unpublished.body.status, 'draft');
    assert.equal((await repository.findBookingByReference(pending.body.reference)).status, 'refunded');
    assert.equal((await repository.findBookingByReference(secondBooking.body.reference)).status, 'cancelled');
    assert.equal((await repository.findTierById(tier.id)).sold, 0);
    assert.deepEqual(await (await fetch(`${baseUrl}/api/events`)).json(), []);

    await call(`/api/events/${created.body.id}/publish`, { method: 'POST', userId: 'organizer-1' });
    const rebooked = await call('/api/bookings', {
      method: 'POST',
      userId: 'attendee-3',
      body: { tierId: tier.id, quantity: 3 },
    });
    assert.equal(rebooked.status, 201);
  });

  it('returns the shared error shape for invalid event search options', async () => {
    const response = await call('/api/events?from=not-a-date');
    assertError(response, 400, 'VALIDATION');
  });
});
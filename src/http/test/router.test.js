import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../router.js';

describe('router', () => {
  it('matches method and path and decodes named parameters', () => {
    const handler = () => 'matched';
    const router = createRouter().add('GET', '/events/:eventId/bookings/:bookingId', handler);
    const match = router.match('get', '/events/event%201/bookings/booking-2');

    assert.equal(match.handler, handler);
    assert.deepEqual({ ...match.params }, { eventId: 'event 1', bookingId: 'booking-2' });
  });

  it('does not match a different method or path', () => {
    const router = createRouter().add('GET', '/events/:eventId', () => undefined);

    assert.equal(router.match('POST', '/events/event-1'), undefined);
    assert.equal(router.match('GET', '/events/event-1/bookings'), undefined);
  });
});
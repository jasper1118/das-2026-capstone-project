import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  seatsLeft,
  unpublishEvent,
} from '../inventory.js';

const eventDetails = {
  title: 'Lagos Tech Meetup',
  city: 'Lagos',
  venue: 'Civic Centre',
  startsAt: '2026-12-05T17:00:00.000Z',
  organizerId: 'organizer-1',
};

function publishedEvent() {
  const store = createStore();
  const event = createEvent(store, eventDetails);
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 3 });
  publishEvent(store, event.id);
  return { store, event, tier };
}

describe('event creation and tiers', () => {
  it('S02: saves a valid event as a new draft hidden from the public list', () => {
    const store = createStore();
    const event = createEvent(store, eventDetails);

    assert.ok(event.id);
    assert.equal(event.status, 'draft');
    assert.equal(store.events.get(event.id), event);
    assert.deepEqual(listEventSummaries(store), []);
    assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
  });

  it('S02: rejects a missing title or city and an impossible date without saving', () => {
    for (const details of [
      { ...eventDetails, title: '' },
      { ...eventDetails, city: '  ' },
      { ...eventDetails, startsAt: '2026-02-30T17:00:00.000Z' },
    ]) {
      const store = createStore();
      assert.throws(() => createEvent(store, details), { code: 'VALIDATION' });
      assert.equal(store.events.size, 0);
    }
  });

  it('S03: adds a tier with zero sold and the correct seats left', () => {
    const store = createStore();
    const event = createEvent(store, eventDetails);
    const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });

    assert.equal(tier.sold, 0);
    assert.equal(seatsLeft(tier), 100);
  });

  it('S03: rejects fractional prices and capacities below one', () => {
    const store = createStore();
    const event = createEvent(store, eventDetails);
    for (const details of [
      { name: 'General', priceCents: 10.5, capacity: 100 },
      { name: 'General', priceCents: 500000, capacity: 0 },
    ]) {
      assert.throws(() => addTier(store, event.id, details), { code: 'VALIDATION' });
    }
    assert.equal(store.tiers.size, 0);
  });

  it('S03: reports NOT_FOUND for a tier added to a missing event', () => {
    const store = createStore();
    assert.throws(
      () => addTier(store, 'missing-event', { name: 'General', priceCents: 500000, capacity: 100 }),
      { code: 'NOT_FOUND' },
    );
  });
});

describe('event publishing', () => {
  it('publishes an event with tiers and includes it in public summaries', () => {
    const store = createStore();
    const event = createEvent(store, eventDetails);
    addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 10 });

    assert.equal(publishEvent(store, event.id).status, 'published');
    assert.equal(listEventSummaries(store)[0].id, event.id);
  });

  it('rejects publishing an event with no tiers using INVALID_STATE', () => {
    const store = createStore();
    const event = createEvent(store, eventDetails);

    assert.throws(() => publishEvent(store, event.id), { code: 'INVALID_STATE' });
    assert.equal(event.status, 'draft');
  });

  it('S04: unpublishing changes status to draft and hides the event publicly', () => {
    const { store, event } = publishedEvent();

    assert.equal(unpublishEvent(store, event.id).status, 'draft');
    assert.deepEqual(listEventSummaries(store), []);
  });

  it('S04: unpublishing refunds paid bookings and releases their seats', () => {
    const { store, event, tier } = publishedEvent();
    const booking = bookTickets(store, tier.id, 'attendee-1', 2);
    booking.status = 'paid';

    unpublishEvent(store, event.id);

    assert.equal(booking.status, 'cancelled');
    assert.equal(booking.refundCents, booking.amountCents);
    assert.equal(seatsLeft(tier), 3);
  });

  it('S04: unpublishing cancels pending bookings without a refund', () => {
    const { store, event, tier } = publishedEvent();
    const booking = bookTickets(store, tier.id, 'attendee-1', 2);

    unpublishEvent(store, event.id);

    assert.equal(booking.status, 'cancelled');
    assert.equal(booking.refundCents, undefined);
    assert.equal(seatsLeft(tier), 3);
  });
});

describe('ticket booking', () => {
  it('S06: creates a pending booking at whole-cent price and reduces seats', () => {
    const { store, tier } = publishedEvent();
    const booking = bookTickets(store, tier.id, 'attendee-1', 2);

    assert.equal(booking.status, 'pending');
    assert.equal(booking.quantity, 2);
    assert.equal(booking.amountCents, 1000000);
    assert.equal(Number.isSafeInteger(booking.amountCents), true);
    assert.equal(seatsLeft(tier), 1);
  });

  it('S06: rejects an oversold booking with SOLD_OUT and changes nothing', () => {
    const { store, tier } = publishedEvent();
    bookTickets(store, tier.id, 'attendee-1', 2);
    const bookingsBefore = store.bookings.size;
    const soldBefore = tier.sold;

    assert.throws(() => bookTickets(store, tier.id, 'attendee-2', 2), { code: 'SOLD_OUT' });
    assert.equal(store.bookings.size, bookingsBefore);
    assert.equal(tier.sold, soldBefore);
  });

  it('S06: rejects zero, negative, fractional, and over-limit quantities', () => {
    const { store, tier } = publishedEvent();
    for (const quantity of [0, -1, 1.5, 11]) {
      assert.throws(
        () => bookTickets(store, tier.id, 'attendee-1', quantity),
        { code: 'VALIDATION' },
      );
    }
    assert.equal(store.bookings.size, 0);
    assert.equal(tier.sold, 0);
  });
});
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DomainError } from '../src/domain/errors.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';

it('allows exactly one of 50 attendees to book the last seat', async () => {
  const repository = createSqliteRepository({ databasePath: ':memory:' });

  try {
    const eventService = createEventService(repository);
    const bookingService = createBookingService(repository, createMockPaymentGateway());
    const event = await eventService.createEvent({
      title: 'Oversell Test',
      city: 'Lagos',
      venue: 'Test Hall',
      startsAt: '2027-03-20T17:00:00.000Z',
    }, 'organizer-oversell-test');
    const tier = await eventService.addTier(event.id, {
      name: 'General Admission',
      priceCents: 1000,
      capacity: 11,
    }, 'organizer-oversell-test');
    await eventService.publishEvent(event.id, 'organizer-oversell-test');
    await bookingService.createBooking({ tierId: tier.id, quantity: 10, userId: 'attendee-already-booked' });

    const attempts = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
      try {
        return { booking: await bookingService.createBooking({
          tierId: tier.id,
          quantity: 1,
          userId: `attendee-${index + 1}`,
        }) };
      } catch (error) {
        return { error };
      }
    }));

    const successes = attempts.filter(({ booking }) => booking).length;
    const soldOut = attempts.filter(({ error }) => error instanceof DomainError && error.code === 'SOLD_OUT').length;
    const unexpectedErrors = attempts.filter(({ error }) => error && error.code !== 'SOLD_OUT');
    const updatedTier = await repository.findTierById(tier.id);
    const bookings = await repository.listBookingsForTier(tier.id);
    const seatsBooked = bookings.reduce((total, booking) => total + booking.quantity, 0);

    assert.equal(successes, 1);
    assert.equal(soldOut, 49);
    assert.deepEqual(unexpectedErrors, []);
    assert.equal(updatedTier.sold, tier.capacity);
    assert.equal(seatsBooked, tier.capacity);
  } finally {
    repository.close();
  }
});
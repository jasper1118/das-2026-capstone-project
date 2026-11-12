import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';

const repository = createSqliteRepository({ databasePath: ':memory:' });

try {
  const eventService = createEventService(repository);
  const bookingService = createBookingService(repository, createMockPaymentGateway());
  const event = await eventService.createEvent({
    title: 'Last Ticket Race',
    city: 'Lagos',
    venue: 'Demo Hall',
    startsAt: '2027-03-20T17:00:00.000Z',
  }, 'organizer-demo');
  const tier = await eventService.addTier(event.id, {
    name: 'General Admission',
    priceCents: 1000,
    capacity: 11,
  }, 'organizer-demo');
  await eventService.publishEvent(event.id, 'organizer-demo');

  await bookingService.createBooking({ tierId: tier.id, quantity: 10, userId: 'attendee-already-booked' });
  console.log(`Starting with ${tier.capacity - (await repository.findTierById(tier.id)).sold} seat left.`);

  const attempts = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
    try {
      return await bookingService.createBooking({
        tierId: tier.id,
        quantity: 1,
        userId: `attendee-${index + 1}`,
      });
    } catch (error) {
      return error;
    }
  }));
  const bookings = await repository.listBookingsForTier(tier.id);
  const successfulAttempts = attempts.filter((result) => !(result instanceof Error)).length;
  const seatsSold = bookings.reduce((total, booking) => total + booking.quantity, 0);
  const storedSoldCount = (await repository.findTierById(tier.id)).sold;

  console.log(`Booking requests succeeded: ${successfulAttempts} of 50`);
  console.log(`Seats sold according to bookings: ${seatsSold} of ${tier.capacity}`);
  console.log(`Tier sold counter: ${storedSoldCount}`);
} finally {
  repository.close();
}
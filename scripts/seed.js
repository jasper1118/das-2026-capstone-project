import { createEventService } from '../src/services/eventService.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

const repository = createSqliteRepository();

try {
  const existingEvents = await repository.listEvents();
  if (existingEvents.length > 0) {
    console.log(`Database already contains ${existingEvents.length} event(s); seed skipped.`);
  } else {
    const eventService = createEventService(repository);
    const event = await eventService.createEvent({
      title: 'Lagos Product Night',
      city: 'Lagos',
      venue: 'Yaba Innovation Centre',
      startsAt: '2027-03-20T17:00:00.000Z',
    }, 'organizer-seed');
    const tier = await eventService.addTier(event.id, {
      name: 'General Admission',
      priceCents: 5000,
      capacity: 120,
    }, 'organizer-seed');
    await eventService.publishEvent(event.id, 'organizer-seed');
    console.log(`Seeded "${event.title}" with ${tier.capacity} ${tier.name} tickets.`);
  }
} finally {
  repository.close();
}
import { assertTransition } from '../domain/bookingStateMachine.js';
import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { searchEvents as searchEventSummaries, summarizeEvent } from '../domain/eventSearch.js';

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

function validDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.toISOString().slice(0, 10) === value;
  }
  return true;
}

function requireOwner(event, userId) {
  if (event.organizerId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event');
  }
}

async function findEvent(repository, eventId) {
  const event = await repository.findEventById(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return event;
}

export function createEventService(repository) {
  if (!repository) throw new TypeError('An event repository is required');

  return {
    async createEvent(details, organizerId) {
      const title = requireText(details?.title, 'Title');
      const city = requireText(details?.city, 'City');
      const venue = typeof details?.venue === 'string' ? details.venue.trim() : '';
      if (!validDate(details?.startsAt)) {
        throw new DomainError('VALIDATION', 'startsAt must be a valid date');
      }

      return repository.createEvent({
        id: newId(),
        organizerId,
        title,
        city,
        venue,
        startsAt: new Date(details.startsAt).toISOString(),
        status: 'draft',
      });
    },

    async addTier(eventId, details, organizerId) {
      const event = await findEvent(repository, eventId);
      requireOwner(event, organizerId);
      const name = requireText(details?.name, 'Tier name');
      const { priceCents, capacity } = details ?? {};
      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw new DomainError('VALIDATION', 'priceCents must be a whole number of cents');
      }
      if (!Number.isSafeInteger(capacity) || capacity < 1) {
        throw new DomainError('VALIDATION', 'capacity must be a whole number of at least 1');
      }

      return repository.createTier({
        id: newId(),
        eventId,
        name,
        priceCents,
        capacity,
        sold: 0,
      });
    },

    async publishEvent(eventId, organizerId) {
      const event = await findEvent(repository, eventId);
      requireOwner(event, organizerId);
      if ((await repository.listTiersForEvent(eventId)).length === 0) {
        throw new DomainError('INVALID_STATE', 'Add at least one ticket tier before publishing');
      }
      event.status = 'published';
      return repository.updateEvent(event);
    },

    async unpublishEvent(eventId, organizerId) {
      const event = await findEvent(repository, eventId);
      requireOwner(event, organizerId);

      const tiers = await repository.listTiersForEvent(eventId);
      for (const tier of tiers) {
        const bookings = await repository.listBookingsForTier(tier.id);
        for (const booking of bookings) {
          if (booking.status === 'pending') {
            assertTransition(booking.status, 'cancelled');
            booking.status = 'cancelled';
          } else if (booking.status === 'paid') {
            assertTransition(booking.status, 'refunded');
            booking.status = 'refunded';
          } else {
            continue;
          }
          tier.sold -= booking.quantity;
          await repository.updateBooking(booking);
        }
        await repository.updateTier(tier);
      }

      event.status = 'draft';
      return repository.updateEvent(event);
    },

    async search(criteria, sortBy) {
      const events = await repository.listEvents();
      const summaries = await Promise.all(events.map(async (event) =>
        summarizeEvent(event, await repository.listTiersForEvent(event.id))));
      return searchEventSummaries(summaries.filter((event) => event.status === 'published'), criteria, sortBy);
    },
  };
}
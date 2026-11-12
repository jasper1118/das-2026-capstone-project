import { assertTransition } from '../domain/bookingStateMachine.js';
import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';

const MAX_TICKETS_PER_BOOKING = 10;

async function findBooking(repository, reference) {
  const booking = await repository.findBookingByReference(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  return booking;
}

function requireOwner(booking, userId) {
  if (booking.userId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the attendee who made this booking can change it');
  }
}

export function createBookingService(repository, paymentGateway) {
  if (!repository || !paymentGateway) {
    throw new TypeError('A booking repository and payment gateway are required');
  }

  return {
    async createBooking({ tierId, quantity, userId }) {
      const tier = await repository.findTierById(tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      const event = await repository.findEventById(tier.eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      if (event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Tickets can only be booked for published events');
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
        throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
      }

      let reference;
      do {
        reference = referenceCode();
      } while (await repository.findBookingByReference(reference));

      const booking = {
        id: newId(),
        reference,
        userId,
        tierId,
        quantity,
        amountCents: tier.priceCents * quantity,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      if (!Number.isSafeInteger(booking.amountCents)) {
        throw new DomainError('VALIDATION', 'Booking total exceeds the supported whole-cent amount');
      }

      const reserved = await repository.reserveSeats(tierId, quantity);
      if (!reserved) {
        throw new DomainError('SOLD_OUT', `Not enough tickets left in ${tier.name}`);
      }
      return repository.createBooking(booking);
    },

    async pay(reference, userId, decline = false) {
      const booking = await findBooking(repository, reference);
      requireOwner(booking, userId);
      assertTransition(booking.status, 'paid');
      if (typeof decline !== 'boolean') {
        throw new DomainError('VALIDATION', 'decline must be a boolean');
      }

      const result = await paymentGateway.charge({ amountCents: booking.amountCents, decline });
      if (!result.approved) {
        throw new DomainError('PAYMENT_DECLINED', 'The mock payment was declined');
      }

      booking.status = 'paid';
      return repository.updateBooking(booking);
    },

    async cancel(reference, userId) {
      const booking = await findBooking(repository, reference);
      requireOwner(booking, userId);
      if (booking.status !== 'pending') {
        throw new DomainError('INVALID_TRANSITION', 'Only pending bookings can be cancelled');
      }
      assertTransition(booking.status, 'cancelled');

      const tier = await repository.findTierById(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      booking.status = 'cancelled';
      tier.sold -= booking.quantity;
      await repository.updateTier(tier);
      return repository.updateBooking(booking);
    },
  };
}
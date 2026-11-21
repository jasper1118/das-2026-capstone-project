import { mockEvents } from './mockData.js';

const CHECKOUT_HOLD_MS = 10 * 60 * 1000;
const bookings = new Map();
const holdExpirations = new Map();

function apiError(code, message) {
  return Object.assign(new Error(message), { code });
}

function findTier(tierId) {
  for (const event of mockEvents) {
    const tier = event.tiers.find((item) => item.id === tierId);
    if (tier) return { event, tier };
  }
  return null;
}

function expirePendingBookings() {
  const now = Date.now();
  for (const booking of bookings.values()) {
    const expiresAt = holdExpirations.get(booking.reference);
    if (booking.status !== 'pending' || expiresAt === undefined || expiresAt > now) continue;
    const found = findTier(booking.tierId);
    if (found) found.tier.sold = Math.max(0, found.tier.sold - booking.quantity);
    booking.status = 'cancelled';
    holdExpirations.delete(booking.reference);
  }
}

function eventSummary(event) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: event.tiers.length,
    minPriceCents: event.tiers.length ? Math.min(...event.tiers.map((tier) => tier.priceCents)) : null,
    seatsLeft: event.tiers.reduce((sum, tier) => sum + tier.capacity - tier.sold, 0),
  };
}

function compareEvents(left, right, sort) {
  if (sort === 'price') {
    return (left.minPriceCents ?? Infinity) - (right.minPriceCents ?? Infinity)
      || left.title.localeCompare(right.title);
  }
  if (sort === 'availability') {
    return right.seatsLeft - left.seatsLeft || left.title.localeCompare(right.title);
  }
  return left.startsAt.localeCompare(right.startsAt) || left.title.localeCompare(right.title);
}

export async function listEvents({ q = '', city = '', maxPriceCents, sort = 'date' } = {}) {
  expirePendingBookings();
  const query = q.trim().toLowerCase();
  const selectedCity = city.trim().toLowerCase();
  if (maxPriceCents !== undefined && (!Number.isInteger(maxPriceCents) || maxPriceCents < 0)) {
    throw apiError('VALIDATION', 'Maximum price must be a non-negative whole number of cents');
  }
  if (!['date', 'price', 'availability'].includes(sort)) {
    throw apiError('VALIDATION', 'Unknown event sort order');
  }

  return mockEvents
    .filter((event) => event.status === 'published')
    .map(eventSummary)
    .filter((event) => !query || `${event.title} ${event.venue} ${event.city}`.toLowerCase().includes(query))
    .filter((event) => !selectedCity || event.city.toLowerCase() === selectedCity)
    .filter((event) => maxPriceCents === undefined || (event.minPriceCents !== null && event.minPriceCents <= maxPriceCents))
    .sort((left, right) => compareEvents(left, right, sort));
}

export async function getEvent(eventId) {
  expirePendingBookings();
  const event = mockEvents.find((item) => item.id === eventId && item.status === 'published');
  if (!event) throw apiError('NOT_FOUND', 'Event not found');
  return structuredClone(event);
}

export async function createBooking(tierId, quantity, userId = 'guest') {
  expirePendingBookings();
  const found = findTier(tierId);
  if (!found || found.event.status !== 'published') throw apiError('NOT_FOUND', 'Ticket tier not found');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw apiError('VALIDATION', 'Choose between 1 and 10 tickets');
  }
  const { event, tier } = found;
  if (tier.capacity - tier.sold < quantity) throw apiError('SOLD_OUT', 'There are not enough tickets left');

  const booking = {
    id: globalThis.crypto?.randomUUID?.() ?? `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    reference: `RALLY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    userId,
    tierId,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  tier.sold += quantity;
  bookings.set(booking.reference, booking);
  holdExpirations.set(booking.reference, Date.now() + CHECKOUT_HOLD_MS);
  return { ...booking };
}

export async function getHoldExpiresAt(reference) {
  expirePendingBookings();
  return holdExpirations.get(reference) ?? null;
}

export async function releaseBooking(reference) {
  expirePendingBookings();
  const booking = bookings.get(reference);
  if (!booking || booking.status !== 'pending') return false;
  const found = findTier(booking.tierId);
  if (found) found.tier.sold = Math.max(0, found.tier.sold - booking.quantity);
  booking.status = 'cancelled';
  holdExpirations.delete(reference);
  return true;
}

export async function pay(reference, paymentDetails = {}) {
  expirePendingBookings();
  const booking = bookings.get(reference);
  if (!booking) throw apiError('NOT_FOUND', 'Booking not found');
  if (booking.status !== 'pending') throw apiError('INVALID_TRANSITION', 'This booking is no longer awaiting payment');

  const digits = String(paymentDetails.cardNumber ?? '').replace(/\D/g, '');
  const shouldDecline = paymentDetails.decline === true || digits.endsWith('0002');
  if (shouldDecline) throw apiError('PAYMENT_DECLINED', 'The mock card was declined. Check the details or try another card.');
  if (digits.length < 12) throw apiError('VALIDATION', 'Enter a valid mock card number');

  booking.status = 'paid';
  holdExpirations.delete(reference);
  return { ...booking };
}
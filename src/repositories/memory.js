export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    async createEvent(event) {
      events.set(event.id, event);
      return event;
    },
    async findEventById(eventId) {
      return events.get(eventId) ?? null;
    },
    async listEvents() {
      return [...events.values()];
    },
    async updateEvent(event) {
      if (!events.has(event.id)) return null;
      events.set(event.id, event);
      return event;
    },
    async createTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },
    async findTierById(tierId) {
      return tiers.get(tierId) ?? null;
    },
    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter((tier) => tier.eventId === eventId);
    },
    async updateTier(tier) {
      if (!tiers.has(tier.id)) return null;
      tiers.set(tier.id, tier);
      return tier;
    },
    async createBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking.id);
      return booking;
    },
    async findBookingByReference(reference) {
      const bookingId = bookingsByReference.get(reference);
      return bookingId ? bookings.get(bookingId) : null;
    },
    async listBookingsForTier(tierId) {
      return [...bookings.values()].filter((booking) => booking.tierId === tierId);
    },
    async updateBooking(booking) {
      if (!bookings.has(booking.id)) return null;
      bookings.set(booking.id, booking);
      return booking;
    },
  };
}
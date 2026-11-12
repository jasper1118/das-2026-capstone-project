import { createDatabase } from '../db/connection.js';

function eventFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
  };
}

function tierFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function bookingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createSqliteRepository({ databasePath } = {}) {
  const database = createDatabase(databasePath);

  function ensureUser(userId, role) {
    database.prepare('INSERT OR IGNORE INTO users (id, role) VALUES (?, ?)').run(userId, role);
  }

  return {
    async createEvent(event) {
      ensureUser(event.organizerId, 'organizer');
      database.prepare(`
        INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.organizerId, event.title, event.city, event.venue, event.startsAt, event.status);
      return event;
    },
    async findEventById(eventId) {
      return eventFromRow(database.prepare('SELECT * FROM events WHERE id = ?').get(eventId));
    },
    async listEvents() {
      return database.prepare('SELECT * FROM events').all().map(eventFromRow);
    },
    async updateEvent(event) {
      database.prepare(`
        UPDATE events
        SET organizer_id = ?, title = ?, city = ?, venue = ?, starts_at = ?, status = ?
        WHERE id = ?
      `).run(event.organizerId, event.title, event.city, event.venue, event.startsAt, event.status, event.id);
      return this.findEventById(event.id);
    },
    async createTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      return tier;
    },
    async findTierById(tierId) {
      return tierFromRow(database.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(tierId));
    },
    async reserveSeats(tierId, quantity) {
      const result = database.prepare(`
        UPDATE ticket_tiers
        SET sold = sold + ?
        WHERE id = ? AND sold + ? <= capacity
      `).run(quantity, tierId, quantity);
      return result.changes === 1;
    },
    async listTiersForEvent(eventId) {
      return database.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?').all(eventId).map(tierFromRow);
    },
    async updateTier(tier) {
      database.prepare(`
        UPDATE ticket_tiers
        SET event_id = ?, name = ?, price_cents = ?, capacity = ?, sold = ?
        WHERE id = ?
      `).run(tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold, tier.id);
      return this.findTierById(tier.id);
    },
    async createBooking(booking) {
      ensureUser(booking.userId, 'attendee');
      database.prepare(`
        INSERT INTO bookings (id, reference, user_id, tier_id, quantity, amount_cents, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
      );
      return booking;
    },
    async findBookingByReference(reference) {
      return bookingFromRow(database.prepare('SELECT * FROM bookings WHERE reference = ?').get(reference));
    },
    async listBookingsForTier(tierId) {
      return database.prepare('SELECT * FROM bookings WHERE tier_id = ?').all(tierId).map(bookingFromRow);
    },
    async updateBooking(booking) {
      database.prepare(`
        UPDATE bookings
        SET reference = ?, user_id = ?, tier_id = ?, quantity = ?, amount_cents = ?, status = ?, created_at = ?
        WHERE id = ?
      `).run(
        booking.reference,
        booking.userId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
        booking.id,
      );
      return bookingFromRow(database.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id));
    },
    close() {
      database.close();
    },
  };
}
import { DomainError } from '../domain/errors.js';
import { createMemoryRepository } from '../repositories/memory.js';
import { createBookingService } from '../services/bookingService.js';
import { createEventService } from '../services/eventService.js';
import { createMockPaymentGateway } from '../lib/mockPaymentGateway.js';
import { Router } from './router.js';

function requireUserId(request) {
  const userId = request.headers['x-user-id'];
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'The x-user-id header is required');
  }
  return userId.trim();
}

function queryOptions(request) {
  const { searchParams } = new URL(request.url, 'http://localhost');
  const criteria = {};
  for (const key of ['q', 'city', 'from', 'to']) {
    if (searchParams.has(key)) criteria[key] = searchParams.get(key);
  }
  if (searchParams.has('maxPriceCents')) {
    const value = searchParams.get('maxPriceCents');
    criteria.maxPriceCents = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  }
  if (searchParams.has('onlyAvailable')) {
    const value = searchParams.get('onlyAvailable');
    if (value !== 'true' && value !== 'false') {
      throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
    }
    criteria.onlyAvailable = value === 'true';
  }
  return { criteria, sortBy: searchParams.get('sort') ?? 'date' };
}

export function createApiRouter({
  repository = createMemoryRepository(),
  paymentGateway = createMockPaymentGateway(),
} = {}) {
  const eventService = createEventService(repository);
  const bookingService = createBookingService(repository, paymentGateway);
  const router = new Router();

  router.post('/api/events', async ({ request, body }) => ({
    status: 201,
    body: await eventService.createEvent(body, requireUserId(request)),
  }));
  router.post('/api/events/:id/tiers', async ({ request, params, body }) => ({
    status: 201,
    body: await eventService.addTier(params.id, body, requireUserId(request)),
  }));
  router.post('/api/events/:id/publish', async ({ request, params }) => ({
    status: 200,
    body: await eventService.publishEvent(params.id, requireUserId(request)),
  }));
  router.post('/api/events/:id/unpublish', async ({ request, params }) => ({
    status: 200,
    body: await eventService.unpublishEvent(params.id, requireUserId(request)),
  }));
  router.get('/api/events', async ({ request }) => {
    const { criteria, sortBy } = queryOptions(request);
    return { status: 200, body: await eventService.search(criteria, sortBy) };
  });
  router.post('/api/bookings', async ({ request, body }) => ({
    status: 201,
    body: await bookingService.createBooking({
      tierId: body?.tierId,
      quantity: body?.quantity,
      userId: requireUserId(request),
    }),
  }));
  router.post('/api/bookings/:reference/pay', async ({ request, params, body }) => ({
    status: 200,
    body: await bookingService.pay(params.reference, requireUserId(request), body?.decline ?? false),
  }));
  router.post('/api/bookings/:reference/cancel', async ({ request, params }) => ({
    status: 200,
    body: await bookingService.cancel(params.reference, requireUserId(request)),
  }));

  return router;
}
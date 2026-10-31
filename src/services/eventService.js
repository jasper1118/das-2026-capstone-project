import { createEvent as createDomainEvent, createStore } from '../domain/inventory.js';

export function createEventService(store = createStore()) {
  return {
    createEvent(details) {
      return createDomainEvent(store, details);
    },
  };
}
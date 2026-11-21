import { listEvents } from '../api.js';
import { el, eventArtFor, formatEventDate, formatPrice } from '../ui.js';

const filterForm = document.querySelector('#event-filters');
const searchInput = document.querySelector('#search-events');
const citySelect = document.querySelector('#city-filter');
const priceInput = document.querySelector('#price-filter');
const sortSelect = document.querySelector('#sort-filter');
const eventGrid = document.querySelector('#event-grid');
const resultCount = document.querySelector('#result-count');
const spotlight = document.querySelector('#spotlight');
let requestNumber = 0;

function eventCard(event, index) {
  const art = eventArtFor(event.id);
  const price = event.minPriceCents === null ? 'Price TBA' : `From ${formatPrice(event.minPriceCents)}`;
  const image = el('img', {
    src: art.src,
    alt: art.alt,
    loading: index < 3 ? 'eager' : 'lazy',
    decoding: 'async',
  });
  const imageLink = el('a', {
    className: 'event-image-link',
    href: `/event.html?id=${encodeURIComponent(event.id)}`,
    'aria-label': `View ${event.title}`,
  }, image);
  const category = el('span', { className: 'event-category' }, art.kind);
  const date = el('p', { className: 'event-date' }, formatEventDate(event.startsAt));
  const title = el('h3', {}, el('a', { href: `/event.html?id=${encodeURIComponent(event.id)}` }, event.title));
  const venue = el('p', { className: 'event-venue' }, `${event.venue} · ${event.city}`);
  const footer = el('div', { className: 'event-card-footer' }, [
    el('span', { className: 'event-price' }, price),
    el('span', { className: event.seatsLeft > 0 ? 'seat-note' : 'seat-note is-sold-out' },
      event.seatsLeft > 0 ? `${event.seatsLeft} left` : 'Sold out'),
  ]);

  return el('article', { className: 'event-card', style: `--card-order:${index}` }, [
    el('div', { className: 'event-card-image' }, [imageLink, category]),
    el('div', { className: 'event-card-copy' }, [date, title, venue, footer]),
  ]);
}

function renderSpotlight(event) {
  const art = eventArtFor(event.id);
  const image = el('img', { src: art.src, alt: art.alt, loading: 'eager', decoding: 'async' });
  const imageLink = el('a', {
    className: 'spotlight-image',
    href: `/event.html?id=${encodeURIComponent(event.id)}`,
    'aria-label': `View featured event: ${event.title}`,
  }, image);
  const details = el('div', { className: 'spotlight-copy' }, [
    el('p', { className: 'spotlight-label' }, [el('span', { className: 'spotlight-star', 'aria-hidden': 'true' }, '✳'), ' THE WEEKEND EDIT']),
    el('p', { className: 'spotlight-date' }, `${formatEventDate(event.startsAt, { weekday: 'long', month: 'long' })} · ${event.city}`),
    el('h2', {}, event.title),
    el('p', { className: 'spotlight-venue' }, event.venue),
    el('a', { className: 'button button-dark', href: `/event.html?id=${encodeURIComponent(event.id)}` }, [
      'See the event', el('span', { 'aria-hidden': 'true' }, '↗'),
    ]),
  ]);
  spotlight.replaceChildren(imageLink, details);
}

function renderEmptyState() {
  return el('div', { className: 'empty-state' }, [
    el('span', { className: 'empty-index' }, '0 results'),
    el('h3', {}, 'Nothing on this wavelength.'),
    el('p', {}, 'Try another search or loosen a filter to see what is happening.'),
    el('button', { className: 'button button-outline', type: 'button', onClick: () => filterForm.reset() }, 'Clear filters'),
  ]);
}

async function updateEvents() {
  const currentRequest = ++requestNumber;
  const rawPrice = priceInput.value.trim();
  const maxPriceCents = rawPrice === '' ? undefined : Math.round(Number(rawPrice) * 100);
  const events = await listEvents({
    q: searchInput.value,
    city: citySelect.value,
    maxPriceCents,
    sort: sortSelect.value,
  });
  if (currentRequest !== requestNumber) return;

  resultCount.textContent = `${String(events.length).padStart(2, '0')} ${events.length === 1 ? 'EVENT' : 'EVENTS'}`;
  eventGrid.setAttribute('aria-busy', 'false');
  eventGrid.replaceChildren(...(events.length ? events.map(eventCard) : [renderEmptyState()]));
}

async function initialize() {
  const events = await listEvents({ sort: 'date' });
  const cities = [...new Set(events.map((event) => event.city))].sort((a, b) => a.localeCompare(b));
  for (const city of cities) citySelect.append(el('option', { value: city }, city));
  if (events.length) renderSpotlight(events[0]);

  filterForm.addEventListener('input', updateEvents);
  filterForm.addEventListener('change', updateEvents);
  filterForm.addEventListener('reset', () => requestAnimationFrame(updateEvents));
  await updateEvents();
}

initialize().catch((error) => {
  eventGrid.setAttribute('aria-busy', 'false');
  eventGrid.replaceChildren(el('p', { className: 'load-error', role: 'alert' }, error.message));
});
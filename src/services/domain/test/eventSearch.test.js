import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterEvents, searchEvents, sortEvents } from '../eventSearch.js';
import { mergeSort } from '../sorting.js';

function event(id, title, startsAt, {
  city = 'Lagos', venue = 'Main Hall', prices = [1000], seats = [5],
} = {}) {
  const tiers = prices.map((priceCents, index) => ({
    id: `${id}-tier-${index}`,
    priceCents,
    seatsLeft: seats[index] ?? 0,
  }));
  return {
    id,
    title,
    city,
    venue,
    startsAt,
    tiers,
    cheapestPriceCents: tiers.length ? Math.min(...prices) : undefined,
    seatsLeft: seats.reduce((total, value) => total + value, 0),
  };
}

const jazz = event('jazz', 'Abuja Jazz Night', '2026-12-05T17:00:00.000Z', {
  city: 'Abuja', venue: 'City Arena', prices: [4500, 7000], seats: [10, 5],
});
const meetup = event('meetup', 'Lagos Tech Meetup', '2026-12-06T12:00:00.000Z', {
  venue: 'Jazz Hall', prices: [2500], seats: [2],
});

describe('event filtering and search', () => {
  it('S05: matches title or venue text without regard to case', () => {
    assert.deepEqual(searchEvents([meetup, jazz], { q: 'JAZZ' }, 'date').map(({ id }) => id), ['jazz', 'meetup']);
    assert.deepEqual(filterEvents([meetup, jazz], { q: 'tech' }).map(({ id }) => id), ['meetup']);
  });

  it('S05: matches city exactly without regard to case', () => {
    assert.deepEqual(filterEvents([jazz, meetup], { city: 'lagos' }).map(({ id }) => id), ['meetup']);
  });

  it('S05: filters by cheapest tier price, sorts cheapest first, and excludes events without tiers', () => {
    const pricey = event('pricey', 'Pricey Show', '2026-12-07T12:00:00.000Z', { prices: [6000] });
    const noTiers = {
      ...event('none', 'No Tickets', '2026-12-08T12:00:00.000Z', { prices: [], seats: [] }),
      cheapestPriceCents: 1,
    };
    assert.deepEqual(
      searchEvents([jazz, pricey, meetup, noTiers], { maxPriceCents: 5000 }, 'price').map(({ id }) => id),
      ['meetup', 'jazz'],
    );
  });

  it('S05: sorts dates earliest first and same-day events by title', () => {
    const laterSameDay = event('z', 'Zulu', '2026-12-05T18:00:00.000Z');
    const earlierSameDay = event('a', 'Alpha', '2026-12-05T17:00:00.000Z');
    const nextDay = event('n', 'Next Day', '2026-12-06T00:00:00.000Z');
    assert.deepEqual(sortEvents([nextDay, laterSameDay, earlierSameDay], 'date').map(({ id }) => id), ['a', 'z', 'n']);
  });

  it('S05: includes an event late on the inclusive date-only end day', () => {
    assert.deepEqual(filterEvents([jazz], { to: '2026-12-05' }).map(({ id }) => id), ['jazz']);
    assert.deepEqual(filterEvents([jazz], { from: '2026-12-05', to: '2026-12-05' }).map(({ id }) => id), ['jazz']);
  });

  it('S05: rejects invalid dates, fractional prices, and unknown sort options with VALIDATION', () => {
    assert.throws(() => filterEvents([jazz], { from: 'not-a-date' }), { code: 'VALIDATION' });
    assert.throws(() => filterEvents([jazz], { to: '2026-02-30' }), { code: 'VALIDATION' });
    assert.throws(() => filterEvents([jazz], { maxPriceCents: 100.5 }), { code: 'VALIDATION' });
    assert.throws(() => sortEvents([jazz], 'unknown'), { code: 'VALIDATION' });
  });

  it('S05: returns fresh lists and leaves input unchanged after filtering, sorting, and searching', () => {
    const input = [meetup, jazz];
    const original = [...input];
    assert.notEqual(filterEvents(input, { city: 'lagos' }), input);
    assert.notEqual(sortEvents(input, 'date'), input);
    assert.notEqual(searchEvents(input, {}, 'price'), input);
    assert.deepEqual(input, original);
  });

  it('S05: filters out sold-out events when onlyAvailable is true', () => {
    const soldOut = event('sold', 'Sold Out', '2026-12-05T12:00:00.000Z', { seats: [0] });
    assert.deepEqual(filterEvents([soldOut, jazz], { onlyAvailable: true }).map(({ id }) => id), ['jazz']);
  });

  it('handles empty input for filtering, sorting, and searching', () => {
    assert.deepEqual(filterEvents([], {}), []);
    assert.deepEqual(sortEvents([], 'date'), []);
    assert.deepEqual(searchEvents([], {}, 'availability'), []);
  });

  it('sorts availability descending, then title and id for ties', () => {
    const second = event('b', 'Same', '2026-12-05T12:00:00.000Z', { seats: [8] });
    const first = event('a', 'Same', '2026-12-05T12:00:00.000Z', { seats: [8] });
    assert.deepEqual(sortEvents([jazz, second, first], 'availability').map(({ id }) => id), ['jazz', 'a', 'b']);
  });
});

it('mergeSort is stable, returns a new array, and does not mutate input', () => {
  const input = [{ key: 2, order: 'first' }, { key: 1, order: 'middle' }, { key: 2, order: 'last' }];
  const original = [...input];
  const result = mergeSort(input, (left, right) => left.key - right.key);

  assert.notEqual(result, input);
  assert.deepEqual(result.map(({ order }) => order), ['middle', 'first', 'last']);
  assert.deepEqual(input, original);
  assert.deepEqual(mergeSort([], () => 0), []);
});
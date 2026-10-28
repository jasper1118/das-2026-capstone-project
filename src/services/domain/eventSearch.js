import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'Event summaries must be an array');
  }
}

function parseDate(value, field) {
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  const datePart = /^(\d{4}-\d{2}-\d{2})(.*)$/.exec(value);
  if (!datePart || (datePart[2] !== '' && !datePart[2].startsWith('T'))) {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  const midnight = new Date(`${datePart[1]}T00:00:00.000Z`);
  if (midnight.toISOString().slice(0, 10) !== datePart[1]) {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  return { timestamp, dateOnly: datePart[2] === '' };
}

function eventTimestamp(summary) {
  const timestamp = Date.parse(summary.startsAt);
  if (!Number.isFinite(timestamp)) {
    throw new DomainError('VALIDATION', 'Event startsAt must be a valid date');
  }
  return timestamp;
}

function eventTiers(summary) {
  return Array.isArray(summary.tiers) ? summary.tiers : [];
}

function cheapestPrice(summary) {
  if (Array.isArray(summary.tiers)) {
    if (summary.tiers.length === 0) return undefined;
    return Math.min(...summary.tiers.map((tier) => tier.priceCents));
  }
  return summary.cheapestPriceCents;
}

function availableSeats(summary) {
  if (Number.isSafeInteger(summary.seatsLeft)) return summary.seatsLeft;
  return eventTiers(summary).reduce((total, tier) => {
    const left = Number.isSafeInteger(tier.seatsLeft) ? tier.seatsLeft : tier.capacity - tier.sold;
    return total + left;
  }, 0);
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function compareByTitleAndId(left, right) {
  return compareText(left.title, right.title) || compareText(left.id, right.id);
}

export function filterEvents(summaries, {
  q,
  city,
  from,
  to,
  maxPriceCents,
  onlyAvailable,
} = {}) {
  requireSummaries(summaries);

  if (q !== undefined && typeof q !== 'string') {
    throw new DomainError('VALIDATION', 'q must be text');
  }
  if (city !== undefined && typeof city !== 'string') {
    throw new DomainError('VALIDATION', 'city must be text');
  }
  if (maxPriceCents !== undefined
    && (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number of cents');
  }

  const fromDate = from === undefined ? undefined : parseDate(from, 'from');
  const toDate = to === undefined ? undefined : parseDate(to, 'to');
  const afterTo = toDate?.dateOnly ? toDate.timestamp + 24 * 60 * 60 * 1000 : undefined;
  const searchText = q?.toLowerCase();
  const searchCity = city?.toLowerCase();

  return summaries.filter((summary) => {
    if (searchText && !`${summary.title ?? ''} ${summary.venue ?? ''}`.toLowerCase().includes(searchText)) {
      return false;
    }
    if (searchCity !== undefined && String(summary.city ?? '').toLowerCase() !== searchCity) {
      return false;
    }

    const startsAt = fromDate || toDate ? eventTimestamp(summary) : undefined;
    if (fromDate && startsAt < fromDate.timestamp) return false;
    if (toDate && (afterTo !== undefined ? startsAt >= afterTo : startsAt > toDate.timestamp)) {
      return false;
    }
    if (maxPriceCents !== undefined) {
      const price = cheapestPrice(summary);
      if (!Number.isSafeInteger(price) || price > maxPriceCents) return false;
    }
    if (onlyAvailable && availableSeats(summary) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  requireSummaries(summaries);
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', `Unknown event sort option: ${sortBy}`);
  }

  const compare = (left, right) => {
    let result = 0;
    if (sortBy === 'date') {
      result = eventTimestamp(left) - eventTimestamp(right);
    } else if (sortBy === 'price') {
      const leftPrice = cheapestPrice(left);
      const rightPrice = cheapestPrice(right);
      if (leftPrice === undefined && rightPrice !== undefined) result = 1;
      else if (leftPrice !== undefined && rightPrice === undefined) result = -1;
      else if (leftPrice !== undefined && rightPrice !== undefined) result = leftPrice - rightPrice;
    } else {
      result = availableSeats(right) - availableSeats(left);
    }
    return result || compareByTitleAndId(left, right);
  };

  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
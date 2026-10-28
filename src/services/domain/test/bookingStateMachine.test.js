import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTransition,
  BOOKING_STATES,
  canTransition,
} from '../bookingStateMachine.js';

const allowedTransitions = [
  ['pending', 'paid'],
  ['pending', 'cancelled'],
  ['paid', 'checked_in'],
  ['paid', 'refunded'],
  ['paid', 'cancelled'],
];

const states = Object.values(BOOKING_STATES);
const allowedTransitionKeys = new Set(allowedTransitions.map(([from, to]) => `${from}:${to}`));
const illegalTransitions = states.flatMap((from) => states
  .filter((to) => !allowedTransitionKeys.has(`${from}:${to}`))
  .map((to) => [from, to]));

describe('booking state machine', () => {
  it('allows every specified transition', () => {
    for (const [from, to] of allowedTransitions) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
      assert.doesNotThrow(() => assertTransition(from, to));
    }
  });

  it('rejects every other state pair with INVALID_TRANSITION', () => {
    for (const [from, to] of illegalTransitions) {
      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
      assert.throws(() => assertTransition(from, to), { code: 'INVALID_TRANSITION' });
    }
  });

  it('rejects unknown states', () => {
    assert.equal(canTransition('unknown', 'paid'), false);
    assert.throws(() => assertTransition('pending', 'unknown'), {
      code: 'INVALID_TRANSITION',
    });
  });
});
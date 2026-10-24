import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatNaira } from '../money.js'

describe('formatNaira', () => {
    it('should show kobo as naira with 2 decimal places',() => {
        assert.equal(formatNaira(0), '₦0.00')
        assert.equal(formatNaira(1), '₦0.01')
        assert.equal(formatNaira(10), '₦0.10')
        assert.equal(formatNaira(100), '₦1.00')
        assert.equal(formatNaira(123456789), '₦1234567.89')
    })
})

it ('should throw an error  for negative kobo', () => {
    assert.throws(() => formatNaira(-1), {
        message: 'Kobo must be a whole number, zero or greater'
    })
})
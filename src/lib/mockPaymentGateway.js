export function createMockPaymentGateway() {
  return {
    async charge({ amountCents, decline = false }) {
      if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
        throw new TypeError('amountCents must be a whole number of cents');
      }
      return { approved: !decline };
    },
  };
}
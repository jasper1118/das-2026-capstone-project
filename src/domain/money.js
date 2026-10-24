export function formatNaira(kobo) {
    if (!Number.isInteger(kobo) || kobo < 0) {
        throw new Error('Kobo must be a whole number, zero or greater');
    }

    return '₦' + (kobo / 100).toFixed(2)
}

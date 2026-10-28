export function mergeSort(items, compare) {
  if (!Array.isArray(items) || typeof compare !== 'function') {
    throw new TypeError('mergeSort expects an array and a comparison function');
  }

  function sortRange(start, end) {
    if (end - start <= 1) return items.slice(start, end);

    const middle = Math.floor((start + end) / 2);
    const left = sortRange(start, middle);
    const right = sortRange(middle, end);
    const merged = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      if (compare(left[leftIndex], right[rightIndex]) <= 0) {
        merged.push(left[leftIndex]);
        leftIndex += 1;
      } else {
        merged.push(right[rightIndex]);
        rightIndex += 1;
      }
    }

    return merged.concat(left.slice(leftIndex), right.slice(rightIndex));
  }

  return sortRange(0, items.length);
}
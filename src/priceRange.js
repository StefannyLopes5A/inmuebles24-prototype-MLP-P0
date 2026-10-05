const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The graph selects whole price bins; typed amounts retain their exact values.
export function selectedPriceBars(bins, min, max) {
  const width = bins[0].max - bins[0].min;
  return {
    first:clamp(Math.floor(min / width), 0, bins.length - 1),
    last:clamp(Math.ceil(max / width) - 1, 0, bins.length - 1),
  };
}

export function priceRangeEdge(position, {first, last}) {
  return position < (first + last + 1) / 2 ? 'min' : 'max';
}

export function priceRangeAtBar(bins, min, max, edge, index) {
  const {first, last} = selectedPriceBars(bins, min, max);
  // Never cross the other bound, including a typed range beyond this graph.
  if (edge === 'min') return {minBudget:bins[clamp(index, 0, last)].min, budget:max};
  if (min >= bins.at(-1).max) return {minBudget:min, budget:max};
  return {minBudget:min, budget:Math.max(min, bins[clamp(index, first, bins.length - 1)].max)};
}

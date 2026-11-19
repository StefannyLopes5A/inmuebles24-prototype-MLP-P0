/**
 * Price history for a sale: twelve months of the colonia's m² (ending at the median the location section shows and
 * following its trend line), plus this listing's own events and its own m² line from the month it was published.
 * A listing only weeks old has no year of asking prices, so its line is short and the colonia's curve gives the context.
 */
import {listingPrice} from './data.js';
import {pricePerM2} from './compareReading.js';
import {marketFacts} from './moraAnalysis.js';

const MONTHS = 12;
const DAY = 86400000;
const step = value => Math.round(value / 100) * 100;

const hashOf = text => [...String(text)].reduce((sum, char) => (Math.imul(sum, 31) + char.charCodeAt(0)) >>> 0, 7);
/** Stable pseudo-random numbers in [0, 1) for one listing, so its simulated history never changes between visits. */
const unitFor = (home, index) => (hashOf(`${home.id}|${index}`) % 1000) / 1000;
const round5k = value => Math.round(value / 5000) * 5000;
/** Price changes before the latest drop: the story starts with the first publication at the start of the chart. */
const EARLIER_CHANGES = 4;

export function priceHistory(home, hood, now = new Date()) {
  if (!home || home.development || home.mode !== 'buy' || !hood?.medianPerM2 || hood.trend?.spark?.length !== MONTHS) return null;
  const price = listingPrice(home);
  if (!(price > 0)) return null;
  const {spark, spoilerPct, forecast1, direction} = hood.trend;
  const last = hood.medianPerM2, first = last / (1 + spoilerPct / 100);
  const chord = index => spark[0] + (spark[MONTHS - 1] - spark[0]) * index / (MONTHS - 1);
  const months = spark.map((point, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1) + index, 1);
    const value = index === MONTHS - 1 ? last : step(first + (last - first) * index / (MONTHS - 1) + (point - chord(index)) * last * 0.0016);
    return {date, value};
  }).map((month, index, list) => ({...month, change:index ? month.value / list[index - 1].value - 1 : null}));

  const facts = marketFacts(home);
  const daysAgo = days => new Date(now.getTime() - days * DAY);
  // The event list is this listing's own story: the first publication at the start of the chart, four earlier price
  // changes, the republication that gives the current days on the platform, and the latest drop. The colonia's m² stays in the chart.
  const before = price + (facts.drop || 0);
  const firstDay = new Date(months[0].date.getTime() + 2 * DAY);
  const republishedAt = daysAgo(facts.days);
  const span = republishedAt - firstDay - 9 * DAY;
  const dated = Array.from({length:EARLIER_CHANGES}, (_, index) =>
    new Date(firstDay.getTime() + 7 * DAY + span * (index + 0.5 + (unitFor(home, index) - 0.5) * 0.5) / EARLIER_CHANGES));
  // Walked back from the price at republication: mostly cuts, and now and then a rise on the way.
  const prices = [before];
  for (let index = EARLIER_CHANGES - 1; index >= 0; index -= 1) {
    const rise = unitFor(home, 10 + index) < 0.3;
    const move = rise ? -(0.015 + unitFor(home, 20 + index) * 0.015) : 0.02 + unitFor(home, 20 + index) * 0.05;
    const older = round5k(prices[0] * (1 + move));
    prices.unshift(older === prices[0] ? older + 5000 : older);
  }
  const changes = dated.map((date, index) => ({kind:'change', date, value:prices[index + 1], delta:prices[index + 1] - prices[index]}));
  const events = [
    {kind:'listed', date:firstDay, value:prices[0]},
    ...changes,
    {kind:'republished', date:republishedAt, value:before},
    ...(facts.drop ? [{kind:'drop', date:daysAgo(facts.dropDays), value:price, drop:facts.drop}] : []),
  ];
  const rows = [...events].sort((a, b) => b.date - a.date);

  // This listing's own m² price month by month, from the first publication: it follows the asking price after each change.
  // It sits on the same scale as the colonia's m², so the two can be read against each other.
  const ppm2 = pricePerM2(home);
  const priceAt = end => [...events].filter(event => event.date <= end).sort((a, b) => b.date - a.date)[0]?.value ?? null;
  const listing = months.map((month, index) => {
    const end = index === MONTHS - 1 ? now : new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0);
    const asked = priceAt(end);
    if (!(ppm2 > 0) || asked == null) return null;
    return {date:month.date, value:index === MONTHS - 1 ? Math.round(ppm2) : step(ppm2 * asked / price)};
  });

  return {
    area:hood.name, price, months, listing, rows, direction,
    change:spoilerPct / 100,
    forecast:forecast1 / 100,
    days:facts.days, drop:facts.drop, dropDays:facts.dropDays,
    priceChanges:events.filter(event => event.kind === 'change' || event.kind === 'drop').length,
  };
}

/**
 * Price history for a sale: twelve months of the colonia's m² (ending at the median the location section shows and
 * following its trend line), plus this listing's own events. A listing only weeks old has no year of asking prices,
 * so the curve is the colonia's and the dated events are the listing's.
 */
import {listingPrice} from './data.js';
import {marketFacts} from './moraAnalysis.js';

const MONTHS = 12;
const DAY = 86400000;
const step = value => Math.round(value / 100) * 100;

/** Simulated and stable per listing: roughly one in four was taken down and published again. */
const republished = home => [...String(home.id)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7) % 4 === 0;

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
  // The event list is this listing's own story: publication, republication and price changes. The colonia's m² stays in the chart.
  const before = price + (facts.drop || 0);
  const events = [{kind:'listed', date:daysAgo(facts.days), value:before}];
  const earliest = facts.drop ? facts.dropDays : 0;
  if (republished(home) && facts.days - earliest > 6) events.push({kind:'republished', date:daysAgo(Math.round((facts.days + earliest) / 2)), value:before});
  if (facts.drop) events.push({kind:'drop', date:daysAgo(facts.dropDays), value:price, drop:facts.drop});
  const rows = events.sort((a, b) => b.date - a.date);

  return {
    area:hood.name, price, months, rows, direction,
    change:spoilerPct / 100,
    forecast:forecast1 / 100,
    days:facts.days, drop:facts.drop, dropDays:facts.dropDays,
  };
}

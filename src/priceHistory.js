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
  const events = [{kind:'listed', date:daysAgo(facts.days), value:price + (facts.drop || 0)}];
  if (facts.drop) events.push({kind:'drop', date:daysAgo(facts.dropDays), value:price, drop:facts.drop});

  // A month's reading closes at the end of the month; the current one closes today.
  const monthRows = months.map((month, index) => ({kind:'month', ...month,
    date:index === MONTHS - 1 ? now : new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0)}));
  const rows = [...events, ...monthRows].sort((a, b) => b.date - a.date);

  return {
    area:hood.name, price, months, rows, direction,
    change:spoilerPct / 100,
    forecast:forecast1 / 100,
    days:facts.days, drop:facts.drop, dropDays:facts.dropDays,
  };
}

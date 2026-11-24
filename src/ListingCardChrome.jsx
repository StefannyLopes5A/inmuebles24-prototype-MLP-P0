import React, {useState} from 'react';
import {cardAgencyLogo} from './data';
import {advertiserFor} from './listingAdvertiser';
import {agencyServiceTooltip, agencyTopService} from './listingCardTags';

const SEAL_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

const BOX_PATH = 'M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 13v-8M3 8l9 5';

function TourTag({label}) {
  // Each card starts its pass at its own moment, so a grid never flashes in sync.
  const [delay] = useState(() => `${(Math.random() * 1.5).toFixed(2)}s`);
  return <span className="discovery-tag is-tour3d" style={{'--shimmer-delay':delay}}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={BOX_PATH}/></svg>
    {label}
  </span>;
}

export function ListingTagList({tags}) {
  return tags.map(tag => tag.shimmer ? <TourTag key={tag.id} label={tag.label}/> : <span className="discovery-tag" data-tag={tag.id} key={tag.id}>{tag.label}</span>);
}

export function ListingAgencyLogo({home, say, logoSrc, alt, imageClass = 'discovery-agency-logo'}) {
  const advertiser = advertiserFor(home);
  const src = logoSrc ?? cardAgencyLogo(home);
  const top = agencyTopService(advertiser.rating);
  const tip = agencyServiceTooltip(say);
  return <span className="discovery-agency-wrap">
    <img className={imageClass} src={src} alt={alt ?? (home.brokerLogo ? home.broker : advertiser.logo ? advertiser.name : '')} loading="lazy"/>
    {top && <span className="discovery-agency-seal" tabIndex={0} data-tooltip={tip} role="img" aria-label={tip}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d={SEAL_PATH} fill="currentColor"/></svg>
    </span>}
  </span>;
}

export function AgencyServiceSeal({advertiser, say, className = 'discovery-agency-seal is-host'}) {
  if (!agencyTopService(advertiser.rating)) return null;
  const tip = agencyServiceTooltip(say);
  return <span className={className} tabIndex={0} data-tooltip={tip} role="img" aria-label={tip}>
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d={SEAL_PATH} fill="currentColor"/></svg>
  </span>;
}

const MORA_MARK = '/assets/mini-listing/mora.svg';
const ARROW_DOWN = <svg width="8" height="9" viewBox="0 0 8 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 1v6.5M1 5l3 3 3-3"/></svg>;
const TREND_UP = <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 8l4-4 2.5 2.5L13 1M9.5 1H13v3.5"/></svg>;
const tipText = tip => tip.join('');

/** The price-drop (`drop`) or high-demand (`demand`) pill. The tooltip text also rides along for screen readers. */
export function HighlightPill({kind, copy}) {
  // The card opens its listing on click; a tap on the pill only shows the toast (the app listens for this event).
  const show = event => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('listing-highlight', {detail:{text:tipText(copy.tip)}}));
  };
  return <span className={`discovery-pill is-${kind}`} data-kind={kind} onClick={show}>
    {kind === 'drop' ? ARROW_DOWN : TREND_UP}<span className="discovery-pill-label">{copy.label}</span>
    <span className="sr-only">. {tipText(copy.tip)}</span>
  </span>;
}

/** Mora's tooltip for a pill. It lives on the card, outside the photo, so it can overflow it. */
export function HighlightTip({kind, copy}) {
  const [before, bold, after] = copy.tip;
  return <span className="discovery-tip" data-kind={kind} aria-hidden="true">
    <img src={MORA_MARK} alt="" width="24" height="24"/>
    <span>{before}<b>{bold}</b>{after}</span>
  </span>;
}

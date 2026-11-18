import React from 'react';
import {HouseCard} from './Home';
import {RailHeading, useRailScroll} from './DiscoveryRail.jsx';
import {useLanguage} from './i18n';

const TITLE = 'Resultados en localidades próximas';
const SUBTITLE = 'Mantente atento a las propiedades más deseadas';

/** Listing carousel after the results pager. Figma 12900:16041. */
export function NearbyResults({homes, saved, onLike, onOpen, receipts = [], search, pref = 'none'}) {
  const {t} = useLanguage();
  const title = t(TITLE);
  const {rail, position, measure, move} = useRailScroll([homes.length, homes[0]?.id]);
  if (homes.length < 2) return null;
  return <section className="discovery-section nearby-results" aria-labelledby="nearby-results-title">
    <RailHeading
      titleId="nearby-results-title"
      title={title}
      subtitle={t(SUBTITLE)}
      prevLabel={t('Anterior: ') + title}
      nextLabel={t('Siguiente: ') + title}
      position={position}
      onMove={move}/>
    <div className="discovery-rail nearby-results-rail" ref={rail} onScroll={measure}>
      {homes.map(home => <HouseCard key={home.id} home={home} search={search} pref={pref} contacted={receipts.some(receipt => receipt.propertyId === home.id)} saved={saved.includes(home.id)} onLike={onLike} onOpen={onOpen}/>)}
    </div>
  </section>;
}

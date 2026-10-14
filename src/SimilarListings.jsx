import React from 'react';
import {HouseCard} from './Home';

/** Up to ten listings like this one, five per row on desktop, with the same card as the results grid. */
export function SimilarListings({items, saved = [], receipts = [], onLike, onOpen}) {
  if (!items.length) return null;
  return <div className="pp-similar">
    {items.map(home => <HouseCard key={home.id} home={home} saved={saved.includes(home.id)} contacted={receipts.some(receipt => receipt.propertyId === home.id)} onLike={onLike} onOpen={() => onOpen(home)}/>)}
  </div>;
}

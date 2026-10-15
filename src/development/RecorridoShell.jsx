import React from 'react';
import {listingCoverSrc} from '../heroMorph';

/** Full-bleed cover: morph target while the 3D chunk loads, the same frame the mini-listing was showing. */
export function RecorridoShell({home}) {
  return <div className="recorrido-page">
    <div className="recorrido-stage"><img className="recorrido-cover" src={listingCoverSrc() || home.image} alt=""/></div>
  </div>;
}

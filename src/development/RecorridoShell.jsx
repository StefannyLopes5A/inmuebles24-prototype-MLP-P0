import React from 'react';

/** The bar and the cover photo. It is the morph target while the 3D chunk loads, and the page wears it too. */
export function RecorridoBar({onHome, children}) {
  return <header className="recorrido-bar">
    <button type="button" className="brand" onClick={onHome} aria-label="Inmuebles24"><img src="/assets/figma-home/d0d59.svg" alt="Inmuebles24"/></button>
    {children}
  </header>;
}

export function RecorridoShell({home}) {
  return <div className="recorrido-page">
    <RecorridoBar/>
    <div className="recorrido-stage"><img className="recorrido-cover" src={home.image} alt=""/></div>
  </div>;
}

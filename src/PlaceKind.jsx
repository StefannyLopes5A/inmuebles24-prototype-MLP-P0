import React from 'react';

const LABELS = {
  state:['Estado', 'Estado'],
  city:['Cidade', 'Ciudad'],
  colonia:['Bairro', 'Colonia'],
  area:['Bairro', 'Colonia'],
  street:['Rua', 'Calle'],
  university:['Universidade', 'Universidad'],
  school:['Escola', 'Escuela'],
  hospital:['Hospital', 'Hospital'],
  metro:['Metrô', 'Metro'],
  comercio:['Comércio', 'Comercio'],
  parque:['Parque', 'Parque'],
  supermercado:['Supermercado', 'Supermercado'],
  cafe:['Café', 'Café'],
  bar_restaurante:['Restaurante', 'Restaurante'],
  poi:['Ponto de interesse', 'Punto de interés'],
};

const ICON = {
  state:<path d="M5 21V4l7 3 7-3v17l-7-3-7 3Z"/>,
  city:<><path d="M4 21V9l4-2v14"/><path d="M8 21V6l8 3v12"/><path d="M16 21v-9l4 2v7"/><path d="M3 21h18"/></>,
  colonia:<><path d="M3 11 8 7l5 4v8H3v-8Z"/><path d="M13 14l4-3 4 3v5h-8v-5Z"/></>,
  street:<><path d="M7 20 10 4"/><path d="M14 20 17 4"/><path d="M9 9h2M9 13h2M9 17h2"/></>,
  university:<path d="m3 10 9-5 9 5-9 5-9-5Zm4 2.5V17c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5"/>,
  school:<><path d="M4 20V9l8-5 8 5v11"/><path d="M10 20v-5h4v5"/><path d="M4 20h16"/></>,
  hospital:<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></>,
  metro:<><rect x="4" y="6" width="16" height="12" rx="3"/><path d="M8 18v2M16 18v2M8 6V4M16 6V4M4 12h16"/></>,
  comercio:<><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
  parque:<><path d="M12 20v-5"/><path d="M12 15c-4 0-6-2.6-6-5.5C9 9.5 10.5 10.4 12 13c1.5-2.6 3-3.5 6-3.5C18 12.4 16 15 12 15Z"/></>,
  supermercado:<><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/><path d="M4 5h2l1.5 9h11L20 8H7"/></>,
  cafe:<><path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 5c.6.8.6 1.4 0 2.2M11 5c.6.8.6 1.4 0 2.2"/></>,
  bar_restaurante:<><path d="M7 3v6a2 2 0 0 0 2 2v9"/><path d="M7 7h2"/><path d="M17 3v18"/><path d="M17 7h2.5a2 2 0 0 0 0-4H17"/></>,
  poi:<><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></>,
};

export function placeIconId(place) {
  if (place?.group && place.group !== 'poi') return place.group;
  return place?.category || place?.kind || 'poi';
}

/** Type under the name: “Comercio · Roma Norte”. A city, state or colonia is the place itself. */
export function placeKindCopy(place, say) {
  const key = placeIconId(place);
  const pair = LABELS[key] || LABELS.poi;
  const broad = key === 'colonia' || key === 'area' || key === 'city' || key === 'state';
  const where = broad ? '' : place?.area || place?.hint || '';
  return [say(pair[0], pair[1]), where].filter(Boolean).join(' · ');
}

export function PlaceKindIcon({place}) {
  return <svg className="place-kind-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[placeIconId(place)] || ICON.poi}</svg>;
}

export function PlaceOptionBody({place, say}) {
  return <><PlaceKindIcon place={place}/><span className="place-option-copy"><b>{place.label}</b><small>{placeKindCopy(place, say)}</small></span></>;
}

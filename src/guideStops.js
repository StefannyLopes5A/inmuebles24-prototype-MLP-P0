/**
 * The presenter's guide: ten stops through the MLP prototype. English only, on purpose; the product it points to keeps
 * its own language. Each action is resolved by App, and `target` is what the ring outlines once the stage folds away.
 * Every stop points to something that is in this version (P0); nothing here opens a removed feature.
 */
export const GUIDE_STOPS = [
  {
    id:'home',
    title:'Home search',
    body:'One sentence with two filters, the operation and the property type, and a location input that only takes places. The search starts once a place is chosen.',
    actions:[{id:'home', label:'Open home', target:'.home-search'}],
  },
  {
    id:'results',
    title:'Results bar',
    body:'The first cell is the location input. Operation and property type sit with the quick filters, and the filter panel opens from “Más filtros”.',
    actions:[
      {id:'results', label:'Results bar', target:'.mora-bar'},
      {id:'all-filters', label:'Filter panel', target:'.all-filters-dialog'},
    ],
  },
  {
    id:'price',
    title:'Price signals',
    body:'Cards carry the price-drop pill, and the fair-price sort puts the best-priced homes first. The listing page explains the score.',
    actions:[
      {id:'sort-price', label:'Sort by fair price', target:'.flow-sort'},
      {id:'mora-price', label:'Price verdict on a listing', target:'.pp-mora-section'},
    ],
  },
  {
    id:'map',
    title:'Map',
    body:'A floating card opens the map as a full-screen page, with the price on every pin. Back returns to the list.',
    actions:[
      {id:'map-float', label:'Floating map card', target:'.map-float'},
      {id:'map-full', label:'Open full-screen map', target:'.rm-page'},
    ],
  },
  {
    id:'primary',
    title:'Primary market',
    body:'Desarrollos is an operation of its own. Torre Olmo reads as any other listing, with the default card and the default listing page.',
    actions:[{id:'development', label:'Open Desarrollos', target:'[data-home-id="torre-olmo"]'}],
  },
  {
    id:'listing',
    title:'Listing page',
    body:'The photo gallery, the facts, Mora’s price verdict, the location map and the agency reviews, with similar properties at the end.',
    actions:[{id:'listing', label:'Open a listing', target:'.pp-gallery'}],
  },
  {
    id:'seo',
    title:'SEO content',
    body:'City and neighborhood blocks on the home and the results page, and neighborhood life on the listing. Mora does not answer about neighborhoods.',
    actions:[
      {id:'seo-home', label:'Home blocks', target:'.home-city-guide'},
      {id:'seo-results', label:'Results blocks', target:'.region-insights'},
      {id:'seo-listing', label:'Neighborhood life', target:'#pp-neighborhood'},
    ],
  },
  {
    id:'contact',
    title:'Contact',
    body:'The contact form grows inside the price card of the listing page and ends in a confirmation. Nothing is sent.',
    actions:[{id:'contact', label:'Open the contact form', target:'.lp-stage'}],
  },
  {
    id:'sign-in',
    title:'Sign-in',
    body:'Saving a favorite or a search asks you to sign in first, with a message that says why. The simulated login accepts any button.',
    actions:[
      {id:'sign-in', label:'Sign in'},
      {id:'favorite', label:'Save a favorite', target:'.account-login'},
      {id:'save-search', label:'Save a search', target:'.account-login'},
    ],
  },
  {
    id:'favorites',
    title:'Favorites',
    body:'A flat list of the homes you saved. There are no folders, comparison or sharing in this version.',
    actions:[{id:'favorites-page', label:'Open favorites', target:'.favorites-page'}],
  },
];

const GUIDE_KEY = 'inmuebles24-v2-guide';

/** `?guide=off` hides the guide for this session and `?guide=on` brings it back; the journey URL drops the param. */
export function guideEnabled(search = '', store = safeSession()) {
  const param = new URLSearchParams(search).get('guide');
  if (param === 'off' || param === 'on') {
    try { store?.setItem(GUIDE_KEY, param); } catch { /* The choice holds for this render. */ }
    return param === 'on';
  }
  try { return store?.getItem(GUIDE_KEY) !== 'off'; } catch { return true; }
}

function safeSession() {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}

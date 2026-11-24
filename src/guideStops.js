/**
 * The presenter's guide: ten stops through the prototype. English only, on purpose; the product it points to keeps
 * its own language. Each action is resolved by App, and `target` is what the ring outlines once the stage folds away.
 */
export const GUIDE_STOPS = [
  {
    id:'mora',
    title:'Mora, deterministic and not',
    body:'Home builds the search as a sentence. In results, Mora also answers questions and can step in on her own.',
    actions:[
      {id:'hybrid-search', label:'Home hybrid search', layout:'hybrid', target:'.home-search'},
      {id:'inline-search', label:'Home free search', layout:'inline', target:'.home-search'},
      {id:'original-search', label:'Home original search', layout:'original', target:'.home-search'},
      {id:'mora-answer', label:'Search conversation', target:'.mora-bar'},
      {id:'mora-suggest', label:'Neighborhood suggestion', target:'.mora-bar'},
      {id:'mora-refine', label:'Search refinement', target:'.mora-bar'},
    ],
  },
  {
    id:'map',
    title:'Map',
    body:'The full map, with Mora’s reading on the left. Her cards only appear on desktop, from 951 px.',
    actions:[{id:'map-full', label:'Open full map', target:'.map-shell[data-mode="full"]'}],
  },
  {
    id:'scarcity',
    title:'Scarcity',
    body:'Tags on the card create urgency. High demand shows when a listing already has many recent contacts.',
    actions:[
      {id:'grid', label:'Grid', target:'.discovery-tag[data-tag="demand"]'},
      {id:'sort-rarity', label:'Rarity', target:'.discovery-tag[data-tag="signal"]'},    ],
  },
  {
    id:'mini-listing',
    title:'Mini listing',
    body:'The summary grows out of the card, in its own row. Every contact state lives in that panel.',
    actions:[{id:'mini-listing', label:'Open a listing', target:'.lp-shell'}],
  },
  {
    id:'context',
    title:'Mora in context',
    body:'Mora adds a reading where you already are. Selecting a sentence on a listing calls her too.',
    actions:[
      {id:'context-panel', label:'In the panel', target:'.lp-shell .lp-mora'},
      {id:'context-listing', label:'Full listing', target:'.lp-mora'},
      {id:'context-map', label:'On the map', target:'.map-widget-stack'},
    ],
  },
  {
    id:'sign-in',
    title:'Sign-in incentives',
    body:'Saving, sharing, and alerts ask you to sign in. The third save without an account shows the invite.',
    actions:[
      {id:'sign-in', label:'Sign in'},
      {id:'favorites', label:'Favorites', target:'.discovery-like'},
      {id:'share-list', label:'Share a list', target:'.share-favorites-chip, .members-chip'},
    ],
  },
  {
    id:'profiling',
    title:'Profiling',
    body:'During search, Mora asks where you are in the move. Your filters stay the same.',
    actions:[
      {id:'ask-moment', label:'When are you moving?', target:'.mora-bar'},
      {id:'ask-credit', label:'Do you have credit?', target:'.mora-bar'},
      {id:'ask-work', label:'Working from home', target:'.mora-bar'},
    ],
  },
  {
    id:'compare',
    title:'Compare favorites',
    body:'Saved homes side by side, and what stands out in each one.',
    actions:[{id:'compare', label:'Compare favorites', target:'.compare-rail'}],
  },
  {
    id:'batch',
    title:'Leads in batches',
    body:'One message to several agencies, from the same comparison.',
    actions:[{id:'batch', label:'Message several agencies', target:'.compare-composer'}],
  },
  {
    id:'primary',
    title:'Primary market',
    body:'Torre Olmo opens as a 3D tour of the building and its units. The model runs on desktop.',
    actions:[{id:'tour', label:'Open 3D tour', target:'.recorrido-page'}],
  },
];

export const GUIDE_FOLDER_NAME = 'Guide';
export const GUIDE_COMPARE_SIZE = 4;
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

/** A folder worth comparing: the first one with three or more homes. */
export function comparableFolder(folders = []) {
  return folders.find(folder => folder.homeIds.length >= 3) || null;
}

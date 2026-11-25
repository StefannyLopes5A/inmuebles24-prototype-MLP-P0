// Torre Olmo is a fictional development (primary market): units, prices and the developer are prototype data.
// It reads as a regular listing, with the default card and the default listing page; there is no 3D tour.
const ASSETS = '/assets/developments/torre-olmo';

export const DEVELOPER = {name:'Grupo Alameda Desarrollos', logo:`${ASSETS}/grupo-alameda.svg`};

export const PRIMARY_MARKET_GALLERY = [
  'render-fachada.jpg', 'piscina.webp', 'academia.jpg', 'salao.webp', 'rooftop.webp', 'piscina-2.webp', 'salao-2.webp',
  'lobby.webp', 'salao-3.webp', 'estar.webp', 'estar-2.webp', 'rooftop-2.webp', 'aerial.jpg', 'street.jpg',
].map(file => `${ASSETS}/${file}`);

export const PRIMARY_MARKET_HOME = {
  id:'torre-olmo',
  listingId:'torre-olmo',
  development:true,
  mode:'buy',
  currency:'MXN',
  title:'Torre Olmo · Departamentos en Polanco V Sección',
  street:'Torre Olmo',
  area:'Polanco V Sección',
  location:'Polanco V Sección, Miguel Hidalgo',
  price:7350000,
  rent:null,
  beds:1,
  baths:1,
  size:64,
  features:'64–128 m² · 1–3 rec.',
  fee:null,
  broker:DEVELOPER.name,
  brokerLogo:DEVELOPER.logo,
  layout:'unknown',
  window:null,
  reason:'Preventa: unidades de 1 a 3 recámaras',
  caveat:'Precios y disponibilidad de preventa: confírmalos con la desarrolladora.',
  image:PRIMARY_MARKET_GALLERY[0],
  imageSource:PRIMARY_MARKET_GALLERY[0],
  capturedAt:'2026-10-14',
};

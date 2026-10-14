/** `minzoom`: metro and schools always show; the rest join as the user zooms in (integer zooms, as MapLibre filters evaluate per tile). */
export const POI_CATEGORIES = [
  {id: 'metro', icon: 'rail-metro', color: '#2F6BFF', ink: '#FFFFFF', minzoom: 0, label: {es: 'Metro', pt: 'Metrô'}},
  {id: 'escola', icon: 'school', color: '#F5B800', ink: '#1C1C1E', minzoom: 0, label: {es: 'Escuelas', pt: 'Escolas'}},
  {id: 'parque', icon: 'park', color: '#16A34A', ink: '#FFFFFF', minzoom: 14, label: {es: 'Parques', pt: 'Parques'}},
  {id: 'hospital', icon: 'hospital', color: '#E5243B', ink: '#FFFFFF', minzoom: 14, label: {es: 'Hospitales', pt: 'Hospitais'}},
  {id: 'supermercado', icon: 'grocery', color: '#0E9F9A', ink: '#FFFFFF', minzoom: 15, label: {es: 'Súper', pt: 'Mercados'}},
  {id: 'cafe', icon: 'cafe', color: '#A8551B', ink: '#FFFFFF', minzoom: 16, label: {es: 'Cafés', pt: 'Cafés'}},
  {id: 'bar_restaurante', icon: 'restaurant', color: '#F5641E', ink: '#FFFFFF', minzoom: 16, label: {es: 'Bares y restaurantes', pt: 'Bares e restaurantes'}},
  {id: 'comercio', icon: 'shop', color: '#9B4DFF', ink: '#FFFFFF', minzoom: 16, label: {es: 'Comercios', pt: 'Comércios'}},
];
export const POI_CATEGORY = Object.fromEntries(POI_CATEGORIES.map(category => [category.id, category]));
export const CITY_CATEGORIES = ['metro', 'parque'];
export const NEARBY_RADIUS_M = 500;

/** Amenity kinds used by the "Cerca de ti" widget and the comparison, mapped to a POI category. */
export const KIND_CATEGORY = {transport: 'metro', green: 'parque', education: 'escola', food: 'cafe', health: 'hospital'};

export const poiIconUrl = id => `/assets/map/maki/${POI_CATEGORY[id]?.icon || 'shop'}.svg`;
export const poiLabel = (id, language = 'es-MX') => POI_CATEGORY[id]?.label[language === 'pt-BR' ? 'pt' : 'es'] || id;

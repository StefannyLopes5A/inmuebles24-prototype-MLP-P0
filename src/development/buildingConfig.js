// Calibration of the Torre Olmo GLB, measured once with scripts/calibrate-building.mjs.
// Model units are the GLB scene frame (after its node transforms); `scale` turns them into metres.
// Horizontal faces pile up every ~1.94 units from 3.6 to 26.9: a double-height ground floor,
// twelve levels (amenities on the first, homes on the other eleven) and the roof.
export const BUILDING = {
  glb:'/models/torre-olmo.glb',
  scale:1.65,
  // Turned with the avenue on the south face (it runs ~4.9° off east) and set back 8.6 m to the north,
  // so the sidewalk slab ends about 3 m before the carriageway instead of over it.
  heading:-4.9,
  offset:[0, -8.6],
  center:[6.23, -7.625],
  bounds:{x:[0, 12.46], z:[-15.25, 0]},
  // `bounds` is the sidewalk slab; the homes sit in the narrower body measured from the 2nd floor slab up.
  body:{x:[0.68, 11.73], z:[-14.35, -2.42]},
  base:3.6,
  floorHeight:1.94,
  levels:12,
  roof:26.9,
  top:28.7,
  // Four homes per floor. z below splitZ faces north (Parque América), above it south (Parque Lincoln);
  // x below splitX is the west bay. Scene +z is south.
  splitZ:-8.385,
  splitX:6.205,
  firstLevelNumber:1,
  firstResidentialFloor:2,
  hiddenMaterials:/^Sumele_/,
};

// Lot point used by the city extract, the sun position and the map pin.
export const LOT = {
  lon:-99.1962,
  lat:19.4318,
  footprint:[[-16, -18], [16, -18], [16, 18], [-16, 18]],
};

export const SIDES = ['norte', 'sur'];

export const residentialFloors = Array.from({length:BUILDING.levels - 1}, (_, index) => BUILDING.firstResidentialFloor + index);

// Floor number (1 = amenities level) for a height in model units, or null outside the levels.
export function floorAt(y, config = BUILDING) {
  const level = Math.floor((y - config.base) / config.floorHeight);
  if (level < 0 || level >= config.levels) return null;
  return level + config.firstLevelNumber;
}

export const sideAt = (z, config = BUILDING) => (z < config.splitZ ? 0 : 1);
export const bayAt = (x, config = BUILDING) => (x < config.splitX ? 0 : 1);

export const UNITS_PER_FLOOR = 4;

// 01 north-west, 02 north-east, 03 south-west, 04 south-east.
export const unitId = (floor, side, bay = 0) => `${floor}${String(side * 2 + bay + 1).padStart(2, '0')}`;

// Unit under a point in model units, the same formula the shader evaluates per pixel.
export function unitAt([x, y, z], config = BUILDING) {
  const floor = floorAt(y, config);
  if (floor == null || floor < config.firstResidentialFloor) return null;
  const side = sideAt(z, config), bay = bayAt(x, config);
  return {floor, side, bay, id:unitId(floor, side, bay)};
}

// Index used by the shader's state texture and the hover/selection uniforms.
export const unitIndex = ({floor, side, bay = 0}, config = BUILDING) => (floor - config.firstLevelNumber) * UNITS_PER_FLOOR + side * 2 + bay;

// Footprint of one home inside the body, in model units.
export function unitRect({side, bay = 0}, config = BUILDING) {
  const {x, z} = config.body;
  return {
    x:bay === 0 ? [x[0], config.splitX] : [config.splitX, x[1]],
    z:side === 0 ? [z[0], config.splitZ] : [config.splitZ, z[1]],
  };
}

// Slab height of a floor in model units.
export const slabY = (floor, config = BUILDING) => config.base + (floor - config.firstLevelNumber) * config.floorHeight;

// Converts metres around the tower centre (+x east, +z south, before the heading) to scene metres (lot at the origin).
export function siteToScene([x, z], config = BUILDING) {
  const angle = (config.heading || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const [ox, oz] = config.offset || [0, 0];
  return [x * cos + z * sin + ox, -x * sin + z * cos + oz];
}

// Converts model units to scene metres, with the same turn and set-back as the model in the scene.
export const toScene = ([x, y, z], config = BUILDING) => {
  const [sx, sz] = siteToScene([(x - config.center[0]) * config.scale, (z - config.center[1]) * config.scale], config);
  return [sx, y * config.scale, sz];
};

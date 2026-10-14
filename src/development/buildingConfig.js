// Calibration of the Torre Olmo GLB, measured once with scripts/calibrate-building.mjs.
// Model units are the GLB scene frame (after its node transforms); `scale` turns them into metres.
// Horizontal faces pile up every ~1.94 units from 3.6 to 26.9: a double-height ground floor,
// twelve levels (amenities on the first, homes on the other eleven) and the roof.
export const BUILDING = {
  glb:'/models/torre-olmo.glb',
  scale:1.65,
  heading:0,
  center:[6.23, -7.625],
  bounds:{x:[0, 12.46], z:[-15.25, 0]},
  base:3.6,
  floorHeight:1.94,
  levels:12,
  roof:26.9,
  top:28.7,
  // The floor splits along the model depth: z below the plane faces north (Parque América),
  // above it faces south (Parque Lincoln). Scene +z is south.
  splitZ:-7.625,
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

export const unitId = (floor, side) => `${floor}${String(side + 1).padStart(2, '0')}`;

// Unit under a point in model units, the same formula the shader evaluates per pixel.
export function unitAt([, y, z], config = BUILDING) {
  const floor = floorAt(y, config);
  if (floor == null || floor < config.firstResidentialFloor) return null;
  const side = sideAt(z, config);
  return {floor, side, id:unitId(floor, side)};
}

// Index used by the shader's state texture and the hover/selection uniforms.
export const unitIndex = ({floor, side}, config = BUILDING) => (floor - config.firstLevelNumber) * 2 + side;

// Slab height of a floor in model units.
export const slabY = (floor, config = BUILDING) => config.base + (floor - config.firstLevelNumber) * config.floorHeight;

// Converts model units to scene metres (lot at the origin).
export const toScene = ([x, y, z], config = BUILDING) => [
  (x - config.center[0]) * config.scale,
  y * config.scale,
  (z - config.center[1]) * config.scale,
];

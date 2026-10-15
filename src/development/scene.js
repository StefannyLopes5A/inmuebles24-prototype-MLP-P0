// The Torre Olmo scene. React never rebuilds it: it sends unit states, hover/selection, the hour and flight requests;
// the three.js loop owns the camera. The lot is the origin, units are metres, +x east, +z south.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutlinePass} from 'three/addons/postprocessing/OutlinePass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import SunCalc from 'suncalc';
import {BUILDING, LOT, UNITS_PER_FLOOR, siteToScene, slabY, toScene, unitAt, unitIndex, unitRect} from './buildingConfig.js';
import {easeDrawer, easeInOut, easeOut} from './easing.js';

const STATUS_CODE = {sold:0, reserved:1, available:2, filtered:3};
const IGNORE = 255;
const deg = THREE.MathUtils.degToRad;
const [BODY_X, , BODY_Z] = toScene([(BUILDING.body.x[0] + BUILDING.body.x[1]) / 2, 0, (BUILDING.body.z[0] + BUILDING.body.z[1]) / 2]);
// The orbit pivot is the middle of the residential body, so zoom and rotation always happen around the tower.
const TOWER_FOCUS = new THREE.Vector3(BODY_X, (slabY(BUILDING.firstResidentialFloor) + BUILDING.roof) / 2 * BUILDING.scale, BODY_Z);
const DEFAULT_AZIMUTH = 0.62;
// The resting tower sits a tenth of the viewport to the right, in the gap between the two cards.
const HOME_SHIFT = 0.1;
// Isometric-leaning framings. The tower anchor is low and close: two facades, little roof.
const POSES = {
  city:{dist:650, el:deg(45)},
  tower:{dist:86, el:deg(26)},
  floor:{dist:75, el:deg(42)},
  unit:{dist:55, el:deg(35)},
  plan:{dist:32, el:deg(60)},
};
// Orbit limits per mode, as elevation above the horizon.
const ORBIT = {
  city:{min:deg(6), max:deg(80), near:80},
  tower:{min:deg(14), max:deg(52), near:46},
  plan:{min:deg(26), max:deg(72), near:20},
};
const DURATION = {arrival:3.2, mode:1.2, focus:1.0, window:1.8, recenter:0.6};
// Layer 1 is the only thing the bloom pass is allowed to see. Everything else is black in that pass.
const BLOOM_LAYER = 1;
const SKY = {day:new THREE.Color('#dde5ec'), dusk:new THREE.Color('#ead7c6'), night:new THREE.Color('#1e3358')};
const SKY_ZENITH = new THREE.Color('#10182c');
// Moon from the east and above, rim from the opposite side, so the two facades separate without a black face.
const MOON = new THREE.Vector3(0.82, 0.7, 0.32).normalize();
const RIM = new THREE.Vector3(-0.62, 0.22, -0.48).normalize();
// Garden and street exposure under the moon, relative to the tower's.
const MOON_GAIN = 2.8;
// The neighbourhood sits a step darker than the garden at night, so the tower stays the subject.
const CITY_NIGHT = 0.28;
// Lit-window emission before the moon gain, which also scales it.
const CITY_WINDOW = 0.16;
// Night albedos keep separate roles: lawn lighter and warmer than crowns, hedges darker, trunks brown, paving out of the greens.
const GROUND = {day:new THREE.Color('#e9e6df'), night:new THREE.Color('#5a6476')};
const ROAD = {day:new THREE.Color('#cfccc6'), night:new THREE.Color('#414a5c')};
const PARK = {day:new THREE.Color('#c9d8bd'), night:new THREE.Color('#5a7558')};
const WATER = {day:new THREE.Color('#b9cfdd'), night:new THREE.Color('#3a5570')};
const TREE = {day:new THREE.Color('#a9c299'), night:new THREE.Color('#7aa871')};
const TRUNK = {day:new THREE.Color('#8a7663'), night:new THREE.Color('#9a7454')};
const PAVING = {day:new THREE.Color('#e2dcd1'), night:new THREE.Color('#8d96a6')};
const LAWN = {day:new THREE.Color('#b3c89a'), night:new THREE.Color('#8fae72')};
const CURB = {day:new THREE.Color('#d3cec5'), night:new THREE.Color('#bdb5a8')};
const HEDGE = {day:new THREE.Color('#8faa7c'), night:new THREE.Color('#4d6e48')};
const PODIUM_NIGHT = new THREE.Color('#3a4250');
// Residential window panes in the GLB. Balcony rails are other blended materials and stay structure.
const GLAZING_MATERIAL = 'auto_18';
const PANE_INSET = 0.22;
const PANE_MIN_AREA = 0.8;
const GLASS_LIT = {day:new THREE.Color('#c5d0dc'), night:new THREE.Color('#ffd7b0')};
const GLASS_DARK = {day:new THREE.Color('#7d8b9c'), night:new THREE.Color('#1c2838')};
const GLASS_COLD = {day:new THREE.Color('#b7c4d4'), night:new THREE.Color('#8ea6c2')};
// Concrete, plaster and stone tones, one per city building.
const FACADES = ['#f1eee8', '#e9e4da', '#e4e2de', '#efe7da', '#dfddd9', '#f4f0e8', '#e6dfd3', '#dcdfe2'].map(hex => new THREE.Color(hex));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
// Camera azimuth facing a unit's facade, swung towards its corner: north looks from -z, the west bay from -x.
const facing = ({side, bay = 0}, spread) => {
  const swing = bay === 0 ? -spread : spread;
  return side === 0 ? Math.PI - swing : swing;
};
// The diagonal closest to `az`, so a floor shows both facades without a long swing.
const cornerAzimuth = az => Math.round((az - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
// Centre of a home at a height in model units, in scene metres.
const unitCenter = (unit, y) => {
  const {x, z} = unitRect(unit);
  return new THREE.Vector3(...toScene([(x[0] + x[1]) / 2, y, (z[0] + z[1]) / 2]));
};

/** 0 by day, 1 from 19:30; dawn mirrors it before 06:45. */
export function nightFactor(hour) {
  return Math.max(smooth(18.6, 19.5, hour), 1 - smooth(5.9, 6.8, hour));
}

/** Two sold homes keep a faint cold room, so the tower is not a dark shell. Stable for a given inventory. */
export function pickColdUnitIds(units) {
  const sold = units.filter(unit => unit.status === 'sold').sort((a, b) => a.index - b.index);
  const chosen = [sold[1], sold.at(-2)].filter(Boolean);
  return [...new Set(chosen.map(unit => unit.id))];
}

/** Depth of the glowing back wall, a short step from the pane toward the middle of the tower. */
export function interiorDepth(axis, depth) {
  const center = axis === 'x' ? BUILDING.splitX : BUILDING.splitZ;
  const inward = Math.sign(center - depth) || 1;
  return depth + inward * PANE_INSET;
}

/** Warm radial falloff. The bright core sits on the window edge; the balcony fades out. */
function spillTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.62)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A flat quad on the balcony, bright at `near` (the pane) and gone at `far`. */
function horizontalSpill(axis, centerU, halfW, near, far, y) {
  const corner = (u, depth) => (axis === 'z' ? [centerU + u, y, depth] : [depth, y, centerU + u]);
  const points = [corner(-halfW, near), corner(halfW, near), corner(-halfW, far), corner(halfW, far)];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.12, 0.5, 0.88, 0.5, 0.12, 1, 0.88, 1], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  return geometry;
}

function cityShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  return shape;
}

/** Douglas–Peucker: drops points closer than `tolerance` to the chord, keeping the street's line. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, az] = points[0], [bx, bz] = points.at(-1);
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
  let far = 0, at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, pz] = points[i];
    const d = Math.abs((px - ax) * dz - (pz - az) * dx) / length;
    if (d > far) { far = d; at = i; }
  }
  if (far <= tolerance) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

/**
 * A turning circle or roundabout tighter than the street is wide folds the ribbon into spikes.
 * Those become a straight line between their ends (or go, when the ends meet); the rest is lightly simplified.
 */
function streetPath(points, width) {
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  if (points.length > 3 && span < width * 3) {
    const [a, b] = [points[0], points.at(-1)];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) < width ? null : [a, b];
  }
  return simplify(points, Math.min(1.5, width * 0.2));
}

function ribbon(points, width) {
  const positions = [], indices = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x, z] = points[i];
    const [px, pz] = points[Math.max(0, i - 1)], [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const dx = nx - px, dz = nz - pz, length = Math.hypot(dx, dz) || 1;
    const ox = -dz / length * width / 2, oz = dx / length * width / 2;
    positions.push(x + ox, 0, z + oz, x - ox, 0, z - oz);
    if (i) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

/** One facade tone per building, as a vertex colour, so the merged city keeps a single draw call. */
function paint(geometry, seed) {
  const color = FACADES[Math.floor(hash(seed, seed * 0.37) * FACADES.length)];
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Large, soft value noise on flat ground, so asphalt and sidewalks are not a flat fill; `tile` adds paving joints. */
function grain(material, scale, amount, tile = 0) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGrainPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGrainPos = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vGrainPos;
float grainHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grainNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(grainHash(i), grainHash(i + vec2(1.0, 0.0)), f.x), mix(grainHash(i + vec2(0.0, 1.0)), grainHash(i + vec2(1.0)), f.x), f.y);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float grainValue = grainNoise(vGrainPos / ${scale.toFixed(1)}) * 0.65 + grainNoise(vGrainPos / ${(scale / 6).toFixed(2)}) * 0.35;
diffuseColor.rgb *= 1.0 - ${amount.toFixed(3)} + grainValue * ${(amount * 2).toFixed(3)};
${tile ? `vec2 joint = fract(vGrainPos / ${tile.toFixed(2)});
diffuseColor.rgb *= 1.0 - 0.1 * max(step(joint.x, 0.035), step(joint.y, 0.035));
diffuseColor.rgb *= 0.97 + 0.06 * grainHash(floor(vGrainPos / ${tile.toFixed(2)}));` : ''}`);
  };
  material.customProgramCacheKey = () => `grain-${scale}-${amount}-${tile}`;
  return material;
}

export class DevelopmentScene {
  constructor(container, {onHover, onPick, onReady, onCityReady, onCityError, onModelError, onInteract, onCamera, reducedMotion = false} = {}) {
    this.container = container;
    this.callbacks = {onHover, onPick, onReady, onCityReady, onCityError, onModelError, onInteract, onCamera};
    this.reduced = reducedMotion;
    this.panelOffset = 0;
    this.mode = 'tower';
    this.flight = null;
    this.tweens = new Map();
    this.labels = new Map();
    this.pointer = null;
    this.hovered = null;
    this.selected = null;
    this.windowView = null;
    this.hoveredFloor = null;
    this.planHidden = false;
    this.night = 0;
    this.slow = 0;
    this.unitParts = new Map();
    this.unitList = null;
    this.unitMatches = null;
    this.coldIds = null;
    this.disposed = false;

    const renderer = this.renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'recorrido-canvas';
    container.appendChild(renderer.domElement);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'recorrido-labels';
    container.appendChild(this.labelLayer);

    const scene = this.scene = new THREE.Scene();
    scene.background = SKY.day.clone();
    scene.fog = new THREE.Fog(SKY.day.clone(), 900, 1600);
    this.context = new THREE.Group();
    this.context.name = 'context';
    scene.add(this.context);

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
    const controls = this.controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 1200;
    controls.screenSpacePanning = false;
    this.viewShift = 0;
    this.focusedFloor = null;
    this.applyOrbit('tower');
    controls.addEventListener('start', () => { this.cancelFlight(); this.callbacks.onInteract?.(); });
    controls.addEventListener('change', () => this.reportCamera());

    this.hemi = new THREE.HemisphereLight('#ffffff', '#cfc8bd', 1.25);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff5e6', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {left:-260, right:260, top:260, bottom:-260, near:10, far:1400});
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);
    const rim = this.rim = new THREE.DirectionalLight('#c9d6ee', 0);
    rim.position.copy(RIM).multiplyScalar(520);
    scene.add(rim);

    const sky = this.sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{uHorizon:{value:SKY.day.clone()}, uZenith:{value:SKY.day.clone()}},
      vertexShader:'varying vec3 vWorld; void main() { vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }',
      fragmentShader:'varying vec3 vWorld; uniform vec3 uHorizon; uniform vec3 uZenith; void main() { float h = normalize(vWorld - cameraPosition).y; gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(-0.05, 0.55, h)), 1.0); }',
    }));
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envMap;
    pmrem.dispose();

    this.cityUniforms = {uNight:{value:0}, uDim:{value:0}, uMoonGain:{value:MOON_GAIN}};
    this.groundMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:GROUND.day}), 22, 0.04)));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64).rotateX(-Math.PI / 2), this.groundMaterial);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.context.add(ground);

    this.unitUniforms = this.createUnitUniforms();

    const composer = this.composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, this.camera));
    this.aoPass = new GTAOPass(scene, this.camera, 1, 1);
    this.aoPass.output = GTAOPass.OUTPUT.Default;
    this.aoPass.blendIntensity = 0.7;
    composer.addPass(this.aoPass);
    this.hoverPass = new OutlinePass(new THREE.Vector2(1, 1), scene, this.camera);
    Object.assign(this.hoverPass, {edgeStrength:3, edgeGlow:0, edgeThickness:1, pulsePeriod:0});
    this.hoverPass.visibleEdgeColor.set('#ff5500');
    this.hoverPass.hiddenEdgeColor.set('#7a2a00');
    composer.addPass(this.hoverPass);
    this.selectPass = new OutlinePass(new THREE.Vector2(1, 1), scene, this.camera);
    Object.assign(this.selectPass, {edgeStrength:4, edgeGlow:0, edgeThickness:2, pulsePeriod:0});
    this.selectPass.visibleEdgeColor.set('#ff5500');
    this.selectPass.hiddenEdgeColor.set('#7a2a00');
    composer.addPass(this.selectPass);
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(BLOOM_LAYER);
    this.darkMaterials = {};
    this.darkMaterial = new THREE.MeshBasicMaterial({color:0x000000});
    this.darkTransparent = new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0, depthWrite:false});
    this.blackBackground = new THREE.Color(0x000000);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.4, 0.85);
    const bloomComposer = this.bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, this.camera));
    bloomComposer.addPass(this.bloomPass);
    this.mixPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms:{
        baseTexture:{value:null},
        bloomTexture:{value:this.bloomPass.renderTargetsHorizontal[0].texture},
      },
      vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
    }), 'baseTexture');
    this.mixPass.enabled = false;
    composer.addPass(this.mixPass);
    composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.bindPointer();
    this.setPose({target:TOWER_FOCUS.clone(), dist:900, el:THREE.MathUtils.degToRad(52), az:DEFAULT_AZIMUTH - 0.35});
    this.buildSite();
    this.setTime(12);
    this.raf = requestAnimationFrame(this.frame);
    this.loadCity();
    this.loadBuilding();
  }

  createUnitUniforms() {
    const data = new Uint8Array(UNITS_PER_FLOOR * BUILDING.levels).fill(IGNORE);
    const texture = new THREE.DataTexture(data, UNITS_PER_FLOOR, BUILDING.levels, THREE.RedFormat, THREE.UnsignedByteType);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return {
      uUnitState:{value:texture},
      uBase:{value:BUILDING.base}, uFloorH:{value:BUILDING.floorHeight}, uLevels:{value:BUILDING.levels}, uSplitZ:{value:BUILDING.splitZ}, uSplitX:{value:BUILDING.splitX},
      uNight:{value:0}, uHover:{value:-1}, uSelected:{value:-1}, uPulse:{value:0}, uHoverLevel:{value:-1}, uCutY:{value:1e4},
      uToModel:{value:new THREE.Matrix4()},
    };
  }

  // ----- City -----------------------------------------------------------------------------------------------

  async loadCity() {
    try {
      const response = await fetch('/data/city.json');
      if (!response.ok) throw new Error(String(response.status));
      const city = await response.json();
      if (this.disposed) return;
      this.city = city;
      this.buildCity(city);
      this.callbacks.onCityReady?.(city);
    } catch {
      if (this.disposed) return;
      this.buildFallbackCity();
      this.callbacks.onCityError?.();
    }
  }

  /** Flat neighbourhood blocks. Day and night share one facade; the moon and a share of lit windows make the night. */
  cityMaterial() {
    const material = this.asContext(new THREE.MeshLambertMaterial({color:'#ffffff', vertexColors:true}));
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.cityUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvCityPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCityNormal = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vCityPos;
varying vec3 vCityNormal;
uniform float uDim;
float cityHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
bool wall = abs(vCityNormal.y) < 0.4;
float pane = 0.0;
vec2 cell = vec2(0.0);
vec2 inCell = vec2(0.0);
if (wall && vCityPos.y > 2.0) {
  vec2 across = normalize(vec2(-vCityNormal.z, vCityNormal.x));
  vec2 grid = vec2(dot(vCityPos.xz, across) / 3.2, vCityPos.y / 3.1);
  cell = floor(grid);
  inCell = fract(grid);
  pane = step(0.16, inCell.x) * step(inCell.x, 0.84) * step(0.3, inCell.y) * step(inCell.y, 0.86);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(vec3(0.62, 0.68, 0.76), vec3(0.35, 0.4, 0.5), uNight), pane * 0.8);
  diffuseColor.rgb *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 0.12, inCell.y));
}
if (wall) diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(0.0, 7.0, vCityPos.y));
else diffuseColor.rgb *= 0.88 + 0.06 * cityHash(floor(vCityPos.xz / 6.0));
float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grey), 0.6 * uDim) * (1.0 - 0.3 * uDim);
diffuseColor.rgb *= mix(1.0, ${CITY_NIGHT.toFixed(2)}, uNight);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (pane > 0.0) {
  vec2 block = floor(vCityPos.xz / 40.0);
  float floorShare = 0.08 + 0.2 * cityHash(vec2(cell.y, block.x * 7.0 + block.y));
  float lit = step(1.0 - floorShare, cityHash(cell + block * 17.0));
  vec3 tint = cityHash(cell * 1.7 + block) > 0.82 ? vec3(0.55, 0.68, 0.95) : vec3(1.0, 0.74, 0.46);
  float glow = mix(1.0, 0.7, smoothstep(0.3, 0.86, inCell.y));
  totalEmissiveRadiance += tint * ${CITY_WINDOW.toFixed(3)} * glow * lit * pane * uNight;
}`);
    };
    material.customProgramCacheKey = () => 'city-context';
    return this.moonlit(material);
  }

  /** Surroundings stay unlit by the room probe and out of the bloom pass. */
  asContext(material) {
    material.userData.context = true;
    if ('envMapIntensity' in material) material.envMapIntensity = 0;
    return material;
  }

  /**
   * Garden, trees and streets keep their Lambert shading at night, so facets, trunks and shadows still read.
   * Moonlight is far dimmer than the sun; the gain lifts only the surroundings, leaving the tower's exposure alone.
   */
  moonlit(material) {
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.uNight = this.cityUniforms.uNight;
      shader.uniforms.uMoonGain = this.cityUniforms.uMoonGain;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uMoonGain;')
        .replace(
          'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
          `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
outgoingLight *= mix(1.0, uMoonGain, uNight);`,
        );
    };
    material.customProgramCacheKey = () => `${key.call(material)}-moonlit`;
    return material;
  }

  /** Water is drawn flat at night: it has no relief for the moon to model, only a colour to keep. */
  unlitAtNight(material) {
    material.onBeforeCompile = shader => {
      shader.uniforms.uNight = this.cityUniforms.uNight;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace(
          'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
          `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
outgoingLight = mix(outgoingLight, diffuseColor.rgb, uNight);`,
        );
    };
    material.customProgramCacheKey = () => 'context-unlit';
    return material;
  }

  buildCity(city) {
    const buildings = [];
    for (const building of city.buildings) {
      if (building.p.length < 3) continue;
      const geometry = new THREE.ExtrudeGeometry(cityShape(building.p), {depth:building.h, bevelEnabled:false});
      geometry.rotateX(-Math.PI / 2);
      geometry.deleteAttribute('uv');
      buildings.push(paint(geometry, building.p[0][0] + building.p[0][1] * 0.1));
    }
    if (buildings.length) {
      const mesh = new THREE.Mesh(mergeGeometries(buildings), this.cityMaterial());
      mesh.castShadow = mesh.receiveShadow = true;
      this.context.add(mesh);
      buildings.forEach(geometry => geometry.dispose());
    }
    const flat = (items, build) => items.map(build).filter(Boolean);
    this.roadMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:ROAD.day, side:THREE.DoubleSide}), 14, 0.05)));
    const roads = flat(city.roads, road => {
      const path = road.p.length > 1 && streetPath(road.p, road.w);
      return path ? ribbon(path, road.w) : null;
    });
    if (roads.length) {
      const mesh = new THREE.Mesh(mergeGeometries(roads), this.roadMaterial);
      mesh.position.y = 0.02;
      mesh.receiveShadow = true;
      this.context.add(mesh);
    }
    this.parkMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:PARK.day}), 9, 0.09)));
    this.waterMaterial = this.unlitAtNight(this.asContext(new THREE.MeshLambertMaterial({color:WATER.day})));
    const plane = items => flat(items, item => new THREE.ShapeGeometry(cityShape(item.p)).rotateX(-Math.PI / 2));
    const parks = plane(city.parks), water = plane(city.water);
    if (parks.length) { const mesh = new THREE.Mesh(mergeGeometries(parks.map(g => g.deleteAttribute('uv') || g)), this.parkMaterial); mesh.position.y = 0.04; mesh.receiveShadow = true; this.context.add(mesh); }
    if (water.length) { const mesh = new THREE.Mesh(mergeGeometries(water.map(g => g.deleteAttribute('uv') || g)), this.waterMaterial); mesh.position.y = 0.05; this.context.add(mesh); }
    this.plantTrees(city.parks);
    this.applyNight();
  }

  plantTrees(parks) {
    const spots = [];
    for (const park of parks) {
      const xs = park.p.map(p => p[0]), zs = park.p.map(p => p[1]);
      const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      for (let x = minX + 6; x < maxX; x += 13) for (let z = minZ + 6; z < maxZ; z += 13) {
        const jx = x + (hash(x, z) - 0.5) * 8, jz = z + (hash(z, x) - 0.5) * 8;
        let inside = false;
        for (let i = 0, j = park.p.length - 1; i < park.p.length; j = i, i += 1) {
          const [xi, zi] = park.p[i], [xj, zj] = park.p[j];
          if ((zi > jz) !== (zj > jz) && jx < (xj - xi) * (jz - zi) / (zj - zi) + xi) inside = !inside;
        }
        if (inside && hash(jx, jz) > 0.25) spots.push([jx, jz, 3 + hash(jz, jx) * 2.5]);
        if (spots.length > 1400) break;
      }
    }
    this.addTrees(spots);
  }

  /** Trunk and crown per spot `[x, z, radius]`, instanced; crowns vary a little in hue, size and lean. */
  addTrees(spots) {
    if (!spots.length) return;
    this.treeMaterial ||= this.moonlit(this.asContext(new THREE.MeshLambertMaterial({color:TREE.day, flatShading:true})));
    this.trunkMaterial ||= this.moonlit(this.asContext(new THREE.MeshLambertMaterial({color:TRUNK.day})));
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.treeMaterial, spots.length);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0), this.trunkMaterial, spots.length);
    const matrix = new THREE.Matrix4(), shade = new THREE.Color(), turn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, r], i) => {
      const stem = r * (0.9 + hash(r, x) * 0.4);
      turn.setFromAxisAngle(up, hash(x, z) * Math.PI * 2);
      trunks.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, 0, z), turn, new THREE.Vector3(r * 0.5, stem + r * 0.4, r * 0.5)));
      crowns.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, stem + r * 0.85, z), turn, new THREE.Vector3(r, r * (0.95 + hash(z, x) * 0.3), r * (0.9 + hash(x, r) * 0.2))));
      crowns.setColorAt(i, shade.setHSL(0.24 + hash(x, r) * 0.07, 0.3, 0.78 + hash(z, r) * 0.22));
    });
    crowns.castShadow = trunks.castShadow = true;
    crowns.receiveShadow = true;
    this.context.add(trunks, crowns);
  }

  /** The tower's own block: a paved plaza with lawn beds, hedges, shrubs and trees, and a row of street trees. */
  buildSite() {
    // Laid out in metres around the tower centre, then turned and set back with it.
    const site = new THREE.Group();
    const [ox, oz] = siteToScene([0, 0]);
    site.position.set(ox, 0, oz);
    site.rotation.y = THREE.MathUtils.degToRad(BUILDING.heading);
    const flat = (material, [x0, x1], [z0, z1], height, y = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, height, z1 - z0), material);
      mesh.position.set((x0 + x1) / 2, y + height / 2, (z0 + z1) / 2);
      mesh.receiveShadow = true;
      site.add(mesh);
      return mesh;
    };
    this.pavingMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:PAVING.day}), 7, 0.05, 1.5)));
    this.lawnMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:LAWN.day}), 3, 0.12)));
    this.curbMaterial = this.moonlit(this.asContext(new THREE.MeshLambertMaterial({color:CURB.day})));
    this.hedgeMaterial = this.moonlit(this.asContext(grain(new THREE.MeshLambertMaterial({color:HEDGE.day}), 1.2, 0.14)));
    // The tower slab spans about ±10 m by ±13 m; the avenue's kerb is at z ≈ 15.6.
    flat(this.pavingMaterial, [-36, 36], [-34, 15], 0.05, -0.04);
    const beds = [
      {x:[-31, -14], z:[-28, 10]}, {x:[14, 31], z:[-28, 10]}, {x:[-12, 12], z:[-30, -16]},
    ];
    const shrubs = [], trees = [];
    for (const [i, bed] of beds.entries()) {
      flat(this.curbMaterial, [bed.x[0] - 0.4, bed.x[1] + 0.4], [bed.z[0] - 0.4, bed.z[1] + 0.4], 0.28);
      flat(this.lawnMaterial, bed.x, bed.z, 0.34);
      // Low hedge on the edge that faces away from the tower.
      const outer = i === 0 ? [[bed.x[0], bed.x[0] + 0.9], bed.z] : i === 1 ? [[bed.x[1] - 0.9, bed.x[1]], bed.z] : [bed.x, [bed.z[0], bed.z[0] + 0.9]];
      const hedge = flat(this.hedgeMaterial, outer[0], outer[1], 0.95, 0.34);
      hedge.castShadow = true;
      const w = bed.x[1] - bed.x[0], d = bed.z[1] - bed.z[0];
      for (let k = 0; k < 7; k += 1) {
        const x = bed.x[0] + 2.4 + hash(i * 13 + k, 2.1) * (w - 4.8), z = bed.z[0] + 2.4 + hash(k, i * 7 + 1.3) * (d - 4.8);
        if (k < 3) trees.push([x, z, 2.2 + hash(x, z) * 1.2]);
        else shrubs.push([x, z, 0.7 + hash(z, x) * 0.6]);
      }
    }
    // Street trees on the avenue sidewalk, clear of the tower front.
    for (let x = -34; x <= 34; x += 8.5) if (Math.abs(x) > 15) trees.push([x, 13.6, 2.2 + hash(x, 9) * 0.6]);
    this.context.add(site);
    const world = ([x, z, r]) => [...siteToScene([x, z]), r];
    this.addTrees(trees.map(world));
    this.hedgeShrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.hedgeMaterial, shrubs.length);
    const matrix = new THREE.Matrix4();
    shrubs.map(world).forEach(([x, z, r], i) => this.hedgeShrubs.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, 0.34 + r * 0.6, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.8, r))));
    this.hedgeShrubs.castShadow = true;
    this.context.add(this.hedgeShrubs);
  }

  buildFallbackCity() {
    const blocks = [];
    for (let i = 0; i < 36; i += 1) {
      const angle = i / 36 * Math.PI * 2, radius = 70 + hash(i, 3) * 160;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, w = 16 + hash(i, 7) * 10, h = 8 + hash(i, 9) * 22;
      blocks.push(paint(new THREE.BoxGeometry(w, h, w).translate(x, h / 2, z).deleteAttribute('uv'), i + 1));
    }
    const mesh = new THREE.Mesh(mergeGeometries(blocks), this.cityMaterial());
    mesh.castShadow = mesh.receiveShadow = true;
    this.context.add(mesh);
  }

  // ----- Building -------------------------------------------------------------------------------------------

  async loadBuilding() {
    try {
      const gltf = await new GLTFLoader().loadAsync(BUILDING.glb);
      if (this.disposed) return;
      const holder = this.building = new THREE.Group();
      const model = this.model = gltf.scene;
      holder.scale.setScalar(BUILDING.scale);
      holder.position.set(...toScene([0, 0, 0]));
      holder.rotation.y = THREE.MathUtils.degToRad(BUILDING.heading);
      holder.add(model);
      this.scene.add(holder);
      holder.updateMatrixWorld(true);
      this.unitUniforms.uToModel.value.copy(model.matrixWorld).invert();
      const glazing = [];
      model.traverse(object => {
        if (!object.isMesh) return;
        const material = object.material;
        if (BUILDING.hiddenMaterials.test(material?.name || '')) { object.visible = false; return; }
        if (material?.name === GLAZING_MATERIAL) { glazing.push(object); return; }
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData.role = 'structure';
        if (material?.name === 'auto_13' && !material.userData.dayColor) {
          material.userData.dayColor = material.color.clone();
          this.podiumMaterials = this.podiumMaterials || [];
          this.podiumMaterials.push(material);
        }
        this.patchStructureShader(material);
      });
      this.prepareRoomMaterials();
      for (const mesh of glazing) this.splitGlazing(mesh);
      this.unitLight = new THREE.PointLight('#ffb46b', 0, 3, 2);
      this.unitLight.name = 'selected_unit_light';
      this.unitLight.castShadow = false;
      this.unitLight.visible = false;
      model.add(this.unitLight);
      this.lobbyLight = new THREE.PointLight('#ffb46b', 0, 5, 2);
      this.lobbyLight.name = 'lobby_light';
      this.lobbyLight.castShadow = false;
      this.lobbyLight.position.set(6.2, 1.55, -7.2);
      model.add(this.lobbyLight);
      this.syncRoomMaterials();
      this.applyUnitLooks();
      this.buildUnitVolumes();
      this.callbacks.onReady?.();
    } catch {
      if (!this.disposed) this.callbacks.onModelError?.();
    }
  }

  // Slabs, rails and frames keep their colour. Night is the lighting, not a darker albedo. A filtered home still goes dim.
  patchStructureShader(material) {
    if (!material || material.userData.structurePatched) return;
    material.userData.structurePatched = true;
    material.envMapIntensity = 0;
    this.patchCut(material);
  }

  /** Plan cut, in model space. Filtered homes dim; nothing here recolours a single balcony. */
  patchCut(material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.unitUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uToModel;\nvarying vec3 vModelPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvModelPos = (uToModel * modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vModelPos;
uniform sampler2D uUnitState;
uniform float uBase, uFloorH, uLevels, uSplitZ, uSplitX, uCutY;`)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vModelPos.y > uCutY) discard;')
        .replace('#include <color_fragment>', `#include <color_fragment>
float level = floor((vModelPos.y - uBase) / uFloorH);
if (level >= 0.0 && level < uLevels) {
  float slot = (vModelPos.z < uSplitZ ? 0.0 : 2.0) + (vModelPos.x < uSplitX ? 0.0 : 1.0);
  float state = floor(texture2D(uUnitState, vec2((slot + 0.5) / ${UNITS_PER_FLOOR}.0, (level + 0.5) / uLevels)).r * 255.0 + 0.5);
  if (state > 2.5 && state < 3.5) diffuseColor.rgb *= 0.5;
}`);
    };
    material.customProgramCacheKey = () => 'torre-cut';
    material.needsUpdate = true;
  }

  prepareRoomMaterials() {
    const room = (emissive, intensity) => new THREE.MeshStandardMaterial({
      color: intensity > 0 ? '#3a2a1e' : '#10141a',
      emissive,
      emissiveIntensity: intensity,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const glass = (color, opacity, metalness) => new THREE.MeshStandardMaterial({
      color, roughness: 0.08, metalness, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    });
    this.roomLit = room('#ffb46b', 1.5);
    this.roomCold = room('#9eb6d6', 0.15);
    this.roomCold.color.set('#1a222c');
    this.roomDark = room('#000000', 0);
    this.glassLit = glass(GLASS_LIT.day, 0.38, 0.04);
    this.glassDark = glass(GLASS_DARK.day, 0.5, 0.15);
    this.glassCold = glass(GLASS_COLD.day, 0.4, 0.2);
    this.spillMaterial = new THREE.MeshBasicMaterial({
      color:'#ffb46b', map:spillTexture(), transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, opacity:0.2, side:THREE.DoubleSide,
    });
    this.sharedMaterials = [this.roomLit, this.roomCold, this.roomDark, this.glassLit, this.glassDark, this.glassCold, this.spillMaterial];
    for (const material of this.sharedMaterials) {
      material.userData.shared = true;
      material.envMapIntensity = 0;
      this.patchCut(material);
    }
  }

  /** Residential panes become one mesh per home. The glowing wall sits just behind the glass, not on the balcony. */
  splitGlazing(mesh) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    const index = geometry.getIndex();
    mesh.updateWorldMatrix(true, false);
    const toModel = new THREE.Matrix4().copy(this.model.matrixWorld).invert().multiply(mesh.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(toModel);
    const buckets = new Map();
    const rest = {pos:[], nrm:[]};
    const triCount = index ? index.count / 3 : position.count / 3;
    const vertex = new THREE.Vector3();
    const norm = new THREE.Vector3();
    for (let tri = 0; tri < triCount; tri += 1) {
      const corners = [];
      const normals = [];
      for (let k = 0; k < 3; k += 1) {
        const i = index ? index.getX(tri * 3 + k) : tri * 3 + k;
        corners.push(vertex.fromBufferAttribute(position, i).clone().applyMatrix4(toModel));
        if (normalAttr) normals.push(norm.fromBufferAttribute(normalAttr, i).clone().applyMatrix3(normalMatrix).normalize());
      }
      const mid = corners[0].clone().add(corners[1]).add(corners[2]).multiplyScalar(1 / 3);
      const unit = unitAt([mid.x, mid.y, mid.z]);
      const bucket = unit
        ? buckets.get(unit.id) || buckets.set(unit.id, {unit, pos:[], nrm:[], clusters:new Map()}).get(unit.id)
        : rest;
      for (let k = 0; k < 3; k += 1) {
        bucket.pos.push(corners[k].x, corners[k].y, corners[k].z);
        if (normals[k]) bucket.nrm.push(normals[k].x, normals[k].y, normals[k].z);
      }
      if (!unit) continue;
      const face = corners[1].clone().sub(corners[0]).cross(corners[2].clone().sub(corners[0]));
      const area = face.length() / 2;
      if (area < 1e-5) continue;
      const axis = Math.abs(face.x) > Math.abs(face.z) ? 'x' : 'z';
      const depth = axis === 'x' ? mid.x : mid.z;
      const key = `${axis}:${Math.round(depth * 2)}`;
      const cluster = bucket.clusters.get(key) || bucket.clusters.set(key, {
        axis, area:0, depth:0, min:[Infinity, Infinity, Infinity], max:[-Infinity, -Infinity, -Infinity],
      }).get(key);
      cluster.area += area;
      cluster.depth += depth * area;
      for (const corner of corners) corner.toArray().forEach((value, axisIndex) => {
        cluster.min[axisIndex] = Math.min(cluster.min[axisIndex], value);
        cluster.max[axisIndex] = Math.max(cluster.max[axisIndex], value);
      });
    }
    for (const bucket of buckets.values()) this.addUnitGlazing(bucket);
    if (rest.pos.length) this.addLooseGlazing(rest, mesh.material);
    mesh.removeFromParent();
    geometry.dispose();
    mesh.material.dispose();
  }

  addUnitGlazing(bucket) {
    const {unit, pos, nrm, clusters} = bucket;
    const id = unit.id;
    const glass = new THREE.Mesh(this.surfaceGeometry(pos, nrm), this.glassDark);
    glass.name = `unit_${id}_glass`;
    glass.userData = {role:'glass', unitId:id, unitIndex:unitIndex(unit)};
    glass.castShadow = false;
    glass.receiveShadow = false;
    glass.renderOrder = 2;
    this.model.add(glass);

    const planes = [];
    const spills = [];
    let anchor = null;
    let anchorArea = 0;
    for (const cluster of clusters.values()) {
      if (cluster.area < PANE_MIN_AREA) continue;
      cluster.depth /= cluster.area;
      const spanU = (cluster.axis === 'z' ? cluster.max[0] - cluster.min[0] : cluster.max[2] - cluster.min[2]) - 0.1;
      const spanV = (cluster.max[1] - cluster.min[1]) - 0.08;
      if (spanU < 0.25 || spanV < 0.25) continue;
      const at = interiorDepth(cluster.axis, cluster.depth);
      const plane = new THREE.PlaneGeometry(spanU, spanV);
      if (cluster.axis === 'x') plane.rotateY(Math.PI / 2);
      plane.translate(
        cluster.axis === 'x' ? at : (cluster.min[0] + cluster.max[0]) / 2,
        (cluster.min[1] + cluster.max[1]) / 2,
        cluster.axis === 'z' ? at : (cluster.min[2] + cluster.max[2]) / 2,
      );
      planes.push(plane);
      const center = cluster.axis === 'x' ? BUILDING.splitX : BUILDING.splitZ;
      const outward = -Math.sign(center - cluster.depth) || -1;
      const half = Math.max(0.22, ((cluster.axis === 'z' ? cluster.max[0] - cluster.min[0] : cluster.max[2] - cluster.min[2]) * 0.5) - 0.04);
      const centerU = cluster.axis === 'z' ? (cluster.min[0] + cluster.max[0]) / 2 : (cluster.min[2] + cluster.max[2]) / 2;
      const near = cluster.depth + outward * 0.05;
      const far = cluster.depth + outward * 1.12;
      spills.push(horizontalSpill(cluster.axis, centerU, half, near, far, cluster.min[1] + 0.03));
      spills.push(horizontalSpill(cluster.axis, centerU, half, near, far, cluster.max[1] - 0.025));
      if (cluster.area > anchorArea) {
        anchorArea = cluster.area;
        anchor = new THREE.Vector3(
          cluster.axis === 'x' ? cluster.depth + outward * 0.4 : centerU,
          cluster.min[1] + 0.42,
          cluster.axis === 'z' ? cluster.depth + outward * 0.4 : centerU,
        );
      }
    }
    let interior = null;
    if (planes.length) {
      const geometry = planes.length === 1 ? planes[0] : mergeGeometries(planes);
      if (planes.length > 1) planes.forEach(item => item.dispose());
      interior = new THREE.Mesh(geometry, this.roomDark);
      interior.name = `unit_${id}_interior`;
      interior.userData = {role:'interior', unitId:id, unitIndex:unitIndex(unit)};
      interior.castShadow = false;
      interior.receiveShadow = false;
      interior.renderOrder = 1;
      this.model.add(interior);
    }
    let spill = null;
    if (spills.length) {
      const geometry = spills.length === 1 ? spills[0] : mergeGeometries(spills);
      if (spills.length > 1) spills.forEach(item => item.dispose());
      spill = new THREE.Mesh(geometry, this.spillMaterial);
      spill.name = `unit_${id}_spill`;
      spill.userData = {role:'spill', unitId:id};
      spill.visible = false;
      spill.renderOrder = 3;
      spill.frustumCulled = true;
      this.model.add(spill);
    }
    this.unitParts.set(id, {glass, interior, spill, anchor});
  }

  addLooseGlazing(rest, source) {
    const material = source.clone();
    material.userData = {};
    material.name = 'building_glass';
    this.patchStructureShader(material);
    const mesh = new THREE.Mesh(this.surfaceGeometry(rest.pos, rest.nrm), material);
    mesh.name = 'building_glass';
    mesh.userData = {role:'glass'};
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.model.add(mesh);
  }

  surfaceGeometry(pos, nrm) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (nrm.length === pos.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    else geometry.computeVertexNormals();
    return geometry;
  }

  buildUnitVolumes() {
    const [x0, x1] = BUILDING.body.x, [z0, z1] = BUILDING.body.z;
    const pad = 0.04;
    const invisible = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false});
    this.unitBoxes = new Map();
    const box = unit => {
      const {x, z} = unitRect(unit);
      const geometry = new THREE.BoxGeometry(x[1] - x[0] + pad, BUILDING.floorHeight, z[1] - z[0] + pad);
      const mesh = new THREE.Mesh(geometry, invisible);
      mesh.position.set((x[0] + x[1]) / 2, slabY(unit.floor) + BUILDING.floorHeight / 2, (z[0] + z[1]) / 2);
      mesh.renderOrder = -1;
      return mesh;
    };
    for (let floor = BUILDING.firstResidentialFloor; floor < BUILDING.firstLevelNumber + BUILDING.levels; floor += 1) {
      for (const side of [0, 1]) for (const bay of [0, 1]) {
        const unit = {floor, side, bay};
        const mesh = box(unit);
        this.model.add(mesh);
        this.unitBoxes.set(unitIndex(unit), mesh);
      }
    }
    // One envelope for picking: the hit point goes through the same floor/side formula as the shader.
    const residentialBottom = slabY(BUILDING.firstResidentialFloor), top = BUILDING.base + BUILDING.levels * BUILDING.floorHeight;
    const envelope = this.envelope = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top - residentialBottom, z1 - z0), invisible);
    envelope.position.set((x0 + x1) / 2, (top + residentialBottom) / 2, (z0 + z1) / 2);
    this.model.add(envelope);
    this.model.updateMatrixWorld(true);
    this.refreshOutlines();
  }

  // ----- Units ----------------------------------------------------------------------------------------------

  setUnitStates(units, matches) {
    const texture = this.unitUniforms.uUnitState.value;
    const data = texture.image.data;
    data.fill(IGNORE);
    for (const unit of units) {
      const code = matches && !matches.has(unit.id) ? STATUS_CODE.filtered : STATUS_CODE[unit.status];
      data[unitIndex(unit)] = code;
    }
    texture.needsUpdate = true;
    this.unitList = units;
    this.unitMatches = matches || null;
    this.applyUnitLooks();
  }

  applyUnitLooks() {
    if (!this.unitParts.size || !this.unitList) return;
    if (!this.coldIds) this.coldIds = new Set(pickColdUnitIds(this.unitList));
    for (const unit of this.unitList) {
      const parts = this.unitParts.get(unit.id);
      if (!parts) continue;
      const filtered = this.unitMatches && !this.unitMatches.has(unit.id);
      const lit = !filtered && unit.status === 'available';
      const cold = !filtered && !lit && this.coldIds.has(unit.id);
      parts.glass.material = lit ? this.glassLit : cold ? this.glassCold : this.glassDark;
      if (parts.interior) parts.interior.material = lit ? this.roomLit : cold ? this.roomCold : this.roomDark;
      if (parts.spill) parts.spill.visible = lit;
      this.setBloom(parts.glass, lit);
      this.setBloom(parts.interior, lit);
      this.setBloom(parts.spill, lit);
    }
    this.placeUnitLight();
  }

  syncRoomMaterials() {
    const n = this.night;
    if (!this.roomLit) return;
    this.roomLit.emissiveIntensity = 1.5 + n;
    this.roomCold.emissiveIntensity = 0.12 + n * 0.38;
    this.glassLit.color.copy(GLASS_LIT.day).lerp(GLASS_LIT.night, n);
    this.glassLit.opacity = 0.4 - n * 0.05;
    this.glassDark.color.copy(GLASS_DARK.day).lerp(GLASS_DARK.night, n);
    this.glassDark.opacity = 0.48 + n * 0.16;
    this.glassDark.metalness = 0.12 + n * 0.5;
    this.glassCold.color.copy(GLASS_COLD.day).lerp(GLASS_COLD.night, n);
    this.glassCold.opacity = 0.42;
    if (this.spillMaterial) this.spillMaterial.opacity = 0.18 + n * 0.62;
  }

  setBloom(mesh, on) {
    if (!mesh) return;
    if (on) mesh.layers.enable(BLOOM_LAYER);
    else mesh.layers.disable(BLOOM_LAYER);
  }
  placeUnitLight() {
    const light = this.unitLight;
    if (!light) return;
    const unit = this.selected;
    const parts = unit && this.unitParts.get(unit.id);
    const filtered = unit && this.unitMatches && !this.unitMatches.has(unit.id);
    const lit = parts?.anchor && unit.status === 'available' && !filtered && this.night > 0.35;
    light.visible = !!lit;
    if (!lit) return;
    light.position.copy(parts.anchor);
    light.intensity = 0.9 * this.night;
  }

  setHover(unit) {
    this.hovered = unit;
    this.unitUniforms.uHover.value = unit ? unitIndex(unit) : -1;
    this.refreshOutlines();
  }

  setHoverFloor(floor) {
    this.hoveredFloor = floor || null;
    this.unitUniforms.uHoverLevel.value = floor ? floor - 1 : -1;
    this.refreshOutlines();
  }

  setSelected(unit) {
    const changed = unit?.id !== this.selected?.id;
    this.selected = unit;
    this.unitUniforms.uSelected.value = unit ? unitIndex(unit) : -1;
    this.refreshOutlines();
    if (unit && changed && !this.reduced) this.tween('pulse', 0, 1, 0.6, value => { this.unitUniforms.uPulse.value = Math.sin(value * Math.PI); }, t => t);
    if (!unit) this.unitUniforms.uPulse.value = 0;
    this.placeUnitLight();
  }

  refreshOutlines() {
    if (!this.unitBoxes) return;
    const box = unit => unit && this.unitBoxes.get(unitIndex(unit));
    const hovered = box(this.hovered), selected = box(this.selected);
    const outlined = this.mode !== 'city' && !this.windowView;
    const shownFloor = this.hoveredFloor || this.focusedFloor;
    const first = shownFloor ? unitIndex({floor:shownFloor, side:0, bay:0}) : 0;
    const floor = shownFloor ? Array.from({length:UNITS_PER_FLOOR}, (_, slot) => this.unitBoxes.get(first + slot)).filter(item => item && item !== selected) : [];
    this.hoverPass.selectedObjects = !outlined ? [] : floor.length ? floor : hovered && hovered !== selected ? [hovered] : [];
    this.selectPass.selectedObjects = outlined && selected ? [selected] : [];
  }

  // ----- Camera ---------------------------------------------------------------------------------------------

  currentPose() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = offset.length();
    return {target:this.controls.target.clone(), dist, el:Math.asin(THREE.MathUtils.clamp(offset.y / dist, -1, 1)), az:Math.atan2(offset.x, offset.z)};
  }

  setPose({target, dist, el, az}) {
    this.controls.target.copy(target);
    this.camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(target);
  }

  applyOrbit(mode) {
    const limits = ORBIT[mode] || ORBIT.tower;
    this.controls.minPolarAngle = Math.PI / 2 - limits.max;
    this.controls.maxPolarAngle = Math.PI / 2 - limits.min;
    this.controls.minDistance = limits.near;
  }

  /** Pixels that park the tower between the cards. The pivot stays on the building. */
  homeShiftPx() {
    return (this.container.clientWidth || 1) * HOME_SHIFT;
  }

  /** The picture slides right of the pivot so the tower rests between the cards. */
  applyViewShift() {
    const width = this.container.clientWidth || 1, height = this.container.clientHeight || 1;
    if (this.viewShift) this.camera.setViewOffset(width, height, -this.viewShift, 0, width, height);
    else this.camera.clearViewOffset();
  }

  shiftTo(shift, seconds, ease = easeInOut) {
    this.tween('shift', this.viewShift, shift, seconds, value => { this.viewShift = value; this.applyViewShift(); }, ease);
  }

  fly(pose, seconds, onDone) {
    const from = this.currentPose();
    const to = {...pose, target:pose.focus.clone()};
    if (this.reduced || seconds <= 0) {
      this.flight = null;
      this.setPose(to);
      this.reportCamera();
      onDone?.();
      return;
    }
    this.flight = {from, to, start:this.clock.getElapsedTime(), duration:seconds, onDone, ease:pose.ease || easeInOut, arc:pose.arc || 0};
  }

  cancelFlight() {
    const flight = this.flight;
    this.flight = null;
    flight?.onDone?.();
  }

  stepFlight(now) {
    const flight = this.flight;
    if (!flight) return;
    const raw = Math.min(1, (now - flight.start) / flight.duration);
    const t = flight.ease(raw);
    const {from, to} = flight;
    this.setPose({
      target:from.target.clone().lerp(to.target, t),
      dist:from.dist + (to.dist - from.dist) * t,
      el:from.el + (to.el - from.el) * t + Math.sin(raw * Math.PI) * flight.arc,
      az:from.az + wrapAngle(to.az - from.az) * t,
    });
    this.reportCamera();
    if (raw >= 1) { this.flight = null; flight.onDone?.(); }
  }

  arrive(onDone) {
    this.fly(this.towerHome(), DURATION.arrival, onDone);
  }

  /** Safety anchor of the tower canvas. Independent of the unit panel: leaving a unit always returns here. */
  towerHome() {
    return {focus:TOWER_FOCUS, dist:POSES.tower.dist, el:POSES.tower.el, az:DEFAULT_AZIMUTH};
  }

  unitPose(unit) {
    return {
      focus:unitCenter(unit, slabY(unit.floor) + BUILDING.floorHeight / 2),
      dist:POSES.unit.dist,
      el:POSES.unit.el,
      az:facing(unit, 0.55),
    };
  }

  floorPose(floor) {
    const y = (slabY(floor) + BUILDING.floorHeight * 0.3) * BUILDING.scale;
    return {focus:new THREE.Vector3(BODY_X, y, BODY_Z), dist:POSES.floor.dist, el:POSES.floor.el, az:cornerAzimuth(this.currentPose().az)};
  }

  setMode(mode, unit = this.selected) {
    const previous = this.mode;
    this.mode = mode;
    this.focusedFloor = null;
    if (this.windowView) this.exitWindowView(false);
    const az = this.currentPose().az;
    this.tween('dim', this.cityUniforms.uDim.value, mode === 'city' ? 0 : 1, 0.6, value => { this.cityUniforms.uDim.value = value; }, t => t);
    this.applyOrbit(mode);
    if (mode === 'plan' && unit) {
      // Just above the slab: walls and ceiling of the floor go, the plan lies on what is left.
      this.cutAt(slabY(unit.floor) + 0.32);
      this.showPlan(unit);
      this.fly({focus:unitCenter(unit, slabY(unit.floor)), dist:POSES.plan.dist, el:POSES.plan.el, az:facing(unit, 0.35)}, previous === 'plan' ? DURATION.focus : DURATION.mode);
    } else {
      this.cutAbove(null);
      this.showPlan(null);
      this.fly(mode === 'city' ? {focus:new THREE.Vector3(0, 0, 0), ...POSES.city, az} : this.towerHome(), DURATION.mode);
    }
    this.refreshOutlines();
  }

  /** The compass: back to the default framing of the current mode, north where it started. */
  resetView() {
    if (this.windowView) return;
    if (this.mode === 'plan' && this.selected) { this.setMode('plan', this.selected); return; }
    if (this.focusedFloor) { this.fly({...this.floorPose(this.focusedFloor), az:DEFAULT_AZIMUTH}, DURATION.focus); return; }
    const pose = this.mode === 'city' ? {focus:new THREE.Vector3(0, 0, 0), ...POSES.city, az:DEFAULT_AZIMUTH} : this.towerHome();
    this.fly(pose, DURATION.focus);
  }

  /** Leaves city, plan or window for the tower frame, without flying. */
  enterTower() {
    if (this.windowView) this.exitWindowView(false);
    this.mode = 'tower';
    this.applyOrbit('tower');
    this.showPlan(null);
    this.tween('dim', this.cityUniforms.uDim.value, 1, 0.6, value => { this.cityUniforms.uDim.value = value; }, t => t);
  }

  /** Back to the tower safety anchor. The unit panel does not own this pose. */
  goTowerHome() {
    this.enterTower();
    this.focusedFloor = null;
    this.cutAbove(null);
    this.fly(this.towerHome(), DURATION.focus);
    this.refreshOutlines();
  }

  /** One floor, opened from above: the levels over it go and its four homes stay outlined. */
  focusFloor(floor) {
    this.enterTower();
    this.focusedFloor = floor;
    this.cutAt(slabY(floor) + BUILDING.floorHeight * 0.55);
    this.fly(this.floorPose(floor), DURATION.focus);
    this.refreshOutlines();
  }

  /** City mode, framed between the tower and a point of interest. */
  showPoint([x, z]) {
    if (this.windowView) this.exitWindowView(false);
    if (this.mode !== 'city') this.setMode('city');
    const focus = new THREE.Vector3(x / 2, 0, z / 2);
    const reach = Math.hypot(x, z);
    this.fly({focus, dist:Math.max(320, reach * 1.6), el:POSES.city.el, az:this.currentPose().az}, DURATION.mode);
  }

  focusUnit(unit) {
    if (this.mode === 'plan') { this.setMode('plan', unit); return; }
    this.focusedFloor = null;
    this.cutAbove(null);
    this.refreshOutlines();
    this.fly(this.unitPose(unit), DURATION.focus);
  }

  flyToAnchor(anchor) {
    const height = anchor === 'roof' ? BUILDING.top * BUILDING.scale : anchor === 0 ? 3 : slabY(anchor) * BUILDING.scale + 2;
    const focus = new THREE.Vector3(BODY_X, height, BODY_Z);
    const pose = this.currentPose();
    if (this.mode === 'plan') this.enterTower();
    this.focusedFloor = null;
    this.cutAbove(null);
    this.refreshOutlines();
    this.fly({focus, dist:anchor === 'roof' ? 100 : 85, el:deg(anchor === 'roof' ? 40 : 30), az:pose.az}, DURATION.focus);
    const [px, pz] = siteToScene([0, anchor === 'roof' ? 0 : (BUILDING.bounds.z[1] - BUILDING.center[1]) * BUILDING.scale]);
    return new THREE.Vector3(px, height + (anchor === 'roof' ? 2 : 0), pz);
  }

  setPanelOffset(offset, animate = true) {
    this.panelOffset = offset;
    // 320ms drawer curve, the same clock as the panel slide in recorrido.css.
    if (!this.windowView) this.shiftTo(offset / 2, animate ? 0.32 : 0, easeDrawer);
  }

  cutAbove(floor) {
    this.cutAt(floor == null ? null : slabY(floor + 1) - 0.02);
  }

  /** Discards the model above `y` (model units); null restores the whole tower. */
  cutAt(y) {
    const top = BUILDING.top + 1;
    const target = y == null ? top : y;
    const from = Math.min(this.unitUniforms.uCutY.value, top);
    if (this.reduced) { this.unitUniforms.uCutY.value = y == null ? 1e4 : target; return; }
    this.tween('cut', from, target, 0.4, value => { this.unitUniforms.uCutY.value = y == null && value >= top - 0.01 ? 1e4 : value; }, easeOut);
  }

  async showPlan(unit) {
    this.planToken = unit?.id || null;
    if (this.planMesh) { this.model?.remove(this.planMesh); this.planMesh.geometry.dispose(); this.planMesh.material.dispose(); this.planMesh = null; }
    if (!unit || !this.model || this.planHidden) return;
    const texture = await planTexture(unit.plan);
    if (this.planToken !== unit.id || !this.model) { texture.dispose(); return; }
    const {x:[x0, x1], z:[z0, z1]} = unitRect(unit);
    const width = x1 - x0, depth = z1 - z0;
    const aspect = texture.image.width / texture.image.height;
    const [w, d] = aspect > width / depth ? [width, width / aspect] : [depth * aspect, depth];
    const mesh = this.planMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, d * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map:texture, transparent:true, depthWrite:false, toneMapped:false}));
    if (unit.side === 1) mesh.rotation.y = Math.PI;
    mesh.position.set((x0 + x1) / 2, slabY(unit.floor) + 0.05 / BUILDING.scale + 0.25, (z0 + z1) / 2);
    mesh.renderOrder = 2;
    this.model.add(mesh);
  }

  setPlanVisible(visible) {
    this.planHidden = !visible;
    this.showPlan(this.mode === 'plan' ? this.selected : null);
  }

  // ----- Window view ----------------------------------------------------------------------------------------

  enterWindowView(unit, labels) {
    if (!unit) return;
    this.cancelFlight();
    this.focusedFloor = null;
    this.cutAbove(null);
    this.showPlan(null);
    this.shiftTo(0, DURATION.window * 0.6);
    const rect = unitRect(unit);
    const facadeZ = unit.side === 0 ? rect.z[0] - 0.6 : rect.z[1] + 0.6;
    const eye = new THREE.Vector3(...toScene([(rect.x[0] + rect.x[1]) / 2, slabY(unit.floor) + 1.6 / BUILDING.scale, facadeZ]));
    // Yaw 0 looks north (-z); the south unit turns around.
    const yaw = unit.side === 0 ? 0 : Math.PI;
    this.windowView = {unit, eye, yaw, base:yaw, pitch:-0.04};
    this.controls.enabled = false;
    this.refreshOutlines();
    const from = this.currentPose();
    const done = () => { if (this.building) this.building.visible = false; this.setLabels(labels); };
    if (this.reduced) { this.applyWindowCamera(); done(); return; }
    const startPos = this.camera.position.clone(), startTarget = from.target.clone();
    const start = this.clock.getElapsedTime();
    this.flight = null;
    this.windowFlight = {startPos, startTarget, start, duration:DURATION.window, done};
    const fade = () => { if (this.building) this.building.visible = false; };
    this.tween('window-hide', 0, 1, DURATION.window * 0.8, value => { if (value > 0.92) fade(); }, t => t);
  }

  applyWindowCamera() {
    const view = this.windowView;
    if (!view) return;
    this.camera.position.copy(view.eye);
    const direction = new THREE.Vector3(-Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), -Math.cos(view.yaw) * Math.cos(view.pitch));
    this.camera.lookAt(view.eye.clone().add(direction));
  }

  exitWindowView(flyBack = true) {
    if (!this.windowView) return;
    this.windowView = null;
    this.windowFlight = null;
    if (this.building) this.building.visible = true;
    this.controls.enabled = true;
    this.setLabels([]);
    this.refreshOutlines();
    this.shiftTo(this.homeShiftPx(), DURATION.recenter);
    // The camera looks out from inside the facade; OrbitControls needs its target back before any flight.
    this.controls.target.copy(this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(40)));
    if (flyBack) this.fly(this.towerHome(), DURATION.mode);
  }

  stepWindowFlight(now) {
    const flight = this.windowFlight;
    if (!flight) return;
    const raw = Math.min(1, (now - flight.start) / flight.duration);
    const t = easeInOut(raw);
    const view = this.windowView;
    const direction = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    const lookEnd = view.eye.clone().add(direction.multiplyScalar(40));
    this.camera.position.copy(flight.startPos.clone().lerp(view.eye, t));
    this.camera.lookAt(flight.startTarget.clone().lerp(lookEnd, t));
    if (raw >= 1) { this.windowFlight = null; this.applyWindowCamera(); flight.done(); }
  }

  // ----- Labels ---------------------------------------------------------------------------------------------

  setLabels(items) {
    for (const [id, label] of this.labels) if (!items.some(item => item.id === id)) { label.el.remove(); this.labels.delete(id); }
    for (const item of items) {
      let label = this.labels.get(item.id);
      if (!label) {
        const el = document.createElement('span');
        el.className = 'recorrido-label';
        this.labelLayer.appendChild(el);
        label = {el};
        this.labels.set(item.id, label);
      }
      const parts = [];
      if (item.icon) {
        const icon = document.createElement('i');
        icon.className = 'recorrido-label-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.setProperty('--poi-icon', `url("${item.icon}")`);
        icon.style.setProperty('--poi-color', item.color);
        icon.style.setProperty('--poi-ink', item.ink);
        parts.push(icon);
      }
      const name = document.createElement('b');
      name.textContent = item.text;
      parts.push(name);
      if (item.meta) {
        const meta = document.createElement('span');
        meta.textContent = item.meta;
        parts.push(meta);
      }
      label.el.replaceChildren(...parts);
      label.el.dataset.kind = item.kind || 'poi';
      label.el.classList.toggle('is-highlighted', !!item.highlighted);
      label.position = item.position instanceof THREE.Vector3 ? item.position : new THREE.Vector3(...item.position);
    }
  }

  placeLabels() {
    if (!this.labels.size) return;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    const projected = new THREE.Vector3();
    for (const label of this.labels.values()) {
      projected.copy(label.position).project(this.camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
      label.el.style.opacity = visible ? '' : '0';
      if (visible) label.el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`;
    }
  }

  // ----- Time of day ----------------------------------------------------------------------------------------

  setTime(hour) {
    this.hour = hour;
    const now = new Date();
    const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0) + (hour + 6) * 3600 * 1000;
    const {altitude, azimuth} = SunCalc.getPosition(new Date(utc), LOT.lat, LOT.lon);
    const up = Math.max(0.04, Math.sin(altitude));
    const sunDir = new THREE.Vector3(-Math.sin(azimuth) * Math.cos(altitude), Math.max(0.05, Math.sin(altitude)), Math.cos(azimuth) * Math.cos(altitude)).normalize();
    this.night = nightFactor(hour);
    const dusk = smooth(16.8, 18.4, hour) * (1 - this.night) + (1 - smooth(6.2, 7.6, hour)) * (1 - this.night);
    const n = this.night;
    this.sun.position.copy(sunDir.lerp(MOON, n)).multiplyScalar(600);
    this.sun.target.position.set(0, 0, 0);
    const daySun = 0.7 + 1.85 * Math.min(1, up * 1.6);
    this.sun.intensity = daySun * (1 - n) + 1.0 * n;
    this.sun.color.set('#fff5e6').lerp(new THREE.Color('#ffb27a'), dusk).lerp(new THREE.Color('#9eb4dc'), n);
    this.hemi.color.set('#ffffff').lerp(new THREE.Color('#7d8eae'), n);
    this.hemi.groundColor.set('#cfc8bd').lerp(new THREE.Color('#3a4238'), n);
    this.hemi.intensity = 1.25 * (1 - n) + 0.85 * n;
    this.rim.intensity = 0.28 * n;
    this.rim.position.copy(RIM).multiplyScalar(520);
    this.applyNight(dusk);
  }

  applyNight(dusk = 0) {
    const n = this.night;
    const horizon = SKY.day.clone().lerp(SKY.dusk, dusk).lerp(SKY.night, n);
    const zenith = SKY.day.clone().lerp(SKY.dusk, dusk).lerp(SKY_ZENITH, n);
    this.sky.material.uniforms.uHorizon.value.copy(horizon);
    this.sky.material.uniforms.uZenith.value.copy(zenith);
    this.scene.background.copy(horizon);
    this.scene.fog.color.copy(horizon);
    this.scene.fog.near = 900;
    this.scene.fog.far = 1700;
    this.groundMaterial.color.copy(GROUND.day).lerp(GROUND.night, n);
    this.roadMaterial?.color.copy(ROAD.day).lerp(ROAD.night, n);
    this.parkMaterial?.color.copy(PARK.day).lerp(PARK.night, n);
    this.waterMaterial?.color.copy(WATER.day).lerp(WATER.night, n);
    this.treeMaterial?.color.copy(TREE.day).lerp(TREE.night, n);
    this.trunkMaterial?.color.copy(TRUNK.day).lerp(TRUNK.night, n);
    this.pavingMaterial?.color.copy(PAVING.day).lerp(PAVING.night, n);
    this.lawnMaterial?.color.copy(LAWN.day).lerp(LAWN.night, n);
    this.curbMaterial?.color.copy(CURB.day).lerp(CURB.night, n);
    this.hedgeMaterial?.color.copy(HEDGE.day).lerp(HEDGE.night, n);
    this.cityUniforms.uNight.value = n;
    this.unitUniforms.uNight.value = n;
    this.syncRoomMaterials();
    this.placeUnitLight();
    if (this.lobbyLight) this.lobbyLight.intensity = 0.4 * n;
    for (const material of this.podiumMaterials || []) material.color.copy(material.userData.dayColor).lerp(PODIUM_NIGHT, n);
    this.applyEnv(n);
    this.aoPass.blendIntensity = 0.7 - n * 0.25;
    // Selective bloom already excludes the facade. The threshold keeps the spill falloff from halo-ing.
    this.bloomPass.threshold = 0.9 - n * 0.5;
    this.bloomPass.strength = n * 0.42;
    this.bloomPass.radius = 0.4;
    this.renderer.toneMappingExposure = 1.05 - n * 0.14;
  }

  applyEnv(night) {
    const intensity = 0.15 * night;
    this.scene.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of materials) {
        if (material.userData.context) continue;
        if ('envMapIntensity' in material && material.envMapIntensity !== undefined) material.envMapIntensity = intensity;
      }
    });
  }

  // ----- Pointer --------------------------------------------------------------------------------------------

  bindPointer() {
    const canvas = this.renderer.domElement;
    let down = null;
    this.onPointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      this.pointer = {x:(event.clientX - rect.left) / rect.width * 2 - 1, y:-((event.clientY - rect.top) / rect.height) * 2 + 1, clientX:event.clientX, clientY:event.clientY};
      if (this.windowView && down) {
        const view = this.windowView;
        view.yaw = view.base + THREE.MathUtils.clamp(wrapAngle(view.yaw - view.base - (event.clientX - down.x) * 0.004), -1.22, 1.22);
        view.pitch = THREE.MathUtils.clamp(view.pitch + (event.clientY - down.y) * 0.003, -0.4, 0.35);
        down = {x:event.clientX, y:event.clientY, moved:true};
        this.applyWindowCamera();
      } else if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) down.moved = true;
    };
    this.onPointerDown = event => { down = {x:event.clientX, y:event.clientY, moved:false}; if (this.windowView) { this.windowFlight = null; canvas.setPointerCapture?.(event.pointerId); } };
    this.onPointerUp = () => {
      const click = down && !down.moved;
      down = null;
      if (click && !this.windowView) this.callbacks.onPick?.(this.pick());
    };
    this.onPointerLeave = () => { this.pointer = null; this.updateHover(null); };
    this.onWheel = () => { this.cancelFlight(); this.callbacks.onInteract?.(); };
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, {passive:true});
  }

  pick() {
    if (!this.pointer || !this.envelope || !this.building?.visible || this.mode === 'city') return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.envelope, false);
    if (!hits.length) return null;
    const local = this.model.worldToLocal(hits[0].point.clone());
    const cut = this.unitUniforms.uCutY.value;
    if (local.y <= cut) return unitAt([local.x, local.y, local.z]);
    // The ray enters above the cut: what the eye sees is the opened floor, where the ray crosses the cut plane.
    const ray = this.raycaster.ray.clone().applyMatrix4(this.model.matrixWorld.clone().invert());
    const open = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -cut), new THREE.Vector3());
    const {x, z} = BUILDING.body;
    if (!open || open.x < x[0] || open.x > x[1] || open.z < z[0] || open.z > z[1]) return null;
    return unitAt([open.x, cut - 0.01, open.z]);
  }

  updateHover(hit) {
    const key = hit?.id || null;
    if (key === this.lastHoverKey && !hit) return;
    this.lastHoverKey = key;
    this.callbacks.onHover?.(hit, this.pointer);
  }

  reportCamera() {
    if (!this.callbacks.onCamera) return;
    const az = this.windowView ? this.windowView.yaw : this.currentPose().az;
    if (Math.abs((this.lastAz ?? 99) - az) < 0.01) return;
    this.lastAz = az;
    this.callbacks.onCamera({azimuth:az});
  }

  // ----- Loop -----------------------------------------------------------------------------------------------

  darkenNonBloomed(object) {
    if (!object.isMesh || this.bloomLayer.test(object.layers)) return;
    if (this.darkMaterials[object.uuid]) return;
    const material = object.material;
    if (!material || Array.isArray(material)) return;
    this.darkMaterials[object.uuid] = material;
    object.material = material.transparent || material.opacity < 1 ? this.darkTransparent : this.darkMaterial;
  }

  restoreBloomMaterial(object) {
    const material = this.darkMaterials[object.uuid];
    if (!material) return;
    object.material = material;
    delete this.darkMaterials[object.uuid];
  }

  /** Beauty pass, plus a bloom of layer 1 only: lit windows and their balcony spill. */
  renderFrame(delta) {
    const bloom = !this.degraded && this.night > 0.04 && this.bloomPass.strength > 0.001;
    if (bloom) {
      const background = this.scene.background;
      const fog = this.scene.fog;
      this.scene.background = this.blackBackground;
      this.scene.fog = null;
      try {
        this.scene.traverse(object => this.darkenNonBloomed(object));
        this.bloomComposer.render(delta);
      } finally {
        this.scene.traverse(object => this.restoreBloomMaterial(object));
        this.scene.background = background;
        this.scene.fog = fog;
      }
      this.mixPass.enabled = true;
    } else this.mixPass.enabled = false;
    this.composer.render(delta);
  }

  tween(id, from, to, seconds, apply, ease = easeInOut) {
    if (this.reduced || seconds <= 0) { this.tweens.delete(id); apply(to); return; }
    this.tweens.set(id, {from, to, start:this.clock.getElapsedTime(), seconds, apply, ease});
  }

  stepTweens(now) {
    for (const [id, tween] of this.tweens) {
      const raw = Math.min(1, (now - tween.start) / tween.seconds);
      tween.apply(tween.from + (tween.to - tween.from) * tween.ease(raw));
      if (raw >= 1) this.tweens.delete(id);
    }
  }

  frame() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const delta = this.clock.getDelta();
    const now = this.clock.getElapsedTime();
    this.stepTweens(now);
    if (this.windowFlight) this.stepWindowFlight(now);
    else if (this.flight) this.stepFlight(now);
    else if (!this.windowView) this.controls.update();
    if (!this.windowView && !this.flight) {
      const target = this.controls.target;
      const reach = Math.hypot(target.x, target.z);
      if (reach > 400) { target.x *= 400 / reach; target.z *= 400 / reach; }
    }
    if (this.pointer && !this.windowView && !this.flight && this.frameCount % 2 === 0) {
      const hit = this.pick();
      if ((hit?.id || null) !== (this.hovered?.id || null) || hit) this.updateHover(hit);
    }
    this.frameCount = (this.frameCount || 0) + 1;
    this.watchPerformance(delta);
    this.renderFrame(delta);
    this.placeLabels();
  }

  /** Below 30 fps for 3 s, shadows, ambient occlusion and bloom switch off for the rest of the visit. */
  watchPerformance(delta) {
    if (this.degraded || delta <= 0 || delta > 0.5) return;
    this.slow = delta > 1 / 30 ? this.slow + delta : Math.max(0, this.slow - delta * 0.5);
    if (this.slow < 3) return;
    this.degraded = true;
    this.renderer.shadowMap.enabled = false;
    this.sun.castShadow = false;
    this.aoPass.enabled = false;
    this.bloomPass.enabled = false;
    if (this.mixPass) this.mixPass.enabled = false;
    this.scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
  }

  resize() {
    const width = this.container.clientWidth || 1, height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    if (!this.windowView && !this.tweens.has('shift')) this.viewShift = width * HOME_SHIFT;
    this.applyViewShift();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.bloomComposer.setSize(width, height);
    this.bloomComposer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
    this.scene.traverse(object => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => { if (material.userData.shared) return; material.map?.dispose(); material.dispose(); });
    });
    this.sharedMaterials?.forEach(material => { material.map?.dispose(); material.dispose(); });
    this.envMap?.dispose();
    this.darkMaterial?.dispose();
    this.darkTransparent?.dispose();
    this.unitUniforms.uUnitState.value.dispose();
    this.composer.dispose?.();
    this.bloomComposer?.dispose();
    this.renderer.dispose();
    canvas.remove();
    this.labelLayer.remove();
  }
}

/** Plans that already have a transparent ground keep it. A drawing on white paper loses the paper, then both crop to the ink. */
const planCache = new Map();
function cropToContent(canvas) {
  const context = canvas.getContext('2d');
  const {width, height} = canvas;
  const data = context.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3] < 16) continue;
    found = true;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!found) return canvas;
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  if (w > width * 0.92 && h > height * 0.92) return canvas;
  const cropped = document.createElement('canvas');
  cropped.width = w;
  cropped.height = h;
  cropped.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return cropped;
}
function planTexture(src) {
  if (!planCache.has(src)) planCache.set(src, new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      let transparent = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent += 1;
      if (transparent < data.length / 4 * 0.02) {
        for (let i = 0; i < data.length; i += 4) {
          const light = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          data[i + 3] = Math.round(255 * (1 - smooth(0.8, 0.96, light)) * 0.96);
        }
        context.putImageData(pixels, 0, 0);
      }
      resolve(cropToContent(canvas));
    };
    image.onerror = reject;
    image.src = src;
  }));
  return planCache.get(src).then(canvas => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  });
}

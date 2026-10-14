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
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import SunCalc from 'suncalc';
import {BUILDING, LOT, slabY, toScene, unitAt, unitIndex} from './buildingConfig.js';
import {easeInOut, easeOut} from './easing.js';

const STATUS_CODE = {sold:0, reserved:1, available:2, filtered:3};
const IGNORE = 255;
const TOWER_FOCUS = new THREE.Vector3(0, 21, 0);
const DEFAULT_AZIMUTH = 0.62;
const POSES = {
  city:{dist:650, el:THREE.MathUtils.degToRad(45)},
  tower:{dist:132, el:THREE.MathUtils.degToRad(20)},
  plan:{dist:58, el:THREE.MathUtils.degToRad(55)},
};
const DURATION = {arrival:3.2, mode:1.2, focus:1.0, window:1.8, recenter:0.6};
const SKY = {day:new THREE.Color('#dde5ec'), dusk:new THREE.Color('#ead7c6'), night:new THREE.Color('#0d1729')};
const GROUND = {day:new THREE.Color('#efede8'), night:new THREE.Color('#151b26')};
const ROAD = {day:new THREE.Color('#fbfaf8'), night:new THREE.Color('#1d2431')};
const PARK = {day:new THREE.Color('#d8e3d0'), night:new THREE.Color('#18231c')};
const WATER = {day:new THREE.Color('#c9dbe6'), night:new THREE.Color('#122030')};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/** 0 by day, 1 from 19:30; dawn mirrors it before 06:45. */
export function nightFactor(hour) {
  return Math.max(smooth(18.6, 19.5, hour), 1 - smooth(5.9, 6.8, hour));
}

function cityShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  return shape;
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

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
    const controls = this.controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 80;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
    controls.screenSpacePanning = false;
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

    this.groundMaterial = new THREE.MeshStandardMaterial({color:GROUND.day, roughness:1});
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64).rotateX(-Math.PI / 2), this.groundMaterial);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    this.cityUniforms = {uNight:{value:0}, uDim:{value:0}};
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
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.55, 0.62);
    composer.addPass(this.bloomPass);
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
    this.setTime(12);
    this.raf = requestAnimationFrame(this.frame);
    this.loadCity();
    this.loadBuilding();
  }

  createUnitUniforms() {
    const data = new Uint8Array(2 * BUILDING.levels).fill(IGNORE);
    const texture = new THREE.DataTexture(data, 2, BUILDING.levels, THREE.RedFormat, THREE.UnsignedByteType);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return {
      uUnitState:{value:texture},
      uBase:{value:BUILDING.base}, uFloorH:{value:BUILDING.floorHeight}, uLevels:{value:BUILDING.levels}, uSplitZ:{value:BUILDING.splitZ},
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

  cityMaterial() {
    const material = new THREE.MeshStandardMaterial({color:'#f4f2ee', roughness:0.92});
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.cityUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvCityPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCityNormal = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vCityPos;
varying vec3 vCityNormal;
uniform float uNight;
uniform float uDim;
float cityHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grey), 0.6 * uDim) * (1.0 - 0.3 * uDim);
diffuseColor.rgb *= mix(1.0, 0.32, uNight);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (abs(vCityNormal.y) < 0.4 && vCityPos.y > 2.0) {
  vec2 across = normalize(vec2(-vCityNormal.z, vCityNormal.x));
  vec2 cell = floor(vec2(dot(vCityPos.xz, across) / 3.2, vCityPos.y / 2.6));
  vec2 inCell = fract(vec2(dot(vCityPos.xz, across) / 3.2, vCityPos.y / 2.6));
  float lit = step(0.84, cityHash(cell + floor(vCityPos.xz / 40.0)));
  float pane = step(0.18, inCell.x) * step(inCell.x, 0.82) * step(0.25, inCell.y) * step(inCell.y, 0.8);
  totalEmissiveRadiance += vec3(0.62, 0.72, 0.95) * 0.55 * lit * pane * uNight;
}`);
    };
    return material;
  }

  buildCity(city) {
    const buildings = [];
    for (const building of city.buildings) {
      if (building.p.length < 3) continue;
      const geometry = new THREE.ExtrudeGeometry(cityShape(building.p), {depth:building.h, bevelEnabled:false});
      geometry.rotateX(-Math.PI / 2);
      geometry.deleteAttribute('uv');
      buildings.push(geometry);
    }
    if (buildings.length) {
      const mesh = new THREE.Mesh(mergeGeometries(buildings), this.cityMaterial());
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      buildings.forEach(geometry => geometry.dispose());
    }
    const flat = (items, build) => items.map(build).filter(Boolean);
    this.roadMaterial = new THREE.MeshStandardMaterial({color:ROAD.day, roughness:1});
    const roads = flat(city.roads, road => road.p.length > 1 ? ribbon(road.p, road.w) : null);
    if (roads.length) {
      const mesh = new THREE.Mesh(mergeGeometries(roads), this.roadMaterial);
      mesh.position.y = 0.02;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.parkMaterial = new THREE.MeshStandardMaterial({color:PARK.day, roughness:1});
    this.waterMaterial = new THREE.MeshStandardMaterial({color:WATER.day, roughness:0.4});
    const plane = items => flat(items, item => new THREE.ShapeGeometry(cityShape(item.p)).rotateX(-Math.PI / 2));
    const parks = plane(city.parks), water = plane(city.water);
    if (parks.length) { const mesh = new THREE.Mesh(mergeGeometries(parks.map(g => g.deleteAttribute('uv') || g)), this.parkMaterial); mesh.position.y = 0.04; mesh.receiveShadow = true; this.scene.add(mesh); }
    if (water.length) { const mesh = new THREE.Mesh(mergeGeometries(water.map(g => g.deleteAttribute('uv') || g)), this.waterMaterial); mesh.position.y = 0.05; this.scene.add(mesh); }
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
    if (!spots.length) return;
    this.treeMaterial = new THREE.MeshStandardMaterial({color:'#b9cdb0', roughness:1, flatShading:true});
    const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.treeMaterial, spots.length);
    const matrix = new THREE.Matrix4();
    spots.forEach(([x, z, r], i) => trees.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, r * 1.6, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 1.15, r))));
    trees.castShadow = true;
    this.scene.add(trees);
  }

  buildFallbackCity() {
    const blocks = [];
    for (let i = 0; i < 36; i += 1) {
      const angle = i / 36 * Math.PI * 2, radius = 70 + hash(i, 3) * 160;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, w = 16 + hash(i, 7) * 10, h = 8 + hash(i, 9) * 22;
      blocks.push(new THREE.BoxGeometry(w, h, w).translate(x, h / 2, z));
    }
    const mesh = new THREE.Mesh(mergeGeometries(blocks), this.cityMaterial());
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ----- Building -------------------------------------------------------------------------------------------

  async loadBuilding() {
    try {
      const gltf = await new GLTFLoader().loadAsync(BUILDING.glb);
      if (this.disposed) return;
      const holder = this.building = new THREE.Group();
      const model = this.model = gltf.scene;
      holder.scale.setScalar(BUILDING.scale);
      holder.position.set(-BUILDING.center[0] * BUILDING.scale, 0, -BUILDING.center[1] * BUILDING.scale);
      holder.rotation.y = THREE.MathUtils.degToRad(BUILDING.heading);
      holder.add(model);
      this.scene.add(holder);
      holder.updateMatrixWorld(true);
      this.unitUniforms.uToModel.value.copy(model.matrixWorld).invert();
      model.traverse(object => {
        if (!object.isMesh) return;
        const material = object.material;
        if (BUILDING.hiddenMaterials.test(material?.name || '')) { object.visible = false; return; }
        object.castShadow = true;
        object.receiveShadow = true;
        this.patchUnitShader(material);
      });
      this.buildUnitVolumes();
      this.callbacks.onReady?.();
    } catch {
      if (!this.disposed) this.callbacks.onModelError?.();
    }
  }

  patchUnitShader(material) {
    if (material.userData.unitPatched) return;
    material.userData.unitPatched = true;
    const glass = material.transparent || material.opacity < 1;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.unitUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uToModel;\nvarying vec3 vModelPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvModelPos = (uToModel * modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vModelPos;
uniform sampler2D uUnitState;
uniform float uBase, uFloorH, uLevels, uSplitZ, uNight, uHover, uHoverLevel, uSelected, uPulse, uCutY;`)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vModelPos.y > uCutY) discard;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float level = floor((vModelPos.y - uBase) / uFloorH);
  if (level >= 0.0 && level < uLevels) {
    float side = vModelPos.z < uSplitZ ? 0.0 : 1.0;
    float state = floor(texture2D(uUnitState, vec2((side + 0.5) / 2.0, (level + 0.5) / uLevels)).r * 255.0 + 0.5);
    float unit = level * 2.0 + side;
    float pane = ${glass ? '1.0' : '0.1'};
    vec3 warm = vec3(1.0, 0.64, 0.3);
    if (state < 0.5) diffuseColor.rgb *= ${glass ? '0.8' : '1.0'};
    else if (state < 1.5) totalEmissiveRadiance += warm * 0.5 * uNight * pane;
    else if (state < 2.5) totalEmissiveRadiance += warm * 2.4 * uNight * pane + vec3(0.07) * (1.0 - uNight) * pane;
    else if (state < 3.5) diffuseColor.rgb *= 0.5;
    if (state < 3.5) {
      if (unit == uHover) totalEmissiveRadiance += vec3(1.0, 0.33, 0.0) * 0.12;
      if (level == uHoverLevel) totalEmissiveRadiance += vec3(1.0, 0.33, 0.0) * 0.1;
      if (unit == uSelected) totalEmissiveRadiance += vec3(1.0, 0.33, 0.0) * (0.14 + 0.3 * uPulse);
    }
  }
}`);
    };
    material.customProgramCacheKey = () => `torre-unit-${glass ? 'glass' : 'solid'}`;
    material.needsUpdate = true;
  }

  buildUnitVolumes() {
    const [x0, x1] = BUILDING.bounds.x, [z0, z1] = BUILDING.bounds.z;
    const pad = 0.04;
    const invisible = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false});
    this.unitBoxes = new Map();
    const box = (floor, side) => {
      const zs = side === 0 ? [z0, BUILDING.splitZ] : [BUILDING.splitZ, z1];
      const geometry = new THREE.BoxGeometry(x1 - x0 + pad * 2, BUILDING.floorHeight, zs[1] - zs[0] + pad);
      const mesh = new THREE.Mesh(geometry, invisible);
      mesh.position.set((x0 + x1) / 2, slabY(floor) + BUILDING.floorHeight / 2, (zs[0] + zs[1]) / 2);
      mesh.renderOrder = -1;
      return mesh;
    };
    for (let floor = BUILDING.firstResidentialFloor; floor < BUILDING.firstLevelNumber + BUILDING.levels; floor += 1) {
      for (const side of [0, 1]) {
        const mesh = box(floor, side);
        this.model.add(mesh);
        this.unitBoxes.set(`${floor}:${side}`, mesh);
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
  }

  refreshOutlines() {
    if (!this.unitBoxes) return;
    const box = unit => unit && this.unitBoxes.get(`${unit.floor}:${unit.side}`);
    const hovered = box(this.hovered), selected = box(this.selected);
    const outlined = this.mode !== 'city' && !this.windowView;
    const floor = this.hoveredFloor ? [0, 1].map(side => this.unitBoxes.get(`${this.hoveredFloor}:${side}`)).filter(item => item && item !== selected) : [];
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

  /** Where the camera must aim so `focus` lands in the middle of the area right of the panel. */
  aimFor(focus, dist, az) {
    if (!this.panelOffset) return focus.clone();
    const height = this.container.clientHeight || 1;
    const worldPerPixel = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / height;
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    return focus.clone().addScaledVector(right, -this.panelOffset / 2 * worldPerPixel);
  }

  fly(pose, seconds, onDone) {
    const from = this.currentPose();
    const to = {...pose, target:this.aimFor(pose.focus, pose.dist, pose.az)};
    if (this.reduced || seconds <= 0) {
      this.flight = null;
      this.setPose(to);
      this.reportCamera();
      onDone?.();
      return;
    }
    this.flight = {from, to, start:this.clock.getElapsedTime(), duration:seconds, onDone, ease:pose.ease || easeInOut, arc:pose.arc || 0};
  }

  cancelFlight() { this.flight = null; }

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

  arrive() {
    this.fly({focus:TOWER_FOCUS, dist:POSES.tower.dist, el:POSES.tower.el, az:DEFAULT_AZIMUTH}, DURATION.arrival);
  }

  setMode(mode, unit = this.selected) {
    const previous = this.mode;
    this.mode = mode;
    if (this.windowView) this.exitWindowView(false);
    const az = this.currentPose().az;
    this.tween('dim', this.cityUniforms.uDim.value, mode === 'city' ? 0 : 1, 0.6, value => { this.cityUniforms.uDim.value = value; }, t => t);
    this.controls.minDistance = mode === 'plan' ? 30 : 80;
    if (mode === 'plan' && unit) {
      const [x, , z] = toScene([(BUILDING.bounds.x[0] + BUILDING.bounds.x[1]) / 2, 0, unit.side === 0 ? (BUILDING.bounds.z[0] + BUILDING.splitZ) / 2 : (BUILDING.splitZ + BUILDING.bounds.z[1]) / 2]);
      const y = slabY(unit.floor) * BUILDING.scale;
      this.cutAbove(unit.floor);
      this.showPlan(unit);
      this.fly({focus:new THREE.Vector3(x, y, z), dist:POSES.plan.dist, el:POSES.plan.el, az:unit.side === 0 ? Math.PI + 0.35 : 0.35}, previous === 'plan' ? DURATION.focus : DURATION.mode);
    } else {
      this.cutAbove(null);
      this.showPlan(null);
      const pose = mode === 'city' ? {focus:new THREE.Vector3(0, 0, 0), ...POSES.city} : {focus:TOWER_FOCUS, ...POSES.tower};
      this.fly({...pose, az}, DURATION.mode);
    }
    this.refreshOutlines();
  }

  /** The compass: back to the default framing of the current mode, north where it started. */
  resetView() {
    if (this.windowView) return;
    if (this.mode === 'plan' && this.selected) { this.setMode('plan', this.selected); return; }
    const pose = this.mode === 'city' ? {focus:new THREE.Vector3(0, 0, 0), ...POSES.city} : {focus:TOWER_FOCUS, ...POSES.tower};
    this.fly({...pose, az:DEFAULT_AZIMUTH}, DURATION.focus);
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
    const center = new THREE.Vector3(0, slabY(unit.floor) * BUILDING.scale + 2, 0);
    this.fly({focus:center, dist:POSES.tower.dist * 0.85, el:THREE.MathUtils.degToRad(14), az:unit.side === 0 ? Math.PI + 0.55 : 0.55}, DURATION.focus);
  }

  flyToAnchor(anchor) {
    const height = anchor === 'roof' ? BUILDING.top * BUILDING.scale : anchor === 0 ? 3 : slabY(anchor) * BUILDING.scale + 2;
    const focus = new THREE.Vector3(0, height, 0);
    const pose = this.currentPose();
    if (this.mode === 'plan') { this.mode = 'tower'; this.cutAbove(null); this.showPlan(null); }
    this.fly({focus, dist:anchor === 'roof' ? 110 : 95, el:THREE.MathUtils.degToRad(anchor === 'roof' ? 34 : 12), az:pose.az}, DURATION.focus);
    return new THREE.Vector3(0, height + (anchor === 'roof' ? 2 : 0), anchor === 'roof' ? 0 : (BUILDING.bounds.z[1] - BUILDING.center[1]) * BUILDING.scale);
  }

  setPanelOffset(offset, animate = true) {
    const pose = this.currentPose();
    const before = this.aimFor(new THREE.Vector3(), pose.dist, pose.az);
    const focus = pose.target.clone().sub(before);
    this.panelOffset = offset;
    if (this.windowView) return;
    this.fly({focus, dist:pose.dist, el:pose.el, az:pose.az}, animate ? DURATION.recenter : 0);
  }

  cutAbove(floor) {
    const top = BUILDING.top + 1;
    const target = floor == null ? top : slabY(floor + 1) - 0.02;
    const from = Math.min(this.unitUniforms.uCutY.value, top);
    if (this.reduced) { this.unitUniforms.uCutY.value = floor == null ? 1e4 : target; return; }
    this.tween('cut', from, target, 0.4, value => { this.unitUniforms.uCutY.value = floor == null && value >= top - 0.01 ? 1e4 : value; }, easeOut);
  }

  async showPlan(unit) {
    this.planToken = unit?.id || null;
    if (this.planMesh) { this.model?.remove(this.planMesh); this.planMesh.geometry.dispose(); this.planMesh.material.dispose(); this.planMesh = null; }
    if (!unit || !this.model || this.planHidden) return;
    const texture = await planTexture(unit.plan);
    if (this.planToken !== unit.id || !this.model) { texture.dispose(); return; }
    const [x0, x1] = BUILDING.bounds.x;
    const [z0, z1] = unit.side === 0 ? [BUILDING.bounds.z[0], BUILDING.splitZ] : [BUILDING.splitZ, BUILDING.bounds.z[1]];
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
    this.cutAbove(null);
    this.showPlan(null);
    const facadeZ = unit.side === 0 ? BUILDING.bounds.z[0] - 0.6 : BUILDING.bounds.z[1] + 0.6;
    const eye = new THREE.Vector3(...toScene([(BUILDING.bounds.x[0] + BUILDING.bounds.x[1]) / 2, slabY(unit.floor) + 1.6 / BUILDING.scale, facadeZ]));
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
    const az = DEFAULT_AZIMUTH;
    // The camera looks out from inside the facade; OrbitControls needs its target back before any flight.
    this.controls.target.copy(this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(40)));
    if (flyBack) this.fly({focus:TOWER_FOCUS, ...POSES.tower, az}, DURATION.mode);
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
      label.el.textContent = item.text;
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
    const direction = new THREE.Vector3(-Math.sin(azimuth) * Math.cos(altitude), Math.max(0.05, Math.sin(altitude)), Math.cos(azimuth) * Math.cos(altitude)).normalize();
    this.sun.position.copy(direction.multiplyScalar(600));
    this.sun.target.position.set(0, 0, 0);
    this.night = nightFactor(hour);
    const dusk = smooth(16.8, 18.4, hour) * (1 - this.night) + (1 - smooth(6.2, 7.6, hour)) * (1 - this.night);
    this.sun.intensity = (0.4 + 2.2 * Math.min(1, up * 1.6)) * (1 - this.night * 0.92);
    this.sun.color.set('#fff5e6').lerp(new THREE.Color('#ffb27a'), dusk);
    this.hemi.intensity = 1.25 - this.night * 0.95;
    this.applyNight(dusk);
  }

  applyNight(dusk = 0) {
    const n = this.night;
    const sky = SKY.day.clone().lerp(SKY.dusk, dusk).lerp(SKY.night, n);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.groundMaterial.color.copy(GROUND.day).lerp(GROUND.night, n);
    this.roadMaterial?.color.copy(ROAD.day).lerp(ROAD.night, n);
    this.parkMaterial?.color.copy(PARK.day).lerp(PARK.night, n);
    this.waterMaterial?.color.copy(WATER.day).lerp(WATER.night, n);
    this.treeMaterial?.color.set('#b9cdb0').lerp(new THREE.Color('#1c2a20'), n);
    this.cityUniforms.uNight.value = n;
    this.unitUniforms.uNight.value = n;
    this.bloomPass.strength = 0.12 + n * 0.85;
    this.renderer.toneMappingExposure = 1 - n * 0.2;
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
    if (local.y > this.unitUniforms.uCutY.value) return null;
    return unitAt([local.x, local.y, local.z]);
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
    this.composer.render(delta);
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
    this.scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
  }

  resize() {
    const width = this.container.clientWidth || 1, height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
      materials.forEach(material => { material.map?.dispose(); material.dispose(); });
    });
    this.unitUniforms.uUnitState.value.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
    canvas.remove();
    this.labelLayer.remove();
  }
}

/** The floor plans are drawings on white; white becomes transparent so the slab shows through. */
const planCache = new Map();
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
      for (let i = 0; i < data.length; i += 4) {
        const light = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        data[i + 3] = Math.round(255 * (1 - smooth(0.8, 0.96, light)) * 0.96);
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas);
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

// Reads the development's GLB and prints the numbers buildingConfig.js needs:
// world bounds after the node transforms, and the heights where horizontal faces pile up (the slabs).
// Usage: node scripts/calibrate-building.mjs public/models/torre-olmo.glb
import {readFileSync} from 'node:fs';

const file = process.argv[2] || 'public/models/torre-olmo.glb';
const glb = readFileSync(file);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;
const bin = glb.subarray(binStart);

const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
};
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function local(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

function read(accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const size = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4}[accessor.type];
  const Type = {5126:Float32Array, 5125:Uint32Array, 5123:Uint16Array, 5121:Uint8Array}[accessor.componentType];
  const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride ? view.byteStride / Type.BYTES_PER_ELEMENT : size;
  const source = new Type(bin.buffer, bin.byteOffset + offset, (accessor.count - 1) * stride + size);
  return Array.from({length:accessor.count}, (_, i) => Array.from({length:size}, (_, k) => source[i * stride + k]));
}

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
const slabs = new Map();
const materialsByMesh = [];
function visit(index, parent) {
  const node = json.nodes[index];
  const world = multiply(parent, local(node));
  if (node.mesh != null) {
    for (const primitive of json.meshes[node.mesh].primitives) {
      const material = json.materials[primitive.material]?.name || '';
      materialsByMesh.push({node:node.name, material});
      if (/^Sumele_/.test(material)) continue;
      const positions = read(primitive.attributes.POSITION).map(p => apply(world, p));
      positions.forEach(p => p.forEach((v, k) => { min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); }));
      const indices = primitive.indices != null ? read(primitive.indices).map(v => v[0]) : positions.map((_, i) => i);
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = [positions[indices[i]], positions[indices[i + 1]], positions[indices[i + 2]]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const area = Math.hypot(...n) / 2;
        if (!area || Math.abs(n[1]) / (2 * area) < 0.98) continue;
        const height = Math.round(((a[1] + b[1] + c[1]) / 3) * 10) / 10;
        slabs.set(height, (slabs.get(height) || 0) + area);
      }
    }
  }
  for (const child of node.children || []) visit(child, world);
}
for (const root of json.scenes[json.scene || 0].nodes) visit(root, identity);

console.log('bounds', {min:min.map(v => +v.toFixed(2)), max:max.map(v => +v.toFixed(2))});
const ranked = [...slabs].filter(([, area]) => area > 40).sort((a, b) => a[0] - b[0]);
console.log('slab heights (m, horizontal area m²)');
for (const [height, area] of ranked) console.log(height.toFixed(1).padStart(6), Math.round(area));

// The 3D Forêt Verte, built the way the original game builds its maps: a height field of
// stepped terraces (5 levels) cut by winding trails that soften them into ramps, two big
// spiral massifs, walls rising at the edge of the play area; the ground uses the game's own
// grass, cliff and path tiles at sprite pixel density, with grass hanging over the cliff lips,
// wind bands and cloud shadows; decor comes from the game's forest sprite sheet (instanced,
// swaying billboards with blob shadows), a two-layer mountain panorama surrounds the map
// and the game's 3D models stand on it. Pokémon are animated sprite-sheet billboards.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BY_ID, sheet } from './sprites.js';
import { SHEETS } from './sheets.js';

// Sheet layout for any of the 251, from the compact table when the run data doesn't have it.
function sheetInfo(id) {
  const known = BY_ID.get(id)?.sheet;
  if (known) return known;
  const t = SHEETS[id];
  const a = (x) => x && { y: x[0], fw: x[1], fh: x[2], n: x[3], rows: 8, d: x[4] };
  return { w: t[0], h: t[1], anims: { idle: a(t[2]) || a(t[3]), walk: a(t[3]) } };
}

const asset = (p) => new URL(`./assets/${p}`, location.href).href;
const PX = 13.5; // sprite pixels per world unit (the game's density)
const TIER = 4.6; // height of one terrace
const LEVELS = 5;
const CELL = 1.12;
export const WORLD = 230;
export const ARENA = WORLD / 2 - 12; // half-size of the square play area

const SKY_TOP = 0x3a90ff;
const SKY_LOW = 0xa8dcff;
const FOG = 0x9ed5ff;

// ---- deterministic randomness and noise ----
function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { next, range: (a, b) => a + next() * (b - a), int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}
function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => { const a = (h & 7) * (Math.PI / 4); return Math.cos(a) * x + Math.sin(a) * y; };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const get = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const X = xi & 255; const Y = yi & 255;
    const u = fade(xf); const v = fade(yf);
    const a = grad(perm[X + perm[Y]], xf, yf); const b = grad(perm[X + 1 + perm[Y]], xf - 1, yf);
    const c = grad(perm[X + perm[Y + 1]], xf, yf - 1); const d = grad(perm[X + 1 + perm[Y + 1]], xf - 1, yf - 1);
    return (a + u * (b - a) + v * (c + u * (d - c) - a - u * (b - a))) * 1.4;
  };
  const fbm = (x, y, oct = 4) => { let amp = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += amp * get(x * f, y * f); n += amp; amp *= 0.5; f *= 2; } return s / n; };
  return { get, fbm };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ---- textures ----
const loader = new THREE.TextureLoader();
function pixTex(path, repeat = true) {
  const t = loader.load(asset(path));
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const atlasCache = new Map();
function packAtlas(pack) {
  if (!atlasCache.has(pack)) atlasCache.set(pack, fetch(asset(`env/${pack}/atlas.json`)).then((r) => r.json()));
  return atlasCache.get(pack);
}
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
function skyTexture(top = SKY_TOP, low = SKY_LOW) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(top));
  grad.addColorStop(0.62, hex(low));
  grad.addColorStop(1, hex(low));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Decor of the forest sheet: name → [scale, sway, collider radius, shadow size]
const DECOR = {
  tree0: [0.085, 0.08, 0.8, 3.6], tree1: [0.085, 0.06, 0.6, 2.6], tree2: [0.08, 0.08, 0.5, 2.2], tree3: [0.085, 0.08, 0.7, 3.2], tree4: [0.085, 0.06, 1, 4.2], tree5: [0.085, 0.1, 0.4, 2],
  boulder: [0.05, 0, 1.2, 2.8], stump: [0.05, 0, 0.7, 1.8], log: [0.05, 0, 0.9, 2.2], bush: [0.05, 0.05, 0, 1.8], berrybush: [0.05, 0.05, 0, 1.8],
  tallgrass: [0.05, 0.18, 0, 0], fern: [0.05, 0.15, 0, 0], flowersA: [0.05, 0.12, 0, 0], flowersB: [0.05, 0.12, 0, 0], sunflower: [0.05, 0.15, 0, 0], mushrooms: [0.05, 0, 0, 0], rocks: [0.05, 0, 0, 0],
  oak: [0.13, 0.03, 2.2, 7], arch: [0.11, 0, 0, 4], hollowlog: [0.1, 0, 1.4, 4], glowshrooms: [0.1, 0, 0.9, 2.5],
};
for (let k = 0; k < 6; k++) DECOR['tree' + k] ||= [0.085, 0.06, 0.7, 3];
for (let k = 0; k < 5; k++) DECOR['big' + k] = [0.05, 0, 0.9, 2.2];
for (let k = 0; k < 7; k++) DECOR['small' + k] = [0.05, 0.12, 0, 0];
const GEN_TREES = ['tree0', 'tree0', 'tree1', 'tree1', 'tree2', 'tree3', 'tree4', 'tree5'];
const GEN_BIG = ['big1', 'big2', 'big3', 'big4', 'big2'];
const GEN_SMALL = ['small0', 'small1', 'small2', 'small3', 'small4', 'small5', 'small6', 'small2'];
const TREES = ['tree0', 'tree0', 'tree1', 'tree3', 'tree4', 'tree5', 'tree1', 'tree2'];
const BIG = ['boulder', 'stump', 'log', 'bush', 'berrybush', 'bush'];
const SMALL = ['tallgrass', 'fern', 'flowersA', 'flowersB', 'sunflower', 'mushrooms', 'rocks', 'tallgrass', 'flowersA'];

// Shared GLSL helpers (written for this rebuild).
const GLSL_UTIL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float bayer4(vec2 p){ vec2 q = mod(p, 4.); int i = int(q.x) + int(q.y) * 4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.; return 0.; }
`;

export function buildWorld(scene, { seed = 1, shared = { uTime: { value: 0 } }, biome = null } = {}) {
  const pack = biome?.pack || 'forest';
  const forest = pack === 'forest';
  const lk = biome?.look || {};
  const FOGC = lk.fog ?? FOG;
  // The map's shape: an island in the sea, a coast with the sea along one side, frozen lakes, mesas, a cave.
  const shape = biome?.id || 'forest';
  const iceLakes = shape === 'glacier';
  const R = rng(seed);
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed ^ 0x5bd1e995);
  const res = Math.round(WORLD / CELL);
  const cell = WORLD / res;
  const half = WORLD / 2;
  const play = ARENA;
  const N = res + 1;
  const heights = new Float32Array(N * N);
  const pathMask = new Float32Array(N * N);
  const idx = (i, j) => j * N + i;

  // trails from the centre
  const trails = [];
  const nt = 4 + R.int(0, 1);
  for (let t = 0; t < nt; t++) {
    const pts = [[0, 0]];
    let a = (t / nt) * Math.PI * 2 + R.range(-0.4, 0.4);
    let x = 0; let z = 0;
    for (let k = 0, steps = Math.round(play / 13); k < steps; k++) { a += R.range(-0.55, 0.55); x += Math.cos(a) * 15; z += Math.sin(a) * 15; pts.push([x, z]); }
    trails.push(pts);
  }
  // two big spiral massifs (raised plateaus with a ramp winding up them)
  const massifs = [];
  for (let tries = 0; massifs.length < (shape === 'desert' || shape === 'cave' ? 3 : 2) && tries < 60; tries++) {
    const a = R.range(0, Math.PI * 2);
    const d = R.range(0.42, 0.66) * play;
    const r = R.range(26, 30);
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    if (Math.hypot(x, z) < r + 18 || massifs.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + r + 16)) continue;
    massifs.push({ x, z, r });
    const pts = [];
    const u = R.range(0, Math.PI * 2);
    const dir = R.chance(0.5) ? 1 : -1;
    for (let k = 0; k <= 22; k++) { const t = k / 22; const ang = u + dir * t * Math.PI * 2.3; const rr = r * (1.12 - t * 0.95); pts.push([x + Math.cos(ang) * rr, z + Math.sin(ang) * rr]); }
    trails.push(pts);
  }
  const trailDist = (x, z) => {
    let best = 1e9;
    for (const pts of trails) for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k]; const [bx, bz] = pts[k + 1];
      const dx = bx - ax; const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = ax + dx * t - x; const pz = az + dz * t - z;
      best = Math.min(best, px * px + pz * pz);
    }
    return Math.sqrt(best);
  };
  const field = (x, z) => {
    let i = n1.fbm(x * 0.011, z * 0.011, 4) * 0.5 + 0.5;
    i += n2.fbm(x * 0.03, z * 0.03, 2) * 0.04;
    i = clamp(i, 0, 1);
    for (const m of massifs) {
      const d = Math.hypot(x - m.x, z - m.z) + n2.get(x * 0.05, z * 0.05) * 6;
      const k = clamp((m.r - d) / (m.r * 0.85), 0, 1);
      i += k * ((LEVELS + 1.35) / LEVELS - i);
    }
    const sharp = smooth(0.25, 0.55, n2.get(x * 0.014 + 40, z * 0.014 - 17));
    const f = i * LEVELS;
    const p = Math.floor(f);
    const m = f - p;
    const h = 0.035 + sharp * 0.4;
    const stepped = (p + smooth(0.5 - h, 0.5 + h, m)) * TIER;
    const td = trailDist(x, z);
    const v = smooth(8, 3, td) * (0.55 + 0.45 * smooth(-0.2, 0.3, n2.get(x * 0.02, z * 0.02)));
    const ramp = i * LEVELS * TIER;
    return { h: stepped * (1 - v * 0.92) + ramp * v * 0.92, td };
  };

  // ponds: flat low basins with water
  const ponds = [];
  const pondCount = biome && biome.water === null ? 0 : shape === 'glacier' ? 4 : shape === 'canela' || shape === 'coast' ? 1 : 2;
  for (let tries = 0; ponds.length < pondCount && tries < 120; tries++) {
    const x = R.range(-play + 20, play - 20); const z = R.range(-play + 20, play - 20);
    if (Math.hypot(x, z) < 30 || massifs.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 14) || ponds.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue;
    if (trailDist(x, z) < 12) continue;
    const base = field(x, z).h;
    ponds.push({ x, z, r: R.range(7, 9.5), h: base, level: base - 0.15, seed: R.range(0, 50) });
  }

  // the sea: how far a point is past the shoreline (negative on land)
  const sea = shape === 'canela' || shape === 'coast' ? { level: TIER * 0.55 } : null;
  const seaDist = (x, z) => shape === 'canela'
    ? Math.hypot(x, z) - (play * 0.78 + n1.get(Math.cos(Math.atan2(z, x)) * 1.6 + 3, Math.sin(Math.atan2(z, x)) * 1.6) * 12)
    : z - (play * 0.42 + n1.get(x * 0.02, 9.5) * 12);
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
    const x = i * cell - half; const z = j * cell - half;
    let { h: h0, td } = field(x, z);
    if (shape === 'desert') h0 += Math.sin(x * 0.21 + n2.get(x * 0.03, z * 0.03) * 4) * 0.12; // wind ripples in the sand
    let h = h0;
    for (const p of ponds) {
      const dx = x - p.x; const dz = z - p.z; const d = Math.hypot(dx, dz);
      if (d > p.r + 7) continue;
      const a = Math.atan2(dz, dx);
      const rr = p.r * (0.82 + 0.3 * n2.get(Math.cos(a) * 1.2 + p.seed, Math.sin(a) * 1.2 - p.seed));
      const k = smooth(p.r + 7, p.r + 3, d);
      h = h * (1 - k) + p.h * k;
      if (d < rr) h = Math.min(h, p.level - 0.06 - 0.39 * smooth(rr, rr - 3.2, d));
    }
    const s = smooth(18, 9, Math.hypot(x, z));
    h = h * (1 - s) + TIER * s;
    h += n2.get(x * 0.07, z * 0.07) * 0.12;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const sd = sea ? seaDist(x, z) : -99;
    h += smooth(play - 4, play + 10, edge) * (shape === 'cave' ? 30 : 18 + n1.get(x * 0.05, z * 0.05) * 8) * (1 - smooth(-6, 4, sd));
    if (sea) {
      const beach = smooth(-16, -3, sd); h = h * (1 - beach) + (sea.level + 0.45 + Math.max(0, -sd) * 0.03) * beach;
      const drop = smooth(-3, 8, sd); h = h * (1 - drop) + (sea.level - 4) * drop;
    }
    heights[idx(i, j)] = h;
    pathMask[idx(i, j)] = smooth(1.9, 1.0, td + n2.get(x * 0.2, z * 0.2) * 0.5) * (1 - smooth(14, 9, Math.hypot(x, z))) * (edge < play - 4 ? 1 : 0);
  }
  { // soften
    const src = heights.slice();
    for (let j = 1; j < res; j++) for (let i = 1; i < res; i++) {
      let s = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += src[idx(i + a, j + b)] * (a === 0 && b === 0 ? 4 : a === 0 || b === 0 ? 2 : 1);
      heights[idx(i, j)] = s / 16;
    }
  }
  // the centre sits at height 0
  const h00 = heights[idx(Math.round(half / cell), Math.round(half / cell))];
  for (let k = 0; k < heights.length; k++) heights[k] -= h00;
  for (const p of ponds) { p.level -= h00; p.h -= h00; }
  if (sea) sea.level -= h00;

  const height = (x, z) => {
    const fx = clamp((x + half) / cell, 0, res - 0.001); const fz = clamp((z + half) / cell, 0, res - 0.001);
    const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const v = fz - j;
    const a = heights[idx(i, j)]; const b = heights[idx(i + 1, j)]; const c = heights[idx(i, j + 1)]; const d = heights[idx(i + 1, j + 1)];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const slopeAt = (x, z, r = 1.5) => Math.max(Math.abs(height(x + r, z) - height(x - r, z)), Math.abs(height(x, z + r) - height(x, z - r))) / (2 * r);
  const inPond = (x, z, pad = 0) => ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad) || (sea && height(x, z) < sea.level + 0.9 + pad * 0.15);
  const pathAt = (x, z) => pathMask[idx(Math.round((x + half) / cell), Math.round((z + half) / cell))] || 0;

  // cliff top/foot maps (max/min over 2.5 units) for the hanging grass and wall shading
  const rad = Math.max(1, Math.round(2.5 / cell));
  const spread = (fn) => {
    const tmp = new Float32Array(N * N); const out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = heights[idx(i, j)]; for (let a = Math.max(0, i - rad); a <= Math.min(N - 1, i + rad); a++) s = fn(s, heights[idx(a, j)]); tmp[idx(i, j)] = s; }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = tmp[idx(i, j)]; for (let b = Math.max(0, j - rad); b <= Math.min(N - 1, j + rad); b++) s = fn(s, tmp[idx(i, b)]); out[idx(i, j)] = s; }
    return out;
  };
  const top = spread(Math.max);
  const base = spread(Math.min);

  // ---- terrain mesh ----
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, res, res).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const aPath = new Float32Array(pos.count);
  const aCliff = new Float32Array(pos.count * 2);
  const aShore = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const i = Math.round((pos.getX(v) + half) / cell); const j = Math.round((pos.getZ(v) + half) / cell);
    pos.setY(v, heights[idx(i, j)]);
    aPath[v] = pathMask[idx(i, j)];
    aCliff[v * 2] = top[idx(i, j)];
    aCliff[v * 2 + 1] = base[idx(i, j)];
    const wx = pos.getX(v); const wz = pos.getZ(v);
    for (const p of ponds) aShore[v] = Math.max(aShore[v], smooth(p.r + 3, p.r + 1, Math.hypot(wx - p.x, wz - p.z)) * (pos.getY(v) < p.level + 0.8 ? 1 : 0));
    if (sea) aShore[v] = Math.max(aShore[v], smooth(sea.level + 1.6, sea.level + 0.9, pos.getY(v)));
  }
  geo.setAttribute('aPath', new THREE.BufferAttribute(aPath, 1));
  geo.setAttribute('aCliff', new THREE.BufferAttribute(aCliff, 2));
  geo.setAttribute('aShore', new THREE.BufferAttribute(aShore, 1));
  geo.computeVertexNormals();

  const uFog = { uFogColor: { value: new THREE.Color(FOGC) }, uFogNear: { value: lk.fogNear ?? 55 }, uFogFar: { value: lk.fogFar ?? 215 } };
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      tGrass: { value: pixTex(`env/${pack}/ground.png`) }, tRock: { value: pixTex(`env/${pack}/cliff.png`) }, tPath: { value: pixTex(`env/${pack}/path.png`) },
      uPx: { value: PX }, uTile: { value: 128 / PX }, uWater: { value: ponds.length ? Math.min(...ponds.map((p) => p.level)) : -999 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() }, uSun: { value: new THREE.Color(0xfff0d6).multiplyScalar(1.05) }, uShadow: { value: new THREE.Color(0x7a8ac8).multiplyScalar(0.8) },
      uTime: shared.uTime, ...uFog,
    },
    vertexShader: `attribute float aPath; attribute vec2 aCliff; attribute float aShore; varying float vShore; varying vec3 vW; varying vec3 vN; varying float vPath; varying vec2 vCliff; varying float vD;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vPath = aPath; vCliff = aCliff; vShore = aShore;
        vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D tGrass, tRock, tPath; uniform float uPx, uTile, uWater, uTime, uFogNear, uFogFar; uniform vec3 uSunDir, uSun, uShadow, uFogColor;
      varying vec3 vW; varying vec3 vN; varying float vPath; varying vec2 vCliff; varying float vD; varying float vShore;
      ${GLSL_UTIL}
      void main(){
        vec3 n = normalize(vN); float slope = 1. - n.y;
        vec2 pp = floor(vW.xz * uPx), ws = pp / uPx;
        // lawn: the tile at sprite density, two offsets picked with a dithered edge, three flat tones in big patches
        vec2 guv = ws / uTile;
        float pick = step(0.5, vnoise(ws * 0.05 + 7.) + (bayer4(pp) - 0.5) * 0.25);
        vec3 g = pick > 0.5 ? texture2D(tGrass, guv * 0.97 + 0.31).rgb * vec3(1.02, 1.03, 0.98) : texture2D(tGrass, guv).rgb;
        float pv = vnoise(ws * 0.08 + 3.1) * 0.7 + vnoise(ws * 0.23) * 0.3 + (bayer4(pp + 1.) - 0.5) * 0.1;
        g *= pv > 0.62 ? vec3(1.07, 1.08, 0.95) : pv < 0.36 ? vec3(0.9, 0.93, 1.0) : vec3(1.);
        vec3 col = mix(g, texture2D(tPath, ws / uTile).rgb, step(0.56 + (bayer4(pp) - 0.5) * 0.1, vPath));
        col = mix(col, texture2D(tPath, ws / uTile + 0.37).rgb * vec3(1.08, 1.04, 0.92), step(0.5 + (hash(pp) - 0.5) * 0.25, vShore));
        // stone walls: the cliff tile along the wall at sprite density, darker at the foot, grass hanging over the lip
        float isRock = step(0.32 + (hash(pp) - 0.5) * 0.08, slope);
        vec3 an = abs(n);
        float useZ = step(an.z + (bayer4(floor(vec2(vW.x + vW.z, vW.y) * uPx)) - 0.5) * 0.2, an.x);
        float along = mix(vW.x, vW.z, useZ);
        vec3 r = texture2D(tRock, (vec2(floor(along * uPx), -floor(vW.y * uPx)) + 0.5) / (uTile * uPx)).rgb;
        r *= mix(0.7, 1., smoothstep(0., 1.8, vW.y - vCliff.y));
        col *= 1. - 0.1 * smoothstep(1.5, 4., vCliff.x - vW.y) * step(slope, 0.3);
        float d = vCliff.x - vW.y, colN = floor(along * uPx / 2.);
        float L = 0.22 + 0.3 * hash(vec2(colN, 1.3)) + 0.25 * vnoise(vec2(along * 0.9, 2.));
        float hang = step(d, L) * isRock * step(1.2, vCliff.x - vCliff.y);
        vec3 hg = mix(g, g * vec3(0.5, 0.6, 0.62), step(L - 1.5 / uPx, d));
        col = mix(col, r, isRock);
        col = mix(col, hg, hang);
        // toon light in three flat bands
        float l = dot(n, uSunDir);
        vec3 light = mix(uShadow, uSun, step(0.08 + (bayer4(pp + 3.) - 0.5) * 0.06, l));
        light = mix(light, uSun * 1.06, step(0.72, l));
        col *= light;
        // wind combing the lawn and cloud shadows drifting over it
        float grassy = (1. - isRock) * (1. - step(0.5, vShore));
        float wv = dot(ws, vec2(0.8, 0.6)) * 0.05 - uTime * 0.6 + vnoise(ws * 0.013) * 3.5;
        float sweep = smoothstep(0.82, 1., sin(wv)) * smoothstep(0.35, 0.65, vnoise(ws * 0.007 + uTime * 0.01));
        col = mix(col, col * vec3(1.12, 1.14, 1.0) + vec3(0.02, 0.025, 0.), step(0.5 + (bayer4(pp + 2.) - 0.5) * 0.9, sweep) * grassy * 0.85);
        vec2 cw = ws * 0.011 + vec2(uTime * 0.016, uTime * 0.009);
        float cl = vnoise(cw) * 0.62 + vnoise(cw * 2.3 + 5.) * 0.38;
        col *= mix(vec3(1.), vec3(0.8, 0.83, 0.95), step(0.62 + (bayer4(pp + 7.) - 0.5) * 0.05, cl));
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vD));
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const terrain = new THREE.Mesh(geo, groundMat);
  terrain.frustumCulled = false;
  scene.add(terrain);

  // water
  for (const p of ponds) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(p.r + 2.5, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: shared.uTime, uPx: { value: PX }, uWaterC: { value: new THREE.Color(biome?.waterColor ?? 0x3aafff) }, uIce: { value: iceLakes ? 1 : 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime, uPx, uIce; uniform vec3 uWaterC; varying vec3 vW; ${GLSL_UTIL}
        void main(){ vec2 pp = floor(vW.xz * uPx / 2.); float ripple = step(0.93, vnoise(pp * 0.18 + vec2(uTime * 0.6, uTime * 0.25)));
          vec3 c = mix(uWaterC * 1.15, uWaterC * 0.85, vnoise(pp * 0.05)); c = mix(c, vec3(0.85, 0.95, 1.), ripple * 0.8);
          if (uIce > 0.5) { float crack = step(0.97, vnoise(pp * 0.35)) + step(0.985, vnoise(pp.yx * 0.5 + 3.)); c = mix(vec3(0.82, 0.92, 1.0), vec3(0.62, 0.8, 0.98), vnoise(pp * 0.08)); c = mix(c, vec3(1.), step(0.9, vnoise(pp * 0.6 + 7.)) * 0.6); c = mix(c, vec3(0.45, 0.62, 0.85), min(crack, 1.) * 0.7); }
          gl_FragColor = vec4(c, 0.86);
          #include <colorspace_fragment>
        }`,
    }));
    w.position.set(p.x, p.level, p.z);
    w.renderOrder = 2;
    scene.add(w);
  }
  if (sea) {
    // the open sea round the island or along the coast, with breaking foam and a glitter of light
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 4, WORLD * 4, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: shared.uTime, uPx: { value: PX }, uWaterC: { value: new THREE.Color(biome?.waterColor ?? 0x2a8ae0) }, ...uFog },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime, uPx, uFogNear, uFogFar; uniform vec3 uWaterC, uFogColor; varying vec3 vW; varying float vD; ${GLSL_UTIL}
        void main(){ vec2 pp = floor(vW.xz * uPx / 2.);
          vec3 c = mix(uWaterC * 1.1, uWaterC * 0.75, vnoise(pp * 0.03 + uTime * 0.05));
          float wave = step(0.9, vnoise(vec2(pp.x * 0.12 + uTime * 0.8, pp.y * 0.4 - uTime * 0.3)));
          c = mix(c, vec3(0.9, 0.97, 1.), wave * 0.7);
          c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, vD));
          gl_FragColor = vec4(c, 0.92);
          #include <colorspace_fragment>
        }`,
    }));
    sw.position.y = sea.level; sw.renderOrder = 2; sw.frustumCulled = false;
    scene.add(sw);
  }

  // ---- sky, fog, light, panorama ----
  scene.background = lk.sky ? skyTexture(lk.sky[0], lk.sky[1]) : skyTexture();
  scene.fog = new THREE.Fog(FOGC, lk.fogNear ?? 55, lk.fogFar ?? 215);
  scene.add(new THREE.HemisphereLight(0xffffff, lk.hemiGround ?? 0x6a8a4a, 1.5 * (lk.light ?? 1)));
  const sun = new THREE.DirectionalLight(lk.sun ?? 0xfff2d8, 1.5 * (lk.light ?? 1));
  sun.position.set(30, 60, 20);
  scene.add(sun);
  for (const [name, radius, repeat, sink, haze, rot] of (['coast', 'glacier'].includes(pack) ? [] : [['pano_far', 420, 3, 30, 0.42, 0.9], ['pano_near', 400, 4, 40, 0.32, 0.2]])) {
    const tex = pixTex(`env/${pack}/${name}.png`, false);
    tex.wrapS = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const imgW = 2048; const imgH = name === 'pano_far' ? 384 : 320;
    const h = imgH * ((2 * Math.PI * radius) / (imgW * repeat));
    const mat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, side: THREE.BackSide, transparent: false,
      uniforms: { map: { value: tex }, uK: { value: repeat }, uHaze: { value: haze }, uFogColor: { value: new THREE.Color(FOGC) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform float uK, uHaze; uniform vec3 uFogColor; varying vec2 vUv;
        void main(){ vec4 c = texture2D(map, vec2(vUv.x * uK, vUv.y)); if (c.a < 0.5) discard;
          gl_FragColor = vec4(mix(c.rgb, uFogColor, uHaze + (1. - uHaze) * 0.55 * (1. - smoothstep(0.05, 0.45, vUv.y))), 1.);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 96, 1, true).translate(0, h / 2 - sink, 0), mat);
    mesh.rotation.y = rot;
    mesh.frustumCulled = false;
    mesh.renderOrder = -50 + (name === 'pano_near' ? 1 : 0);
    mesh.onBeforeRender = (r, s, cam) => { mesh.position.set(cam.position.x, cam.position.y, cam.position.z); mesh.updateMatrixWorld(); };
    scene.add(mesh);
  }

  // ---- decor ----
  const colliders = [];
  const reserved = [];
  const items = [];
  const flat = (x, z, r = 1.5) => slopeAt(x, z, r) < 0.18;
  const free = (x, z, r) => !reserved.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + r);
  const put = (kind, x, z, s = R.range(0.9, 1.15), collide = true) => {
    const d = DECOR[kind];
    items.push({ kind, x, y: height(x, z) - 0.08, z, s, flip: R.chance(0.5) });
    if (collide && d[2] > 0) colliders.push({ x, z, r: d[2] * s * 0.9 });
  };
  // landmarks: an oak grove on top of each massif, then a fairy ring, an arch, a hollow log and a meadow
  const T = forest ? TREES : GEN_TREES; const BG = forest ? BIG : GEN_BIG; const SM = forest ? SMALL : GEN_SMALL;
  for (const m of massifs) {
    if (!forest) { reserved.push({ x: m.x, z: m.z, r: 9 }); for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; put(R.pick(GEN_TREES), m.x + Math.cos(a) * 7, m.z + Math.sin(a) * 7); } continue; }
    put('oak', m.x, m.z, 1);
    reserved.push({ x: m.x, z: m.z, r: 9 });
    const t0 = R.range(0, 6.28);
    for (let k = 0; k < 7; k++) { const a = t0 + (k / 7) * Math.PI * 2; const d = R.range(6.5, 8.5); put(R.pick(['tree0', 'tree1', 'tree3', 'tree4']), m.x + Math.cos(a) * d, m.z + Math.sin(a) * d); }
    for (let k = 0; k < 18; k++) { const a = R.range(0, 6.28); const d = R.range(2.8, 8); put(R.pick(['fern', 'flowersA', 'flowersB', 'mushrooms']), m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, R.range(0.85, 1.15), false); }
  }
  const spot = (r) => {
    for (let k = 0; k < 60; k++) {
      const x = R.range(-play + 14, play - 14); const z = R.range(-play + 14, play - 14);
      if (Math.hypot(x, z) < 26 || !flat(x, z, r * 0.7) || !free(x, z, r) || inPond(x, z, 6) || pathAt(x, z) > 0.3) continue;
      return { x, z };
    }
    return null;
  };
  const ringOf = (kinds, count, r0, r1, cx, cz, collide = false) => { for (let k = 0; k < count; k++) { const a = R.range(0, 6.28); const d = r0 + Math.sqrt(R.next()) * (r1 - r0); put(R.pick(kinds), cx + Math.cos(a) * d, cz + Math.sin(a) * d, R.range(0.85, 1.15), collide); } };
  const landmarks = [];
  for (const kind of (forest ? ['fairy', 'arch', 'hollow', 'meadow'] : [])) {
    const p = spot(kind === 'meadow' ? 9 : 6.5);
    if (!p) continue;
    reserved.push({ x: p.x, z: p.z, r: kind === 'meadow' ? 9 : 6.5 });
    landmarks.push({ kind, ...p });
    if (kind === 'fairy') { put('glowshrooms', p.x, p.z, 1); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; put('mushrooms', p.x + Math.cos(a) * 4.3, p.z + Math.sin(a) * 4.3, R.range(0.85, 1.05), false); } ringOf(['flowersA', 'flowersB', 'fern'], 10, 1.8, 3.4, p.x, p.z); }
    if (kind === 'arch') { put('arch', p.x, p.z, 1); ringOf(['boulder'], 2, 3.5, 5, p.x, p.z, true); ringOf(['fern', 'tallgrass', 'rocks', 'flowersA'], 18, 2, 6, p.x, p.z); }
    if (kind === 'hollow') { put('hollowlog', p.x, p.z, 1); ringOf(['stump'], 2, 3.5, 5, p.x, p.z, true); ringOf(['mushrooms', 'fern', 'tallgrass'], 18, 2.5, 6, p.x, p.z); }
    if (kind === 'meadow') ringOf(['flowersA', 'flowersB', 'sunflower', 'tallgrass', 'fern'], 60, 0, 9, p.x, p.z);
  }
  for (const p of ponds) ringOf(forest ? ['tallgrass', 'tallgrass', 'fern', 'flowersA', 'flowersB'] : ['small0', 'small1', 'small2'], 26, p.r * 0.95, p.r + 3, p.x, p.z);
  const scatter = (kinds, count, minR, ok, pad) => {
    for (let k = 0; k < count * 4 && count > 0; k++) {
      const x = R.range(-play + 2, play - 2); const z = R.range(-play + 2, play - 2);
      if (Math.hypot(x, z) < minR || !flat(x, z, pad > 1 ? 1.5 : 0.8) || !ok(x, z) || !free(x, z, pad) || inPond(x, z, 1.5) || pathAt(x, z) > 0.3) continue;
      put(R.pick(kinds), x, z, R.range(0.85, 1.2));
      count--;
    }
  };
  const area = ((play * 2) / 336) ** 2;
  scatter(T, Math.round(380 * area * (pack === 'desert' ? 0.45 : 1)), 18, (x, z) => n1.get(x * 0.025, z * 0.025) > -0.1, 3.5);
  scatter(BG, Math.round(260 * area), 14, () => true, 2);
  scatter(SM, Math.round(2200 * area * (forest ? 1 : 0.6)), 6, (x, z) => n2.get(x * 0.05, z * 0.05) > -0.15, 0);
  // the rim beyond the walls: a dense wood
  for (let k = 0; k < 220; k++) {
    const side = R.int(0, 3); const t = R.range(-half + 4, half - 4); const d = R.range(play + 6, half - 3);
    const [x, z] = side === 0 ? [t, -d] : side === 1 ? [t, d] : side === 2 ? [-d, t] : [d, t];
    put(R.pick(forest ? ['tree0', 'tree1', 'tree3', 'tree4', 'tree1'] : GEN_TREES), x, z, R.range(1, 1.3), false);
  }

  const decor = new THREE.Group();
  scene.add(decor);
  packAtlas(pack).then((atlas) => buildDecor(decor, atlas, items, shared, pack, uFog)).catch(() => {});

  // minimap picture: terrace tones, walls, ponds and trails
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = 256;
  {
    const g = mapCanvas.getContext('2d');
    const img = g.createImageData(256, 256);
    let lo = Infinity; let hi = -Infinity;
    for (const h of heights) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const wx = (x / 255) * WORLD - half; const wz = (y / 255) * WORLD - half;
      const h = height(wx, wz);
      const s = slopeAt(wx, wz, 1);
      const t = clamp((h - lo) / (hi - lo + 0.001), 0, 1);
      let c = [70 + t * 60, 64 + t * 64, 120 + t * 50];
      if (s > 0.6) c = [40, 38, 70];
      if (inPond(wx, wz)) c = [70, 150, 230];
      else if (pathAt(wx, wz) > 0.5) c = [150, 130, 120];
      const o = (y * 256 + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  if (shape === 'cave') {
    const rock = new THREE.MeshToonMaterial({ color: 0x4a4a62 }); const cryst = new THREE.MeshToonMaterial({ color: 0x9a7aff, emissive: 0x5a3ab8, emissiveIntensity: 0.6 });
    for (let k = 0; k < 46; k++) {
      const p = spot(2.5); if (!p) continue;
      const crystal = k % 3 === 0; const hgt = crystal ? R.range(1.6, 3.4) : R.range(5, 14);
      const m = new THREE.Mesh(new THREE.ConeGeometry(crystal ? 0.6 : R.range(1.2, 2.2), hgt, crystal ? 5 : 7), crystal ? cryst : rock);
      m.position.set(p.x, height(p.x, p.z) + hgt / 2 - 0.2, p.z); m.rotation.set(R.range(-0.1, 0.1), R.range(0, 6), R.range(-0.1, 0.1));
      scene.add(m); colliders.push({ x: p.x, z: p.z, r: crystal ? 0.6 : 1.4 }); reserved.push({ x: p.x, z: p.z, r: 2.5 });
    }
  }
  // 3D models from the game standing on the map (purely decorative ones; Poké Balls are placed by the run)
  const props = [];
  for (const [model, size] of [['slots', 3], ['altar', 3.2], ['totem', 3.4], ['chest', 1.6], ['boss', 3.6], ['nest', 2.4], ['goldrock', 1.8]]) {
    const p = spot(4);
    if (!p) continue;
    reserved.push({ x: p.x, z: p.z, r: 4 });
    colliders.push({ x: p.x, z: p.z, r: size * 0.45 });
    props.push({ model, ...p });
    placeModel(scene, model, p.x, height(p.x, p.z) - 0.05, p.z, size, R.range(0, 6.28));
  }

  // Each zone (and the sanctuary) brings its own sky, fog and light.
  const hemiLight = scene.children.find((o) => o.isHemisphereLight); const sunLight = scene.children.find((o) => o.isDirectionalLight);
  function setLook(l) {
    if (!l) return;
    if (l.sky) scene.background = skyTexture(l.sky[0], l.sky[1]);
    if (l.fog != null) { scene.fog.color.set(l.fog); uFog.uFogColor.value.set(l.fog); }
    if (l.fogNear) { scene.fog.near = l.fogNear; scene.fog.far = l.fogFar; uFog.uFogNear.value = l.fogNear; uFog.uFogFar.value = l.fogFar; }
    if (hemiLight && l.hemiGround != null) { hemiLight.groundColor.set(l.hemiGround); hemiLight.intensity = 1.5 * (l.light ?? 1); }
    if (sunLight && l.sun != null) { sunLight.color.set(l.sun); sunLight.intensity = 1.5 * (l.light ?? 1); }
  }
  const world = {
    setLook, sea, ice: iceLakes, height, slopeAt, play, ponds, massifs, colliders, landmarks, props, mapCanvas, decor,
    mesas: [], // kept for older callers
    flatSpot: (pad = 2) => spot(pad),
    onMesa: () => null,
  };
  return world;
}

// Instanced, camera-facing (around the vertical axis) sprites from the forest sheet, with
// wind sway at the top and blob shadows underneath; one draw call each.
function buildDecor(group, atlas, items, shared, pack = 'forest', fog = null) {
  const tex = pixTex(`env/${pack}/atlas.png`, false);
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const list = items.filter((it) => atlas.sprites[it.kind]);
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const aPos = new Float32Array(list.length * 3);
  const aSize = new Float32Array(list.length * 2);
  const aUV = new Float32Array(list.length * 4);
  const aFx = new Float32Array(list.length * 2);
  list.forEach((it, k) => {
    const sp = atlas.sprites[it.kind];
    const d = DECOR[it.kind];
    aPos.set([it.x, it.y, it.z], k * 3);
    aSize.set([sp.w * d[0] * it.s * (it.flip ? -1 : 1), sp.h * d[0] * it.s], k * 2);
    aUV.set([sp.x / atlas.w, 1 - (sp.y + sp.h) / atlas.h, sp.w / atlas.w, sp.h / atlas.h], k * 4);
    aFx.set([d[1], (it.x * 0.37 + it.z * 0.21) % 6.28], k * 2);
  });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  geo.setAttribute('aUV', new THREE.InstancedBufferAttribute(aUV, 4));
  geo.setAttribute('aFx', new THREE.InstancedBufferAttribute(aFx, 2));
  geo.instanceCount = list.length;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uTime: shared.uTime, ...(fog || { uFogColor: { value: new THREE.Color(FOG) }, uFogNear: { value: 55 }, uFogFar: { value: 215 } }) },
    vertexShader: `attribute vec3 aPos; attribute vec2 aSize; attribute vec4 aUV; attribute vec2 aFx; uniform float uTime; varying vec2 vUv; varying float vD;
      void main(){
        vec3 camR = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]));
        float sway = sin(uTime * 1.6 + aFx.y) * aFx.x * position.y * position.y;
        vec3 w = aPos + camR * (position.x * aSize.x + sway * abs(aSize.y)) + vec3(0., position.y * aSize.y, 0.);
        vec2 uv = uv; if (aSize.x < 0.) uv.x = 1. - uv.x;
        vUv = aUV.xy + uv * aUV.zw;
        vec4 mv = viewMatrix * vec4(w, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uFogColor; uniform float uFogNear, uFogFar; varying vec2 vUv; varying float vD;
      void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard; vec3 col = mix(c.rgb, uFogColor, smoothstep(uFogNear, uFogFar, vD)); gl_FragColor = vec4(col, 1.);
          #include <colorspace_fragment>
        }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);

  // blob shadows
  const withShadow = list.filter((it) => DECOR[it.kind][3] > 0);
  const sgeo = new THREE.InstancedBufferGeometry();
  const disc = new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
  sgeo.index = disc.index;
  sgeo.setAttribute('position', disc.attributes.position);
  const sPos = new Float32Array(withShadow.length * 4);
  withShadow.forEach((it, k) => sPos.set([it.x, it.y + 0.12, it.z, DECOR[it.kind][3] * it.s], k * 4));
  sgeo.setAttribute('aS', new THREE.InstancedBufferAttribute(sPos, 4));
  sgeo.instanceCount = withShadow.length;
  const smat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute vec4 aS; void main(){ vec3 w = aS.xyz + position * vec3(aS.w, 1., aS.w * 0.6); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.05, 0.1, 0.2, 0.22); }',
  });
  const shadows = new THREE.Mesh(sgeo, smat);
  shadows.frustumCulled = false;
  shadows.renderOrder = 1;
  group.add(shadows);
}

// ---- the game's 3D models ----
const gltf = new GLTFLoader();
const modelCache = new Map();
function loadModel(name) {
  if (!modelCache.has(name)) modelCache.set(name, gltf.loadAsync(asset(`models/${name}.glb`)).then((g) => g.scene).catch(() => null));
  return modelCache.get(name);
}
export function placeModel(scene, name, x, y, z, size, rot = 0) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = rot;
  scene.add(holder);
  loadModel(name).then((src) => {
    if (!src) return;
    const m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.y, dim.x * 0.8, 0.001);
    m.scale.setScalar(k);
    m.position.y = -box.min.y * k;
    m.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) { if (mt.map) { mt.map.magFilter = THREE.NearestFilter; mt.map.needsUpdate = true; } }
      }
    });
    holder.add(m);
  });
  return holder;
}

// Keeps a point out of trees, rocks and props, out of ponds and inside the play area.
export function collide(world, p, radius = 0.6) {
  for (const c of world.colliders) {
    const dx = p.x - c.x; const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + radius;
    if (d < min && d > 0.0001) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
  }
  for (const q of world.ice ? [] : world.ponds) {
    const dx = p.x - q.x; const dz = p.z - q.z; const d = Math.hypot(dx, dz); const min = q.r * 0.82;
    if (d < min && d > 0.0001) { p.x = q.x + (dx / d) * min; p.z = q.z + (dz / d) * min; }
  }
  if (world.sea) for (let k = 0; k < 12 && world.height(p.x, p.z) < world.sea.level + 0.35; k++) { const d = Math.hypot(p.x, p.z) || 1; p.x -= (p.x / d) * 0.5; p.z -= (p.z / d) * 0.5; }
  const lim = world.play - 2;
  p.x = clamp(p.x, -lim, lim);
  p.z = clamp(p.z, -lim, lim);
}

// ---- Pokémon billboards ----
const baseTextures = new Map();
function sheetTexture(id) {
  if (!baseTextures.has(id)) {
    const img = sheet(id);
    const t = new THREE.Texture(img);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    if (img.complete) t.needsUpdate = true;
    else img.addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
    baseTextures.set(id, t);
  }
  return baseTextures.get(id);
}

export class Mon {
  constructor(scene, id, size = 1) {
    this.scene = scene;
    this.size = size;
    this.mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.4 });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, 0.2);
    scene.add(this.sprite);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x0a1430, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
    this.setSpecies(id);
  }

  setSpecies(id) {
    this.id = id;
    const base = sheetTexture(id);
    this.tex = base.clone();
    const img = base.image;
    this.tex.needsUpdate = !!img.complete;
    if (!img.complete) img.addEventListener('load', () => { this.tex.needsUpdate = true; }, { once: true });
    this.mat.map = this.tex;
    this.mat.needsUpdate = true;
    this.anims = sheetInfo(id);
  }

  frame(anim, f, dir) {
    const sh = this.anims;
    const a = sh.anims[anim] || sh.anims.walk;
    this.tex.repeat.set(a.fw / sh.w, a.fh / sh.h);
    this.tex.offset.set(((f % a.n) * a.fw) / sh.w, 1 - (a.y + (dir % a.rows) * a.fh + a.fh) / sh.h);
    const k = this.size / 24;
    this.sprite.scale.set(a.fw * k, a.fh * k, 1);
  }

  // y is where the sprite stands (ground + jump); ground is the terrain height under it.
  place(x, y, z, ground = y) {
    this.sprite.position.set(x, y, z);
    this.shadow.position.set(x, ground + 0.06, z);
    this.shadow.scale.setScalar(this.size * 0.9);
  }

  tint(flash) {
    this.mat.color.setRGB(1 + flash * 2, 1 + flash, 1 + flash);
  }

  dispose() {
    this.scene.remove(this.sprite);
    this.scene.remove(this.shadow);
    this.mat.dispose();
    this.tex.dispose();
  }
}

// A soft round glow texture for projectiles, flames and sparks.
const glowCache = new Map();
export function glowTexture(color) {
  if (!glowCache.has(color)) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 16);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    glowCache.set(color, t);
  }
  return glowCache.get(color);
}

export function itemTexture(name) {
  const key = 'item:' + name;
  if (!glowCache.has(key)) {
    const t = loader.load(asset(`items/${name}.png`));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    glowCache.set(key, t);
  }
  return glowCache.get(key);
}

// A slowly orbiting look at the map with a few wandering Pokémon (map choice screen).
export function startPreview(canvas, ids, focusRect = null, biome = null) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
  const shared = { uTime: { value: 0 } };
  const world = buildWorld(scene, { seed: 7, shared, biome });
  // Like the original, look from a low angle at a meadow with a terrace cliff rising behind it.
  let fx = 0; let fz = 0; let fdir = 0; let bestScore = -1;
  for (let i = 0; i < 400; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5) * ARENA * 1.2; const z = (Math.cos(i * 78.233) * 0.5) * ARENA * 1.2;
    const h0 = world.height(x, z);
    if (Math.abs(world.height(x + 3, z) - h0) + Math.abs(world.height(x, z + 3) - h0) > 0.3) continue;
    for (let k = 0; k < 8; k++) {
      const d = (k / 8) * Math.PI * 2; const vx = Math.cos(d); const vz = Math.sin(d);
      const rise = world.height(x + vx * 16, z + vz * 16) - h0;
      let clear = true;
      for (let s = 4; s <= 36; s += 4) if (world.height(x - vx * s, z - vz * s) > h0 + 0.6) clear = false;
      const score = clear && rise > TIER * 0.8 && rise < TIER * 2.5 ? rise - Math.hypot(x, z) * 0.01 : -1;
      if (score > bestScore) { bestScore = score; fx = x; fz = z; fdir = d; }
    }
  }
  const fy = world.height(fx, fz);
  const wander = ids.map((id) => {
    const m = new Mon(scene, id, 1.7);
    let x = fx; let z = fz;
    for (let tries = 0; tries < 20; tries++) {
      x = fx + (Math.random() - 0.5) * 26 - Math.cos(fdir) * Math.random() * 12; z = fz + (Math.random() - 0.5) * 26 - Math.sin(fdir) * Math.random() * 12;
      if (Math.abs(world.height(x, z) - fy) < 0.3) break;
    }
    return { m, x, z, hx: x, hz: z, dir: Math.random() * 6.28, t: Math.random() * 5, walk: Math.random() < 0.6 };
  });
  let raf = 0;
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    shared.uTime.value = now / 1000;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    if (focusRect) {
      const r = focusRect(); const b = canvas.getBoundingClientRect();
      const ox = b.width / 2 - (r.left - b.left + r.width / 2); const oy = b.height / 2 - (r.top - b.top + r.height / 2);
      camera.setViewOffset(b.width, b.height, ox, oy, b.width, b.height);
    }
    camera.updateProjectionMatrix();
    const sway = fdir + Math.sin(now / 9000) * 0.22;
    const cx = fx - Math.cos(sway) * 34; const cz = fz - Math.sin(sway) * 34;
    let cy = fy + 15;
    for (let k = 0.25; k <= 1; k += 0.25) cy = Math.max(cy, world.height(fx - Math.cos(sway) * 34 * k, fz - Math.sin(sway) * 34 * k) + 5 + 8 * k);
    camera.position.set(cx, cy, cz);
    camera.lookAt(fx + Math.cos(fdir) * 6, fy + 3, fz + Math.sin(fdir) * 6);
    const yaw = Math.atan2(cx - fx, cz - fz);
    for (const c of wander) {
      c.t -= dt;
      if (c.t < 0) { c.dir += (Math.random() - 0.5) * 2; c.t = 1 + Math.random() * 3; c.walk = Math.random() < 0.7; }
      if (c.walk) { const nx = c.x + Math.cos(c.dir) * dt * 1.6; const nz = c.z + Math.sin(c.dir) * dt * 1.6; if (Math.abs(world.height(nx, nz) - world.height(c.x, c.z)) < 0.4) { c.x = nx; c.z = nz; } else c.dir += Math.PI / 2; }
      if (Math.hypot(c.x - c.hx, c.z - c.hz) > 6) c.dir = Math.atan2(c.hz - c.z, c.hx - c.x);
      const vx = Math.cos(c.dir); const vz = Math.sin(c.dir);
      const sx = vx * Math.cos(yaw) - vz * Math.sin(yaw);
      const sy = vx * Math.sin(yaw) + vz * Math.cos(yaw);
      const dir = [6, 5, 4, 3, 2, 1, 0, 7, 6][Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 4];
      const an = c.walk ? 'walk' : 'idle';
      const a = c.m.anims.anims[an] || c.m.anims.anims.walk;
      c.m.frame(an, Math.floor(now / (c.walk ? 110 : 180)) % a.n, dir);
      const gy = world.height(c.x, c.z);
      c.m.place(c.x, gy, c.z, gy);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); renderer.dispose(); };
}

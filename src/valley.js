// The living backdrop behind the menus: the Johto valley at sunset, drawn live in 3D like the
// original game does it (never a looping film). A terraced height field with a lake, a river and
// a waterfall, the Tin Tower on its plateau, the Burned Tower, a torii, a bridge, a shrine and
// lanterns, the valley's sprite trees swaying in the wind, a two-layer mountain panorama, a pixel
// sky with a rainbow, and the legendary birds and beasts moving on endless curves: Ho-Oh circles
// the tower trailing rainbow sparks, Lugia hovers over the far water, Raikou calls lightning,
// Entei flares, Suicune purifies the lake, Celebi floats by, the three starters cheer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHEETS } from './game/sheets.js';

const asset = (p) => new URL(`./assets/${p}`, location.href).href;

// ---- Layout of the valley (world units) ----
const SIZE = 140; const SEG = 260; const STEP = SIZE / SEG; const MASK = 140; const WATER = -0.5;
const PLATEAU = { x: 17, z: -27, r: 12, h: 7.5 }; // the Tin Tower's hill
const MESA = { x: -19, z: -30, r: 11, h: 4.2 }; // the Burned Tower's hill
const LAKE = { x: 3, z: -6, rx: 13, rz: 7.2 };
const FALL_DIR = { x: -0.42, z: 0.91 };
const POOL = { x: PLATEAU.x + FALL_DIR.x * (PLATEAU.r + 3.2), z: PLATEAU.z + FALL_DIR.z * (PLATEAU.r + 3.2), r: 3.4 };
const FALL = { x: 0, z: 0, top: 0, lip: 0, w: 3 };
const FALL_SIDE = { x: FALL_DIR.z, z: -FALL_DIR.x };
const RIVER = [[14, -3.5], [19, -0.5], [24, 2.5], [30, 7], [38, 13], [48, 18]];
const BRIDGE = { x: 23.2, z: 2.1, s: 0.82 };
const SUICUNE = { x: 4.5, z: -4.2 };
const RAIKOU = { x: 1.6, z: -17.8, r: 2.4, h: 4.6 };
const ENTEI = { x: 18.5, z: -8.5, r: 2.4, h: 3.2 };
const ROCKS = [RAIKOU, ENTEI];
const HILLS = [PLATEAU, MESA];
const TOWER = { x: 17.5, z: -28, s: 0.7 };
const TORII = { x: -0.5, z: -9.5, s: 1.05 };
const BURNED = { x: -18.5, z: -30, s: 0.62 };
const SHRINE = { x: 14.5, z: 8.5, s: 0.7 };
const LANTERNS = [{ x: -6.5, z: -1.8 }, { x: 0.6, z: 1.6 }, { x: 9.4, z: 1.3 }, { x: 14.6, z: -6.2 }, { x: -9.6, z: -9.6 }, { x: 5.6, z: -14.4 }, { x: 20.6, z: -1.2 }, { x: 26.4, z: 5.2 }, { x: 12.6, z: 7.4 }, { x: 16.4, z: 7.6 }];
const STARTERS = [{ id: 152, x: 3.4, z: 10.4 }, { id: 155, x: 6.2, z: 11.2 }, { id: 158, x: 9, z: 10.4 }];
const CAM = { x: -6, y: 9.6, z: 31 };
const LOOK = { x: 4.5, y: 8.6, z: -6 };
const SUN = [0.58, 0.26, -0.8];
const MONS = [152, 155, 158, 243, 244, 245, 249, 250, 251, 163, 187, 194, 161, 129, 185, 198];

const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function lineDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1]; const dx = bx - ax; const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

// A small seeded generator and 2D simplex noise, so the valley comes out the same every time.
class Rng {
  constructor(seed) { this.s = seed >>> 0 || 2654435769; }
  next() { let e = this.s = (this.s + 1831565813) >>> 0; e = Math.imul(e ^ (e >>> 15), e | 1); e ^= e + Math.imul(e ^ (e >>> 7), e | 61); return ((e ^ (e >>> 14)) >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(a) { for (let t = a.length - 1; t > 0; t--) { const n = Math.floor(this.next() * (t + 1)); [a[t], a[n]] = [a[n], a[t]]; } return a; }
}
const F2 = 0.5 * (Math.sqrt(3) - 1); const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
class Noise {
  constructor(seed) {
    this.perm = new Uint8Array(512);
    const p = new Rng(seed).shuffle(Array.from({ length: 256 }, (_, i) => i));
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  get(x, y) {
    const P = this.perm; const s = (x + y) * F2; const i = Math.floor(x + s); const j = Math.floor(y + s); const t = (i + j) * G2;
    const x0 = x - (i - t); const y0 = y - (j - t); const i1 = x0 > y0 ? 1 : 0; const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2; const y1 = y0 - j1 + G2; const x2 = x0 - 1 + 2 * G2; const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255; const jj = j & 255; let n = 0;
    let a = 0.5 - x0 * x0 - y0 * y0; if (a > 0) { const g = GRAD[P[ii + P[jj]] & 7]; a *= a; n += a * a * (g[0] * x0 + g[1] * y0); }
    let b = 0.5 - x1 * x1 - y1 * y1; if (b > 0) { const g = GRAD[P[ii + i1 + P[jj + j1]] & 7]; b *= b; n += b * b * (g[0] * x1 + g[1] * y1); }
    let c = 0.5 - x2 * x2 - y2 * y2; if (c > 0) { const g = GRAD[P[ii + 1 + P[jj + 1]] & 7]; c *= c; n += c * c * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
}

// ---- Shader pieces ----
const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }`;
const BAYER = `
  float bayer4(vec2 p){ vec2 q = mod(p, 4.); float v = mod(q.x + q.y * 2., 4.) / 4.; return fract(v + q.y * 0.3125); }`;
const TOON = `
  vec3 toonLight(vec3 n, vec2 pp){
    float ndl = dot(n, uSunDir);
    float d = (bayer4(pp) - 0.5) * 0.06;
    float band = step(0.02, ndl + d) * 0.72 + step(0.58, ndl + d) * 0.28;
    float sky = floor(n.y * 3. + bayer4(pp + 2.) * 0.9) / 3.;
    return mix(mix(uShadow, uSun, 0.3), uSun, band) + vec3(0.06, 0.08, 0.12) * sky;
  }`;
const WIND = `
  const vec2 WIND_DIR = vec2(0.86, 0.51);
  float windSway(vec2 p, float t, float h, float heightOffset){
    float bend = max(0., h - heightOffset) / (1. - heightOffset); bend *= bend;
    float gust = mix(0.35, 1.0, 0.5 + 0.5 * sin(t / 3.5 + dot(p, vec2(0.031, 0.017))));
    float ph = t * 1.6 - dot(p, WIND_DIR) * 0.22;
    float wave = (sin(ph) + cos(ph * 1.7 + 0.6)) * 0.5;
    return wave * gust * bend;
  }`;

const texLoader = new THREE.TextureLoader();
function loadTex(path, { repeat = false, nearestMin = false } = {}) {
  return new Promise((resolve) => texLoader.load(asset(path), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = nearestMin ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    if (nearestMin) t.generateMipmaps = false;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    resolve(t);
  }, undefined, () => resolve(null)));
}
const solid = (hex) => { const c = new THREE.Color(hex); const t = new THREE.DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255]), 1, 1); t.needsUpdate = true; return t; };

// ---- The game's 3D models: toon shading in three tones and a dark outline shell ----
const gltf = new GLTFLoader();
const modelCache = new Map();
const gradient = (() => { const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const outlineMat = (() => {
  const m = new THREE.MeshBasicMaterial({ color: 0x1d1530, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.045;'); };
  return m;
})();
function loadModel(name) {
  if (!modelCache.has(name)) {
    modelCache.set(name, gltf.loadAsync(asset(`models/${name}.glb`)).then((g) => {
      const conv = new Map();
      const meshes = [];
      g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        const src = o.material;
        let m = conv.get(src);
        if (!m) {
          const map = src.map;
          if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
          const glow = src.emissive && src.emissive.getHex() !== 0;
          m = new THREE.MeshToonMaterial({ map: map || null, color: map ? 0xffffff : src.color, gradientMap: gradient, emissive: glow ? src.emissive : new THREE.Color(0), emissiveIntensity: glow ? 1.4 : 0 });
          conv.set(src, m);
        }
        o.material = m;
        if (!m.emissiveIntensity) { const shell = new THREE.Mesh(o.geometry, outlineMat); shell.raycast = () => {}; o.add(shell); }
      }
      return g.scene;
    }).catch(() => null));
  }
  return modelCache.get(name).then((s) => (s ? s.clone(true) : null));
}

// ---- Particles (sparks that glow, and soft flat specks) ----
class Particles {
  constructor(cap, additive, round) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3).fill(-999); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap).fill(1); this.base = new Float32Array(cap); this.grav = new Float32Array(cap); this.sway = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uPx: { value: Math.min(window.devicePixelRatio || 1, 1.5) } },
      vertexShader: 'attribute float aSize; attribute float aAlpha; uniform float uPx; varying vec3 vC; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aSize * uPx * 30. / -mv.z; vC = color; vA = aAlpha; }',
      fragmentShader: round
        ? 'varying vec3 vC; varying float vA; void main(){ vec2 q = (floor(gl_PointCoord * 6.) + 0.5) / 6. - 0.5; float d = length(q); if (d > 0.5 || vA <= 0.) discard; gl_FragColor = vec4(vC, vA * (d < 0.24 ? 1. : 0.5)); }'
        : 'varying vec3 vC; varying float vA; void main(){ if (vA <= 0.) discard; gl_FragColor = vec4(vC, vA); }',
      vertexColors: true,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  emit(x, y, z, vx, vy, vz, c, size, life, grav = 0, sway = 0) {
    const i = this.n++ % this.cap;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.col.set([c.r, c.g, c.b], i * 3);
    this.base[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.sway[i] = sway;
  }
  update(dt, t) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = this.life[i] / this.max[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const sw = this.sway[i] ? Math.sin(t * 2.6 + i) * this.sway[i] : 0;
      this.pos[i * 3] += (this.vel[i * 3] + sw) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + sw * 0.4) * dt;
      this.alpha[i] = Math.min(1, k * 3, (1 - k) * 12);
      this.size[i] = this.base[i] * (0.4 + 0.6 * k);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }
}

// ---- Pokémon: sprite-sheet billboards, leaning a little toward the camera, standing on their feet ----
const SPRITE_PX = 0.074; // world units per sprite pixel at scale 1
class SpriteKind {
  constructor(id, scene, shared) {
    const t = SHEETS[id];
    this.w = t[0]; this.h = t[1];
    const anim = (a) => a && { y: a[0], fw: a[1], fh: a[2], n: a[3], d: a[4], tot: a[4].reduce((s, x) => s + x, 0) || 1 };
    this.anims = { idle: anim(t[2]) || anim(t[3]), walk: anim(t[3]) || anim(t[2]) };
    this.foot = this.anims.walk.fh / 2 - 6;
    this.cap = 8; this.count = 0;
    const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aUV = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iUV', this.aUV);
    this.tex = new THREE.Texture();
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => { this.tex.image = img; this.tex.needsUpdate = true; this.measure(img); this.ready = true; };
    img.src = asset(`pmd/${id}.png`);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex }, uLean: { value: 0.35 }, uLight: shared.uLight, uFogColor: shared.uFogColor, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
      vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iUV; uniform float uLean; varying vec2 vUv; varying float vFog;
        void main(){
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 up = normalize(mix(vec3(0.,1.,0.), camUp, uLean));
          vec3 world = iPos + right * (position.x * iSize.x) + up * (position.y * iSize.y);
          vec4 mv = viewMatrix * vec4(world, 1.);
          mv.z += 0.25 + iSize.y * 0.05;
          gl_Position = projectionMatrix * mv;
          vUv = vec2(mix(iUV.x, iUV.z, uv.x), mix(iUV.y, iUV.w, uv.y)); vFog = -mv.z;
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uLight, uFogColor; uniform float uFogNear, uFogFar; varying vec2 vUv; varying float vFog;
        void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard;
          gl_FragColor = vec4(mix(t.rgb * uLight, uFogColor, smoothstep(uFogNear, uFogFar, vFog)), 1.);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, this.cap);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.count = 0;
    scene.add(this.mesh);
  }
  // Where the feet are: the lowest solid row of the first walking frame.
  measure(img) {
    try {
      const a = this.anims.walk; const c = document.createElement('canvas'); c.width = a.fw; c.height = a.fh;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, a.y, a.fw, a.fh, 0, 0, a.fw, a.fh);
      const d = g.getImageData(0, 0, a.fw, a.fh).data; let low = -1;
      for (let y = 0; y < a.fh; y++) for (let x = 0; x < a.fw; x++) if (d[(y * a.fw + x) * 4 + 3] > 128) low = Math.max(low, y);
      if (low >= 0) this.foot = low + 1 - a.fh / 2;
    } catch { /* keep the default */ }
  }
  begin() { this.count = 0; }
  push(x, y, z, anim, t, row, scale, once = false) {
    if (!this.ready || this.count >= this.cap || scale <= 0.002) return;
    const a = this.anims[anim] || this.anims.idle;
    let k = once ? Math.min(a.tot - 1, Math.floor(t * a.tot)) : Math.floor(t * 60) % a.tot;
    let f = 0;
    while (f < a.n - 1 && k >= a.d[f]) { k -= a.d[f]; f++; }
    const s = SPRITE_PX * scale; const i = this.count++;
    this.aPos.array.set([x, y - (a.fh / 2 - this.foot) * s, z], i * 3);
    this.aSize.array.set([a.fw * s, a.fh * s], i * 2);
    const u0 = (f * a.fw) / this.w; const u1 = ((f + 1) * a.fw) / this.w;
    const vTop = 1 - (a.y + row * a.fh) / this.h; const vBot = 1 - (a.y + (row + 1) * a.fh) / this.h;
    this.aUV.array.set([u0, vBot, u1, vTop], i * 4);
  }
  end() {
    this.mesh.count = this.count;
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aUV.needsUpdate = true;
  }
}

function shadowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute vec4 iS; varying vec2 vUv; void main(){ vUv = uv; vec3 p = vec3(position.x*iS.w, 0., position.z*iS.w*0.7) + iS.xyz; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv-0.5)*2.; float a = smoothstep(1.,0.25,d)*0.32; gl_FragColor = vec4(0.08,0.06,0.2,a); }',
  });
}
// Soft round shadows under the Pokémon.
class Shadows {
  constructor(scene, cap = 48) {
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iS', this.attr);
    this.mesh = new THREE.InstancedMesh(g, shadowMaterial(), cap);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 0.5; this.mesh.count = 0; this.cap = cap; this.n = 0;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(x, y, z, size) { if (this.n < this.cap) this.attr.array.set([x, y + 0.05, z, size], this.n++ * 4); }
  end() { this.mesh.count = this.n; this.attr.needsUpdate = true; }
}

// ---- The valley ----
class Valley {
  constructor(scene, shared, camera) {
    this.scene = scene; this.shared = shared; this.camera = camera;
    this.group = new THREE.Group(); scene.add(this.group);
    this.heights = new Float32Array(261 * 261);
    this.glows = []; this.bolts = []; this.flash = 0; this.struck = false;
    this.nextBolt = 2.5; this.nextFlare = 5; this.nextCheer = 3; this.nextKarp = 4; this.karp = { t: 9, x: 0, z: 0, vx: 0 };
    this.nextFlock = 8; this.flock = { t: 99, side: 1, y: 22, z: -60 }; this.nextHop = 6; this.hop = 9; this.cheer = { who: -1, t: 0 };
    this.t = 0; this.c = new THREE.Color();
    this.right = new THREE.Vector3(); this.fwd = new THREE.Vector3(); this.upTmp = new THREE.Vector3();
    this.buildHeights(); this.buildGround(); this.buildWater(); this.buildFall(); this.buildShafts();
    this.loading = [this.buildModels(), this.loadPack(), this.buildPanorama()];
    this.fx = new Particles(1600, true, true); this.soft = new Particles(2200, false, false);
    this.group.add(this.fx.points, this.soft.points);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.kinds = new Map(MONS.map((id) => [id, new SpriteKind(id, this.group, shared)]));
    this.shadows = new Shadows(this.group);
  }

  ready() { return Promise.all(this.loading); }

  inLane(x, z) {
    const nx = LAKE.x - CAM.x; const nz = LAKE.z - CAM.z; const len = Math.hypot(nx, nz);
    const ax = x - CAM.x; const az = z - CAM.z; const along = (ax * nx + az * nz) / len; const across = Math.abs(ax * nz - az * nx) / len;
    return along > 0 && along < len + 6 && across < 4 + along * 0.32;
  }

  buildHeights() {
    const n1 = new Noise(1999); const n2 = new Noise(2000); const n3 = new Noise(2001);
    for (let row = 0; row <= SEG; row++) {
      for (let col = 0; col <= SEG; col++) {
        const x = col * STEP - SIZE / 2; const z = row * STEP - SIZE / 2;
        const s = n1.get(x * 0.09, z * 0.09);
        let h = n2.get(x * 0.04, z * 0.04) * 0.5 + s * 0.14;
        const l = Math.hypot(x - 4, (z + 6) * 1.15);
        h += smooth(34, 46, l) * (2.2 + n3.get(x * 0.05, z * 0.05) * 1.2) + smooth(50, 64, l) * (3 + n2.get(x * 0.03 + 9, z * 0.03) * 2);
        h += 0.6 * (1 - smooth(2, 8, dist(x, z, 6.2, 11)));
        h = Math.max(h, -0.3 + s * 0.1);
        const u = Math.min(Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz), dist(x, z, POOL.x, POOL.z) / (POOL.r * 1.6) + 0.15) + s * 0.08;
        const lake = smooth(1.1, 0.6, u);
        h = h * (1 - lake) + (-2.4 + u * 0.9) * lake;
        const f = lineDist(x, z, RIVER) + s * 0.5; const riv = smooth(3.2, 1.4, f);
        h = h * (1 - riv) + Math.min(h, -1.15 + f * 0.25) * riv;
        const m = s * 1.3 + n2.get(x * 0.07 + 40, z * 0.07) * 2.2;
        const along = (x - PLATEAU.x) * FALL_DIR.x + (z - PLATEAU.z) * FALL_DIR.z;
        const side = (x - PLATEAU.x) * FALL_SIDE.x + (z - PLATEAU.z) * FALL_SIDE.z;
        const notch = (1 - smooth(2.2, 6, Math.abs(side))) * smooth(PLATEAU.r - 7, PLATEAU.r - 3, along);
        const chan = (1 - smooth(0.9, 1.6, Math.abs(side))) * smooth(PLATEAU.r - 7, PLATEAU.r - 5, along);
        for (const e of [...HILLS, ...ROCKS]) {
          const soft = e === PLATEAU ? 0.35 : 1;
          const wob = e === PLATEAU ? m * (1 - notch) : m;
          const k = 1 - smooth(e.r - soft, e.r + 0.7 * soft, dist(x, z, e.x, e.z) + wob * Math.min(1, e.r / 10));
          const top = e === PLATEAU ? e.h + 1.4 * smooth(6, 4, dist(x, z, TOWER.x, TOWER.z + 1)) - 0.7 * chan : e.h;
          h = Math.max(h, top * k + h * (1 - k));
        }
        this.heights[row * 261 + col] = h;
      }
    }
    const top = this.fallH(PLATEAU.r - 3, 0);
    FALL.top = top; FALL.lip = this.wallAt(0, top - 0.6, PLATEAU.r - 4);
    FALL.x = PLATEAU.x + FALL_DIR.x * FALL.lip; FALL.z = PLATEAU.z + FALL_DIR.z * FALL.lip;
  }
  fallH(a, s) { return this.height(PLATEAU.x + FALL_DIR.x * a + FALL_SIDE.x * s, PLATEAU.z + FALL_DIR.z * a + FALL_SIDE.z * s); }
  wallAt(s, h, from) { for (let r = from; r < PLATEAU.r + 6; r += 0.05) if (this.fallH(r, s) < h) return r; return PLATEAU.r + 6; }
  height(x, z) {
    const fx = Math.max(0, Math.min(259.999, (x + SIZE / 2) / STEP)); const fz = Math.max(0, Math.min(259.999, (z + SIZE / 2) / STEP));
    const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const v = fz - j; const H = this.heights;
    return (H[j * 261 + i] * (1 - u) + H[j * 261 + i + 1] * u) * (1 - v) + (H[(j + 1) * 261 + i] * (1 - u) + H[(j + 1) * 261 + i + 1] * u) * v;
  }
  flat(x, z, d = 0.9, tol = 0.5) {
    const h = this.height(x, z);
    return Math.abs(this.height(x + d, z) - h) < tol && Math.abs(this.height(x, z + d) - h) < tol && Math.abs(this.height(x - d, z) - h) < tol && Math.abs(this.height(x, z - d) - h) < tol;
  }

  buildGround() {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const col = Math.round((p.getX(i) + SIZE / 2) / STEP); const row = Math.round((p.getZ(i) + SIZE / 2) / STEP);
      p.setY(i, this.heights[row * 261 + col]);
    }
    g.computeVertexNormals();
    const s = this.shared;
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: {
        tGrass: { value: solid(0xc8a040) }, tLitter: { value: solid(0xa04020) }, tMoss: { value: solid(0x5a8a3a) }, tDirt: { value: solid(0x9a7040) }, tCliff: { value: solid(0x6a6060) }, tPebble: { value: solid(0xc8b090) }, tMask: { value: solid(0) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.62, -0.25).normalize() }, uSun: { value: new THREE.Color(0xffd5a8).multiplyScalar(1.06) }, uShadow: { value: new THREE.Color(0x6a5a9a).multiplyScalar(0.8) },
        uWater: { value: WATER }, uFogColor: s.uFogColor, uFogNear: s.uFogNear, uFogFar: s.uFogFar,
      },
      vertexShader: 'varying vec3 vW; varying vec3 vN; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `
        uniform sampler2D tGrass, tLitter, tMoss, tDirt, tCliff, tPebble, tMask; uniform vec3 uSunDir, uSun, uShadow, uFogColor; uniform float uFogNear, uFogFar, uWater;
        varying vec3 vW; varying vec3 vN; varying float vD;
        ${NOISE}
        ${BAYER}
        ${TOON}
        void main(){
          vec3 n = normalize(vN); float slope = 1. - n.y;
          vec2 pp = floor(vW.xz * 32.);
          vec2 uv = vW.xz / 4.;
          float dz = (bayer4(pp) - 0.5) * 0.22;
          vec3 col = texture2D(tGrass, uv).rgb;
          vec4 m = texture2D(tMask, (vW.xz + ${(SIZE / 2).toFixed(1)}) / ${SIZE.toFixed(1)});
          float wild = vnoise(vW.xz * 0.12);
          col = mix(col, texture2D(tDirt, uv * 0.9).rgb, step(0.72 + dz, wild) * 0.9);
          col = mix(col, texture2D(tMoss, uv).rgb, step(0.5 + dz, m.b));
          col = mix(col, texture2D(tLitter, uv).rgb, step(0.5 + dz, m.r));
          vec3 gold = texture2D(tLitter, uv + 0.37).rgb; gold = vec3(dot(gold, vec3(0.5, 0.4, 0.1))) * vec3(1.55, 1.25, 0.42);
          col = mix(col, gold, step(0.5 + dz, m.g));
          col = mix(col, texture2D(tPebble, uv).rgb, step(vW.y, uWater + 0.4 + dz * 2.));
          vec2 cuv = abs(n.x) > abs(n.z) ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
          vec3 rk = texture2D(tCliff, cuv / 4.6).rgb * (1.12 + (vnoise(floor(cuv * 1.5)) - 0.5) * 0.25);
          rk = mix(rk, texture2D(tMoss, cuv / 4.).rgb, step(0.68 + dz, vnoise(cuv * 0.35 + 3.)) * 0.85);
          col = mix(col, rk, step(0.42 + dz * 0.5, slope));
          col *= mix(1., 0.62, smoothstep(uWater + 0.1, uWater - 0.6, vW.y));
          col *= vec3(1.04, 0.98, 0.9);
          col *= toonLight(n, pp);
          gl_FragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vD)), 1.);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, this.groundMat);
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  buildWater() {
    let lo = Infinity; let hi = -Infinity;
    for (const h of this.heights) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const data = new Uint8Array(261 * 261 * 4);
    for (let i = 0; i < 261 * 261; i++) { const v = Math.round(((this.heights[i] - lo) / (hi - lo)) * 255); data.set([v, v, v, 255], i * 4); }
    const ht = new THREE.DataTexture(data, 261, 261);
    ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
    const s = this.shared;
    const lamps = LANTERNS.map((l) => new THREE.Vector3(l.x, this.height(l.x, l.z), l.z));
    const sd = Math.hypot(SUN[0], SUN[2]);
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: {
        uTime: s.uTime, tH: { value: ht }, uMin: { value: lo }, uRange: { value: hi - lo }, uLevel: { value: WATER }, uRing: { value: new THREE.Vector2(SUICUNE.x, SUICUNE.z) }, uPool: { value: new THREE.Vector2(POOL.x, POOL.z) },
        uSky: { value: new THREE.Color(0xffb880) }, uSunXZ: { value: new THREE.Vector2(SUN[0] / sd, SUN[2] / sd) }, uLamps: { value: lamps }, uGlow: { value: 1 }, uFogColor: s.uFogColor, uFogNear: s.uFogNear, uFogFar: s.uFogFar,
      },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `
        uniform float uTime, uMin, uRange, uLevel, uGlow; uniform vec2 uRing, uPool, uSunXZ; uniform sampler2D tH; uniform vec3 uSky, uFogColor; uniform float uFogNear, uFogFar;
        uniform vec3 uLamps[${LANTERNS.length}];
        varying vec3 vW; varying float vD;
        ${NOISE}
        void main(){
          float ground = texture2D(tH, (vW.xz + ${(SIZE / 2).toFixed(1)}) / ${SIZE.toFixed(1)}).r * uRange + uMin;
          float depth = uLevel - ground;
          if (depth < 0.0) discard;
          vec2 px = floor(vW.xz * 12.) / 12.;
          float dd = depth + (vnoise(px * 0.6 + uTime * 0.1) - 0.5) * 0.3;
          vec3 col = dd < 0.25 ? vec3(0.14, 0.5, 0.46) : dd < 0.7 ? vec3(0.045, 0.27, 0.45) : dd < 1.3 ? vec3(0.022, 0.13, 0.36) : vec3(0.014, 0.07, 0.24);
          vec3 V = normalize(cameraPosition - vW);
          col = mix(col, uSky, pow(1. - V.y, 3.) * 0.42);
          float wv = vnoise(vec2(px.x * 0.55 + uTime * 0.16, px.y * 1.9 - uTime * 0.1));
          float line = step(abs(fract(wv * 4.) - 0.5), 0.045) * step(0.5, vnoise(px * 0.3 + uTime * 0.04));
          col = mix(col, min(col + vec3(0.26, 0.2, 0.1), vec3(1.)), line);
          vec2 toW = normalize(vW.xz - cameraPosition.xz);
          float road = smoothstep(0.985, 0.999, dot(toW, uSunXZ));
          float glit = step(0.9 - road * 0.35, hash(floor(vW.xz * vec2(14., 5.)) + floor(uTime * 3.) * 1.7));
          col = mix(col, vec3(1., 0.86, 0.56), road * 0.35 + glit * road * 0.75);
          col = mix(col, vec3(1., 0.95, 0.8), step(0.996, hash(floor(vW.xz * 12.) + floor(uTime * 2.5) * 1.7)) * 0.8);
          for (int i = 0; i < ${LANTERNS.length}; i++) {
            vec2 L = uLamps[i].xz, d = vW.xz - L, toC = normalize(cameraPosition.xz - L);
            float along = dot(d, toC), across = abs(d.x * toC.y - d.y * toC.x);
            float wob = (vnoise(vec2(along * 3., uTime * 2.) + float(i) * 7.) - 0.5) * 0.5;
            float k = step(-0.2, along) * (1. - smoothstep(0.5, 4.5, along)) * step(across + wob * 0.6, 0.32 - along * 0.03);
            col = mix(col, vec3(1., 0.78, 0.4), k * 0.85 * uGlow * step(0.3, fract(along * 2.2 - uTime * 0.6 + wob)));
          }
          float d = distance(vW.xz, uRing);
          float ring = step(fract(d * 0.42 - uTime * 0.45), 0.05) * (1. - smoothstep(2., 9., d)) * step(0.9, d);
          col = mix(col, vec3(0.75, 1., 1.), step(d, 0.8 + 0.15 * sin(uTime * 3.)) * 0.6);
          col = mix(col, vec3(0.62, 1., 0.98), ring * 0.85);
          float pd = distance(vW.xz, uPool);
          float churn = (1. - smoothstep(0.8, 3.4, pd)) * step(0.45, vnoise(px * 2.2 + vec2(0., uTime * 1.6)));
          col = mix(col, vec3(0.95, 0.98, 1.), churn * 0.85);
          float fw = 0.1 + 0.05 * sin(uTime * 1.6 + vnoise(px * 0.6) * 6.);
          float foam = max(step(depth, fw), step(depth, fw + 0.18) * step(0.62, vnoise(px * 1.4 + uTime * 0.35)) * 0.85);
          col = mix(col, vec3(1.), foam);
          gl_FragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vD)), max(mix(0.86, 0.97, smoothstep(0., 1.2, depth)), foam * 0.97));
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(72, 48).rotateX(-Math.PI / 2), this.waterMat);
    mesh.position.set(14, WATER, -2);
    mesh.renderOrder = 2;
    this.group.add(mesh);
  }

  buildFall() {
    const top = FALL.top + 0.15; const H = top - WATER; const s = this.shared;
    this.fallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: s.uTime, uH: { value: H }, uFogColor: s.uFogColor, uFogNear: s.uFogNear, uFogFar: s.uFogFar },
      vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `
        uniform float uTime, uH; uniform vec3 uFogColor; uniform float uFogNear, uFogFar; varying vec2 vUv; varying float vD;
        ${NOISE}
        void main(){
          vec2 p = floor(vec2(vUv.x * 22., vUv.y * uH * 7.));
          float edge = min(vUv.x, 1. - vUv.x);
          if (edge < 0.06 * (0.6 + vnoise(vec2(p.y * 0.2, uTime)))) discard;
          float streak = vnoise(vec2(p.x * 0.9, (p.y + uTime * 26.) * 0.12));
          vec3 col = streak > 0.62 ? vec3(1.) : streak > 0.4 ? vec3(0.72, 0.9, 1.) : vec3(0.42, 0.72, 0.92);
          col = mix(col, vec3(1.), smoothstep(0.86, 1., vUv.y) + smoothstep(0.16, 0., vUv.y));
          gl_FragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vD) * 0.8), 0.92);
          #include <colorspace_fragment>
        }`,
    });
    const pos = []; const uvs = []; const idx = [];
    for (let r = 0; r <= 32; r++) {
      const a = r / 32; const y = WATER + a * H;
      for (let c = 0; c <= 8; c++) {
        const sx = (c / 8 - 0.5) * FALL.w;
        let out;
        if (a >= 0.999) out = FALL.lip - 1.2;
        else { const wall = this.wallAt(sx, Math.min(y, FALL.top - 0.6), PLATEAU.r - 6); out = Math.max(wall + 0.35, FALL.lip + 0.25 + 1.5 * Math.sqrt(((1 - a) * H) / 6)); }
        pos.push(PLATEAU.x + FALL_DIR.x * out + FALL_SIDE.x * sx, a >= 0.999 ? top : y, PLATEAU.z + FALL_DIR.z * out + FALL_SIDE.z * sx);
        uvs.push(c / 8, a);
      }
    }
    for (let r = 0; r < 32; r++) for (let c = 0; c < 8; c++) { const i = r * 9 + c; const j = i + 9; idx.push(i, i + 1, j, i + 1, j + 1, j); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    const fall = new THREE.Mesh(g, this.fallMat); fall.renderOrder = 3; fall.frustumCulled = false; this.group.add(fall);
    const rg = new THREE.PlaneGeometry(FALL.w * 0.8, 5.5).rotateX(-Math.PI / 2);
    const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.9 + uv.getY(i) * 0.1);
    const run = new THREE.Mesh(rg, this.fallMat); const back = FALL.lip - 1.2 - 2.75;
    run.position.set(PLATEAU.x + FALL_DIR.x * back, top - 0.05, PLATEAU.z + FALL_DIR.z * back);
    run.rotation.y = Math.atan2(FALL_DIR.x, FALL_DIR.z) + Math.PI; run.renderOrder = 3; this.group.add(run);
  }

  // Warm sunbeams slanting down from behind the tower.
  buildShafts() {
    const s = this.shared;
    this.shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: s.uTime, uK: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime, uK; varying vec2 vUv;
        ${BAYER}
        void main(){
          float a = smoothstep(0., 0.3, vUv.y) * smoothstep(1., 0.55, vUv.y) * (1. - abs(vUv.x - 0.5) * 2.);
          a *= 0.16 * uK * (0.75 + 0.25 * sin(uTime * 0.4 + vUv.y * 3.));
          if (a < bayer4(floor(gl_FragCoord.xy / 2.)) * 0.16) discard;
          gl_FragColor = vec4(vec3(1., 0.76, 0.46) * a * 2.2, 1.);
        }`,
    });
    const from = new THREE.Vector3(TOWER.x + 18, 34, TOWER.z - 30);
    for (const [x, z, w] of [[-4, -12, 5], [6, -4, 3.5], [14, 0, 6], [24, 4, 4], [-14, -6, 3]]) {
      const to = new THREE.Vector3(x, this.height(x, z), z); const len = from.distanceTo(to);
      const g = new THREE.PlaneGeometry(w, len).translate(0, -len / 2, 0);
      const m = new THREE.Mesh(g, this.shaftMat); m.position.copy(from);
      const up = from.clone().sub(to).normalize();
      const toCam = new THREE.Vector3(CAM.x, CAM.y, CAM.z).sub(from.clone().add(to).multiplyScalar(0.5)).normalize();
      const right = up.clone().cross(toCam).normalize(); const fwd = right.clone().cross(up);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
      m.renderOrder = 5; m.frustumCulled = false; this.group.add(m);
    }
  }

  place(name, x, y, z, s, rot) {
    const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = rot; holder.scale.setScalar(s);
    this.group.add(holder);
    return loadModel(name).then((m) => {
      if (!m || this.disposed) return;
      holder.add(m);
      m.traverse((o) => {
        const mt = o.material;
        if (o.isMesh && /Glow|Flame/.test(o.name + (o.parent?.name ?? '')) && mt?.emissive && !this.glows.some((g) => g.m === mt)) this.glows.push({ m: mt, base: mt.emissiveIntensity || 1 });
      });
    });
  }
  face(x, z) { return Math.atan2(CAM.x - x, CAM.z - z); }
  buildModels() {
    const jobs = [
      this.place('johto_tower', TOWER.x, this.height(TOWER.x, TOWER.z) - 0.05, TOWER.z, TOWER.s, this.face(TOWER.x, TOWER.z)),
      this.place('johto_torii', TORII.x, -1.4, TORII.z, TORII.s, this.face(TORII.x, TORII.z) + 0.1),
      this.place('iris_burned', BURNED.x, this.height(BURNED.x, BURNED.z) - 0.1, BURNED.z, BURNED.s, this.face(BURNED.x, BURNED.z) + 0.35),
    ];
    const [ax, az] = RIVER[1]; const [bx, bz] = RIVER[3];
    jobs.push(this.place('iris_bridge', BRIDGE.x, -0.05, BRIDGE.z, BRIDGE.s, Math.atan2(-(bz - az), bx - ax)));
    jobs.push(this.place('iris_shrine', SHRINE.x, this.height(SHRINE.x, SHRINE.z) - 0.05, SHRINE.z, SHRINE.s, this.face(SHRINE.x, SHRINE.z) - 0.3));
    for (const l of LANTERNS) jobs.push(this.place('iris_lantern', l.x, this.height(l.x, l.z) - 0.05, l.z, 0.8, this.face(l.x, l.z)));
    return Promise.all(jobs);
  }

  async buildPanorama() {
    for (const [name, radius, rep, drop, haze, rot] of [['pano_far', 420, 3, 30, 0.42, 0.9], ['pano_near', 400, 4, 40, 0.32, 0.2]]) {
      const tex = await loadTex(`env/iris/${name}.png`);
      if (this.disposed || !tex) continue;
      tex.wrapS = THREE.RepeatWrapping;
      const img = tex.image; const h = img.height * ((2 * Math.PI * radius) / (img.width * rep));
      const mat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false, side: THREE.BackSide, fog: false,
        uniforms: { map: { value: tex }, uK: { value: rep }, uHaze: { value: haze }, uFogColor: this.shared.uFogColor },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform sampler2D map; uniform float uK, uHaze; uniform vec3 uFogColor; varying vec2 vUv;
          void main(){
            vec4 c = texture2D(map, vec2(vUv.x * uK, vUv.y));
            if (c.a < 0.5) discard;
            vec3 warm = c.rgb * vec3(1.08, 0.96, 0.9);
            gl_FragColor = vec4(mix(warm, uFogColor, uHaze + (1. - uHaze) * 0.55 * (1. - smoothstep(0.05, 0.45, vUv.y))), 1.);
            #include <colorspace_fragment>
          }`,
      });
      const g = new THREE.CylinderGeometry(radius, radius, h, 96, 1, true).translate(0, h / 2 - drop, 0);
      const m = new THREE.Mesh(g, mat); m.rotation.y = rot; m.frustumCulled = false; m.renderOrder = -50 + (name === 'pano_near' ? 1 : 0);
      m.onBeforeRender = (r, sc, cam) => { m.position.copy(cam.position); m.updateMatrixWorld(); };
      this.group.add(m);
    }
  }

  // Trees, bushes and grass from the valley's sprite sheet, placed by the same seeded rules each time.
  async loadPack() {
    const [atlasRes, atlasTex, ...tiles] = await Promise.all([
      fetch(asset('env/iris/atlas.json')).then((r) => r.json()).catch(() => null), loadTex('env/iris/atlas.png', { nearestMin: true }),
      ...['grass', 'litter', 'moss', 'dirt', 'cliff', 'pebble'].map((n) => loadTex(`env/iris/tiles/${n}.png`, { repeat: true })),
    ]);
    if (this.disposed) return;
    if (tiles.every(Boolean)) { const u = this.groundMat.uniforms; [u.tGrass.value, u.tLitter.value, u.tMoss.value, u.tDirt.value, u.tCliff.value, u.tPebble.value] = tiles; }
    if (!atlasRes || !atlasTex) return;
    const still = ['tree5', 'big1', 'big3', 'small4'];
    const kinds = [
      ...[0, 1, 2, 3, 4, 5].map((n) => ({ name: `tree${n}`, scale: 0.085, sway: still.includes(`tree${n}`) ? 0 : 0.06, collider: 0.7, shadow: 3 })),
      ...[0, 1, 2, 3, 4].map((n) => ({ name: `big${n}`, scale: 0.05, sway: 0, collider: 0.9, shadow: 2.2 })),
      ...[0, 1, 2, 3, 4, 5, 6].map((n) => ({ name: `small${n}`, scale: 0.05, sway: still.includes(`small${n}`) ? 0 : 0.12, collider: 0, shadow: 0 })),
    ];
    const kind = (n) => kinds.find((k) => k.name === n);
    const rng = new Rng(251); const items = [];
    const add = (k, x, z, s = rng.range(0.9, 1.15)) => items.push({ kind: k, x, y: this.height(x, z) - 0.08, z, flip: rng.chance(0.5), s });
    const crowded = (x, z, d) => items.some((it) => dist(x, z, it.x, it.z) < d);
    const wet = (x, z) => this.height(x, z) < -0.05;
    const props = [...LANTERNS, BRIDGE, SHRINE, TORII];
    const open = (x, z) => dist(x, z, CAM.x, CAM.z) > 13 && !wet(x, z) && ROCKS.every((r) => dist(x, z, r.x, r.z) > r.r + 1.6) && STARTERS.every((s) => dist(x, z, s.x, s.z) > 2.6)
      && props.every((p) => dist(x, z, p.x, p.z) > 2.2) && dist(x, z, BURNED.x, BURNED.z) > 6.5 && dist(x, z, TOWER.x, TOWER.z) > 9 && dist(x, z, BRIDGE.x, BRIDGE.z) > 6.5
      && lineDist(x, z, RIVER) > 3.6 && !this.inLane(x, z) && !(x > 14 && x < 34 && z > -4 && z < 12 && lineDist(x, z, RIVER) < 7) && dist(x, z, POOL.x, POOL.z) > 5
      && !(x > -4 && x < 22 && z > -16 && z < 13 && dist(x, z, LAKE.x + 2, LAKE.z + 3) < 14);
    const scatter = (names, count, where, ok, gap, size) => {
      for (let tries = 0; tries < count * 12 && count > 0; tries++) {
        const [x, z] = where();
        if (this.flat(x, z) && ok(x, z) && !crowded(x, z, gap)) { add(kind(rng.pick(names)), x, z, size?.()); count--; }
      }
    };
    const ring = (a, b) => () => { const t = rng.range(0, Math.PI * 2); const r = rng.range(a, b); return [Math.cos(t) * r + 5, Math.sin(t) * r - 8]; };
    scatter(['tree0', 'tree0', 'tree1', 'tree1', 'tree2', 'tree4'], 80, ring(22, 50), (x, z) => open(x, z) && dist(x, z, PLATEAU.x, PLATEAU.z) > PLATEAU.r + 1, 3);
    scatter(['tree0', 'tree1', 'tree2', 'tree0'], 16, () => [rng.range(-30, -8), rng.range(-18, 10)], open, 3.2);
    scatter(['tree0', 'tree1', 'tree2', 'tree3'], 14, () => [rng.range(20, 40), rng.range(-8, 16)], open, 3.2);
    scatter(['tree4', 'tree4', 'tree3', 'tree0'], 10, () => [PLATEAU.x + rng.range(-11, 11), PLATEAU.z + rng.range(-11, 6)], (x, z) => dist(x, z, PLATEAU.x, PLATEAU.z) < PLATEAU.r - 1.5 && dist(x, z, TOWER.x, TOWER.z) > 8.5 && dist(x, z, FALL.x, FALL.z) > 3, 3);
    scatter(['tree5', 'tree5', 'tree4', 'tree1'], 8, () => [MESA.x + rng.range(-9, 9), MESA.z + rng.range(-9, 9)], (x, z) => dist(x, z, MESA.x, MESA.z) < MESA.r - 1.4 && dist(x, z, BURNED.x, BURNED.z) > 6, 3);
    scatter(['tree3', 'tree3'], 6, () => [rng.range(22, 34), rng.range(-24, -10)], open, 1.6);
    scatter(['big2', 'big2', 'big1', 'big3', 'big4', 'big4'], 26, ring(11, 30), open, 2.3);
    scatter(['small2', 'small2', 'small1', 'small0', 'small3'], 40, () => { const t = rng.range(0, Math.PI * 2); const k = rng.range(1.06, 1.5); return [LAKE.x + Math.cos(t) * LAKE.rx * k, LAKE.z + Math.sin(t) * LAKE.rz * k]; },
      (x, z) => !wet(x, z) && dist(x, z, CAM.x, CAM.z) > 12 && props.every((p) => dist(x, z, p.x, p.z) > 1.3) && STARTERS.every((s) => dist(x, z, s.x, s.z) > 1.4), 0.9);
    scatter(['small2', 'small1', 'small0', 'small5', 'small6', 'small3', 'small4'], 90, () => [rng.range(-28, 36), rng.range(-24, 20)],
      (x, z) => dist(x, z, CAM.x, CAM.z) > 12 && !wet(x, z) && STARTERS.every((s) => dist(x, z, s.x, s.z) > 2.2) && props.every((p) => dist(x, z, p.x, p.z) > 1.4) && dist(x, z, BRIDGE.x, BRIDGE.z) > 3.5, 1);
    scatter(['small2', 'small1', 'small0'], 10, () => [rng.range(-2, 16), rng.range(5, 15)],
      (x, z) => dist(x, z, CAM.x, CAM.z) > 12 && !wet(x, z) && STARTERS.every((s) => dist(x, z, s.x, s.z) > 2) && props.every((p) => dist(x, z, p.x, p.z) > 1.4), 0.8);
    this.buildDecor(atlasTex, atlasRes, items);
    this.bakeMask(items);
  }

  buildDecor(tex, atlas, items) {
    const n = items.length; const g = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
    const pos = new Float32Array(n * 4); const size = new Float32Array(n * 4); const uvs = new Float32Array(n * 4);
    items.forEach((it, i) => {
      const r = atlas.sprites[it.kind.name]; const k = it.kind.scale * it.s;
      pos.set([it.x, it.y, it.z, it.kind.sway], i * 4);
      size.set([r.w * k, r.h * k, k, it.kind.name.startsWith('tree') ? 0.22 : it.kind.collider > 0 ? 0.1 : 0], i * 4);
      let u0 = r.x / atlas.w; let u1 = (r.x + r.w) / atlas.w;
      if (it.flip) [u0, u1] = [u1, u0];
      uvs.set([u0, 1 - (r.y + r.h) / atlas.h, u1, 1 - r.y / atlas.h], i * 4);
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4)); g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 4)); g.setAttribute('iUV', new THREE.InstancedBufferAttribute(uvs, 4));
    const s = this.shared;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uTime: s.uTime, uWind: s.uWind, uTint: { value: new THREE.Color(1.08, 0.95, 0.84) }, uFogColor: s.uFogColor, uFogNear: s.uFogNear, uFogFar: s.uFogFar },
      vertexShader: `attribute vec4 iPos; attribute vec4 iSize; attribute vec4 iUV; uniform float uTime; uniform float uWind;
        varying vec2 vUv; varying float vD; varying float vY;
        ${WIND}
        void main(){
          vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]));
          float h = position.y; float sway = 0.0, dip = 0.0;
          if (iPos.w > 0.0) {
            sway = windSway(iPos.xz, uTime, h, iSize.w) * iPos.w * uWind * iSize.y * 1.2;
            sway = floor(sway / iSize.z + 0.5) * iSize.z;
            dip = 0.5 * sway * sway / max(iSize.y, 0.01);
          }
          vec3 w = iPos.xyz + right * (position.x * iSize.x + sway) + vec3(0., h * iSize.y - dip, 0.);
          vec4 mv = viewMatrix * vec4(w, 1.);
          vD = -mv.z; gl_Position = projectionMatrix * mv;
          vUv = vec2(mix(iUV.x, iUV.z, uv.x), mix(iUV.y, iUV.w, uv.y)); vY = h;
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uTint; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
        varying vec2 vUv; varying float vD; varying float vY;
        void main(){
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.5) discard;
          vec3 c = t.rgb * uTint * mix(0.78, 1.0, smoothstep(0.0, 0.22, vY));
          gl_FragColor = vec4(mix(c, uFogColor, smoothstep(uFogNear, uFogFar, vD)), 1.);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.InstancedMesh(g, mat, n); mesh.frustumCulled = false; mesh.renderOrder = 1; this.group.add(mesh);
    const shade = items.filter((it) => it.kind.shadow > 0);
    const sg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const sp = new Float32Array(shade.length * 4);
    shade.forEach((it, i) => sp.set([it.x, it.y + 0.05, it.z, it.kind.shadow * it.s], i * 4));
    sg.setAttribute('iS', new THREE.InstancedBufferAttribute(sp, 4));
    const sm = new THREE.InstancedMesh(sg, shadowMaterial(), shade.length); sm.frustumCulled = false; sm.renderOrder = 0.5; this.group.add(sm);
  }

  // Fallen leaves, gold grass and moss painted under the trees and along the lake and the path.
  bakeMask(items) {
    const data = new Uint8Array(MASK * MASK * 4); const nz = new Noise(77);
    const paint = (cx, cz, r, ch) => {
      for (let z = Math.floor(cz - r - 2); z <= cz + r + 2; z++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const i = Math.round(x + SIZE / 2); const j = Math.round(z + SIZE / 2);
        if (i < 0 || j < 0 || i >= MASK || j >= MASK) continue;
        const k = 1 - smooth(r * 0.6, r + 1.2, dist(x, z, cx, cz) + nz.get(x * 0.4, z * 0.4) * 1.6);
        const o = (j * MASK + i) * 4 + ch; data[o] = Math.max(data[o], k * 255);
      }
    };
    for (const it of items) {
      const nm = it.kind.name;
      if (nm === 'tree0' || nm === 'tree1' || nm === 'big2') paint(it.x, it.z, nm === 'big2' ? 1.2 : 2.6, 0);
      else if (nm === 'tree2') paint(it.x, it.z, 2.8, 1);
      else if (nm === 'tree4' || nm === 'tree3') paint(it.x, it.z, 2, 2);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.18) paint(LAKE.x + Math.cos(a) * LAKE.rx * 1.12, LAKE.z + Math.sin(a) * LAKE.rz * 1.15, 1.6 + nz.get(a * 3, 0) * 1.2, 2);
    for (const [x, z] of RIVER) paint(x, z + 2.6, 1.4, 2);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const t = new THREE.DataTexture(data, MASK, MASK); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    this.groundMat.uniforms.tMask.value = t;
  }

  col(hex) { return this.c.setHex(hex); }
  hsl(h) { return this.c.setHSL(((h % 1) + 1) % 1, 1, 0.62); }
  dirRow(dx, dz) {
    const n = dx * this.right.x + dz * this.right.z; const r = dx * this.fwd.x + dz * this.fwd.z;
    return ((Math.round(Math.atan2(n, -r) / (Math.PI / 4)) % 8) + 8) % 8;
  }
  faceCam(x, z) { return this.dirRow(this.camera.position.x - x, this.camera.position.z - z); }

  strike() {
    const from = new THREE.Vector3(RAIKOU.x + (Math.random() - 0.5) * 4, 28, RAIKOU.z - 2); const to = new THREE.Vector3(RAIKOU.x + 0.6, RAIKOU.h + 0.2, RAIKOU.z);
    const main = [];
    for (let i = 0; i <= 14; i++) { const p = from.clone().lerp(to, i / 14); if (i > 0 && i < 14) p.add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2)); main.push(p); }
    const ribbon = (pts, w) => {
      const v = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]; const b = pts[i + 1]; const dir = b.clone().sub(a).normalize(); const toC = this.camera.position.clone().sub(a).normalize();
        const side = dir.clone().cross(toC).normalize().multiplyScalar(w * (1 - (i / pts.length) * 0.5));
        const a1 = a.clone().add(side); const a2 = a.clone().sub(side); const b1 = b.clone().add(side); const b2 = b.clone().sub(side);
        v.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z, b1.x, b1.y, b1.z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
    };
    const geos = [ribbon(main, 0.42)];
    for (const k of [4, 8]) { const br = [main[k]]; for (let i = 1; i <= 4; i++) br.push(br[i - 1].clone().add(new THREE.Vector3((Math.random() - 0.3) * 2, -1.4, Math.random() - 0.5))); geos.push(ribbon(br, 0.2)); }
    for (const g of geos) { const m = new THREE.Mesh(g, this.boltMat); m.renderOrder = 7; m.frustumCulled = false; this.group.add(m); this.bolts.push({ mesh: m, t: 0 }); }
    if (!this.struck) this.flash = 0.6;
    this.struck = true;
    for (let i = 0; i < 44; i++) { const a = Math.random() * Math.PI * 2; const v = 2 + Math.random() * 6; this.fx.emit(to.x, to.y, to.z, Math.cos(a) * v, 2 + Math.random() * 6, Math.sin(a) * v, this.col(Math.random() < 0.5 ? 0xfff07a : 0xffffff), 4 + Math.random() * 3, 0.4 + Math.random() * 0.5, 14); }
  }
  flames(dt, burst) {
    const h = ENTEI.h; const n = burst ? 120 : Math.random() < dt * 60 ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const r = Math.random() * (burst ? 1.4 : 1.1); const up = burst ? 8 + Math.random() * 10 : 1.5 + Math.random() * 2;
      const c = [0xfff0a0, 0xffc040, 0xff7820, 0xff3a10][Math.floor(Math.random() * 4)];
      this.fx.emit(ENTEI.x + Math.cos(a) * r, h + Math.random() * 0.6, ENTEI.z + Math.sin(a) * r * 0.7, Math.cos(a) * (burst ? 1.6 : 0.3), up, Math.sin(a) * (burst ? 1.2 : 0.3), this.col(c), burst ? 8 + Math.random() * 5 : 6 + Math.random() * 4, burst ? 1 + Math.random() * 0.8 : 0.7 + Math.random() * 0.6, burst ? 6 : -0.5);
    }
  }
  splash(x, z, count, speed = 2.4) {
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2; const v = speed * (0.5 + Math.random() * 0.6); this.soft.emit(x, -0.4, z, Math.cos(a) * v, 2 + Math.random() * 3, Math.sin(a) * v, this.col(Math.random() < 0.6 ? 0xe8f8ff : 0x9cd8ff), 3.2, 0.9, 9); }
  }

  update(dt) {
    this.t += dt;
    const t = this.t; const cam = this.camera;
    const sway = Math.sin(t * 0.11) * 1.6; const bob = Math.sin(t * 0.19) * 0.22;
    cam.position.set(CAM.x + sway, CAM.y + bob, CAM.z - Math.abs(sway) * 0.2);
    cam.lookAt(LOOK.x + sway * 0.3, LOOK.y, LOOK.z);
    cam.updateMatrixWorld();
    cam.matrixWorld.extractBasis(this.right, this.upTmp, this.fwd);
    this.fwd.negate(); this.fwd.y = 0; this.fwd.normalize(); this.right.y = 0; this.right.normalize();
    this.glows.forEach(({ m, base }, i) => { m.emissiveIntensity = base * (1.2 + 0.3 * Math.sin(t * 5 + i * 1.7) * Math.sin(t * 2.3 + i)); });
    this.waterMat.uniforms.uGlow.value = 0.85 + 0.15 * Math.sin(t * 7) * Math.sin(t * 3.1);
    if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) this.onRainbow?.(0.42 + 0.18 * Math.sin(t * 0.21));
    for (const k of this.kinds.values()) k.begin();
    this.shadows.begin();
    const get = (id) => this.kinds.get(id);

    // Raikou's lightning on its rock.
    if ((this.nextBolt -= dt) <= 0) { this.strike(); this.nextBolt = 4 + Math.random() * 5; }
    for (const b of this.bolts) b.t += dt;
    for (const b of this.bolts.filter((x) => x.t > 0.32)) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); }
    this.bolts = this.bolts.filter((b) => b.t <= 0.32);
    this.boltMat.opacity = this.bolts.length ? (Math.sin(this.bolts[0].t * 60) > -0.3 ? 1 : 0.35) * (1 - this.bolts[0].t / 0.32) : 0;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); this.onFlash?.(this.flash); }

    // Entei's flames, Suicune's aurora, spray at the waterfall, smoke and embers at the Burned Tower, lantern sparks.
    const flare = (this.nextFlare -= dt) <= 0;
    if (flare) this.nextFlare = 7 + Math.random() * 5;
    this.flames(dt, flare);
    if (Math.random() < dt * 22) { const a = Math.random() * Math.PI * 2; const r = 0.8 + Math.random() * 2.8; this.fx.emit(SUICUNE.x + Math.cos(a) * r, -0.4, SUICUNE.z + Math.sin(a) * r * 0.7, 0, 0.8 + Math.random() * 1.4, 0, this.col(Math.random() < 0.7 ? 0x8cf8ff : 0xc8a0ff), 3.5 + Math.random() * 2, 1.6 + Math.random(), 0, 0.4); }
    if (Math.random() < dt * 40) { const a = Math.random() * Math.PI * 2; const r = FALL.lip + 2.2; this.soft.emit(PLATEAU.x + FALL_DIR.x * r + Math.cos(a) * 1.2, -0.3, PLATEAU.z + FALL_DIR.z * r + Math.sin(a) * 0.6, Math.cos(a) * 1.4, 1.4 + Math.random() * 2.4, Math.sin(a) * 0.8 + 0.6, this.col(Math.random() < 0.5 ? 0xffffff : 0xd8f0ff), 4 + Math.random() * 3, 1.1, 2.2); }
    if (Math.random() < dt * 8) this.soft.emit(FALL.x + FALL_SIDE.x * (Math.random() - 0.5) * FALL.w, FALL.top, FALL.z + FALL_SIDE.z * (Math.random() - 0.5) * FALL.w, (POOL.x - FALL.x) * 0.15, -1, (POOL.z - FALL.z) * 0.15, this.col(0xf0f8ff), 2.6, 0.9, 12);
    const bh = this.height(BURNED.x, BURNED.z);
    if (Math.random() < dt * 9) this.soft.emit(BURNED.x + (Math.random() - 0.5) * 6, bh + 1.5 + Math.random() * 2, BURNED.z + (Math.random() - 0.5) * 5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.6, 0.15, this.col(Math.random() < 0.5 ? 0x6a5a62 : 0x8a7a7a), 9 + Math.random() * 6, 5, -0.05, 0.25);
    if (Math.random() < dt * 10) this.fx.emit(BURNED.x + (Math.random() - 0.5) * 6, bh + 0.8, BURNED.z + (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 0.5, 1.4 + Math.random(), 0, this.col(Math.random() < 0.6 ? 0xff8a30 : 0xffd060), 2.6, 1.6 + Math.random(), 0, 0.5);
    if (Math.random() < dt * 12) { const l = LANTERNS[Math.floor(Math.random() * LANTERNS.length)]; this.fx.emit(l.x, this.height(l.x, l.z) + 1.25, l.z, 0, 0.05, 0, this.col(0xffc060), 6, 0.6, 0); }
    if (Math.random() < dt * 5) { const a = Math.random() * Math.PI * 2; this.fx.emit(LAKE.x + Math.cos(a) * LAKE.rx * 1.05, 0.4 + Math.random() * 1.6, LAKE.z + Math.sin(a) * LAKE.rz * 1.05, (Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4, this.col(0xe8ff90), 2.4, 3, 0, 0.5); }

    // Ho-Oh circles the Tin Tower forever, trailing rainbow sparks.
    const u = t * 0.24;
    const hx = TOWER.x + Math.sin(u) * 15; const hz = TOWER.z + Math.cos(u) * 15 * 0.6; const hy = PLATEAU.h + 17 + Math.sin(t * 0.7) * 1.2 + Math.cos(u) * 1.5;
    const vx = Math.cos(u); const vz = -Math.sin(u) * 0.6; const vl = Math.hypot(vx, vz);
    get(250).push(hx, hy, hz, 'walk', t, this.dirRow(vx, vz), 2.6);
    for (let i = 0; i < 7; i++) { const o = (i - 3) * 0.32; this.soft.emit(hx - (vx / vl) * 1.6 - (vz / vl) * o * 0.2, hy + 1.2 + o, hz - (vz / vl) * 1.6 + (vx / vl) * o * 0.2, 0, -0.25, 0, this.hsl(i / 7.5), 4.6, 3, 0); }
    if (Math.random() < dt * 5) this.soft.emit(hx, hy, hz, (Math.random() - 0.5) * 0.6, -0.6, (Math.random() - 0.5) * 0.6, this.col(Math.random() < 0.5 ? 0xffd040 : 0xff8a30), 4, 6, 0.02, 1.2);

    // Lugia hovers over the far water, stirring it.
    const w = t * 0.17; const lx = -3.5 + Math.sin(w) * 2.5; const lz = -23 + Math.cos(w * 0.7) * 1.5; const ly = 15 + Math.sin(t * 0.8) * 0.8 + Math.sin(w * 2) * 1.2;
    get(249).push(lx, ly, lz, 'walk', t * 0.8, this.faceCam(lx + Math.cos(w) * 8, lz), 2.8);
    for (let i = 0; i < 2; i++) { const a = t * 3 + i * Math.PI + Math.random() * 0.4; const r = 3.6 + Math.random() * 0.8; this.fx.emit(lx + Math.cos(a) * r, ly - 1 + (Math.random() - 0.5) * 2.5, lz + Math.sin(a) * r * 0.5, -Math.sin(a) * 4, 0.6, Math.cos(a) * 2, this.col(Math.random() < 0.6 ? 0xd8f4ff : 0x9cc8ff), 3, 0.7, 0); }
    if (Math.random() < dt * 14) this.soft.emit(lx + (Math.random() - 0.5) * 6, -0.45, lz + 8 + Math.random() * 2, (Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, 0.5, this.col(0xf2f8ff), 3, 0.7, 4);

    // The three beasts on their spots.
    const beast = (id, spot, scale, charging) => { const y = this.height(spot.x, spot.z); get(id).push(spot.x, y, spot.z, charging ? 'charge' : 'idle', t, this.faceCam(spot.x + 1.4, spot.z), scale); this.shadows.push(spot.x, y, spot.z, scale * 1.1); };
    beast(243, RAIKOU, 1.9, this.bolts.length > 0 || this.nextBolt < 0.6);
    beast(244, ENTEI, 1.9, this.nextFlare > 6.2);
    get(245).push(SUICUNE.x, -0.48 + Math.sin(t * 1.4) * 0.04, SUICUNE.z, 'idle', t, this.faceCam(SUICUNE.x + 1.4, SUICUNE.z), 1.9);

    // Celebi drifts over the meadow.
    const cw = t * 0.42; const cx = 18 + Math.sin(cw) * 3.5; const cz = 6 + Math.sin(cw * 2) * 1.6; const cy = this.height(cx, cz) + 2.8 + Math.sin(t * 2.6) * 0.3;
    get(251).push(cx, cy, cz, 'idle', t, this.dirRow(Math.cos(cw), Math.cos(cw * 2)), 1.1);
    if (Math.random() < dt * 18) this.fx.emit(cx, cy + 0.6, cz, (Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4, this.col(Math.random() < 0.7 ? 0xa0ff70 : 0xf0ffb0), 3, 1.2, 0);

    this.wildlife(dt, t);

    // The starters cheer in turn.
    if ((this.nextCheer -= dt) <= 0) { this.cheer = { who: Math.floor(Math.random() * 3), t: 0 }; this.nextCheer = 3.5 + Math.random() * 3; }
    this.cheer.t += dt;
    STARTERS.forEach((s, i) => {
      const y = this.height(s.x, s.z); const on = this.cheer.who === i && this.cheer.t < 1;
      const row = Math.sin(t * 0.3 + i * 2) > -0.7 ? this.faceCam(s.x + (i - 1) * 3, s.z) : this.dirRow(-0.3 + i * 0.3, -1);
      get(s.id).push(s.x, y + (on ? Math.max(0, Math.sin(this.cheer.t * Math.PI * 2)) * 0.4 : 0), s.z, on ? 'attack' : 'idle', on ? this.cheer.t : t + i, on ? this.faceCam(s.x, s.z) : row, 1.5, on);
      this.shadows.push(s.x, y, s.z, 1.2);
      if (on && this.cheer.t - dt < 0.3 && this.cheer.t >= 0.3) {
        for (let k = 0; k < 36; k++) {
          const a = Math.random() * Math.PI * 2; const v = 1 + Math.random() * 2.5;
          if (s.id === 152) this.soft.emit(s.x, y + 1, s.z, Math.cos(a) * v, 1.5 + Math.random() * 2.5, Math.sin(a) * v, this.col(Math.random() < 0.6 ? 0x7ad850 : 0xc0f080), 3.5, 1.4, 2.5, 1.2);
          else if (s.id === 155) this.fx.emit(s.x + Math.cos(a) * 0.3, y + 0.8, s.z + Math.sin(a) * 0.3, Math.cos(a) * v * 0.6, 2 + Math.random() * 3, Math.sin(a) * v * 0.6, this.col([0xfff0a0, 0xffb030, 0xff6020][k % 3]), 6, 0.8, -1);
          else this.soft.emit(s.x, y + 1, s.z, Math.cos(a) * v * 0.7, 3 + Math.random() * 3, Math.sin(a) * v * 0.7, this.col(Math.random() < 0.6 ? 0x60c8ff : 0xe8f8ff), 3.5, 1.2, 9);
        }
      }
    });

    // Autumn leaves drifting down, and fireflies over the grass.
    if (Math.random() < dt * 14) {
      const x = -12 + Math.random() * 42; const z = -16 + Math.random() * 30; const gold = Math.random() < 0.3;
      this.soft.emit(x, 9 + Math.random() * 8, z, 0.7 + Math.random() * 0.5, -0.8 - Math.random() * 0.5, (Math.random() - 0.5) * 0.3, this.col(gold ? [0xf4c030, 0xffe060][Math.floor(Math.random() * 2)] : [0xe03f2a, 0xf07a28, 0xc8301c, 0xff5a3a][Math.floor(Math.random() * 4)]), 3.4 + Math.random() * 1.2, 13, 0, 1.3);
    }
    if (Math.random() < dt * 6) { const x = -6 + Math.random() * 32; const z = -8 + Math.random() * 20; this.fx.emit(x, this.height(x, z) + 0.5 + Math.random() * 2, z, 0.2, 0.15, 0, this.col(0xffe08a), 2.6, 4, 0, 0.3); }

    this.fx.update(dt, t); this.soft.update(dt, t);
    for (const k of this.kinds.values()) k.end();
    this.shadows.end();
  }

  wildlife(dt, t) {
    const get = (id) => this.kinds.get(id);
    // Hoothoot on the torii.
    get(163).push(TORII.x + 1.3, -1.4 + 5.85 * TORII.s, TORII.z, Math.sin(t * 0.5) > 0.85 ? 'attack' : 'idle', t, this.faceCam(TORII.x, TORII.z), 1.05);
    // Hoppip drifting across on the wind.
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.035 + i * 0.33) % 1; const x = -14 + k * 46; const z = -6 + i * 5 + Math.sin(t * 0.3 + i) * 2;
      const y = this.height(x, z) + 4 + i * 1.4 + Math.sin(t * 1.3 + i * 2) * 0.6 + Math.sin(k * Math.PI) * 3;
      const fade = Math.min(1, k * 12, (1 - k) * 12);
      if (fade > 0.05) get(187).push(x, y, z, 'idle', t + i, this.dirRow(1, 0.2), 1 * fade + 0.001);
    }
    // Wooper bobbing in the shallows.
    const wx = -3.2 + Math.sin(t * 0.25) * 1.4; const wz = 0.2;
    get(194).push(wx, -0.85 + Math.sin(t * 2) * 0.06, wz, 'idle', t, this.faceCam(wx, wz), 1.05);
    if (Math.random() < dt * 1.5) this.splash(wx, 0.5, 3, 1);
    // Sentret peeking out of the grass.
    const pk = (t % 7) / 7; const up = smooth(0.05, 0.15, pk) * smooth(0.75, 0.65, pk);
    if (up > 0.02) { const sx = -5.6; const sz = 2.2; get(161).push(sx, this.height(sx, sz) - 0.9 + up * 0.9, sz, 'idle', t, Math.sin(t * 1.4) > 0 ? this.faceCam(sx, sz) : this.dirRow(-1, 0.3), 1.1); }
    // Sudowoodo hopping now and then.
    if ((this.nextHop -= dt) <= 0) { this.hop = 0; this.nextHop = 9 + Math.random() * 6; }
    this.hop += dt;
    {
      const x = 27.5; const z = -2.5; const jump = this.hop < 0.9 ? Math.abs(Math.sin(this.hop * Math.PI * 3)) * 0.5 : 0;
      get(185).push(x, this.height(x, z) + jump, z, this.hop < 0.9 ? 'walk' : 'idle', this.hop < 0.9 ? this.hop : 0, this.faceCam(x, z), 1.5);
      this.shadows.push(x, this.height(x, z), z, 1.1);
    }
    // Magikarp leaping out of the lake.
    if ((this.nextKarp -= dt) <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.karp = { t: 0, x: LAKE.x + Math.cos(a) * LAKE.rx * 0.5, z: LAKE.z + 1.5 + Math.sin(a) * LAKE.rz * 0.4, vx: Math.random() < 0.5 ? -1 : 1 };
      this.nextKarp = 5 + Math.random() * 6; this.splash(this.karp.x, this.karp.z, 14);
    }
    const kp = this.karp;
    if (kp.t < 1) { kp.t += dt; if (kp.t >= 1) this.splash(kp.x + kp.vx * 2.4, kp.z, 16); else get(129).push(kp.x + kp.vx * 2.4 * kp.t, WATER + Math.sin(kp.t * Math.PI) * 2.6, kp.z, 'walk', t, this.dirRow(kp.vx, 0), 1.1); }
    // A flock of Murkrow crossing the far sky.
    if ((this.nextFlock -= dt) <= 0) { this.flock = { t: 0, side: Math.random() < 0.5 ? -1 : 1, y: 20 + Math.random() * 6, z: -58 - Math.random() * 10 }; this.nextFlock = 16 + Math.random() * 12; }
    const fl = this.flock;
    if (fl.t < 9) {
      fl.t += dt;
      for (let i = 0; i < 5; i++) { const x = -fl.side * 48 + fl.side * (fl.t * 12 - Math.abs(i - 2) * 2.2); get(198).push(x, fl.y + Math.sin(t * 3 + i) * 0.4 - Math.abs(i - 2) * 0.6, fl.z + (i - 2) * 2, 'walk', t + i * 0.3, this.dirRow(fl.side, 0), 1.3); }
    }
  }

  dispose() {
    this.disposed = true;
    this.group.traverse((o) => { o.geometry?.dispose?.(); });
    this.scene.remove(this.group);
  }
}

// ---- Sky dome: SNES-style banded gradient, sunset glow, a pixel rainbow, the sun and drifting clouds ----
function makeSky(shared) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3e44a8) }, bottom: { value: new THREE.Color(0xffaf72) }, sunDir: { value: new THREE.Vector3() }, uTime: shared.uTime,
      cloudTint: { value: new THREE.Color(1.1, 0.86, 0.76) }, cover: { value: 0.1 }, uPx: { value: 4 }, glowCol: { value: new THREE.Color(0xff8a40) }, glowK: { value: 1 },
      rainbow: { value: 0.55 }, rbDir: { value: new THREE.Vector3() },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, bottom, sunDir, cloudTint, glowCol, rbDir; uniform float uTime, cover, uPx, glowK, rainbow; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ return n(p)*0.5 + n(p*2.03+1.7)*0.28 + n(p*4.1+4.3)*0.14 + n(p*8.3+2.1)*0.08; }
      float bayer(vec2 p){ vec2 q = mod(floor(p), 4.); float x0 = mod(q.x, 2.), y0 = mod(q.y, 2.), x1 = floor(q.x * 0.5), y1 = floor(q.y * 0.5);
        return (8. * abs(x0 - y0) + 4. * y0 + 2. * abs(x1 - y1) + y1) / 16.; }
      float clouds(vec2 uv){ return fbm(uv) + cover * 0.28; }
      void main(){
        vec2 fc = gl_FragCoord.xy, cell = floor(fc / uPx), sc = (cell + 0.5) * uPx;
        vec3 dir = normalize(vDir + dFdx(vDir) * (sc.x - fc.x) + dFdy(vDir) * (sc.y - fc.y));
        float dth = bayer(cell);
        float y = clamp(dir.y * 1.4 + 0.15, 0., 1.);
        float B = 7., t = pow(y, 0.8) * B;
        float tb = (floor(t) + step(1. - fract(t), 0.35) * step(dth, (fract(t) - 0.65) / 0.35)) / B;
        vec3 c = mix(bottom, top, clamp(tb, 0., 1.));
        float gw = pow(max(dot(normalize(dir.xz + 1e-4), normalize(sunDir.xz + 1e-4)), 0.), 3.) * pow(1. - clamp(dir.y * 1.5, 0., 1.), 2.);
        c = mix(c, glowCol, floor(gw * 4. + dth) / 4. * glowK);
        if (rainbow > 0.01) {
          float rd = acos(clamp(dot(dir, rbDir), -1., 1.)), rb = (rd - 0.62) / 0.075;
          if (rb > 0. && rb < 1.) {
            int bi = int(floor(rb * 7.));
            vec3 rc = bi == 0 ? vec3(0.62, 0.36, 0.95) : bi == 1 ? vec3(0.36, 0.42, 1.) : bi == 2 ? vec3(0.3, 0.75, 1.) : bi == 3 ? vec3(0.4, 0.92, 0.42) : bi == 4 ? vec3(1., 0.92, 0.32) : bi == 5 ? vec3(1., 0.62, 0.22) : vec3(1., 0.32, 0.3);
            c = mix(c, rc, rainbow * 0.6 * smoothstep(-0.02, 0.12, dir.y) * step(dth * 0.25, 1. - abs(rb - 0.5) * 1.4));
          }
        }
        float s = max(dot(dir, sunDir), 0.);
        c = mix(c, mix(c, vec3(1., 0.97, 0.86), 0.5), step(0.9955, s));
        c = mix(c, vec3(1., 0.98, 0.9), step(0.9985, s));
        c += vec3(1., 0.85, 0.6) * (step(0.97, s) * 0.06 + step(0.92, s + (dth - 0.5) * 0.01) * 0.04);
        vec2 uv = dir.xz / (dir.y + 0.18) * 1.1 + vec2(uTime * 0.012, uTime * 0.004);
        float fade = smoothstep(0.02, 0.2, dir.y);
        float cl = 0.;
        if (fade > 0.) cl = clouds(uv) * fade;
        float edge = 0.56 + (dth - 0.5) * 0.02;
        if (cl > edge) {
          vec2 toSun = normalize(sunDir.xz + 1e-4) * 0.16;
          float lit = clouds(uv + toSun) * fade, shade = clouds(uv - toSun) * fade;
          vec3 body = vec3(0.97, 0.98, 1.0), sh = vec3(0.78, 0.82, 0.96), base = vec3(0.64, 0.68, 0.88), rim = vec3(1.0, 0.99, 0.93);
          float away = step(shade, cl - 0.01), toward = step(lit, cl - 0.01);
          vec3 cc = mix(body, sh, away);
          cc = mix(cc, base, away * step(cl, edge + 0.05));
          cc = mix(cc, rim, toward * step(cl, edge + 0.06));
          cc = mix(cc, vec3(1.), step(edge + 0.16, cl) * (1. - away));
          c = mix(c, cc * cloudTint, 0.97);
        }
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.frustumCulled = false; sky.renderOrder = -100;
  return sky;
}

// ---- Final pass: dark pixel outlines from depth, warm tint, toon grade and vignette ----
function makeFinal() {
  return new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 600 }, uFog: { value: new THREE.Vector2(60, 175.5) }, uTint: { value: new THREE.Vector3(1.04, 0.97, 0.92) }, uDark: { value: 0.42 }, uOffset: { value: 0.4 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D tColor, tDepth; uniform vec2 uTexel, uFog; uniform float uNear, uFar, uDark, uOffset; uniform vec3 uTint; varying vec2 vUv;
      float vz(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        float c = vz(vUv);
        float m = max(max(vz(vUv + vec2(uTexel.x, 0.)), vz(vUv - vec2(uTexel.x, 0.))), max(vz(vUv + vec2(0., uTexel.y)), vz(vUv - vec2(0., uTexel.y))));
        float edge = step(1.0 + c * 0.12, m - c) * step(c, 300.) * (1. - smoothstep(mix(uFog.x, uFog.y, 0.35), uFog.y * 0.9, c));
        col = mix(col, vec3(0.0103, 0.0052, 0.0212), edge * 0.85);
        col *= uTint;
        vec3 g = clamp(col, 0., 1.);
        float l = dot(g, vec3(0.299, 0.587, 0.114));
        g = g * mix(vec3(0.93, 0.97, 1.06), vec3(1.04, 1.01, 0.95), smoothstep(0.15, 0.75, l));
        g = mix(g, g * g * (3. - 2. * g), 0.22);
        float d = distance(vUv, vec2(0.5));
        g *= smoothstep(0.8, uOffset * 0.799, d * (uDark + uOffset));
        gl_FragColor = vec4(g, 1.);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
}

// Starts the valley in a canvas and returns controls. onReady fires once the first frames are
// drawn with the models and the trees in place.
export function startValley(canvas, { onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  const shared = { uTime: { value: 0 }, uFogColor: { value: new THREE.Color(0xf0a47e) }, uFogNear: { value: 60 }, uFogFar: { value: 175.5 }, uLight: { value: new THREE.Color(1, 1, 1).multiplyScalar(0.997) }, uWind: { value: 1 } };
  scene.fog = new THREE.Fog(0xf0a47e, 60, 175.5);
  const hemi = new THREE.HemisphereLight(0xdff3ff, 0x7a5a5a, 0.98);
  const sun = new THREE.DirectionalLight(0xffc890, 1.6 * 0.98);
  sun.position.set(...SUN).normalize().multiplyScalar(150);
  scene.add(hemi, sun);
  const sky = makeSky(shared);
  const sh = Math.hypot(SUN[0], SUN[2]); const k = Math.sqrt(1 - 0.1 * 0.1) / sh;
  sky.material.uniforms.sunDir.value.set(SUN[0] * k, 0.1, SUN[2] * k);
  const rbAz = Math.atan2(-1, -0.42);
  sky.material.uniforms.rbDir.value.set(Math.cos(rbAz), 0.05, Math.sin(rbAz)).normalize();
  scene.add(sky);
  const valley = new Valley(scene, shared, camera);
  valley.onRainbow = (v) => { sky.material.uniforms.rainbow.value = v; };
  const final = makeFinal();
  // Lightning briefly brightens the whole picture.
  valley.onFlash = (f) => { const t = 1 + f * 0.45; final.uniforms.uTint.value.set(1.04 * t, 0.97 * t, 0.92 * t + f * 0.1); };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), final); quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let target = null;

  let w0 = 0; let h0 = 0; let r0 = 0;
  function resize() {
    const w = canvas.clientWidth || innerWidth; const h = canvas.clientHeight || innerHeight;
    const r = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(3.7e6 / (w * h))));
    if (w === w0 && h === h0 && r === r0) return;
    w0 = w; h0 = h; r0 = r;
    renderer.setPixelRatio(r); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const bw = Math.round(w * r); const bh = Math.round(h * r);
    target?.dispose();
    target = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(bw, bh), magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
    final.uniforms.tColor.value = target.texture; final.uniforms.tDepth.value = target.depthTexture;
    final.uniforms.uTexel.value.set(1 / bw, 1 / bh);
  }

  let raf = 0; let last = performance.now(); let running = false; let frames = 0; let loaded = false;
  valley.ready().then(() => { loaded = true; });
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    resize();
    shared.uTime.value += dt;
    valley.update(dt);
    sky.position.copy(camera.position);
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    if (loaded && ++frames === 3) onReady?.();
  }
  const api = {
    resume() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    pause() { running = false; cancelAnimationFrame(raf); },
    dispose() { api.pause(); valley.dispose(); target?.dispose(); renderer.dispose(); },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (running) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  });
  api.resume();
  return api;
}

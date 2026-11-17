// The animated Pokémon frame used by La Ligue and the Pokédex, like the original's: a radial
// backdrop in the Pokémon's type colours with slowly turning light rays, a glowing pedestal,
// and the Pokémon's idle animation playing from its sprite sheet.
import { SHEETS } from './sheets.js';
import { TYPE_FR } from './types.js';

export const TYPE_COLOR = {
  normal: '#a8a090', fire: '#ff7a2a', water: '#3a8cff', grass: '#36c96a', electric: '#f2b705', ice: '#4fd0e0',
  fighting: '#d0402a', poison: '#a24cf0', ground: '#c8963a', flying: '#7aa8ff', psychic: '#ff5ad0', bug: '#8ab82a',
  rock: '#a8904a', ghost: '#6a5ab8', dragon: '#5a5af0', dark: '#4a4058', steel: '#8a9aaa', fairy: '#f08ad8',
};

export const typeIcon = (t, size = 26) => `<span class="typeicon" title="${TYPE_FR[t] || t}" style="width:${size}px;height:${size}px"><img class="pix" src="./assets/ui/types/${t}.png" alt=""></span>`;
export const typeChip = (t) => `<span class="tchip2" style="background:${TYPE_COLOR[t] || '#888'}">${TYPE_FR[t] || t}</span>`;

const sheets = new Map();
function sheetImg(id) {
  if (!sheets.has(id)) { const i = new Image(); i.src = `./assets/pmd/${id}.png`; sheets.set(id, i); }
  return sheets.get(id);
}

// A canvas playing one animation (facing the viewer). Stops by itself once removed from the page.
export function animCanvas(id, scale = 4, anim = 'idle', silhouette = false) {
  const t = SHEETS[id];
  const c = document.createElement('canvas');
  c.className = 'pix ls-spr';
  if (!t) return c;
  const a = (anim === 'walk' ? t[3] : t[2]) || t[3];
  const [y, fw, fh, n, d] = a;
  c.width = fw * scale;
  c.height = fh * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const img = sheetImg(id);
  const total = d.reduce((s, x) => s + x, 0);
  let last = -1;
  let started = false;
  const frameAt = (ms) => { let k = Math.floor((ms / 1000) * 60) % total; for (let i = 0; i < n; i++) { if (k < d[i]) return i; k -= d[i]; } return 0; };
  const draw = (ms) => {
    if (started && !c.isConnected) return;
    if (c.isConnected) started = true;
    const f = frameAt(ms);
    if (f !== last && img.complete && img.naturalWidth) {
      last = f;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(img, f * fw, y, fw, fh, 0, 0, c.width, c.height);
      if (silhouette) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#4a4a66'; g.fillRect(0, 0, c.width, c.height); }
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return c;
}

// Still silhouettes for the grids, drawn once per Pokémon and cached.
const silCache = new Map();
export function silhouetteURL(id) {
  if (silCache.has(id)) return silCache.get(id);
  const p = new Promise((resolve) => {
    const t = SHEETS[id];
    if (!t) { resolve(''); return; }
    const [y, fw, fh] = t[2] || t[3];
    const img = sheetImg(id);
    const go = () => {
      const c = document.createElement('canvas');
      c.width = fw * 2; c.height = fh * 2;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, y, fw, fh, 0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#4a4f66';
      g.fillRect(0, 0, c.width, c.height);
      // Crop to the Pokémon itself so the silhouette fills its cell, as in the original.
      const px = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width; let y0 = c.height; let x1 = -1; let y1 = -1;
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (px[(yy * c.width + xx) * 4 + 3]) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
      if (x1 < 0) { resolve(c.toDataURL()); return; }
      const side = Math.max(x1 - x0, y1 - y0) + 3;
      const o = document.createElement('canvas');
      o.width = side; o.height = side;
      o.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.floor((side - (x1 - x0 + 1)) / 2), Math.floor((side - (y1 - y0 + 1)) / 2), x1 - x0 + 1, y1 - y0 + 1);
      resolve(o.toDataURL());
    };
    if (img.complete && img.naturalWidth) go(); else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', () => resolve(''), { once: true }); }
  });
  silCache.set(id, p);
  return p;
}
export function fillSilhouettes(root) {
  root.querySelectorAll('img[data-sil]').forEach((im) => silhouetteURL(+im.dataset.sil).then((u) => { if (u) im.src = u; }));
}

// HTML for a stage card; call hydrateStages(root) after inserting it.
export function stageCard(id, types, { cls = '', num = false, plate = null, wardrobe = false, silhouette = false, scale = 4 } = {}) {
  const c = TYPE_COLOR[types[0]] || '#ff5a5f';
  const c2 = TYPE_COLOR[types[1] || types[0]] || c;
  return `<div class="ls-show ${cls}" style="--c:${silhouette ? '#5a6078' : c};--c2:${silhouette ? '#3a3f58' : c2}">
    <div class="ls-rays"></div>${num ? `<div class="ls-num">#${String(id).padStart(3, '0')}</div>` : ''}
    <div class="ls-stage"><div class="ls-pedestal"></div><span class="stage-spr" data-id="${id}" data-scale="${scale}" data-sil="${silhouette ? 1 : ''}"></span></div>
    ${plate ? `<div class="ls-plate"><small>${plate.sub}</small><h1>${plate.name}</h1>${plate.types ? `<div class="row">${plate.types.map(typeChip).join('')}</div>` : ''}</div>` : ''}
    ${wardrobe ? `<button class="ls-wd-btn"><img class="pix uiicon" src="./assets/ui/icons/looks.png" alt=""><b>0/4</b></button>` : ''}
    <div class="ls-flash"></div></div>`;
}
export function hydrateStages(root) {
  root.querySelectorAll('.stage-spr').forEach((el) => el.replaceWith(animCanvas(+el.dataset.id, +el.dataset.scale || 4, 'idle', !!el.dataset.sil)));
}

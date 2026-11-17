import { SPECIES } from './species.js';

export const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

// Sprite sheets hold 8 rows, one per facing: down, down-right, right, up-right, up, up-left, left, down-left.
const cache = new Map();

export function sheet(id) {
  if (!cache.has(id)) {
    const img = new Image();
    img.src = `./assets/pmd/${id}.png`;
    cache.set(id, img);
  }
  return cache.get(id);
}

export function preload(ids) {
  return Promise.all(ids.map((id) => {
    const img = sheet(id);
    return img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; });
  }));
}

export function facing(dx, dy) {
  if (!dx && !dy) return 0;
  const a = Math.atan2(dy, dx); // 0 = right, pi/2 = down
  const oct = Math.round(a / (Math.PI / 4));
  return [6, 5, 4, 3, 2, 1, 0, 7, 6][oct + 4] ?? 0;
}

// Draws one animation frame centred on (x, y) at the feet.
export function drawSprite(ctx, id, anim, frame, dir, x, y, scale = 2, flash = 0) {
  const s = BY_ID.get(id);
  const a = s?.sheet?.anims?.[anim] || s?.sheet?.anims?.walk;
  const img = sheet(id);
  if (!a || !img.complete || !img.naturalWidth) return;
  const f = frame % a.n;
  const sx = f * a.fw;
  const sy = a.y + (dir % a.rows) * a.fh;
  const w = a.fw * scale;
  const h = a.fh * scale;
  ctx.drawImage(img, sx, sy, a.fw, a.fh, Math.round(x - w / 2), Math.round(y - h * 0.78), w, h);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, flash) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, sx, sy, a.fw, a.fh, Math.round(x - w / 2), Math.round(y - h * 0.78), w, h);
    ctx.restore();
  }
}

// Frame index for an animation at a given time (uses the sheet's own frame durations, in 1/60 s).
export function frameAt(id, anim, t) {
  const a = BY_ID.get(id)?.sheet?.anims?.[anim];
  if (!a) return 0;
  const total = a.d.reduce((x, y) => x + y, 0);
  let tick = Math.floor(t * 60) % total;
  for (let i = 0; i < a.d.length; i++) {
    if (tick < a.d[i]) return i;
    tick -= a.d[i];
  }
  return 0;
}

// A canvas that plays one animation of a Pokémon's sheet (facing down) while it is on the page.
export function animSprite(id, scale = 4, anim = 'idle') {
  const s = BY_ID.get(id);
  const a = s.sheet.anims[anim] || s.sheet.anims.walk;
  const c = document.createElement('canvas');
  c.width = a.fw * scale;
  c.height = a.fh * scale;
  c.className = 'pix ls-spr';
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const img = sheet(id);
  let last = -1;
  const draw = (t) => {
    if (!c.isConnected && last >= 0) return;
    const f = frameAt(id, anim, t / 1000);
    if (f !== last && img.complete && img.naturalWidth) {
      last = f;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(img, f * a.fw, a.y, a.fw, a.fh, 0, 0, c.width, c.height);
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return c;
}

// A small still portrait (first idle frame facing down) as a data URL, for menus.
export function portrait(id, size = 64) {
  return new Promise((resolve) => {
    const img = sheet(id);
    const go = () => {
      const a = BY_ID.get(id).sheet.anims.idle || BY_ID.get(id).sheet.anims.walk;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const k = Math.min(size / a.fw, size / a.fh);
      g.drawImage(img, 0, a.y, a.fw, a.fh, (size - a.fw * k) / 2, (size - a.fh * k) / 2, a.fw * k, a.fh * k);
      resolve(c.toDataURL());
    };
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener('load', go, { once: true });
  });
}

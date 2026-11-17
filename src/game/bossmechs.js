// Guardians' special mechanics and the legendaries' own moves, after the game's: each guardian of the
// Côte, the Glacier, Cramois'Île, the Caverne, the Bois aux Chênes and Rosalia adds its own trick to the
// shared boss moves, and each sanctuary legendary fights with its own moves and a weak point to find.
// Every factory gets `a`, the run's helpers, and returns { name, every, cast(), tick(dt), hitMul(fx, fz), onKill(e) }.

const R = (lo, hi) => lo + Math.random() * (hi - lo);
const ang = (x, z) => Math.atan2(z, x);
const near = (o, x, z, r) => Math.hypot(o.x - x, o.z - z) < r;
const mk = (o) => ({ every: 8, cast() { return 3; }, tick() {}, hitMul() { return 1; }, onKill() {}, ...o });

// A shared "weak" window: the boss takes more damage for a while.
function weak(a, s, k, sec, title) { s.weakT = sec; s.weakK = k; if (title) a.say(title); }
function weakMul(s) { return s.weakT > 0 ? s.weakK : 1; }
function tickWeak(s, dt) { if (s.weakT > 0) s.weakT -= dt; }
// A line telegraph, then a beam along it hitting the player.
function beam(a, x, z, dx, dz, len, width, delay, mul, color = '#ff5a3a') {
  for (let k = 1; k <= Math.round(len / 2); k++) a.ring(x + dx * k * 2, z + dz * k * 2, width, color, delay);
  a.later(delay, () => {
    if (!a.live()) return;
    for (let k = 1; k <= Math.round(len / 2); k++) a.spark(x + dx * k * 2, 1, z + dz * k * 2, color, { size: width * 1.4, life: 0.35 });
    const px = a.P.x - x; const pz = a.P.z - z; const t = px * dx + pz * dz; const off = Math.abs(px * dz - pz * dx);
    if (t > 0 && t < len && off < width && a.P.y < 2) a.strike(mul);
  });
}
const toward = (a, from = a.e) => { const dx = a.P.x - from.x; const dz = a.P.z - from.z; const d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, d]; };
// Circles hitting where the player stands, after a delay.
function blasts(a, n, r, delay, mul, color, spread = 9) {
  for (let i = 0; i < n; i++) a.later(i * 0.25, () => {
    if (!a.live()) return;
    const x = a.P.x + (i ? R(-spread, spread) : 0); const z = a.P.z + (i ? R(-spread, spread) : 0);
    a.ring(x, z, r, color, delay);
    a.later(delay, () => { if (!a.live()) return; a.spark(x, 0.5, z, color, { size: r, grow: 1, life: 0.4 }); if (near(a.P, x, z, r) && a.P.y < 2) a.strike(mul); });
  });
}
function radial(a, n, speed, mul, color, off = Math.random()) { for (let i = 0; i < n; i++) a.shot(a.e.x, a.e.z, (off + i / n) * Math.PI * 2, speed, mul, 0.8, 3, color); }

// ---------------- Guardians ----------------
export const GUARDIAN_MECHS = {
  // Côte Tempête
  99: (a) => { const s = { face: 0 }; return mk({ name: 'Garde Claquoir', intro: 'Sa pince le protège : frappe-le dans le dos',
    tick(dt) { const [dx, dz] = toward(a); const want = ang(dx, dz); let d = want - s.face; d = Math.atan2(Math.sin(d), Math.cos(d)); s.face += Math.sign(d) * Math.min(Math.abs(d), 1.1 * dt); },
    hitMul(fx, fz) { let d = ang(fx - a.e.x, fz - a.e.z) - s.face; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.05) { a.blocked('Bloqué !'); return 0.08; } return Math.abs(d) > 2.2 ? 1.6 : 1; },
    cast() { a.say('Garde !'); a.hold(1.4); const cx = Math.cos(s.face); const cz = Math.sin(s.face); a.ring(a.e.x + cx * 4, a.e.z + cz * 4, 3.5, '#ff4a3a', 1.2); a.later(1.2, () => { if (a.live() && near(a.P, a.e.x + cx * 4, a.e.z + cz * 4, 3.5)) a.strike(1.7); }); return 3; } }); },
  101: (a) => { const s = { mines: [] }; return mk({ name: 'Champ de mines', intro: 'Ne marche pas sur ses mines… et fais-le rouler dessus',
    cast() { a.say('Champ de mines !'); for (let i = 0; i < 9; i++) { const m = { x: a.e.x + R(-14, 14), z: a.e.z + R(-14, 14), t: 14 }; s.mines.push(m); } a.later(2.5, () => { if (!a.live()) return; a.say('Roulade !'); a.charge(0.9, 24); }); return 4.5; },
    tick(dt) { for (const m of [...s.mines]) { m.t -= dt; if (Math.random() < dt * 2) a.ring(m.x, m.z, 1.1, '#ffd23a', 0.5);
      const boom = () => { a.spark(m.x, 0.6, m.z, '#ffe060', { size: 3, grow: 2, life: 0.4 }); s.mines.splice(s.mines.indexOf(m), 1); };
      if (near(a.P, m.x, m.z, 1.2) && a.P.y < 1) { a.say('Marche sur une mine !'); a.strike(1.2); boom(); } else if (near(a.e, m.x, m.z, 1.6)) { a.say('Sa propre mine !'); a.hurtBoss(0.06); boom(); } else if (m.t <= 0) boom(); } } }); },
  130: (a) => { const s = {}; return mk({ name: 'Tourbillon', every: 9,
    cast() { if (Math.random() < 0.5) { a.say('Tourbillon !'); s.pull = 3.5; a.ring(a.e.x, a.e.z, 12, '#4ab0ff', 3.5); return 4; }
      a.say('Ultralaser !'); const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 34, 2, 1.3, 2.2, '#ffd23a'); a.hold(1.4); a.later(1.5, () => { if (a.live()) { a.say('Doit se recharger !'); weak(a, s, 2, 3.5); a.hold(3.5); } }); return 5.5; },
    tick(dt) { tickWeak(s, dt); if (s.pull > 0) { s.pull -= dt; a.pull(a.e.x, a.e.z, 5, dt); if (near(a.P, a.e.x, a.e.z, 3) && Math.random() < dt * 2) a.strike(0.5); } },
    hitMul() { return weakMul(s); } }); },
  73: (a) => { const s = { tent: [] }; return mk({ name: 'Forêt de tentacules', intro: 'Brise ses tentacules : ça lui fait mal',
    cast() { a.say('Tentacules !'); for (let i = 0; i < 5; i++) { const x = a.P.x + R(-10, 10); const z = a.P.z + R(-10, 10); a.ring(x, z, 1.8, '#c070ff', 1); a.later(1, () => { if (!a.live()) return; if (near(a.P, x, z, 1.8)) a.strike(1); s.tent.push(a.minion(72, x, z, 0.03)); }); } return 6; },
    onKill(m) { if (s.tent.includes(m)) { a.say('Ça lui fait mal !'); a.hurtBoss(0.03); } } }); },
  121: (a) => { const s = {}; return mk({ name: 'Tour Rapide', intro: 'Pendant qu’elle tourne, elle est intouchable : attends que son noyau soit exposé',
    cast() { a.say('Tour Rapide !'); s.spin = 3.2; a.charge(1, 26); a.later(1.1, () => a.live() && a.charge(1, 26)); a.later(2.2, () => a.live() && a.charge(1, 26)); a.later(3.3, () => { if (a.live()) { a.say('Noyau exposé !'); weak(a, s, 2, 3.5); a.hold(3.5); } }); return 7; },
    tick(dt) { tickWeak(s, dt); if (s.spin > 0) s.spin -= dt; }, hitMul() { if (s.spin > 0) { a.blocked('Esquivé !'); return 0.15; } return weakMul(s); } }); },
  125: (a) => { const s = {}; return mk({ name: 'Cage-Éclair', intro: 'Reste dans la cage : en sortir électrocute',
    cast() { a.say('Cage-Éclair !'); s.cage = { x: a.P.x, z: a.P.z, t: 6, hurt: 0 }; blasts(a, 4, 2.6, 1.2, 1.2, '#ffe35a', 6); return 7; },
    tick(dt) { const c = s.cage; if (!c) return; c.t -= dt; c.hurt -= dt; if (Math.random() < dt * 3) a.ring(c.x, c.z, 9, '#ffe35a', 0.5); if (c.hurt <= 0 && !near(a.P, c.x, c.z, 9)) { c.hurt = 0.5; a.strike(0.6); } if (c.t <= 0) s.cage = null; } }); },
  // Glacier céleste
  87: (a) => mk({ name: 'Luge de glace', cast() { a.say('Luge de glace !'); for (let i = 0; i < 3; i++) a.later(i * 1.1, () => a.live() && a.charge(0.8, 30)); return 4.5; } }),
  97: (a) => { const s = {}; return mk({ name: 'Pendule hypnotique', intro: 'Éloigne-toi quand le pendule oscille',
    cast() { a.say('Pendule !'); a.ring(a.e.x, a.e.z, 11, '#ff7ae0', 2); a.hold(2); a.later(2, () => { if (!a.live()) return; if (near(a.P, a.e.x, a.e.z, 11)) { a.sleep(2.2); a.later(0.6, () => { if (a.live()) { a.say('Dévorêve !'); a.heal(0.04); a.strike(1.4); } }); } }); return 5; } }); },
  91: (a) => { const s = { shut: true, t: 6 }; return mk({ name: 'Carapace', intro: 'Sa coquille la protège : frappe quand elle s’ouvre',
    tick(dt) { s.t -= dt; if (s.t <= 0) { s.shut = !s.shut; s.t = s.shut ? 6 : 4; a.say(s.shut ? 'Carapace !' : 'Elle s’ouvre !'); } },
    cast() { if (s.shut) { a.say('Picanon'); for (let r = 0; r < 3; r++) a.later(r * 0.5, () => a.live() && radial(a, 10, 9, 0.7, '#c8d8ff')); } else if (near(a.P, a.e.x, a.e.z, 5)) { a.say('Claquoir !'); a.strike(1.6); } return 3; },
    hitMul() { if (s.shut) { a.blocked('Carapace !'); return 0.05; } return 1.6; } }); },
  124: (a) => mk({ name: 'Grobisou', cast() { if (Math.random() < 0.5) { a.say('Berceuse !'); a.ring(a.e.x, a.e.z, 12, '#ff9ad8', 2); a.later(2, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 12)) a.sleep(2.5); }); return 4; } a.say('Grobisou !'); a.charge(0.8, 28); return 3.5; } }),
  131: (a) => mk({ name: 'Banquises', intro: 'Saute par-dessus la vague de Surf',
    cast() { const r = Math.random(); if (r < 0.4) { a.say('Surf !'); a.wave(2, 1.6); return 4; } if (r < 0.7) { a.say('Hydrocanon !'); const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 30, 2, 1.1, 1.8, '#4ab0ff'); return 3.5; }
      a.say('Banquises !'); blasts(a, 5, 2.4, 1.2, 1, '#bfe8ff'); a.later(1.4, () => { if (a.live() && Math.random() < 0.5) { a.say('La glace te recouvre !'); a.sleep(1.2); } }); return 4; } }),
  65: (a) => { const s = {}; return mk({ name: 'Prescience',
    cast() { if (Math.random() < 0.5) { a.say('Prescience !'); for (let i = 0; i < 4; i++) a.later(i * 0.5, () => { if (!a.live()) return; const x = a.P.x; const z = a.P.z; a.ring(x, z, 2.6, '#ff7ae0', 2.5); a.later(2.5, () => { if (a.live() && near(a.P, x, z, 2.6)) a.strike(1.3); }); }); return 4.5; }
      a.say('Télékinésie !'); s.pull = 2; a.later(2, () => { if (a.live()) { a.wave(1, 1.2); } }); return 4; },
    tick(dt) { if (s.pull > 0) { s.pull -= dt; a.pull(a.e.x, a.e.z, 6, dt); } } }); },
  // Île Cramois'Île
  78: (a) => { const s = {}; return mk({ name: 'Nitrocharge', intro: 'Après ses charges, elle est épuisée',
    cast() { a.say('Nitrocharge !'); for (let i = 0; i < 3; i++) a.later(i * 1, () => { if (!a.live()) return; a.charge(0.75, 26 + i * 6); a.firePath(); }); a.later(3.4, () => { if (a.live()) { a.say('Épuisé !'); weak(a, s, 2, 3.5); a.hold(3.5); } }); return 7.5; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  38: (a) => { const s = { clones: [] }; return mk({ name: 'Feu Follet', intro: 'Seule la vraie Feunard prend des dégâts',
    cast() { if (Math.random() < 0.5 || s.clones.some(a.alive)) { a.say('Feu Follet !'); radial(a, 6, 7, 0.8, '#7a8aff'); blasts(a, 2, 2.2, 1.4, 1, '#7a8aff'); return 3.5; }
      a.say('Onde Folie !'); s.clones = [0, 1, 2].map(() => a.minion(38, a.e.x + R(-8, 8), a.e.z + R(-8, 8), 0.02, true)); a.teleport(a.e.x + R(-8, 8), a.e.z + R(-8, 8)); return 4; },
    hitMul() { return s.clones.some(a.alive) ? 0.4 : 1; }, onKill(m) { if (s.clones.includes(m)) a.say('Une illusion !'); } }); },
  126: (a) => { const s = { fire: true, t: 10 }; return mk({ name: 'Corps Ardent', intro: 'Le feu le protège : il le perd après son Magma',
    tick(dt) { s.t -= dt; if (s.t <= 0) { s.fire = !s.fire; s.t = s.fire ? 10 : 5; if (s.fire) a.say('Corps Ardent !'); } },
    cast() { if (s.fire && s.t < 4) { a.say('Magma !'); a.pools(4); s.fire = false; s.t = 5; a.say('Sans son feu !'); return 4; } a.say('Poing Feu !'); a.charge(0.7, 24); return 3; },
    hitMul() { if (s.fire) { a.blocked('Le feu le protège !'); return 0.25; } return 1.6; } }); },
  137: (a) => { const s = { nodes: [], down: 0 }; const spawn = () => { s.nodes = [0, 1, 2].map((i) => a.minion(137, a.e.x + Math.cos(i * 2.1) * 9, a.e.z + Math.sin(i * 2.1) * 9, 0.04, true, 0.6)); a.say('Bouclier de données !'); };
    return mk({ name: 'Conversion', intro: 'Brise ses nœuds de données pour faire tomber son bouclier',
      cast() { if (!s.nodes.some(a.alive) && s.down <= 0) { spawn(); return 3; } a.say(Math.random() < 0.5 ? 'Triplattaque !' : 'Conversion !'); for (let k = 0; k < 3; k++) a.later(k * 0.35, () => a.live() && radial(a, 3, 12, 0.8, ['#ff5a3a', '#4ab0ff', '#ffe35a'][k])); return 3; },
      tick(dt) { if (s.down > 0) s.down -= dt; }, hitMul() { if (s.nodes.some(a.alive)) { a.blocked('Bouclier de données !'); return 0.1; } return s.down > 0 ? 1.6 : 1; },
      onKill(m) { if (s.nodes.includes(m)) { a.say('Nœud brisé !'); if (!s.nodes.some(a.alive)) { a.say('Système en panne !'); s.down = 7; a.hold(3); } } } }); },
  136: (a) => { const s = { heat: 0 }; return mk({ name: 'Élan ardent', intro: 'À trois surchauffes, il s’effondre',
    cast() { s.heat++; a.say(`Surchauffe ${s.heat}/3`); radial(a, 12, 10, 0.9, '#ff8a2a'); a.ring(a.e.x, a.e.z, 6, '#ff5a2a', 0.6); a.later(0.6, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 6)) a.strike(1.2); });
      if (s.heat >= 3) { s.heat = 0; a.later(1, () => { if (a.live()) { a.say('Il s’effondre !'); weak(a, s, 2.2, 4); a.hold(4); } }); } return 3.5; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  89: (a) => mk({ name: 'Détritus', cast() { if (Math.random() < 0.5) { a.say('Détritus !'); a.pools(3); return 3.5; } a.say('Bombe Beurk !'); blasts(a, 6, 2.6, 1.2, 1.1, '#a050c8'); return 3.5; } }),
  // Caverne Azurée
  108: (a) => { const s = {}; return mk({ name: 'Léchouille', intro: 'Esquive sa langue : si elle se colle, il est sans défense',
    cast() { a.say('Coup de langue !'); const [dx, dz] = toward(a); const x0 = a.e.x; const z0 = a.e.z; for (let k = 1; k <= 8; k++) a.ring(x0 + dx * k * 2, z0 + dz * k * 2, 1, '#ff7aa8', 0.8); a.hold(1.2);
      a.later(0.8, () => { if (!a.live()) return; const px = a.P.x - x0; const pz = a.P.z - z0; const t = px * dx + pz * dz; if (t > 0 && t < 16 && Math.abs(px * dz - pz * dx) < 1.4) { a.say('Il t’attrape !'); a.pullTo(a.e.x + dx * 2, a.e.z + dz * 2); a.sleep(1); a.strike(1.3); } else { a.say('Sa langue est restée collée !'); weak(a, s, 1.8, 3); a.hold(3); } }); return 5; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  39: (a) => { const s = {}; return mk({ name: 'Boul’Armure', cast() { if (Math.random() < 0.5) { a.say('Gonflé !'); s.puff = 5; a.grow(1.5, 5); a.charge(1.2, 20); a.later(5, () => a.live() && a.say('Dégonflé !')); return 6; } a.say('Berceuse !'); a.ring(a.e.x, a.e.z, 12, '#ff9ad8', 2); a.later(2, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 12)) { a.say('Somnolent !'); a.sleep(2.2); } }); return 4; },
    tick(dt) { if (s.puff > 0) s.puff -= dt; }, hitMul() { return s.puff > 0 ? 0.35 : 1; } }); },
  113: (a) => { const s = { eggs: [] }; return mk({ name: 'Œuf-thérapie', intro: 'Brise ses œufs avant qu’ils n’éclosent et la soignent',
    cast() { if (Math.random() < 0.5) { a.say('Œuf-thérapie !'); for (let i = 0; i < 3; i++) { const egg = a.minion(102, a.e.x + R(-9, 9), a.e.z + R(-9, 9), 0.025, true, 0.7); egg.hatch = 6; s.eggs.push(egg); } return 4; } a.say('Bombe Œuf !'); blasts(a, 5, 2.4, 1.1, 1.1, '#ffe8c8'); return 3.5; },
    tick(dt) { for (const g of [...s.eggs]) { if (!a.alive(g)) { s.eggs.splice(s.eggs.indexOf(g), 1); continue; } g.hatch -= dt; if (g.hatch <= 0) { a.say('Il éclôt et la soigne !'); a.heal(0.1); a.remove(g); s.eggs.splice(s.eggs.indexOf(g), 1); } } },
    onKill(m) { if (s.eggs.includes(m)) a.say('Œuf brisé !'); } }); },
  132: (a) => { const s = {}; return mk({ name: 'Transformation', intro: 'Il copie ton Pokémon : tes attaques de ton type lui font moins mal',
    cast() { if (!s.copy) { a.say('Transformation !'); s.copy = 10; a.setSpecies(a.playerSpecies()); a.say('Il copie ton type !'); return 3; } radial(a, 8, 10, 0.9, '#c8a0ff'); return 3; },
    tick(dt) { if (s.copy > 0) { s.copy -= dt; if (s.copy <= 0) { a.setSpecies(132); a.say('Il a perdu sa forme !'); s.copy = 0; } } },
    hitMul(fx, fz, type) { return s.copy > 0 && type === a.playerType() ? 0.5 : 1; } }); },
  3: (a) => { const s = { crystals: [], energy: 0 }; return mk({ name: 'Lance-Soleil', intro: 'Brise les cristaux qui nourrissent son Lance-Soleil',
    cast() { if (!s.crystals.length) { s.crystals = [0, 1, 2, 3].map((i) => a.minion(74, a.e.x + Math.cos(i * 1.57) * 11, a.e.z + Math.sin(i * 1.57) * 11, 0.03, true, 0.8)); }
      const left = s.crystals.filter(a.alive).length; const r = Math.random();
      if (r < 0.4 && left) { a.say('Lance-Soleil !'); const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 36, 2.6, 1.6, 1.2 + left * 0.4, '#fff07a'); a.hold(1.8); return 4.5; }
      if (r < 0.7) { a.say('Poudre Dodo !'); a.ring(a.e.x, a.e.z, 8, '#c8f070', 1.6); a.later(1.6, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 8)) a.sleep(2); }); return 3.5; }
      a.say('Fouet Lianes !'); a.ring(a.e.x, a.e.z, 6.5, '#36c96a', 0.9); a.later(0.9, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 6.5)) a.strike(1.4); }); return 3; },
    onKill(m) { if (s.crystals.includes(m)) { const n = s.crystals.filter(a.alive).length; a.say(n ? `Il en reste ${n}` : 'Plus de cristaux !'); } } }); },
  9: (a) => { const s = {}; return mk({ name: 'Tour Rapide', intro: 'Dans sa carapace il esquive tout : frappe quand il sort la tête',
    cast() { if (Math.random() < 0.5) { a.say('Tour Rapide !'); s.shell = 4; a.charge(1, 24); a.later(1.2, () => a.live() && a.charge(1, 24)); a.later(4, () => { if (a.live()) { a.say('Il sort la tête !'); weak(a, s, 1.8, 3); } }); return 6.5; }
      a.say('Hydroblast !'); for (const o of [-0.25, 0.25]) { const [dx, dz] = toward(a); const c = Math.cos(o); const sn = Math.sin(o); beam(a, a.e.x, a.e.z, dx * c - dz * sn, dx * sn + dz * c, 30, 1.6, 1.2, 1.5, '#4ab0ff'); } a.later(1.6, () => { if (a.live()) { a.say('Rechargement !'); weak(a, s, 1.5, 2.5); } }); return 4.5; },
    tick(dt) { tickWeak(s, dt); if (s.shell > 0) s.shell -= dt; }, hitMul() { if (s.shell > 0) { a.blocked('Esquivé !'); return 0.1; } return weakMul(s); } }); },
  // Bois aux Chênes
  168: (a) => { const s = { holders: [] }; return mk({ name: 'Toile suspendue', intro: 'Brise les Mimigal qui tiennent son fil',
    cast() { if (!s.holders.some(a.alive) && !s.fallen) { a.say('Monte dans la cime !'); s.holders = [0, 1, 2].map((i) => a.minion(167, a.e.x + Math.cos(i * 2.1) * 8, a.e.z + Math.sin(i * 2.1) * 8, 0.035, true)); a.float(true); return 3; }
      a.say('Toile !'); blasts(a, 4, 2.4, 1.2, 0.8, '#e8e8f0'); a.later(1.3, () => { if (a.live() && Math.random() < 0.4) { a.say('Collé !'); a.sleep(1); } }); return 3.5; },
    tick(dt) { if (s.fallen > 0) { s.fallen -= dt; if (s.fallen <= 0) s.fallen = 0; } },
    hitMul() { if (s.holders.some(a.alive)) { a.blocked('Hors d’atteinte !'); return 0.1; } return s.fallen > 0 ? 1.8 : 1; },
    onKill(m) { if (s.holders.includes(m) && !s.holders.some(a.alive)) { a.say('Emmêlé !'); a.float(false); s.fallen = 6; a.hold(4); } } }); },
  189: (a) => { const s = {}; return mk({ name: 'Vent traversier', intro: 'Quand il se pose pour se reposer, il est vulnérable',
    cast() { const r = Math.random(); if (r < 0.4) { a.say('Vent traversier !'); s.wind = 4; s.wx = R(-1, 1); s.wz = R(-1, 1); return 5; } if (r < 0.75) { a.say('Bomb’Germe !'); blasts(a, 6, 2.2, 1.1, 1, '#9ad850'); return 3.5; }
      a.say('Il se pose pour se reposer !'); weak(a, s, 2, 3.5); a.hold(3.5); return 4.5; },
    tick(dt) { tickWeak(s, dt); if (s.wind > 0) { s.wind -= dt; a.push(s.wx * 7 * dt, s.wz * 7 * dt); } }, hitMul() { return weakMul(s); } }); },
  214: (a) => { const s = {}; return mk({ name: 'Coup de corne', intro: 'Fais-le foncer dans un arbre ou un mur : il reste coincé',
    cast() { if (Math.random() < 0.6) { a.say('Coup de corne !'); a.charge(1.2, 30, () => { a.say('Coincé !'); weak(a, s, 2, 4); a.hold(4); }); return 5; } a.say('Lance-bûches !'); const [dx, dz] = toward(a); const base = ang(dx, dz); for (const o of [-0.4, 0, 0.4]) a.shot(a.e.x, a.e.z, base + o, 11, 1.2, 1.4, 3, '#a87a4a'); return 3; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  176: (a) => { const s = {}; return mk({ name: 'Métronome', intro: 'Place-toi sous l’étoile de Vœu et elle te soignera',
    cast() { if (Math.random() < 0.4) { a.say('Vœu !'); s.wish = { x: a.e.x + R(-10, 10), z: a.e.z + R(-10, 10), t: 4 }; return 5; } a.say('Métronome !'); a.common(); return 3.5; },
    tick(dt) { const w = s.wish; if (!w) return; w.t -= dt; if (Math.random() < dt * 4) a.ring(w.x, w.z, 3, '#fff07a', 0.5); if (w.t <= 0) { if (near(a.P, w.x, w.z, 3)) { a.say('Vœu volé !'); a.healPlayer(0.25); } else { a.say('Il se soigne !'); a.heal(0.08); } s.wish = null; } } }); },
  205: (a) => { const s = {}; return mk({ name: 'Explosion', intro: 'Foretress va exploser : sors du cercle',
    cast() { if (Math.random() < 0.55) { a.say('Picots !'); for (let r = 0; r < 2; r++) a.later(r * 0.5, () => a.live() && radial(a, 12, 9, 0.8, '#c8b070')); return 3; }
      a.say('Explosion !'); a.ring(a.e.x, a.e.z, 11, '#ff3a3a', 3); a.hold(3.2); a.later(3, () => { if (!a.live()) return; a.spark(a.e.x, 1, a.e.z, '#ffd040', { size: 12, grow: 4, life: 0.6 }); if (near(a.P, a.e.x, a.e.z, 11)) a.strike(3); a.say('Ouvert !'); weak(a, s, 2, 4); }); return 7; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  202: (a) => { const s = { glow: 0 }; return mk({ name: 'Lien du Destin', intro: 'Qulbutoké te renvoie chaque coup tant qu’il brille',
    cast() { a.say('Lien du Destin !'); s.glow = 3; a.ring(a.e.x, a.e.z, 3, '#ff4a8a', 3); a.later(3, () => { if (a.live()) a.say('Sans protection !'); }); return 6; },
    tick(dt) { if (s.glow > 0) { s.glow -= dt; if (Math.random() < dt * 8) a.spark(a.e.x, 1.5, a.e.z, '#ff4a8a', { size: 0.8, life: 0.3 }); } },
    hitMul() { if (s.glow > 0) { a.reflect(); return 0; } return 1.3; } }); },
  // Ville de Rosalia
  217: (a) => { const s = { hives: [] }; return mk({ name: 'Ruches', intro: 'Ursaring fonce sur les ruches : brise-les avant qu’il ne les mange',
    cast() { if (!s.hives.some(a.alive)) { a.say('Ça sent le miel !'); s.hives = [0, 1, 2].map(() => a.minion(15, a.e.x + R(-14, 14), a.e.z + R(-14, 14), 0.03, true, 0.7)); return 3; }
      a.say('Coup de hache !'); a.ring(a.e.x, a.e.z, 5.5, '#c87a3a', 0.9); a.later(0.9, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 5.5)) a.strike(1.5); }); return 3; },
    tick(dt) { const h = s.hives.find(a.alive); if (h) { a.moveToward(h.x, h.z, dt); if (near(a.e, h.x, h.z, 2)) { a.say('Il entre en rage !'); a.heal(0.12); a.remove(h); a.rage(); } } },
    onKill(m) { if (s.hives.includes(m)) a.say('Ruche brisée !'); } }); },
  234: (a) => { const s = {}; return mk({ name: 'Regard hypnotique', intro: 'Si tu regardes Cerfrousse quand ses bois étincellent, tu t’endors',
    cast() { if (Math.random() < 0.5) { a.say('Détourne le regard !'); s.glare = 2; return 4; } a.say('Ruée !'); a.charge(1, 28); return 3; },
    tick(dt) { if (s.glare > 0) { s.glare -= dt; if (Math.random() < dt * 10) a.spark(a.e.x, 3, a.e.z, '#fff6a0', { size: 1, life: 0.3 }); if (s.glare <= 0) { if (a.lookingAt(a.e.x, a.e.z)) { a.say('Hypnotisé !'); a.sleep(2.5); } else a.say('Bois éteints !'); } } } }); },
  229: (a) => { const s = { pack: [] }; return mk({ name: 'Meute', intro: 'Abats les Malosse pour ouvrir la barrière de feu',
    cast() { if (!s.pack.some(a.alive)) { a.say('Meute !'); s.pack = [0, 1, 2, 3].map(() => a.minion(228, a.e.x + R(-10, 10), a.e.z + R(-10, 10), 0.04, false)); return 3; }
      a.say('Fournaise !'); radial(a, 14, 10, 0.9, '#ff6a2a'); a.ring(a.e.x, a.e.z, 7, '#ff5a2a', 0.8); a.later(0.8, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 7)) a.strike(1.4); }); return 3.5; },
    hitMul() { if (s.pack.some(a.alive)) { a.blocked('Barrière de feu !'); return 0.15; } return 1; },
    onKill(m) { if (s.pack.includes(m) && !s.pack.some(a.alive)) { a.say('Brèche !'); a.hold(2); } } }); },
  200: (a) => { const s = { lanterns: [] }; return mk({ name: 'Possession', intro: 'Feuforêve se cache dans une lanterne : trouve celle qui te donne des frissons',
    cast() { if (!s.hidden && Math.random() < 0.5) { a.say('Possession !'); s.lanterns = [0, 1, 2, 3].map(() => ({ x: a.P.x + R(-15, 15), z: a.P.z + R(-15, 15) })); s.real = Math.floor(Math.random() * 4); s.hidden = 12; a.hide(true); return 4; }
      a.say('Requiem !'); const x = a.P.x; const z = a.P.z; a.ring(x, z, 8, '#9a5aff', 3); a.later(3, () => { if (a.live() && near(a.P, x, z, 8)) a.strike(1.8); }); return 4.5; },
    tick(dt) { if (!(s.hidden > 0)) return; s.hidden -= dt; s.lanterns.forEach((l, i) => { if (Math.random() < dt * 2) a.ring(l.x, l.z, 1.5, i === s.real && near(a.P, l.x, l.z, 6) ? '#c8a0ff' : '#ffc860', 0.5);
      if (near(a.P, l.x, l.z, 1.6) && !l.done) { l.done = true; if (i === s.real) { a.say('Je t’ai trouvé !'); a.hide(false); a.teleport(l.x, l.z); s.hidden = 0; a.hold(3); } else { a.say('Ce n’est pas ici !'); a.strike(0.6); } } });
      if (s.hidden <= 0) { a.hide(false); s.hidden = 0; } },
    hitMul() { return s.hidden > 0 ? 0 : 1; } }); },
  178: (a) => mk({ name: 'Prophétie', intro: 'Mémorise la vision : les coups tomberont exactement là',
    cast() { if (Math.random() < 0.6) { a.say('Prophétie !'); const spots = Array.from({ length: 6 }, (_, i) => ({ x: a.P.x + (i ? R(-10, 10) : 0), z: a.P.z + (i ? R(-10, 10) : 0) })); spots.forEach((p) => a.ring(p.x, p.z, 2.8, '#ffe35a', 1)); a.later(3, () => { if (!a.live()) return; spots.forEach((p) => { a.spark(p.x, 0.5, p.z, '#ffe35a', { size: 3, grow: 1, life: 0.4 }); if (near(a.P, p.x, p.z, 2.8)) a.strike(1.3); }); }); return 4.5; }
      a.say('Boost Mental !'); a.buff(1.3, 6); return 3; } }),
  197: (a) => { const s = { beams: [] }; return mk({ name: 'Nuit noire', intro: 'Dans le noir, Noctali est immunisé : amène-le à un rayon de lune',
    cast() { if (!s.beams.length) { a.say('Nuit noire !'); s.beams = [0, 1].map(() => ({ x: a.e.x + R(-14, 14), z: a.e.z + R(-14, 14) })); return 3; } a.say('Regard Noir !'); a.ring(a.e.x, a.e.z, 10, '#3a2a5a', 1.5); a.later(1.5, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 10)) { a.say('Tu ne peux pas bouger !'); a.sleep(1.5); } }); return 4; },
    tick(dt) { for (const b of s.beams) if (Math.random() < dt * 3) a.ring(b.x, b.z, 3.5, '#d8e8ff', 0.5); },
    hitMul() { if (!s.beams.length) return 1; if (s.beams.some((b) => near(a.e, b.x, b.z, 3.5))) return 2; a.blocked('On n’y voit rien !'); return 0.1; } }); },
};

// ---------------- Legendaries ----------------
// Each has its own moves and a weak point: find it and the legendary takes much more damage for a while.
export const LEGEND_KITS = {
  151: (a) => { const s = {}; const pick = ['Déflagration', 'Blizzard', 'Fatal-Foudre', 'Séisme', 'Lance-Soleil'];
    return mk({ name: 'Joueur', every: 3, intro: 'Mew joue avec toi : esquive sa Bulle Piège et frappe pendant son Reflet raté',
      cast() { const r = Math.random();
        if (r < 0.2) { a.say('Bulle Piège !'); const x = a.P.x; const z = a.P.z; a.ring(x, z, 2.5, '#ff9ad8', 1.2); a.later(1.2, () => { if (!a.live()) return; if (near(a.P, x, z, 2.5)) { a.sleep(1.5); a.strike(0.8); } else { a.say('Esquivé !'); weak(a, s, 2.5, 4); } }); return 3; }
        if (r < 0.3) { a.say('Transformation !'); a.setSpecies(a.playerSpecies()); a.later(8, () => a.live() && a.setSpecies(151)); return 3; }
        const m = pick[Math.floor(Math.random() * pick.length)]; a.say(`Métronome : ${m} !`);
        if (m === 'Déflagration') { radial(a, 16, 9, 1, '#ff6a2a'); radial(a, 16, 6, 1, '#ff9a3a'); }
        if (m === 'Blizzard') blasts(a, 6, 2.6, 1.2, 1.1, '#bfe8ff');
        if (m === 'Fatal-Foudre') blasts(a, 4, 3, 1, 1.4, '#ffe35a', 4);
        if (m === 'Séisme') a.wave(3, 1.4);
        if (m === 'Lance-Soleil') { const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 36, 2.6, 1.5, 2, '#fff07a'); }
        return 3.2; },
      tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  146: (a) => { const s = { cover: [] }; return mk({ name: 'Oiseau de feu', every: 3, intro: 'Mets-toi à couvert dans un cercle doré pendant son Feu Sacré',
    cast() { const r = Math.random();
      if (r < 0.3) { a.say('Feu Sacré !'); s.cover = [0, 1, 2].map(() => ({ x: a.P.x + R(-12, 12), z: a.P.z + R(-12, 12) })); s.cover.forEach((c) => a.ring(c.x, c.z, 3, '#ffd23a', 3)); a.hold(3.2);
        a.later(3, () => { if (!a.live()) return; a.spark(a.P.x, 1, a.P.z, '#ff5a2a', { size: 6, grow: 3, life: 0.5 }); if (!s.cover.some((c) => near(a.P, c.x, c.z, 3))) a.strike(2.4); else { a.say('À couvert !'); weak(a, s, 2.5, 5); } }); return 5; }
      if (r < 0.6) { a.say('Mur de Feu !'); const [dx, dz] = toward(a); for (let k = -5; k <= 5; k++) a.shot(a.e.x - dz * k * 1.6, a.e.z + dx * k * 1.6, ang(dx, dz), 9, 1, 1, 4, '#ff6a2a'); return 3.5; }
      a.say('Bourrasque Ardente !'); s.gust = 2.5; s.gx = a.P.x - a.e.x; s.gz = a.P.z - a.e.z; a.pools(3); return 4; },
    tick(dt) { tickWeak(s, dt); if (s.gust > 0) { s.gust -= dt; const d = Math.hypot(s.gx, s.gz) || 1; a.push((s.gx / d) * 8 * dt, (s.gz / d) * 8 * dt); } }, hitMul() { return weakMul(s); } }); },
  145: (a) => { const s = { rods: [], grounded: 0 }; return mk({ name: 'Oiseau du tonnerre', every: 3, intro: 'Place-toi près d’un paratonnerre actif : la foudre ira sur lui et non sur toi',
    cast() { if (!s.rods.length) { a.say('Paratonnerre !'); s.rods = [0, 1].map(() => ({ x: a.P.x + R(-14, 14), z: a.P.z + R(-14, 14) })); }
      const r = Math.random();
      if (r < 0.4) { a.say('Foudre guidée !'); const x = a.P.x; const z = a.P.z; a.ring(x, z, 3, '#ffe35a', 1.2); a.later(1.2, () => { if (!a.live()) return; const rod = s.rods.find((q) => near(a.P, q.x, q.z, 5)); if (rod) { a.say('Paratonnerre !'); a.spark(rod.x, 2, rod.z, '#ffe35a', { size: 4, grow: 2, life: 0.4 }); s.grounded++; if (s.grounded >= 3) { s.grounded = 0; a.say('Électhor abattu !'); weak(a, s, 3, 8); a.hold(4); } } else if (near(a.P, x, z, 3)) a.strike(1.6); }); return 3; }
      if (r < 0.7) { a.say('Bec Vrille !'); a.charge(0.9, 30); return 3; }
      a.say('Élecanon !'); const [dx, dz] = toward(a); for (const o of [-0.2, 0, 0.2]) a.shot(a.e.x, a.e.z, ang(dx, dz) + o, 13, 1.1, 1, 3, '#ffe35a'); return 2.8; },
    tick(dt) { tickWeak(s, dt); for (const q of s.rods) if (Math.random() < dt * 2) a.ring(q.x, q.z, 1.2, '#ffe35a', 0.6); }, hitMul() { return weakMul(s); } }); },
  144: (a) => { const s = { shell: 1, shellHp: 0 }; return mk({ name: 'Oiseau de glace', every: 3, intro: 'Brise sa carapace de glace, et va dans les secteurs au bord doré avant qu’ils ne gèlent',
    cast() { const r = Math.random();
      if (r < 0.35) { a.say('Glaciation !'); const safe = [0, 1].map(() => ({ x: a.P.x + R(-10, 10), z: a.P.z + R(-10, 10) })); safe.forEach((c) => a.ring(c.x, c.z, 3.4, '#ffd23a', 3)); a.later(3, () => { if (!a.live()) return; if (safe.some((c) => near(a.P, c.x, c.z, 3.4))) a.say('En sécurité !'); else { a.strike(1.8); a.sleep(1.2); } }); return 4.5; }
      if (r < 0.65) { a.say('Laser Glace !'); const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 34, 2, 1.2, 1.6, '#bfe8ff'); return 3.2; }
      a.say('Vent Glace !'); radial(a, 14, 8, 0.9, '#d8f0ff'); return 3; },
    tick(dt) { tickWeak(s, dt); if (!s.shell && !(s.weakT > 0) && Math.random() < dt * 0.05) { s.shell = 1; s.shellHp = 0; a.say('Carapace de glace !'); } },
    hitMul() { if (s.shell) { s.shellHp++; if (s.shellHp > 40) { s.shell = 0; a.say('Carapace brisée !'); weak(a, s, 3, 8); a.hold(3); } else a.blocked('Carapace de glace !'); return 0.2; } return weakMul(s); } }); },
  6: (a) => { const s = { geysers: [] }; return mk({ name: 'Dragon de feu', every: 3, intro: 'Reste dans le cercle doré d’un geyser et esquive le piqué : la vapeur éteindra sa flamme',
    cast() { const r = Math.random();
      if (r < 0.3) { a.say('Piqué !'); s.geysers = [0, 1].map(() => ({ x: a.P.x + R(-9, 9), z: a.P.z + R(-9, 9) })); s.geysers.forEach((g) => a.ring(g.x, g.z, 3, '#ffd23a', 2.6)); const x = a.P.x; const z = a.P.z; a.ring(x, z, 3.5, '#ff3a3a', 2.6); a.hold(3);
        a.later(2.6, () => { if (!a.live()) return; a.teleport(x, z); a.spark(x, 1, z, '#ff7a2a', { size: 6, grow: 2, life: 0.5 }); if (near(a.P, x, z, 3.5)) a.strike(2); if (s.geysers.some((g) => near(a.e, g.x, g.z, 4.5))) { a.say('Flamme éteinte !'); weak(a, s, 3, 8); a.hold(3); } }); return 5; }
      if (r < 0.55) { a.say('Lance-Flammes !'); const [dx, dz] = toward(a); beam(a, a.e.x, a.e.z, dx, dz, 22, 2.4, 0.9, 1.5, '#ff7a2a'); return 3; }
      if (r < 0.8) { a.say('Draco-Choc !'); const [dx, dz] = toward(a); for (const o of [-0.3, 0, 0.3]) a.shot(a.e.x, a.e.z, ang(dx, dz) + o, 12, 1.2, 1.1, 3, '#a05aff'); return 2.8; }
      a.say('Danse Flammes !'); a.pools(3); return 3.5; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); } }); },
  150: (a) => { const s = { clones: [], orb: null }; return mk({ name: 'Le Pokémon Génétique', every: 3, intro: 'Glisse (Maj) juste quand l’anneau devient doré pour lui renvoyer la Ball’Ombre',
    cast() { const r = Math.random();
      if (r < 0.25 && !s.clones.some(a.alive)) { a.say('Bouclier mental !'); s.clones = [0, 1, 2].map((i) => a.minion(150, a.e.x + Math.cos(i * 2.1) * 9, a.e.z + Math.sin(i * 2.1) * 9, 0.025, false, 0.7)); return 3; }
      if (r < 0.55 && !s.orb) { a.say('Ball’Ombre !'); s.orb = { x: a.e.x, z: a.e.z, t: 0 }; return 4; }
      if (r < 0.8) { a.say('Frappe Psy !'); a.wave(2, 1.5); return 3.5; }
      a.say('Télékinésie !'); blasts(a, 5, 2.6, 1.1, 1.2, '#ff7ae0'); return 3; },
    tick(dt) { tickWeak(s, dt); const o = s.orb; if (!o) return; o.t += dt; const [dx, dz, d] = toward(a, o); o.x += dx * 7 * dt; o.z += dz * 7 * dt; a.spark(o.x, 1.2, o.z, '#5a2a8a', { size: 1.4, life: 0.12 });
      if (d < 3 && d > 1.2 && Math.random() < dt * 6) a.ring(a.P.x, a.P.z, 1.5, '#ffd23a', 0.2);
      if (d < 1.2) { if (a.dashing()) { a.say('Renvoyé !'); a.later(0.6, () => { if (a.live()) { a.say('Sa propre Ball’Ombre !'); a.hurtBoss(0.04); weak(a, s, 3, 7); a.hold(3); } }); } else { a.strike(1.8); a.say('Le renvoi a échoué !'); } s.orb = null; }
      if (o.t > 8) s.orb = null; },
    hitMul() { if (s.clones.some(a.alive)) { a.blocked('Les clones le protègent !'); return 0.1; } return weakMul(s); } }); },
  251: (a) => { const s = { clock: null }; return mk({ name: 'Gardien du temps', every: 3, intro: 'Dans le présent, tu ne frappes que son écho : brise son horloge de fleurs',
    cast() { const r = Math.random();
      if (!a.alive(s.clock) && !(s.weakT > 0) && r < 0.3) { a.say('Faille temporelle !'); s.clock = a.minion(182, a.e.x + R(-12, 12), a.e.z + R(-12, 12), 0.05, true, 0.9); return 3; }
      if (r < 0.55) { a.say('Feuille Magik !'); const [dx, dz] = toward(a); for (const o of [-0.35, -0.12, 0.12, 0.35]) a.shot(a.e.x, a.e.z, ang(dx, dz) + o, 11, 1, 0.9, 3, '#7ad850'); return 2.8; }
      if (r < 0.75) { a.say('Giga-Sangsue !'); a.ring(a.e.x, a.e.z, 9, '#36c96a', 1.2); a.later(1.2, () => { if (a.live() && near(a.P, a.e.x, a.e.z, 9)) { a.strike(1.2); a.heal(0.03); } }); return 3; }
      a.say('Pouvoir Antique !'); blasts(a, 6, 2.6, 1.2, 1.1, '#c8a060'); return 3.5; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { if (s.weakT > 0) return weakMul(s); a.blocked('Ce n’est que son écho !'); return 0.25; },
    onKill(m) { if (m === s.clock) { a.say('Le temps se brise !'); weak(a, s, 3, 9); a.hold(3); } } }); },
  250: (a) => { const s = { bell: null }; return mk({ name: 'Phénix de l’aube', every: 3, intro: 'Frappe la cloche qui brille avant que Ho-Oh finisse de concentrer son feu',
    cast() { const r = Math.random();
      if (r < 0.3 && !a.alive(s.bell)) { a.say('Feu Sacré !'); s.bell = a.minion(120, a.e.x + R(-12, 12), a.e.z + R(-12, 12), 0.04, true, 0.9); a.hold(6); a.ring(a.e.x, a.e.z, 14, '#ff8a2a', 6);
        a.later(6, () => { if (!a.live()) return; if (a.alive(s.bell)) { a.remove(s.bell); a.spark(a.e.x, 1, a.e.z, '#ff7a2a', { size: 14, grow: 4, life: 0.6 }); if (near(a.P, a.e.x, a.e.z, 14)) a.strike(3); } }); return 7; }
      if (r < 0.6) { a.say('Arc-en-ciel !'); for (let i = 0; i < 4; i++) a.later(i * 0.7, () => { if (!a.live()) return; const x = a.P.x; const z = a.P.z; a.ring(x, z, 2.4, '#ff5ad0', 0.9); a.later(0.9, () => { if (a.live() && near(a.P, x, z, 2.4)) a.strike(1.2); }); }); return 3.5; }
      if (r < 0.8) { a.say('Rapace !'); a.charge(0.9, 30); return 3; }
      a.say('Plumes ardentes !'); radial(a, 16, 9, 1, '#ffb030'); return 3; },
    tick(dt) { tickWeak(s, dt); }, hitMul() { return weakMul(s); },
    onKill(m) { if (m === s.bell) { a.say('Coup de cloche !'); a.say('Le glas étourdit Ho-Oh !'); weak(a, s, 3, 9); a.hold(4); } } }); },
};

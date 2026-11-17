// A 3D survivor run on one of the maps: third-person camera behind the Pokémon,
// hordes that close in, automatic attacks, candies, level-ups with attacks and
// vitamins, Poké Balls holding items, three zones with a guardian each, an Ultimate (R).
import * as THREE from 'three';
import { BY_ID, facing, frameAt, preload } from './sprites.js';
import { TYPE_CHART, TYPE_FR } from './types.js';
import { Mon, buildWorld, collide, glowTexture, itemTexture, placeModel } from './world3d.js';
import { BIOMES } from './biomes.js';
import { GUARDIAN_MECHS, LEGEND_KITS } from './bossmechs.js';
import { coopLink } from './social.js';
import { ITEM_NAMES } from './treasure-items.js';
import { BALL_ITEMS, EVOLVE_AT, EXTRA_ATTACKS, RARITIES, VITAMINS, kitFor, mainType, rollRarity } from './kits.js';

// Each zone has its own 10-minute clock, as in the game; past it comes the final swarm.
const ZONE_LENGTH = 600;
const RUN_LENGTH = ZONE_LENGTH;
// The game's curves: enemy health and damage per zone and minute, the alive cap, the spawn budget.
const ZONE_OFFSET = [0, 75, 150];
const HP_BASE = [1, 5.5, 13, 20]; const HP_SQ = [0.15, 0.07, 0.05, 0.05];
const DMG_ZONE = [1, 2, 3.1, 3.4];
const PLAYER_ZONE = [1, 1.8, 3.2, 4];
const TIER = { normal: 0, hard: 1, nightmare: 2 };
const TIER_HP = [1, 1.4, 1.9]; const TIER_DMG = [1, 1.42, 1.96]; const TIER_AMOUNT = [1, 1.3, 1.6]; const TIER_EVENTS = [1, 1.2, 1.4]; const TIER_ELITE = [0, 0.04, 0.08];
const LIVE_CAP = 160;
// What the special movers do, as in the game: dig, glide, roll or leave spikes behind.
const ROLES = { 206: 'burrow', 208: 'burrow', 207: 'glide', 231: 'roll', 232: 'roll', 211: 'spite' };
const BIG_ROLE = { 208: true, 232: true };
const TYPES = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];
const eff = (atk, defs) => defs.reduce((m, d) => m * (TYPE_CHART.chart[TYPES.indexOf(atk)]?.[TYPES.indexOf(d)] ?? 1), 1);
const nextEvo = (id) => { for (const s of BY_ID.values()) if (s.evoFrom === id) return s.id; return null; };
const clock = (s, tenths = false) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return tenths ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${m}:${String(Math.floor(r)).padStart(2, '0')}`;
};
const portrait = (id) => `./assets/portraits/${id}.png`;
const itemImg = (name) => `./assets/items/${name}.png`;

export async function startRun3D({ root, speciesId, mode, difficulty = 'normal', bonus, profile, onExit, biome = null, coop = null, bag = [] }) {
  // Bag items chosen before the run (from the Trésors): used up now, active for the whole run.
  const BAG = new Set(bag);
  const startSpecies = BY_ID.get(speciesId);
  // The map's own Pokémon: its residents first, their evolutions joining in later zones, the map's special
  // movers, three alpha totems and summoners per zone, a guardian per zone and the legendary of its sanctuary.
  const B = biome || BIOMES[0];
  const known = (id) => BY_ID.has(id);
  const evo1 = (id) => nextEvo(id);
  const res = B.residents.filter(known);
  // As in the game: each zone draws from every non-legendary Pokémon of the map's types (base forms in zone 1,
  // first evolutions joining in zone 2, evolved forms in zone 3), the map's residents come every third new
  // species, and the map's "late" types join after four minutes.
  const LEGEND = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251]);
  const stageOf = (id) => { let n = 0; let sp = BY_ID.get(id); while (sp?.evoFrom && n < 3) { sp = BY_ID.get(sp.evoFrom); n++; } return n; };
  const rootOf = (id) => { let sp = BY_ID.get(id); for (let n = 0; sp?.evoFrom && n < 3; n++) sp = BY_ID.get(sp.evoFrom); return sp?.id ?? id; };
  const bstOf = (sp) => sp.stats.hp + sp.stats.atk + sp.stats.def + sp.stats.spa + sp.stats.spd + sp.stats.spe;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wild = [...BY_ID.values()].filter((sp) => sp.id <= 251 && !LEGEND.has(sp.id) && !ROLES[sp.id]);
  const okStage = (id, z) => { const st = stageOf(id); return st <= Math.min(2, z - 1) && st >= (z === 3 ? 1 : 0); };
  const johtoFirst = (l) => (B.johto ? [...l.filter((x) => x > 151), ...l.filter((x) => x <= 151)] : l);
  const mainPool = (z) => {
    let l = wild.filter((sp) => sp.types.some((t) => B.types.includes(t)) && okStage(sp.id, z));
    if (z === 3) l = l.concat(wild.filter((sp) => sp.types.some((t) => B.types.includes(t)) && stageOf(sp.id) === 0 && !nextEvo(sp.id) && bstOf(sp) >= 420));
    return johtoFirst(shuffle(l.map((sp) => sp.id))).slice(0, 14);
  };
  const residentPool = (z) => shuffle(wild.filter((sp) => B.residents.includes(rootOf(sp.id)) && okStage(sp.id, z)).map((sp) => sp.id)).slice(0, 6);
  const latePool = (z) => johtoFirst(shuffle(wild.filter((sp) => sp.types.some((t) => (B.late || []).includes(t)) && okStage(sp.id, z)).map((sp) => sp.id))).slice(0, 6);
  const POOLS = [1, 2, 3].map((z) => ({ main: mainPool(z), res: residentPool(z), late: latePool(z) }));
  const ZONE_POOLS = POOLS.map((p) => [...new Set([...p.main, ...p.res])]);
  const SPECIALS = (B.specials || []).filter(known);
  const ids = new Set([speciesId, ...ZONE_POOLS.flat(), ...POOLS.flatMap((p) => p.late), ...SPECIALS, ...B.guardians.flat(), ...B.totems.flat(), ...B.summoners.flat(), ...B.legendaries].filter(known));
  for (let e = nextEvo(speciesId); e; e = nextEvo(e)) ids.add(e);
  await preload([...ids]);

  const kit = kitFor(startSpecies, BY_ID);
  const ptype = kit.type || mainType(startSpecies);
  const lab = bonus || { hp: 0, dmg: 0, spd: 0 };
  const hard = difficulty === 'hard' ? 1.7 : difficulty === 'nightmare' ? 2.6 : 1;

  root.innerHTML = `
  <div class="r3">
    <canvas class="r3-canvas"></canvas>
    <div class="r3-labels"></div>
    <div class="r3-hud">
      <div class="r3-me">
        <div class="r3-face"><img src="${portrait(speciesId)}" alt=""><span class="r3-lv">N. <b>1</b></span></div>
        <div class="r3-me-tx"><div><b class="r3-name"></b><i class="r3-type"></i></div><div class="r3-evo"></div><div class="r3-relics"><i></i><i></i><i></i></div></div>
      </div>
      <div class="r3-top">
        <div class="r3-top-l"><b>${B.name}</b><span><span class="r3-zdots"></span>Zone <span class="r3-zone">1</span>/3 <em class="r3-diff">${difficulty === 'hard' ? 'DIFFICILE' : difficulty === 'nightmare' ? 'CAUCHEMAR' : mode === 'endless' ? 'SURVIE' : 'NORMAL'}</em></span></div>
        <div class="r3-timer"><img src="${itemImg('poke-ball')}" alt=""><b>10:00</b></div>
        <div class="r3-top-r"><b class="r3-elapsed">0:00.0</b><span class="r3-recordline"></span></div>
        <div class="r3-under"><span><img src="./assets/ui/icons/coin.png" alt=""><b class="r3-money">0</b> ₽</span><span><img src="${itemImg('poke-ball')}" alt=""><b class="r3-kos">0</b></span><span><img src="${itemImg('great-ball')}" alt=""><b class="r3-balls">0</b></span></div>
      </div>
      <div class="r3-map"><canvas width="220" height="220"></canvas><span class="r3-gold"><img src="${itemImg('poke-ball')}" alt=""><b>0</b></span></div>
      <div class="r3-season"><div class="r3-season-h"><b>SAISON 3</b><span>Hors du top 50</span></div><div class="r3-season-b"><img src="${portrait(speciesId)}" alt=""><span><small>TON RECORD DE LA SAISON</small><b class="r3-best"></b></span><span class="r3-left"><small>ENCORE</small><b></b><small>K.O.</small></span></div></div>
      <div class="r3-boss" hidden><b></b><div class="r3-bar"><i></i></div></div>
      <div class="r3-banner" hidden><small></small><b></b></div>
      <div class="r3-prompt" hidden><kbd>E</kbd> ici pour réveiller le gardien de la zone. Bats-le pour ouvrir le portail vers la suivante.</div>
      <div class="r3-slots">
        <div class="r3-vits"><i></i><i></i><i></i></div>
        <div class="r3-moves"></div>
        <div class="r3-ult" title="Ultimate (R)"><small class="r3-ult-name"></small><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" class="bg"/><circle cx="32" cy="32" r="29" class="fg" pathLength="100"/></svg><img src="" alt=""><kbd>R</kbd></div>
        <div class="r3-c" title="Encens (C)"><span class="r3-pips"><i></i><i></i><i></i></span><img src="${itemImg('moon-stone')}" alt=""><kbd>C</kbd></div>
      </div>
      <div class="r3-hint">ZQSD / WASD bouger · Souris caméra · Espace sauter · Maj glisser · R Ultimate · E ouvrir · Échap pause</div>
      <div class="r3-touch"><button class="r3-tbtn r3-tjump">⤒</button><button class="r3-tbtn r3-tult">R</button><button class="r3-tbtn r3-tpause">II</button></div>
    </div>
    <div class="r3-joy" hidden><i></i></div>
    <div class="r3-modal" hidden></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const canvas = $('.r3-canvas');
  const labels = $('.r3-labels');

  // ---- three.js ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
  const shared = { uTime: { value: 0 } };
  // co-op teammates share the room's map seed, so everyone walks the same valley
  const world = buildWorld(scene, { seed: coop ? 3 + (coop.seed % 1000) : 3 + Math.floor(Math.random() * 1000), shared, biome: B });
  const gh = (x, z) => world.height(x, z);
  let camGround = gh(0, 6);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0x7af0ff, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // ---- state ----
  const P = {
    id: speciesId, x: 0, z: 6, y: 0, vy: 0, dir: 0, moving: false, hurt: 0, lv: 1, xp: 0, next: 13,
    hp: 0, maxHp: 0, armor: 0, speed: 0, regen: 0, pick: 6, ult: 0, dash: 0, dashCd: 0, incense: 3, incenseT: 0,
  };
  const attacks = [{ ...kit.attack, type: ptype, lv: 1, t: 0.5 }];
  const vitamins = [];
  const relics = [];
  const stats = { damage: 0, money: 0, kills: 0, streak: 0, bestStreak: 0, streakT: 0 };
  const enemies = [];
  const fx = [];
  const drops = [];
  const balls = [];
  let time = 0;
  let zone = 1;
  let guardian = null;
  let guardianSpawned = false;
  let sanctuary = false;
  let legendaryDown = false;
  let alphaSpawned = 0;
  let alphas = 0;
  let summonT = 40;
  let stageTime = 0;
  let cardsDrawn = 0;
  let wantE = false;
  let bossAI = null;
  const mateMons = new Map();
  // Co-op: the host's game is the reference for the hordes; the others see its enemies, their hits are sent to
  // it, and every K.O. drops loot for everyone.
  const coopHost = !coop || coop.host === coop.you;
  let uidN = 0; const pendingKills = []; const pendingHits = []; const pendingFx = []; const ghostShots = []; let lastSnapZone = 1;
  const link = coop ? coopLink(coop.code, () => ({ x: P.x, z: P.z, y: P.y, dir: P.dir, hp: Math.round(P.hp), lv: P.lv, id: P.id, zone, dash: P.dash > 0, yaw: Math.round(yaw * 100) / 100, maxHp: Math.round(P.maxHp) }), {
    outgoing: () => coopHost
      ? { snap: { z: zone, st: Math.round(stageTime), e: enemies.slice(0, 160).map((e) => [e.uid, e.id, Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, Math.max(0, Math.round(e.hp)), Math.round(e.maxHp), (e.boss ? 1 : 0) | (e.alpha ? 2 : 0) | (e.elite ? 4 : 0) | (e.static ? 8 : 0) | (e.hidden ? 16 : 0) | (e.float ? 32 : 0)]) }, kills: pendingKills.splice(0), fx: pendingFx.splice(0) }
      : { hits: pendingHits.splice(0) },
    incoming: (r) => {
      for (const ev of r.events || []) {
        if (ev[0] === 'hit' && coopHost) { const e = enemies.find((x) => x.uid === ev[1]); if (e && !over) { e.hp -= ev[2]; e.flash = 0.12; tag(e.x, 1.8 * (e.boss ? 2 : 1), e.z, String(Math.round(ev[2])), 'mate'); if (e.hp <= 0) kill(e); } }
        if (ev[0] === 'fx' && !coopHost && !over) guestFx(ev.slice(1), r.you);
        if (ev[0] === 'kill' && !coopHost && !over) { const [, x, z, v, coin] = ev; drop(x, z, 'candy', v); if (coin) drop(x + 0.6, z, 'coin', coin); stats.kills++; }
      }
      if (!coopHost && r.snap && !over) applySnap(r.snap);
    },
  }) : null;
  // On a teammate's game: the boss's warnings and shots are drawn, and what was aimed at this trainer lands here.
  function guestFx(f, me) {
    const [kind, ...a] = f;
    if (kind === 'ring') groundRing(a[0], a[1], a[2], a[3], a[4]);
    else if (kind === 'shot') { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(a[6] || '#ff6a5a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(a[4] * 1.6); scene.add(sp); ghostShots.push({ sp, x: a[0], z: a[1], vx: Math.cos(a[2]) * a[3], vz: Math.sin(a[2]) * a[3], life: a[5] }); }
    else if (kind === 'wave') { const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring); ghostShots.push({ ring, x: a[0], z: a[1], r: a[2], life: 2 }); }
    else if (a[0] === me) {
      if (kind === 'hurt') hurtPlayer(a[1]);
      if (kind === 'target') { tag(P.x, 3, P.z, 'Ciblé !', 'weak'); }
      if (kind === 'sleep') { P.stun = Math.max(P.stun || 0, a[1]); tag(P.x, 2.6, P.z, 'Zzz', 'weak'); }
      if (kind === 'pull') { P.pullFx = { x: a[1], z: a[2], speed: a[3], t: a[4] }; }
      if (kind === 'push') { P.x += a[1]; P.z += a[2]; collide(world, P, 0.6); }
      if (kind === 'pullTo') { P.x = a[1]; P.z = a[2]; collide(world, P, 0.6); }
      if (kind === 'heal') { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * a[1]); tag(P.x, 2.4, P.z, `+${Math.round(P.maxHp * a[1])}`, 'heal'); }
    }
  }
  function applySnap(snap) {
    if (snap.z > zone && !sanctuary) { zone = snap.z; world.setLook(B.zones[zone - 2]); banner(`${B.name} · Zone ${zone}/3`, 'Ton équipe passe à la zone suivante !'); }
    stageTime = snap.st;
    const seen = new Set();
    for (const [uid, id, x, z, hp, max, fl] of snap.e) {
      seen.add(uid);
      let e = enemies.find((o) => o.uid === uid);
      if (!e) {
        const sp = BY_ID.get(id); if (!sp) continue;
        const boss = !!(fl & 1); const m = new Mon(scene, id, boss ? 3.4 : fl & 2 ? 3.2 : fl & 4 ? 2.2 : 1.6);
        if (fl & 2) m.mat.color.setRGB(1.15, 1.02, 0.7); if (fl & 4) m.mat.color.setRGB(1.25, 0.85, 0.85);
        const zi = Math.min(4, zone) - 1;
        e = { uid, remote: true, id, m, x, z, tx: x, tz: z, hp, maxHp: max, r: boss ? 2.2 : 0.9, boss, alpha: !!(fl & 2), elite: !!(fl & 4), static: !!(fl & 8), types: sp.types, flash: 0, dir: 0, wob: Math.random() * 5, burn: 0, kb: 0,
          dmg: (fl & 8) ? 0 : (5 + sp.stats.atk / 16 + sp.stats.spa / 32) * (1 + 0.13 * snap.st / 60) * DMG_ZONE[zi] * (boss ? 1.4 : 1) };
        enemies.push(e);
      }
      e.tx = x; e.tz = z; e.maxHp = max; if (hp < e.hp || !e.hitAt || time - e.hitAt > 0.6) e.hp = hp; e.hidden = !!(fl & 16); e.float = !!(fl & 32); e.m.sprite.visible = !e.hidden;
    }
    for (const e of [...enemies]) if (e.remote && !seen.has(e.uid)) { enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); }
    const boss = enemies.find((e) => e.remote && e.boss);
    $('.r3-boss').hidden = !boss;
    if (boss) { $('.r3-boss b').textContent = BY_ID.get(boss.id).name; $('.r3-boss .r3-bar i').style.width = `${(boss.hp / boss.maxHp) * 100}%`; }
  }
  const eShots = [];
  const tierN = TIER[difficulty] ?? 0;
  let credits = 0;
  let cards = [];
  let timeline = [];
  let finalSwarm = false;
  let finalAt = 0;
  let altar = null;
  let portal = null;
  let hordeWeight = 1;
  let spawnAcc = 0;
  let paused = false;
  let over = false;
  let yaw = 0;
  let camDist = 14;
  let shake = 0;
  let evolving = 0;
  const seen = new Set([speciesId]);

  const vit = (id) => vitamins.find((v) => v.id === id);
  const vitVal = (id) => { const v = vit(id); return v ? (v.total ?? v.lv * v.mult) * VITAMINS.find((x) => x.id === id).per : 0; };
  const has = (id) => relics.some((r) => r.id === id);

  function applyStats(heal) {
    const s = BY_ID.get(P.id).stats;
    const old = P.maxHp;
    P.maxHp = Math.round((60 + s.hp * 1.2) * (1 + vitVal('hp-up') + lab.hp * 0.05));
    P.armor = Math.round(6 * s.def / 55 + 3 * s.spd / 55) + (kit.passive?.name === 'Brume de chaleur' ? -10 : 0) + vitVal('iron');
    P.speed = (6 + s.spe * 0.012) * (1 + vitVal('carbos') + lab.spd * 0.03) * (ptype === 'normal' ? 1.1 : 1);
    P.regen = 0.5 + vitVal('super-potion') + (has('leftovers') ? 1 : 0);
    P.pick = 6 + vitVal('magnet') + (has('soft-sand') ? 2 : 0);
    P.power = (1 + Math.max(0, Math.max(s.atk, s.spa) - 84) / 280) * (1 + lab.dmg * 0.05 + (has('silk-scarf') ? 0.15 : 0));
    P.hp = heal ? P.maxHp : Math.min(P.maxHp, P.hp + Math.max(0, P.maxHp - old));
  }
  applyStats(true);

  // ---- input ----
  const keys = new Set();
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if (k === 'escape' || k === 'p') { e.preventDefault(); togglePause(); return; }
      if (paused) return;
      if (k === 'r') ultimate();
      if (k === ' ') { e.preventDefault(); jump(); }
      if (k === 'shift') dash();
      if (k === 'e') { openNearBall(); wantE = true; }
      if (k === 'c') incense();
      keys.add(k);
    } else keys.delete(k);
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  let drag = null;
  const joy = { on: false, id: -1, x: 0, y: 0, dx: 0, dy: 0 };
  const touchy = matchMedia('(pointer: coarse)').matches;
  canvas.addEventListener('pointerdown', (e) => {
    if (touchy && e.clientX < innerWidth * 0.5 && !joy.on) {
      Object.assign(joy, { on: true, id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
      const el = $('.r3-joy');
      el.hidden = false;
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    } else drag = { id: e.pointerId, x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (joy.on && e.pointerId === joy.id) {
      let dx = e.clientX - joy.x;
      let dy = e.clientY - joy.y;
      const d = Math.hypot(dx, dy);
      if (d > 50) { dx *= 50 / d; dy *= 50 / d; }
      joy.dx = dx / 50; joy.dy = dy / 50;
      $('.r3-joy i').style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (drag && e.pointerId === drag.id) {
      yaw -= (e.clientX - drag.x) * 0.006;
      drag.x = e.clientX;
    }
  });
  const up = (e) => {
    if (joy.on && e.pointerId === joy.id) { joy.on = false; joy.dx = joy.dy = 0; $('.r3-joy').hidden = true; $('.r3-joy i').style.transform = ''; }
    if (drag && e.pointerId === drag.id) drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { camDist = Math.min(26, Math.max(8, camDist + e.deltaY * 0.01)); }, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $('.r3-tjump').onclick = () => jump();
  $('.r3-tult').onclick = () => ultimate();
  $('.r3-tpause').onclick = () => togglePause();
  $('.r3-ult').onclick = () => ultimate();
  $('.r3-c').onclick = () => incense();

  function jump() { if (P.y <= 0.001) P.vy = 9; }
  function dash() { if (P.dashCd <= 0) { P.dash = 0.25; P.dashCd = 1.6; } }
  function incense() {
    if (P.incense <= 0 || P.incenseT > 0) return;
    P.incense--;
    P.incenseT = 6;
    banner('Encens', 'Tes attaques sont plus rapides pendant 6 s !', 'purple');
  }

  // ---- world objects ----
  function spawnEnemy(id, isBoss = false, kind = '') {
    const s = BY_ID.get(id);
    let x;
    let z;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = isBoss ? 20 : 30 + Math.random() * 10;
      x = P.x + Math.cos(a) * d;
      z = P.z + Math.sin(a) * d;
      const p = { x, z };
      collide(world, p);
      x = p.x; z = p.z;
      if (Math.hypot(x - P.x, z - P.z) > 12) break;
    }
    const tier = TIER[difficulty] ?? 0;
    const eff = stageTime + ZONE_OFFSET[Math.min(2, zone - 1)] * Math.min(1, stageTime / 20);
    const mins = Math.max(0, eff / 60);
    const zi = Math.min(4, zone) - 1;
    const sq = Math.max(0, mins - (zone === 1 ? 1.5 : 0));
    const swarmK = finalSwarm ? 4 ** ((stageTime - finalAt) / 60) : 1;
    const hpMult = (1 + mins * 0.3 + sq * sq * HP_SQ[zi]) * HP_BASE[zi] * TIER_HP[tier] * swarmK;
    const early = 1.35 + 1.05 * Math.max(0, 1 - eff / 480);
    const dmgMult = (1 + mins * 0.13) * DMG_ZONE[zi] * (zone < 2 ? 1 : zone >= 3 ? [1.08, 1.25, 1.5][tier] : [1.04, 1.16, 1.35][tier]) * TIER_DMG[tier] * (finalSwarm ? 2 ** ((stageTime - finalAt) / 60) : 1);
    const bst = s.stats.hp + s.stats.atk + s.stats.def + s.stats.spa + s.stats.spd + s.stats.spe;
    const base = (12 + bst * 0.055) * hpMult;
    const scale = 1;
    const alpha = kind === 'alpha'; const legend = kind === 'legend';
    const role = kind === 'special' ? ROLES[id] || 'roll' : '';
    const elite = kind === 'elite';
    let hp = base * early * hordeWeight;
    if (elite) hp = base * early * 4.5;
    // guardians: (12 + BST·0.055) × the zone curve at 2.5 minutes or later × 0.8 / 0.55 / 0.5 × 70; the legendary
    // uses the zone-3 curve at 7.5 minutes with its own boost, as in the game. Long fights wear them out (see hit()).
    const raw = 12 + bst * 0.055;
    const zn = (z, t) => { const zz = Math.min(4, z) - 1; const q = Math.max(0, t - (z === 1 ? 1.5 : 0)); return (1 + t * 0.3 + q * q * HP_SQ[zz]) * HP_BASE[zz]; };
    if (isBoss) hp = raw * zn(zone, Math.max(2.5, mins)) * [0.8, 0.55, 0.5][Math.min(2, zone - 1)] * 70 * TIER_HP[tier];
    if (legend) hp = raw * zn(3, 7.5) * 0.5 * 1.6 * 1.35 * 2.5 * 70 * TIER_HP[tier];
    if (alpha) hp = base * 14;
    if (kind === 'totem') hp = base * 18;
    if (kind === 'summon') hp = base * 10;
    if (ROLES[id] && BIG_ROLE[id]) hp *= 3;
    const m = new Mon(scene, id, legend ? 4.4 : isBoss ? 3.4 : alpha ? 3.2 : kind === 'totem' ? 3.5 : kind === 'summon' ? 3 : elite ? 2.2 : 1.6);
    if (alpha || kind === 'totem') m.mat.color.setRGB(1.15, 1.02, 0.7);
    if (kind === 'shiny') { hp = base * 10; m.mat.color.setRGB(0.85, 1.25, 1.35); }
    if (elite) m.mat.color.setRGB(1.25, 0.85, 0.85);
    const e = { id, m, x, z, hp, maxHp: hp, spd: (isBoss || legend ? 3.4 : Math.min(6.2, 3 + s.stats.spe / 55)) * Math.min(1.3, 1 + 0.02 * mins + 0.06 * (zone - 1)) * (alpha ? 0.85 : 1), dmg: (5 + s.stats.atk / 16 + s.stats.spa / 32) * (legend ? 1.975 * 2.7 * TIER_DMG[tier] : dmgMult) * (alpha || kind === 'totem' ? 1.3 : elite ? 1.2 : 1), elite, shiny: kind === 'shiny', r: isBoss || legend ? 2.2 : alpha || kind === 'totem' ? 1.6 : 0.9, boss: isBoss || legend, alpha, legend, special: kind === 'special', role, big: !!BIG_ROLE[id], buried: role === 'burrow', mode: role === 'burrow' ? 'buried' : '', modeT: 0, summon: kind === 'summon', act: 2 + Math.random() * 3, rush: 0, flash: 0, kb: 0, kx: 0, kz: 0, burn: 0, dir: 0, wob: Math.random() * 5, types: s.types, hitT: 0, slow: 0 };
    seen.add(id);
    e.uid = ++uidN;
    enemies.push(e);
    return e;
  }

  function spawnBalls(n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 12 + Math.random() * (world.play - 20);
      const p = { x: Math.cos(a) * d, z: Math.sin(a) * d };
      collide(world, p, 1.2);
      const kind = Math.random() < 0.2 ? 'ultra-ball' : 'great-ball';
      const sp = placeModel(scene, 'ball', p.x, gh(p.x, p.z), p.z, 1.3, Math.random() * 6.28);
      balls.push({ x: p.x, z: p.z, sp, kind });
    }
  }
  function spawnBallAt(x, z) {
    const p = { x, z }; collide(world, p, 1.2);
    balls.push({ x: p.x, z: p.z, sp: placeModel(scene, 'ball', p.x, gh(p.x, p.z), p.z, 1.3, Math.random() * 6.28), kind: Math.random() < 0.4 ? 'ultra-ball' : 'great-ball' });
  }
  spawnBalls(12);
  startZoneTimeline();
  if (mode !== 'endless' && coopHost) placeAltar();
  if (BAG.size) setTimeout(() => { if (!over) tag(P.x, 3.2, P.z, `Sac : ${[...BAG].map((k) => ITEM_NAMES[k] || k).join(', ')}`, 'say'); }, 1200);
  if (BAG.has('rare-candy')) setTimeout(() => { if (!over) { P.bonusLv = 1; P.xp += P.next; levelUp(); } }, 1500);
  // test hook: only with ?pbdebug in the address
  if (location.search.includes('pbdebug')) window.__run = { P, enemies, get zone() { return zone; }, get stageTime() { return stageTime; }, get credits() { return credits; }, get cards() { return cards; }, wake: () => wakeGuardian(), fire: (k) => fire(k), fight: (id, leg) => { if (guardian && enemies.includes(guardian)) { enemies.splice(enemies.indexOf(guardian), 1); guardian.m.dispose(); } guardianSpawned = true; guardian = spawnEnemy(id, true, leg ? 'legend' : ''); guardian.x = P.x + 10; guardian.z = P.z; $('.r3-boss').hidden = false; $('.r3-boss b').textContent = BY_ID.get(id).name; startBoss(guardian); }, get boss() { return bossAI && { hp: Math.round(bossAI.e.hp), max: Math.round(bossAI.e.maxHp), dmg: +bossAI.e.dmg.toFixed(1), last: bossAI.last, rage: bossAI.enraged, shots: eShots.length, mech: bossAI.mech?.name, stun: +(P.stun || 0).toFixed(1), minions: enemies.filter((x) => x.static).length }; } };

  function drop(x, z, kind, v) {
    const map = kind === 'candy' ? itemTexture(v > 2 ? 'rare-candy' : 'exp-share') : kind === 'coin' ? itemTexture('amulet-coin') : itemTexture('oran-berry');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.4 }));
    sp.center.set(0.5, 0);
    const s = kind === 'candy' ? (v > 2 ? 0.8 : 0.55) : 0.7;
    sp.scale.set(s, s, 1);
    sp.position.set(x, gh(x, z) + 0.2, z);
    scene.add(sp);
    drops.push({ x, z, kind, v, sp, pull: false, t: Math.random() * 6 });
  }

  // effects: glowing sprites that grow, move and fade
  function spark(x, y, z, color, { size = 0.6, grow = 0, life = 0.4, vx = 0, vy = 0, vz = 0 } = {}) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(x, gh(x, z) + y, z);
    sp.scale.setScalar(size);
    scene.add(sp);
    fx.push({ sp, life, max: life, grow, vx, vy, vz, size });
  }
  function groundRing(x, z, radius, color, life = 0.5) {
    if (link && coopHost && bossAI) pendingFx.push(['ring', Math.round(x * 10) / 10, Math.round(z * 10) / 10, radius, color, life]);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, gh(x, z) + 0.2, z);
    scene.add(m);
    fx.push({ ring: m, life, max: life, radius });
  }

  // floating damage numbers
  const tags = [];
  function tag(x, y, z, text, cls = '') {
    if (tags.length > 50) tags.shift().el.remove();
    const el = document.createElement('b');
    el.className = `r3-dmg ${cls}`;
    el.textContent = text;
    labels.append(el);
    tags.push({ el, x, y: y + gh(x, z), z, t: 0.8 });
  }

  // ---- combat ----
  function hit(e, dmg, type, push = 0, fromX = P.x, fromZ = P.z) {
    if (!enemies.includes(e) || e.buried || e.hidden) return;
    let k = eff(type, e.types);
    const crit = Math.random() < 0.05 + vitVal('dire-hit');
    let amount = dmg * P.power * PLAYER_ZONE[Math.min(4, zone) - 1] * k * (crit ? 1.75 : 1) * (0.9 + Math.random() * 0.2);
    if (type === ptype && ptype === 'fire') {
      const burning = enemies.filter((o) => o.burn > 0 && Math.hypot(o.x - P.x, o.z - P.z) < 8).length;
      amount *= Math.min(1.24, 1 + burning * 0.04);
    }
    if (type === 'fire' && has('charcoal')) amount *= 1.2;
    if (type === 'water' && has('mystic-water')) amount *= 1.2;
    if (type === 'grass' && has('miracle-seed')) amount *= 1.2;
    if (type === 'electric' && has('magnet')) amount *= 1.2;
    if (bossAI?.mech && e === bossAI.e) amount *= bossAI.mech.hitMul(fromX, fromZ, type);
    if (bossAI && e === bossAI.e && bossAI.fightT > 120) amount *= Math.min(1e9, 2 ** ((bossAI.fightT - 120) / 20));
    amount = Math.max(1, Math.round(amount));
    if (e.remote) { pendingHits.push([e.uid, amount, type]); e.hp -= amount; e.hitAt = time; e.flash = 0.12; stats.damage += amount; tag(e.x, 1.8 * (e.boss ? 2 : 1), e.z, String(amount), crit ? 'crit' : k > 1 ? 'super' : k < 1 ? 'weak' : ''); if (e.hp <= 0) { e.m.sprite.visible = false; e.hidden = true; } return; }
    e.hp -= amount;
    e.flash = 0.12;
    stats.damage += amount;
    if (push && !e.boss) {
      const dx = e.x - fromX;
      const dz = e.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      e.kb = 0.15; e.kx = (dx / d) * push; e.kz = (dz / d) * push;
    }
    tag(e.x, 1.8 * (e.boss ? 2 : 1), e.z, String(amount), crit ? 'crit' : k > 1 ? 'super' : k < 1 ? 'weak' : '');
    if (e.hp <= 0) kill(e);
  }

  function kill(e) {
    if (link && coopHost) pendingKills.push([Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, e.boss ? 30 : 1 + Math.floor(time / 180), e.boss ? 50 : Math.random() < 0.25 ? 1 + Math.floor(Math.random() * 3) : 0]);
    if (bossAI?.mech && e !== bossAI.e) bossAI.mech.onKill(e);
    const i = enemies.indexOf(e);
    if (i < 0) return;
    enemies.splice(i, 1);
    stats.kills++;
    stats.streak++;
    stats.streakT = 2.5;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    P.ult = Math.min(100, P.ult + (e.boss ? 35 : 1.2));
    for (let k = 0; k < 6; k++) spark(e.x, 0.8, e.z, '#ffffff', { size: 0.4, life: 0.35, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 6 });
    drop(e.x, e.z, 'candy', e.boss ? 30 : 1 + Math.floor(time / 180));
    if (Math.random() < 0.25 || e.boss) drop(e.x + 0.6, e.z, 'coin', e.boss ? 50 : 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.02 || e.boss) drop(e.x - 0.6, e.z, 'berry', 0);
    if (e.role === 'spite') spikes(e);
    if (e.shiny) shinyReward(e, 'Pokémon chromatique vaincu !');
    if (e.alpha) { alphas++; P.ult = Math.min(100, P.ult + 20); drop(e.x, e.z, 'candy', 12); for (let k = 0; k < 4; k++) drop(e.x + Math.cos(k) * 1.2, e.z + Math.sin(k) * 1.2, 'coin', 8); spawnBallAt(e.x, e.z); banner('Alpha vaincu !', `${BY_ID.get(e.id).name} laisse une Poké Ball`, 'gold'); $('.r3-boss').hidden = !guardian; }
    e.m.dispose();
    if (e.legend) { legendaryDown = true; guardian = null; $('.r3-boss').hidden = true; banner(`${BY_ID.get(e.id).name} est vaincu !`, B.sanctuary.name, 'gold'); setTimeout(() => finish(true), 1600); return; }
    if (e === guardian) guardianDown();
  }

  // a chromatic Pokémon is worth a level, a Poké Ball and a pile of coins
  let masterUsed = false;
  function shinyReward(e, title) {
    stats.shinies = (stats.shinies || 0) + 1;
    drop(e.x, e.z, 'candy', Math.round(P.next * 0.9)); for (let k = 0; k < 5; k++) drop(e.x + Math.cos(k * 1.3) * 1.4, e.z + Math.sin(k * 1.3) * 1.4, 'coin', 10);
    spawnBallAt(e.x, e.z); banner(title, `${BY_ID.get(e.id).name} chromatique laisse une Poké Ball`, 'gold');
  }
  function guardianDown() {
    guardian = null;
    $('.r3-boss').hidden = true;
    if (mode === 'endless') { banner('Gardien vaincu !', 'Les hordes continuent…'); guardianSpawned = false; zone++; startZoneTimeline(); return; }
    banner('Gardien vaincu !', zone >= 3 ? 'Le portail du sanctuaire est ouvert' : 'Le portail vers la zone suivante est ouvert', 'gold');
    finalSwarm = false;
    const gx = altar ? altar.x : P.x + 6; const gz = altar ? altar.z : P.z;
    spawnBallAt(gx + 3, gz + 2);
    openPortal(gx, gz);
  }

  // After the third guardian, the sanctuary: its own sky, and the map's legendary as the last boss.
  function enterSanctuary() {
    sanctuary = true;
    for (const e of [...enemies]) if (!e.boss) { enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); }
    world.setLook(B.sanctuary);
    const id = B.legendaries.find(known) || 151;
    banner(B.sanctuary.name, `${B.sanctuary.heart || 'Le légendaire se réveille'}…`, 'purple');
    setTimeout(() => {
      if (over) return;
      guardian = spawnEnemy(id, true, 'legend');
      startBoss(guardian);
      $('.r3-boss').hidden = false;
      $('.r3-boss b').textContent = `Légendaire · ${BY_ID.get(id).name}`;
      banner(`${BY_ID.get(id).name} apparaît !`, 'Le légendaire du sanctuaire', 'red');
    }, 2600);
  }

  function nearest(range, from = P) {
    let best = null;
    let bd = range * range;
    for (const e of enemies) {
      if (e.buried) continue;
      const d = (e.x - from.x) ** 2 + (e.z - from.z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  const shots = [];
  function fireAttack(a) {
    const area = 1 + vitVal('stardust');
    const lvMul = a.boost || 1;
    const color = a.type === ptype ? kit.color : ({ ground: '#c8a060', psychic: '#ff7ae0', electric: '#ffe35a', flying: '#cfe4ff' })[a.type] || '#ffffff';
    if (a.kind === 'cone') {
      const target = nearest(a.range * area + 2);
      const ang = target ? Math.atan2(target.z - P.z, target.x - P.x) : Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
      const range = a.range * area;
      for (let k = 0; k < 14; k++) {
        const aa = ang + (Math.random() - 0.5) * 0.7;
        const sp = 9 + Math.random() * 5;
        spark(P.x, 1 + P.y, P.z, k % 3 ? '#ff8a2a' : '#ffd23a', { size: 0.9, grow: 1.6, life: range / sp, vx: Math.cos(aa) * sp, vy: Math.random() * 0.8, vz: Math.sin(aa) * sp });
      }
      // a stream: it keeps burning along the cone for a moment, hitting each time (the game's "dégâts par coup")
      const tick = () => {
        for (const e of [...enemies]) {
          const dx = e.x - P.x;
          const dz = e.z - P.z;
          const d = Math.hypot(dx, dz);
          if (d > range + e.r) continue;
          let da = Math.atan2(dz, dx) - ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < 0.4 + e.r / Math.max(1, d)) {
            hit(e, a.dmg * lvMul, a.type, 1);
            if (Math.random() < (a.burn || 0) + (a.lv - 1) * 0.05) e.burn = 3;
          }
        }
      };
      tick();
      for (const ms of [300]) setTimeout(() => { if (!over && !paused) tick(); }, ms);
    } else if (a.kind === 'shot') {
      const count = 1 + Math.floor(vitVal('pp-up')) + Math.floor((a.lv - 1) / 2);
      const target = nearest(a.range * area + 4);
      if (!target) return;
      const base = Math.atan2(target.z - P.z, target.x - P.x);
      for (let k = 0; k < count; k++) {
        const ang = base + (k - (count - 1) / 2) * 0.16;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.scale.setScalar(0.9);
        sp.position.set(P.x, gh(P.x, P.z) + 1 + P.y, P.z);
        scene.add(sp);
        shots.push({ sp, x: P.x, z: P.z, vx: Math.cos(ang) * 22, vz: Math.sin(ang) * 22, life: 0.9, dmg: a.dmg * lvMul, type: a.type, pierce: a.lv >= 3 ? 2 : 1, hits: new Set() });
      }
    } else if (a.kind === 'whip') {
      const target = nearest(a.range * area + 1);
      const ang = target ? Math.atan2(target.z - P.z, target.x - P.x) : 0;
      for (let k = -4; k <= 4; k++) {
        const aa = ang + k * 0.2;
        spark(P.x + Math.cos(aa) * a.range * area * 0.8, 1, P.z + Math.sin(aa) * a.range * area * 0.8, '#7ae06a', { size: 0.8, life: 0.25 });
      }
      for (const e of [...enemies]) {
        const d = Math.hypot(e.x - P.x, e.z - P.z);
        if (d > a.range * area + e.r) continue;
        let da = Math.atan2(e.z - P.z, e.x - P.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.95) { hit(e, a.dmg * lvMul, a.type, 3); P.hp = Math.min(P.maxHp, P.hp + 0.5); }
      }
    } else if (a.kind === 'chain') {
      let from = P;
      const done = new Set();
      for (let k = 0; k < 3 + Math.floor(a.lv / 2); k++) {
        let best = null;
        let bd = (k ? 6 : a.range * area) ** 2;
        for (const e of enemies) {
          if (done.has(e)) continue;
          const d = (e.x - from.x) ** 2 + (e.z - from.z) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        done.add(best);
        for (let s = 0; s <= 6; s++) {
          const t = s / 6;
          spark(from.x + (best.x - from.x) * t + (Math.random() - 0.5) * 0.4, 1 + Math.random() * 0.4, from.z + (best.z - from.z) * t + (Math.random() - 0.5) * 0.4, '#ffe35a', { size: 0.5, life: 0.18 });
        }
        hit(best, a.dmg * lvMul * (k ? 0.7 : 1), a.type);
        from = best;
      }
    } else if (a.kind === 'pulse') {
      const r = (4 + a.lv * 0.6) * area;
      groundRing(P.x, P.z, r, 0xff7ae0, 0.4);
      for (const e of [...enemies]) if (Math.hypot(e.x - P.x, e.z - P.z) < r + e.r) hit(e, a.dmg * lvMul, a.type, 5);
    } else if (a.kind === 'bolt') {
      for (let k = 0; k < Math.min(1 + Math.ceil(a.lv / 2), enemies.length); k++) {
        const e = enemies[Math.floor(Math.random() * enemies.length)];
        if (!e || Math.hypot(e.x - P.x, e.z - P.z) > 18) continue;
        for (let s = 0; s < 8; s++) spark(e.x + (Math.random() - 0.5) * 0.5, s * 1.2, e.z + (Math.random() - 0.5) * 0.5, '#fff27a', { size: 0.7, life: 0.2 });
        hit(e, a.dmg * lvMul, a.type);
      }
    }
  }

  function ultimate() {
    if (paused || over || P.ult < 100) return;
    P.ult = 0;
    shake = 0.5;
    const color = kit.color;
    const c = new THREE.Color(color).getHex();
    groundRing(P.x, P.z, 14, c, 0.7);
    setTimeout(() => !over && groundRing(P.x, P.z, 18, c, 0.8), 250);
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      spark(P.x, 0.6, P.z, k % 2 ? color : '#ffd23a', { size: 1.4, grow: 1.2, life: 0.7, vx: Math.cos(a) * 20, vz: Math.sin(a) * 20 });
    }
    banner(kit.ult.name, 'Ultimate !');
    for (const e of [...enemies]) {
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (d < 18) { hit(e, (30 + P.lv * 4) * (e.boss ? 0.6 : 2.2), ptype, 6); if (ptype === 'fire') e.burn = 4; }
    }
  }

  // ---- Poké Balls ----
  function openNearBall() {
    const b = balls.find((o) => Math.hypot(o.x - P.x, o.z - P.z) < 2.6);
    if (!b) return;
    balls.splice(balls.indexOf(b), 1);
    scene.remove(b.sp);
    for (let k = 0; k < 16; k++) spark(b.x, 0.8, b.z, '#fff27a', { size: 0.6, life: 0.5, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 8 });
    const options = BALL_ITEMS.filter((it) => !has(it.id));
    if (relics.length >= 3 || !options.length) {
      P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3);
      for (let k = 0; k < 8; k++) drop(b.x + (Math.random() - 0.5) * 3, b.z + (Math.random() - 0.5) * 3, 'coin', 2);
      banner('Poké Ball', 'Des Pokédollars et des PV !');
      return;
    }
    const it = options[Math.floor(Math.random() * options.length)];
    relics.push(it);
    applyStats(false);
    banner(it.name, it.desc, 'gold');
  }

  // ---- level-ups ----
  function choices() {
    const list = [];
    for (const a of attacks) if (a.lv < 8) list.push({ kind: 'atk-up', a });
    if (attacks.length < 3) for (const a of EXTRA_ATTACKS) if (!attacks.some((x) => x.id === a.id)) list.push({ kind: 'atk-new', a });
    for (const v of vitamins) if (v.lv < 10) list.push({ kind: 'vit-up', v: VITAMINS.find((x) => x.id === v.id) });
    if (vitamins.length < 3) for (const v of VITAMINS) if (!vit(v.id)) list.push({ kind: 'vit-new', v });
    return list.sort(() => Math.random() - 0.5).slice(0, 3).map((c) => ({ ...c, rarity: c.kind === 'atk-new' ? RARITIES[0] : rollRarity(P.lv, zone, 0) }));
  }

  function levelUp() {
    P.lv++;
    P.xp -= P.next;
    P.next = Math.round(10 + P.lv * 2.6 + P.lv ** 1.5);
    const evo = nextEvo(P.id);
    const stage = P.id === speciesId ? 0 : 1;
    if (evo && P.lv >= EVOLVE_AT[stage]) evolve(evo);
    const opts = choices();
    if (!opts.length) return;
    paused = true;
    const m = $('.r3-modal');
    m.hidden = false;
    m.dataset.kind = 'level';
    m.innerHTML = `<div class="r3-lvl">
      <div class="r3-lvl-h"><b>Niveau ${P.lv} !</b><small>Choisis une amélioration</small></div>
      <div class="r3-cards">${opts.map((o, i) => {
        const isAtk = o.kind.startsWith('atk');
        const name = isAtk ? o.a.name : o.v.name;
        const lvNow = isAtk ? (o.kind === 'atk-up' ? o.a.lv : 0) : (vit(o.v.id)?.lv || 0);
        const desc = isAtk ? (o.kind === 'atk-up' ? `Dégâts par coup ${(o.a.dmg * (o.a.boost || 1)).toFixed(1)} → ${(o.a.dmg * ((o.a.boost || 1) + 0.125 * o.rarity.mult)).toFixed(1)} · +${Math.round(25 * o.rarity.mult)} % de proba. d’état · +${Math.round(20 * o.rarity.mult)} % de durée` : o.a.desc) : `${o.v.stat} +${Math.round(o.v.per * o.rarity.mult * (o.v.per < 1 ? 100 : 1))}${o.v.per < 1 ? ' %' : ''}`;
        const icon = isAtk ? `<span class="r3-ty ty-${o.a.type}">${(TYPE_FR[o.a.type] || '').slice(0, 1)}</span>` : `<img class="pix" src="${itemImg(o.v.icon)}" alt="">`;
        return `<button class="r3-card" style="--rc:${o.rarity.color}" data-i="${i}"><em>${o.rarity.name}</em>${icon}<b>${name}</b><small>${isAtk ? 'Attaque' : 'Vitamine'} · ${lvNow ? `N. ${lvNow} → ${lvNow + 1}` : 'Nouveau'}</small><span>${desc}</span></button>`;
      }).join('')}</div></div>`;
    m.querySelectorAll('.r3-card').forEach((b) => b.addEventListener('click', () => {
      const o = opts[+b.dataset.i];
      if (o.kind === 'atk-up') { o.a.lv++; o.a.boost = (o.a.boost || 1) + 0.125 * o.rarity.mult; }
      if (o.kind === 'atk-new') attacks.push({ ...o.a, lv: 1, t: 0.3 });
      if (o.kind === 'vit-up') { const v = vit(o.v.id); v.lv++; v.total = (v.total ?? v.mult) + o.rarity.mult; }
      if (o.kind === 'vit-new') vitamins.push({ id: o.v.id, lv: 1, mult: o.rarity.mult, total: o.rarity.mult });
      applyStats(false);
      m.hidden = true;
      m.dataset.kind = '';
      paused = false;
      if (P.bonusLv > 0) { P.bonusLv--; P.xp += P.next; }
      if (P.xp >= P.next) levelUp();
    }));
  }

  function evolve(to) {
    const from = BY_ID.get(P.id).name;
    P.id = to;
    player.setSpecies(to);
    evolving = 1.2;
    seen.add(to);
    applyStats(true);
    $('.r3-face img').src = portrait(to);
    banner(`${from} évolue en ${BY_ID.get(to).name} !`, 'Évolution', 'gold');
  }

  let bannerTimer = 0;
  function banner(title, sub = '', tone = '') {
    const b = $('.r3-banner');
    b.className = `r3-banner ${tone}`;
    b.querySelector('b').textContent = title;
    b.querySelector('small').textContent = sub;
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.hidden = true; }, 2600);
  }

  // ---- pause and end ----
  function statRows(rows) { return rows.map(([k, v, good]) => `<li><span>${k}</span><b class="${good ? 'good' : ''}">${v}</b></li>`).join(''); }
  function pct(v) { return `${Math.round(v * 100)}%`; }

  function togglePause(force) {
    if (over) return;
    const m = $('.r3-modal');
    if (paused && m.dataset.kind !== 'pause') return;
    paused = force ?? !paused;
    if (!paused) { m.hidden = true; m.dataset.kind = ''; return; }
    m.dataset.kind = 'pause';
    m.hidden = false;
    const s = BY_ID.get(P.id);
    const dps = time > 0 ? Math.round(stats.damage / time) : 0;
    m.innerHTML = `<div class="r3-pause">
      <header class="r3-ph">
        <div class="r3-ph-face"><img src="${portrait(P.id)}" alt=""><span>N. ${P.lv}</span></div>
        <div class="r3-ph-me"><small><em>PAUSE</em> ${B.name.toUpperCase()} · ZONE ${zone} · ${difficulty === 'normal' ? 'NORMAL' : difficulty.toUpperCase()}</small><b>${s.name} <i class="ty ty-${s.types[0]}">${TYPE_FR[s.types[0]]}</i></b>
          <div class="r3-ph-bar"><span>PV</span><i><u style="width:${(P.hp / P.maxHp) * 100}%"></u></i><em>${Math.ceil(P.hp)}/${P.maxHp}</em></div>
          <div class="r3-ph-bar xp"><span>EXP</span><i><u style="width:${(P.xp / P.next) * 100}%"></u></i><em>${Math.floor(P.xp)}/${P.next}</em></div></div>
        <div class="r3-ph-stats">${[[clock(time), 'TEMPS'], [stats.kills, 'K.O.'], [stats.damage, 'DÉGÂTS'], [dps, 'DÉGÂTS/S'], [`${stats.money} ₽`, 'ARGENT'], [`×${stats.bestStreak}`, 'MEILLEURE SÉRIE']].map(([v, k]) => `<span><b>${v}</b><small>${k}</small></span>`).join('')}</div>
      </header>
      <div class="r3-pcols">
        <section class="r3-pc blue"><h3>Attaques <small>${attacks.length} appris</small></h3><div class="r3-pc-body">
          <article class="talent"><small>TALENT</small><b>${kit.passive.name}</b><p>${kit.passive.desc}</p></article>
          ${attacks.map((a) => `<article class="atk"><span class="r3-ty ty-${a.type}">${(TYPE_FR[a.type] || '').slice(0, 1)}</span><div><b>${a.name} <em>N. ${a.lv}</em></b><small>${TYPE_FR[a.type] || ''} · ${a.cls} · ${a.shape}</small><p>${a.desc}</p></div></article>`).join('')}
          <article class="atk"><span class="r3-ty ty-${ptype}">R</span><div><b>${kit.ult.name} <em>Ultimate R</em></b><small>${TYPE_FR[ptype]} · Spécial</small><p>${kit.ult.desc}</p></div></article>
        </div></section>
        <section class="r3-pc orange"><h3>Objets <small>${relics.length} au total</small></h3><div class="r3-pc-body">
          ${relics.length ? relics.map((r) => `<article class="obj"><img class="pix" src="${itemImg(r.id)}" alt=""><div><b>${r.name}</b><p>${r.desc}</p></div></article>`).join('') : '<p class="r3-empty">Tu ne portes pas encore d’objets. Ouvre-les dans les Poké Balls de la carte.</p>'}
          <h4>VITAMINES · ${vitamins.length}/3</h4>
          ${vitamins.length ? vitamins.map((v) => { const d = VITAMINS.find((x) => x.id === v.id); return `<article class="obj"><img class="pix" src="${itemImg(d.icon)}" alt=""><div><b>${d.name} <em>N. ${v.lv}</em></b><p>${d.stat}</p></div></article>`; }).join('') : '<p>Les vitamines se choisissent à la montée de niveau.</p>'}
        </div></section>
        <section class="r3-pc purple"><h3>Statistiques <small>Vert : meilleur que la base</small></h3><div class="r3-pc-body two">
          <div><h4>ATTAQUE</h4><ul>${statRows([['Dégâts', pct(P.power), P.power > 1], ['Vit. d’attaque', pct(1 + vitVal('x-speed') + (has('quick-claw') ? 0.12 : 0)), vit('x-speed')], ['Projectiles', Math.floor(vitVal('pp-up')), vit('pp-up')], ['Zone', pct(1 + vitVal('stardust')), vit('stardust')], ['Proba. de critique', pct(0.05 + vitVal('dire-hit')), vit('dire-hit')], ['Dégâts critiques', '175%']])}</ul></div>
          <div><h4>DÉFENSE</h4><ul>${statRows([['PV max.', P.maxHp, vit('hp-up')], ['Régénération/s', P.regen.toFixed(1), P.regen > 0.5], ['Armure', P.armor.toFixed(0), P.armor > 0]])}</ul><h4>UTILITAIRE</h4><ul>${statRows([['Vitesse', pct(P.speed / (6 + s.stats.spe * 0.012)), vit('carbos')], ['Portée ramassage', P.pick.toFixed(0), P.pick > 6], ['Expérience', pct(1 + vitVal('lucky-egg') + (has('exp-share') ? 0.15 : 0)), vit('lucky-egg')], ['Difficulté', pct(hard)]])}</ul></div>
        </div></section>
      </div>
      <p class="r3-keys"><b>Échap</b> continuer · <b>WASD/ZQSD</b> bouger · <b>Souris</b> caméra · <b>Espace</b> sauter · <b>Maj</b> glisser · <b>R</b> Ultimate · <b>E</b> ouvrir · <b>C</b> encens · <b>Molette</b> zoom · <b>P</b> pause</p>
      <div class="r3-pbtns">
        <button class="btn red" data-a="quit">Abandonner</button>
        <button class="btn ghost" data-a="save">Sauvegarder et quitter</button>
        <button class="btn ghost" data-a="restart">Recommencer</button>
        <button class="btn ghost" data-a="stuck">Coincé</button>
        <button class="btn green r3-go" data-a="go">Continuer</button>
      </div>
    </div>`;
    m.querySelector('[data-a="go"]').onclick = () => togglePause(false);
    m.querySelector('[data-a="quit"]').onclick = () => { m.dataset.kind = ''; finish(false, true); };
    m.querySelector('[data-a="save"]').onclick = () => { m.dataset.kind = ''; finish(false, true); };
    m.querySelector('[data-a="restart"]').onclick = () => { cleanup(); onExit(result(false), 'again'); };
    m.querySelector('[data-a="stuck"]').onclick = () => { P.x = 0; P.z = 6; togglePause(false); };
  }

  function result(victory) {
    const dust = Math.round((stats.kills / 4 + P.lv * 3 + time / 10 + (victory ? 80 : 0)) * (difficulty === 'hard' ? 1.75 : difficulty === 'nightmare' ? 2.5 : 1));
    return { victory, time, kills: stats.kills, level: P.lv, species: P.id, start: speciesId, dust, seen: [...seen], mode, difficulty, map: B.id, legendary: legendaryDown, alphas };
  }

  function finish(victory, quit = false) {
    if (over) return;
    over = true;
    paused = true;
    const r = result(victory);
    const m = $('.r3-modal');
    m.hidden = false;
    m.dataset.kind = 'end';
    m.innerHTML = `<div class="r3-end ${victory ? 'win' : ''}">
      <div class="r3-end-h"><img src="${portrait(P.id)}" alt=""><div><small>${B.name.toUpperCase()} · ${mode === 'endless' ? 'SURVIE' : difficulty.toUpperCase()}</small><b>${victory ? 'Carte terminée !' : quit ? 'Partie terminée' : 'Ton Pokémon est K.O.'}</b></div></div>
      <p>${victory ? `Tu as traversé ${B.name} et vaincu le légendaire du sanctuaire. Un nouveau Pokémon rejoint ta Ligue !` : 'Chaque partie te rapporte de la Poussière Étoile : dépense-la au Labo.'}</p>
      <div class="r3-ph-stats">${[[clock(time), 'TEMPS'], [stats.kills, 'K.O.'], [P.lv, 'NIVEAU'], [stats.damage, 'DÉGÂTS'], [`+${r.dust}`, 'POUSSIÈRE']].map(([v, k]) => `<span><b>${v}</b><small>${k}</small></span>`).join('')}</div>
      <div class="r3-pbtns"><button class="btn ghost" data-a="menu">Menu</button><button class="btn red r3-go" data-a="again">Rejouer</button></div>
    </div>`;
    m.querySelector('[data-a="again"]').onclick = () => { cleanup(); onExit(r, 'again'); };
    m.querySelector('[data-a="menu"]').onclick = () => { cleanup(); onExit(r, 'menu'); };
  }

  // ---- HUD ----
  const s0 = BY_ID.get(speciesId);
  function hudStatic() {
    const s = BY_ID.get(P.id);
    $('.r3-name').textContent = s.name;
    const t = $('.r3-type');
    t.textContent = TYPE_FR[s.types[0]];
    t.className = `r3-type ty ty-${s.types[0]}`;
    const evo = nextEvo(P.id);
    const stage = P.id === speciesId ? 0 : 1;
    $('.r3-evo').innerHTML = evo ? `› <img src="${portrait(evo)}" alt=""> N. ${EVOLVE_AT[stage]}` : '';
    $('.r3-relics').innerHTML = [0, 1, 2].map((i) => (relics[i] ? `<i><img class="pix" src="${itemImg(relics[i].id)}" alt="" title="${relics[i].name}"></i>` : '<i></i>')).join('');
    $('.r3-vits').innerHTML = [0, 1, 2].map((i) => { const v = vitamins[i]; const d = v && VITAMINS.find((x) => x.id === v.id); return v ? `<i title="${d.name}"><img class="pix" src="${itemImg(d.icon)}" alt=""><em>${v.lv}</em></i>` : '<i></i>'; }).join('');
    $('.r3-moves').innerHTML = [0, 1, 2].map((i) => { const a = attacks[i]; return a ? `<i class="on" title="${a.name}"><small>${a.name}</small><span class="r3-ty ty-${a.type}">${(TYPE_FR[a.type] || '').slice(0, 1)}</span><em>${a.lv}</em></i>` : '<i></i>'; }).join('') + `<i class="lock"><img src="./assets/ui/icons/lock.png" alt=""></i>`;
    $('.r3-ult-name').textContent = kit.ult.name;
    $('.r3-ult img').src = portrait(P.id);
  }
  let lastSig = '';
  const best = profile?.best?.kills || 0;
  $('.r3-best').textContent = `${best} K.O.`;
  $('.r3-recordline').textContent = profile?.best?.classic ? `Record ${clock(profile.best.classic)}` : 'Pas de record sur cette carte';

  const mapCanvas = $('.r3-map canvas');
  const mctx = mapCanvas.getContext('2d');
  function drawMap() {
    const W = mapCanvas.width;
    const R = W / 2;
    mctx.clearRect(0, 0, W, W);
    mctx.save();
    mctx.beginPath();
    mctx.arc(R, R, R - 4, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#2a2d52';
    mctx.fillRect(0, 0, W, W);
    const sc = R / 45;
    mctx.translate(R, R);
    mctx.rotate(yaw);
    const T = (x, z) => [(x - P.x) * sc, (z - P.z) * sc];
    { const W2 = world.play * 2 + 24; const [x0, y0] = T(-W2 / 2, -W2 / 2); mctx.globalAlpha = 0.9; mctx.drawImage(world.mapCanvas, x0, y0, W2 * sc, W2 * sc); mctx.globalAlpha = 1; }
    mctx.strokeStyle = '#ff5a5f88';
    mctx.lineWidth = 3;
    mctx.beginPath();
    { const [x0, y0] = T(-world.play, -world.play); mctx.strokeRect(x0, y0, world.play * 2 * sc, world.play * 2 * sc); }
    for (const b of balls) { const [x, y] = T(b.x, b.z); mctx.fillStyle = '#ff5a5f'; mctx.beginPath(); mctx.arc(x, y, 5, 0, 6.3); mctx.fill(); mctx.fillStyle = '#fff'; mctx.fillRect(x - 5, y, 10, 1.5); }
    // the guardian's altar and the portal, pinned to the map edge when far away
    for (const [o, col, label] of [[altar, '#ffd23a', '!'], [portal, '#8ad8ff', '◎']]) {
      if (!o) continue;
      let [x, y] = T(o.x, o.z); const d = Math.hypot(x, y); const lim = R - 14;
      if (d > lim) { x *= lim / d; y *= lim / d; }
      mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x, y, 8, 0, 6.3); mctx.fill();
      mctx.save(); mctx.rotate(-yaw); mctx.fillStyle = '#1a1630'; mctx.font = '900 12px Nunito, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
      const c = Math.cos(-yaw); const sn = Math.sin(-yaw); mctx.fillText(label, x * c - y * sn, x * sn + y * c); mctx.restore();
    }    for (const e of enemies) { const [x, y] = T(e.x, e.z); mctx.fillStyle = e.boss ? '#ffd23a' : '#7ab8ff'; mctx.fillRect(x - (e.boss ? 4 : 2), y - (e.boss ? 4 : 2), e.boss ? 8 : 4, e.boss ? 8 : 4); }
    mctx.restore();
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(R, R - 8);
    mctx.lineTo(R + 6, R + 6);
    mctx.lineTo(R, R + 3);
    mctx.lineTo(R - 6, R + 6);
    mctx.fill();
    mctx.font = '900 14px Nunito, sans-serif';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    for (const [l, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['O', -Math.PI / 2]]) {
      const ang = a + yaw - Math.PI / 2;
      mctx.fillStyle = '#ffffff';
      mctx.fillText(l, R + Math.cos(ang) * (R - 16), R + Math.sin(ang) * (R - 16));
    }
  }

  function hudTick() {
    const sig = `${P.id}|${relics.length}|${vitamins.map((v) => v.id + v.lv).join()}|${attacks.map((a) => a.id + a.lv).join()}`;
    if (sig !== lastSig) { lastSig = sig; hudStatic(); }
    $('.r3-lv b').textContent = P.lv;
    $('.r3-timer b').textContent = mode === 'endless' ? clock(time) : sanctuary ? '—' : clock(ZONE_LENGTH - stageTime);
    $('.r3-timer').classList.toggle('swarm', finalSwarm);
    $('.r3-elapsed').textContent = clock(time, true);
    $('.r3-zone').textContent = Math.min(3, zone);
    $('.r3-zdots').innerHTML = [1, 2, 3].map((z) => `<i class="${z < zone ? 'done' : z === zone ? 'on' : ''}"></i>`).join('') + '<i class="gold"></i>';
    $('.r3-money').textContent = stats.money;
    $('.r3-kos').textContent = stats.kills;
    $('.r3-balls').textContent = balls.length;
    $('.r3-gold b').textContent = stats.kills;
    $('.r3-left b').textContent = Math.max(0, best + 1 - stats.kills);
    $('.r3-ult .fg').style.strokeDasharray = `${P.ult} 100`;
    $('.r3-ult').classList.toggle('ready', P.ult >= 100);
    $('.r3-pips').innerHTML = [0, 1, 2].map((i) => `<i class="${i < P.incense ? 'on' : ''}"></i>`).join('');
    if (guardian) $('.r3-boss .r3-bar i').style.width = `${(guardian.hp / guardian.maxHp) * 100}%`;
  }

  // player HP bar under the sprite
  const hpEl = document.createElement('div');
  hpEl.className = 'r3-php';
  hpEl.innerHTML = '<i></i><b></b>';
  labels.append(hpEl);
  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    v3.set(x, y, z).project(camera);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight, v3.z < 1];
  }

  // ---- the director ----
  function speciesCost(id) { const t = BY_ID.get(id).stats; return 1 + (t.hp + t.atk + t.def + t.spa + t.spd + t.spe) / 220; }
  function newCard() {
    const p = POOLS[Math.min(2, zone - 1)];
    const useRes = cardsDrawn++ % 3 === 1 && p.res.length;
    const useLate = !useRes && stageTime > 240 && p.late.length && Math.random() < 0.4;
    const pool = useRes ? p.res : useLate ? p.late : p.main.length ? p.main : ZONE_POOLS[Math.min(2, zone - 1)];
    const id = pool.find((x) => !cards.some((c) => c.id === x)) ?? pool[0];
    if (id == null) return;
    for (const c of cards) c.weight *= 0.85;
    cards.push({ id, cost: speciesCost(id), weight: 1.4 });
  }
  function startZoneTimeline() {
    stageTime = 0; credits = 0; cards = []; finalSwarm = false;
    for (let k = 0; k < 3; k++) newCard();
    const first = zone === 1; const early = [0, 15, 30][tierN];
    const t = [];
    for (let m = 1; m < 9.6; m += 0.8 + Math.random() * 0.4) t.push({ t: m * 60, kind: 'card' });
    if (first) t.push({ t: 165, kind: 'special' }); else t.push({ t: 100, kind: 'special' }, { t: 330, kind: 'special' });
    t.push({ t: 150, kind: 'alpha' }, { t: 330, kind: 'alpha' }, { t: 480, kind: 'alpha' });
    t.push({ t: first ? 235 : 200, kind: Math.random() < 0.5 ? 'swarm' : 'stampede' }, { t: 390, kind: 'swarm' }, { t: 520, kind: 'stampede' });
    t.push({ t: first ? 330 : 270, kind: 'elitewave' }, { t: 450, kind: 'elitewave' });
    t.push({ t: first ? 290 : 255, kind: 'totem' }, { t: 420, kind: 'totem' }, { t: 360, kind: 'summoner' });
    if (tierN >= 2) t.push({ t: 510, kind: 'totem' });
    if (BAG.has('honey')) t.push({ t: 240, kind: 'alpha' });
    const owed = first && BAG.has('shiny-stone');
    if (owed || Math.random() < 0.12 + Math.min(0.12, (P.luck || 0) / 400)) t.push({ t: owed ? 40 + Math.random() * 110 : 40 + Math.random() * 380, kind: 'shiny' });
    for (const e of t) if (!['card', 'special', 'shiny'].includes(e.kind)) e.t = Math.max(60, e.t - early);
    timeline = t.sort((x, y) => x.t - y.t);
  }
  function pickCard() { const tot = cards.reduce((x, c) => x + c.weight, 0); let r = Math.random() * tot; for (const c of cards) { if ((r -= c.weight) <= 0) return c; } return cards[0]; }
  function fire(kind) {
    const evMul = TIER_EVENTS[tierN];
    if (kind === 'card') newCard();
    else if (kind === 'special' && SPECIALS.length) spawnEnemy(SPECIALS[Math.floor(Math.random() * SPECIALS.length)], false, 'special');
    else if (kind === 'alpha' && cards.length) {
      let id = pickCard().id; const ev = nextEvo(id); if (ev && BY_ID.has(ev)) id = ev;
      const a = spawnEnemy(id, false, 'alpha');
      banner('Pokémon Alpha !', `Un ${BY_ID.get(a.id).name} géant et furieux est apparu`, 'red');
    } else if (kind === 'totem') {
      const pool = B.totems[(Math.min(3, zone) - 1) % 3].filter(known);
      if (pool.length) { const e = spawnEnemy(pool[Math.floor(Math.random() * pool.length)], false, 'totem'); banner(`Totem ${BY_ID.get(e.id).name} !`, 'Un Pokémon dominant garde une Poké Ball', 'gold'); }
    } else if (kind === 'summoner') {
      const pool = B.summoners[(Math.min(3, zone) - 1) % 3].filter(known);
      if (pool.length) spawnEnemy(pool[0], false, 'summon');
    } else if (kind === 'swarm' && cards.length) {
      const id = pickCard().id; const n = Math.round((zone === 1 && stageTime < 300 ? 40 : 46 + zone * 12) * evMul);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const e = spawnEnemy(id); e.x = P.x + Math.cos(a) * 26; e.z = P.z + Math.sin(a) * 26; e.hp *= 0.6; e.maxHp = e.hp; collide(world, e, e.r); }
      banner('Essaim !', `Un essaim de ${BY_ID.get(id).name} t'encercle…`, 'gold');
    } else if (kind === 'stampede' && cards.length) {
      const id = pickCard().id; const n = Math.round((zone === 1 && stageTime < 300 ? 30 : 34 + zone * 8) * evMul);
      const a = Math.random() * Math.PI * 2; const dx = Math.cos(a); const dz = Math.sin(a);
      for (let i = 0; i < n; i++) { const side = ((i % 17) - 8) * 2.2; const back = Math.floor(i / 17) * 3 + Math.random() * 2; const e = spawnEnemy(id); e.x = P.x - dx * (34 + back) - dz * side; e.z = P.z - dz * (34 + back) + dx * side; e.hp *= 0.8; e.maxHp = e.hp; e.dmg *= 1.3; e.charge = { dx, dz, t: 9 }; }
      banner('Ruée !', `Un troupeau de ${BY_ID.get(id).name} ! Écarte-toi de son chemin`, 'red'); shake = 0.3;
    } else if (kind === 'shiny' && cards.length) {
      let id = pickCard().id; const ev = nextEvo(id); if (ev && BY_ID.has(ev) && Math.random() < 0.5) id = ev;
      const e = spawnEnemy(id, false, 'shiny'); e.fleeT = 60;
      banner('Pokémon chromatique !', `Un ${BY_ID.get(e.id).name} chromatique est apparu : bats-le avant qu’il ne s’enfuie`, 'gold');
    } else if (kind === 'elitewave' && cards.length) {
      for (let i = 0; i < Math.round((4 + zone * 2) * evMul); i++) spawnEnemy(pickCard().id, false, 'elite');
      banner('Vague d’élite', 'Une vague de Pokémon d’élite approche', 'purple');
    }
  }
  function director(dt) {
    for (const e of timeline) if (!e.done && stageTime >= e.t) { e.done = true; fire(e.kind); }
    const eff = stageTime + ZONE_OFFSET[Math.min(2, zone - 1)] * Math.min(1, stageTime / 20);
    const vCap = Math.round((10 + eff * 0.65 + (eff / 60) ** 2 * 4.5) * (1 + (zone - 1) * 0.6) * [1, 1.15, 1.3][tierN]);
    hordeWeight = Math.max(1, vCap / LIVE_CAP);
    const liveCap = Math.min(LIVE_CAP, vCap);
    const income = (0.7 + 0.014 * eff + 0.5 * (eff / 60) ** 1.75) * (1 + (zone - 1) * 0.35) * TIER_AMOUNT[tierN] * (finalSwarm ? 6 : 1);
    if (!Number.isFinite(credits)) credits = 0;
    credits = Math.min(credits + income * dt, income * 2 + 10 * hordeWeight);
    if (!Number.isFinite(credits)) credits = 0;
    let guard = 0;
    while (cards.length && enemies.length < liveCap && guard++ < 20) {
      const c = pickCard(); const cost = c.cost * hordeWeight;
      if (!(cost > 0) || credits < cost) break;
      credits -= cost;
      const firstMinute = zone === 1 && stageTime < 90;
      const eliteP = 0.012 + (stageTime / 60) * 0.004 + (zone - 1) * 0.03 + TIER_ELITE[tierN];
      spawnEnemy(c.id, false, !firstMinute && Math.random() < eliteP ? 'elite' : '');
    }
    for (const e of [...enemies]) if (e.shiny) {
      if (Math.random() < dt * 4) spark(e.x, 1.6 + Math.random(), e.z, '#bff6ff', { size: 0.6, life: 0.6, vy: 1.5 });
      if (BAG.has('master-ball') && !masterUsed && e.hp <= e.maxHp * 0.5) { masterUsed = true; groundRing(e.x, e.z, 3, '#b070ff', 0.8); shinyReward(e, 'Capturé avec la Master Ball !'); enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); continue; }
      e.fleeT -= dt; if (e.fleeT <= 0) { groundRing(e.x, e.z, 2.5, '#ffffff', 0.6); tag(e.x, 3, e.z, 'S’est enfui…', 'weak'); enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); }
    }
    if (finalSwarm && Math.random() < dt * 2 && cards.length) for (let k = 0; k < 6; k++) spawnEnemy(pickCard().id, false, 'elite');
  }
  function placeAltar() {
    let p = null;
    for (let k = 0; k < 40 && !p; k++) { const a = Math.random() * Math.PI * 2; const d = 38 + Math.random() * 30; const q = { x: P.x + Math.cos(a) * d, z: P.z + Math.sin(a) * d }; collide(world, q, 3); if (Math.hypot(q.x - P.x, q.z - P.z) > 25 && world.slopeAt(q.x, q.z, 2) < 0.2) p = q; }
    p ||= world.flatSpot(4) || { x: 30, z: 30 };
    altar = { x: p.x, z: p.z, sp: placeModel(scene, 'altar', p.x, gh(p.x, p.z) - 0.05, p.z, 3.2, Math.random() * 6.28) };
  }
  function wakeGuardian() {
    if (guardianSpawned) return;
    guardianSpawned = true;
    const pool = B.guardians[(zone - 1) % 3].filter(known);
    guardian = spawnEnemy(pool[Math.floor(Math.random() * pool.length)], true);
    if (altar) { guardian.x = altar.x + 4; guardian.z = altar.z; }
    startBoss(guardian);
    $('.r3-boss').hidden = false;
    $('.r3-boss b').textContent = `Gardien · ${BY_ID.get(guardian.id).name}`;
    banner(`${BY_ID.get(guardian.id).name} se réveille !`, `Gardien de la zone ${zone}`, 'red');
  }
  function openPortal(x, z) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.85 }));
    ring.position.set(x, gh(x, z) + 2, z);
    scene.add(ring);
    portal = { x, z, ring };
    banner('Au portail !', 'Le portail vers la zone suivante est ouvert', 'blue');
  }
  function usePortal() {
    scene.remove(portal.ring); portal = null;
    if (altar) { scene.remove(altar.sp); altar = null; }
    if (zone >= 3) { enterSanctuary(); return; }
    zone++;
    guardianSpawned = false;
    for (const e of [...enemies]) { enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); }
    world.setLook(B.zones[zone - 2]);
    startZoneTimeline();
    placeAltar();
    spawnBalls(6);
    banner(`${B.name} · Zone ${zone}/3`, B.zones[zone - 2]?.name || 'Zone suivante !');
  }

  // ---- whom the boss is after: in co-op it picks a trainer for each move (often the nearest, sometimes anyone) ----
  let bossTarget = null; let pullSent = 0;
  const mateList = () => (link ? link.mates().filter((m) => (m.pos.zone || 1) === zone) : []);
  const players = () => [{ me: true, x: P.x, z: P.z, y: P.y }, ...mateList().map((m) => ({ id: m.id, x: m.pos.x, z: m.pos.z, y: m.pos.y || 0, maxHp: m.pos.maxHp, dash: m.pos.dash, yaw: m.pos.yaw }))];
  const tgt = () => { if (!bossTarget || bossTarget.me) return null; return mateList().find((m) => m.id === bossTarget.id) || null; };
  const BT = {
    get x() { const m = tgt(); return m ? m.pos.x : P.x; }, get z() { const m = tgt(); return m ? m.pos.z : P.z; }, get y() { const m = tgt(); return m ? m.pos.y || 0 : P.y; },
    get svx() { return tgt() ? 0 : P.svx || 0; }, get svz() { return tgt() ? 0 : P.svz || 0; }, get maxHp() { const m = tgt(); return m ? m.pos.maxHp || 100 : P.maxHp; },
    get hp() { return P.hp; }, set hp(v) { P.hp = v; },
  };
  function pickTarget() {
    const list = players();
    if (list.length < 2 || !bossAI) { bossTarget = { me: true }; return; }
    const e = bossAI.e;
    const pick = Math.random() < 0.6 ? list.reduce((b, p) => (Math.hypot(p.x - e.x, p.z - e.z) < Math.hypot(b.x - e.x, b.z - e.z) ? p : b)) : list[Math.floor(Math.random() * list.length)];
    const changed = !bossTarget || bossTarget.me !== !!pick.me || bossTarget.id !== pick.id;
    bossTarget = pick.me ? { me: true } : { id: pick.id };
    if (changed) { if (pick.me) tag(P.x, 3, P.z, 'Ciblé !', 'weak'); else pendingFx.push(['target', pick.id]); }
  }
  const sendTo = (kind, ...args) => { const m = tgt(); if (m) { pendingFx.push([kind, m.id, ...args]); return true; } return false; };
  function hurtTarget(amount) { if (!sendTo('hurt', Math.round(amount))) hurtPlayer(amount); }
  function hurtAt(pl, amount) { if (pl.me) hurtPlayer(amount); else pendingFx.push(['hurt', pl.id, Math.round(amount)]); }

  // ---- guardians and legendaries: the game's boss moves ----
  // slams (three marked circles), a ring of projectiles, a charge along a marked line, aimed volleys and a
  // shockwave to jump over; at half health it flies into a rage and adds a spiral, a meteor rain and hostile ground.
  const BOSS_MOVES = ['slams', 'ring', 'charge', 'volley', 'wave'];
  const RAGE_MOVES = [...BOSS_MOVES, 'spiral', 'meteor', 'pools'];
  const tele = [1, 0.92, 0.85][tierN];
  const later = (sec, fn) => setTimeout(() => { if (!over) fn(); }, sec * 1000);
  function startBoss(e) {
    bossAI = { e, t: 2.2, last: '', enraged: false, fightT: 0, hold: 0, charge: null, waves: [], pools: [], spiral: null, poolT: 0, color: kit.color || '#ff5a4a', mechT: 4, sayT: 0, blockT: 0, reflT: 0, minions: [] };
    const make = (e.legend ? LEGEND_KITS : GUARDIAN_MECHS)[e.id];
    bossAI.mech = make ? make(bossApi) : null;
    if (bossAI.mech?.intro) later(2.6, () => bossLive() && banner(bossAI.mech.name, bossAI.mech.intro, e.legend ? 'gold' : 'purple'));
  }
  // What a guardian's mechanic or a legendary's moves can do (see bossmechs.js).
  const bossApi = {
    P: BT, get e() { return bossAI.e; },
    live: () => bossLive(), alive: (m) => !!m && enemies.includes(m), later,
    ring: (x, z, r, c, life) => groundRing(x, z, r, c, life), spark: (x, y, z, c, o) => spark(x, y, z, c, o),
    shot: (x, z, a, sp, mul, size, life, c) => eShot(x, z, a, sp, mul, size, life, c), strike: (mul) => strike(mul),
    say: (text) => { tag(bossAI.e.x, 4.2, bossAI.e.z, text, 'say'); },
    blocked: (text) => { if (bossAI.blockT <= 0) { bossAI.blockT = 0.7; tag(bossAI.e.x, 3.4, bossAI.e.z, text, 'weak'); } },
    hold: (sec) => { bossAI.hold = Math.max(bossAI.hold, sec); },
    charge: (t, speed, onWall) => { const dx = BT.x - bossAI.e.x; const dz = BT.z - bossAI.e.z; const d = Math.hypot(dx, dz) || 1; bossAI.charge = { cx: dx / d, cz: dz / d, t, hit: false, again: false, speed, onWall }; },
    firePath: () => { for (const k of [0.25, 0.5, 0.75]) later(k, () => bossLive() && bossAI.pools.push({ x: bossAI.e.x, z: bossAI.e.z, r: 2.2, t: 5 })); },
    pools: (n) => { for (let i = 0; i < n; i++) { const x = BT.x + (i ? (Math.random() - 0.5) * 12 : 0); const z = BT.z + (i ? (Math.random() - 0.5) * 12 : 0); groundRing(x, z, 3.4, bossAI.color, tele); later(tele, () => { if (!bossLive()) return; for (const pl of players()) if (Math.hypot(pl.x - x, pl.z - z) < 3.4 && pl.y < 2) hurtAt(pl, bossAI.e.dmg); bossAI.pools.push({ x, z, r: 3.1, t: 6 }); }); } },
    wave: (n, mul) => { const B0 = bossAI; for (let i = 0; i < n; i++) later(0.8 + i * 0.55, () => { if (!bossLive()) return; const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring); B0.waves.push({ x: B0.e.x, z: B0.e.z, r: B0.e.r + 0.5, hit: false, ring, mul }); }); groundRing(bossAI.e.x, bossAI.e.z, 4.5, '#ff9a3a', 0.8); },
    common: () => { const m = BOSS_MOVES[Math.floor(Math.random() * BOSS_MOVES.length)]; bossMove(m); },
    hurtBoss: (frac) => { const e = bossAI.e; const n = Math.round(e.maxHp * frac); e.hp -= n; tag(e.x, 3, e.z, String(n), 'crit'); if (e.hp <= 0) kill(e); },
    heal: (frac) => { const e = bossAI.e; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * frac); tag(e.x, 3, e.z, `+${Math.round(e.maxHp * frac)}`, 'heal'); },
    healPlayer: (frac) => { if (sendTo('heal', frac)) return; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * frac); tag(P.x, 2.4, P.z, `+${Math.round(P.maxHp * frac)}`, 'heal'); },
    sleep: (t) => { if (sendTo('sleep', t)) return; P.stun = Math.max(P.stun || 0, t); tag(P.x, 2.6, P.z, 'Zzz', 'weak'); },
    pull: (x, z, speed, dt) => { if (tgt()) { if (time - pullSent > 0.2) { pullSent = time; sendTo('pull', x, z, speed, 0.25); } return; } const dx = x - P.x; const dz = z - P.z; const d = Math.hypot(dx, dz) || 1; if (d > 2) { P.x += (dx / d) * speed * dt; P.z += (dz / d) * speed * dt; collide(world, P, 0.6); } },
    pullTo: (x, z) => { if (sendTo('pullTo', x, z)) return; P.x = x; P.z = z; collide(world, P, 0.6); },
    push: (dx, dz) => { if (tgt()) { if (time - pullSent > 0.2) { pullSent = time; sendTo('push', dx * 6, dz * 6); } return; } P.x += dx; P.z += dz; collide(world, P, 0.6); },
    minion: (id, x, z, hpFrac, isStatic = false, scale = 1) => {
      const m = spawnEnemy(BY_ID.has(id) ? id : 120); m.x = x; m.z = z; collide(world, m, m.r);
      m.hp = m.maxHp = Math.max(30, bossAI.e.maxHp * hpFrac); if (isStatic) { m.static = true; m.spd = 0; m.dmg = 0; }
      if (scale !== 1) m.m.size *= scale; groundRing(m.x, m.z, 2, '#ffffff', 0.5); bossAI.minions.push(m); return m;
    },
    remove: (m) => { const i = enemies.indexOf(m); if (i >= 0) { enemies.splice(i, 1); m.m.dispose(); } },
    teleport: (x, z) => { const e = bossAI.e; for (let k = 0; k < 10; k++) spark(e.x, 1, e.z, '#c8a0ff', { size: 0.7, life: 0.4, vy: 2 }); e.x = x; e.z = z; collide(world, e, e.r); },
    setSpecies: (id) => { const e = bossAI.e; if (!BY_ID.has(id)) return; e.m.setSpecies(id); e.types = BY_ID.get(id).types; },
    playerSpecies: () => P.id, playerType: () => ptype,
    grow: (k, t) => { const e = bossAI.e; e.m.size *= k; later(t, () => { e.m.size /= k; }); },
    float: (on) => { bossAI.e.float = on; },
    hide: (on) => { const e = bossAI.e; e.hidden = on; e.m.sprite.visible = !on; e.m.shadow.visible = !on; },
    reflect: () => { if (bossAI.reflT <= 0) { bossAI.reflT = 0.35; hurtTarget(bossAI.e.dmg * 0.45); tag(bossAI.e.x, 3.6, bossAI.e.z, 'Arrête d’attaquer !', 'weak'); } },
    moveToward: (x, z, dt) => { const e = bossAI.e; const dx = x - e.x; const dz = z - e.z; const d = Math.hypot(dx, dz) || 1; e.x += (dx / d) * e.spd * 1.3 * dt; e.z += (dz / d) * e.spd * 1.3 * dt; bossAI.hold = Math.max(bossAI.hold, 0.05); },
    rage: () => { bossAI.e.spd *= 1.2; },
    buff: (k, t) => { const e = bossAI.e; e.spd *= k; later(t, () => { e.spd /= k; }); },
    lookingAt: (x, z) => { const m = tgt(); const yw = m ? m.pos.yaw || 0 : yaw; const fx = -Math.sin(yw); const fz = -Math.cos(yw); const dx = x - BT.x; const dz = z - BT.z; const d = Math.hypot(dx, dz) || 1; return (fx * dx + fz * dz) / d > 0.7; },
    dashing: () => { const m = tgt(); return m ? !!m.pos.dash : P.dash > 0; },
  };
  const bossLive = () => bossAI && enemies.includes(bossAI.e) && !over;
  function eShot(x, z, ang, speed, mul, size = 0.8, life = 3, color = '#ff6a5a') {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(size * 1.6); scene.add(sp);
    if (link && coopHost) pendingFx.push(['shot', Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(ang * 100) / 100, speed, size, life, color]);
    eShots.push({ sp, x, z, vx: Math.cos(ang) * speed, vz: Math.sin(ang) * speed, life, mul, r: size });
  }
  function strike(mul) { if (bossAI) hurtTarget(bossAI.e.dmg * mul); }
  function bossMove(name) {
    const B0 = bossAI; const e = B0.e; const rage = B0.enraged;
    if (name === 'slams') {
      const volley = (n, delay) => { for (let i = 0; i < n; i++) { const x = BT.x + (i === 0 ? (BT.svx || 0) * 0.8 : (Math.random() - 0.5) * 14); const z = BT.z + (i === 0 ? (BT.svz || 0) * 0.8 : (Math.random() - 0.5) * 14); groundRing(x, z, 3.6, '#ff3a3a', delay); later(delay, () => { if (!bossLive()) return; for (let k = 0; k < 10; k++) spark(x, 0.5, z, B0.color, { size: 0.9, life: 0.5, vx: (Math.random() - 0.5) * 9, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 9 }); shake = 0.2; for (const pl of players()) if (Math.hypot(pl.x - x, pl.z - z) < 3.6 && pl.y < 2) hurtAt(pl, e.dmg * 1.6); }); } };
      volley(3, 1.1 * tele); if (rage) later(0.7, () => bossLive() && volley(3, tele));
      return rage ? 3.8 : 3;
    }
    if (name === 'ring') {
      const n = rage ? 18 : 14; const reps = rage ? 3 : 1; const o = Math.random();
      groundRing(e.x, e.z, 3, B0.color, 0.4);
      for (let r = 0; r < reps; r++) later(0.4 + r * 0.5, () => { if (!bossLive()) return; for (let i = 0; i < n; i++) eShot(e.x, e.z, (o + (i + r * 0.5) / n) * Math.PI * 2, 10, 0.8); groundRing(e.x, e.z, 5, B0.color, 0.4); });
      return 2.8 + (reps - 1) * 0.4;
    }
    if (name === 'charge') {
      const go = (again) => { const dx = BT.x - e.x; const dz = BT.z - e.z; const d = Math.hypot(dx, dz) || 1; const cx = dx / d; const cz = dz / d; const w = 0.75 * tele;
        for (let k = 1; k <= 11; k++) groundRing(e.x + cx * k * 2, e.z + cz * k * 2, 1.1, '#ff3a3a', w);
        B0.hold = w + 0.8;
        later(w, () => { if (!bossLive()) return; B0.charge = { cx, cz, t: 0.75, hit: false, again: again && rage }; }); };
      go(true);
      return rage ? 4.4 : 3.2;
    }
    if (name === 'volley') {
      const n = rage ? 4 : 3;
      for (let i = 0; i < n; i++) later((0.45 + i * 0.4) * tele, () => { if (!bossLive()) return; const tx = BT.x + (BT.svx || 0) * 0.5; const tz = BT.z + (BT.svz || 0) * 0.5; const a = Math.atan2(tz - e.z, tx - e.x); for (let k = -2; k <= 2; k++) eShot(e.x, e.z, a + k * 0.17, 15, 0.6, 0.9, 3); });
      return 2.6 + n * 0.2;
    }
    if (name === 'wave') {
      const n = rage ? 3 : 2; const w = 0.8 * tele;
      groundRing(e.x, e.z, 4.5, '#ff9a3a', w); B0.hold = w + n * 0.55;
      for (let i = 0; i < n; i++) later(w + i * 0.55, () => { if (!bossLive()) return; shake = 0.3; const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring); B0.waves.push({ x: e.x, z: e.z, r: e.r + 0.5, hit: false, ring }); });
      return 3 + n * 0.3;
    }
    if (name === 'spiral') { groundRing(e.x, e.z, 4, B0.color, 0.6); B0.hold = 3.2; later(0.6, () => { if (bossLive()) B0.spiral = { t: 2.6, a: Math.random() * 6.28, acc: 0, spin: Math.random() < 0.5 ? 1.9 : -1.9 }; }); return 3.8; }
    if (name === 'meteor') {
      const n = 8 + zone * 2;
      for (let i = 0; i < n; i++) later(i * 0.2, () => { if (!bossLive()) return; const x = BT.x + (i % 3 === 0 ? (BT.svx || 0) * 0.9 : (Math.random() - 0.5) * 18); const z = BT.z + (i % 3 === 0 ? (BT.svz || 0) * 0.9 : (Math.random() - 0.5) * 18); const w = 1.1 * tele; groundRing(x, z, 2.6, B0.color, w); later(w, () => { if (!bossLive()) return; for (let k = 0; k < 8; k++) spark(x, 0.6, z, B0.color, { size: 0.8, life: 0.4, vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 7 }); for (const pl of players()) if (Math.hypot(pl.x - x, pl.z - z) < 2.6 && pl.y < 2) hurtAt(pl, e.dmg * 1.2); }); });
      return 2.4 + n * 0.12;
    }
    if (name === 'pools') {
      for (let i = 0; i < 3; i++) { const x = BT.x + (i ? (Math.random() - 0.5) * 12 : 0); const z = BT.z + (i ? (Math.random() - 0.5) * 12 : 0); groundRing(x, z, 3.4, B0.color, tele); later(tele, () => { if (!bossLive()) return; for (const pl of players()) if (Math.hypot(pl.x - x, pl.z - z) < 3.4 && pl.y < 2) hurtAt(pl, bossAI.e.dmg); B0.pools.push({ x, z, r: 3.1, t: 6 }); }); }
      return 2.8;
    }
    return 2;
  }
  function bossTick(dt) {
    const B0 = bossAI;
    if (!bossLive()) {
      // the boss is down: its hives, eggs, nodes and clones go with it
      for (const m of bossAI.minions) { const i = enemies.indexOf(m); if (i >= 0) { enemies.splice(i, 1); m.m.dispose(); } }
      bossAI = null; for (const sh of eShots.splice(0)) scene.remove(sh.sp); return;
    }
    const e = B0.e;
    B0.fightT += dt; B0.hold = Math.max(0, B0.hold - dt);
    if (!B0.enraged && e.hp < e.maxHp * 0.5) {
      B0.enraged = true; e.spd *= 1.2; shake = 0.5; groundRing(e.x, e.z, 8, '#ff3a3a', 0.6); groundRing(e.x, e.z, 14, '#ffffff', 0.8);
      banner('Furie !', `${BY_ID.get(e.id).name} enrage : attaques nouvelles et plus rapides`, 'red');
    }
    if (B0.charge) {
      const c = B0.charge; c.t -= dt; const ox = e.x; const oz = e.z; e.x += c.cx * (c.speed || 30) * dt; e.z += c.cz * (c.speed || 30) * dt; collide(world, e, e.r);
      if (c.onWall && Math.hypot(e.x - ox, e.z - oz) < (c.speed || 30) * dt * 0.4) { const f = c.onWall; c.onWall = null; c.t = 0; f(); }
      if (Math.random() < 0.6) spark(e.x, 0.5, e.z, '#ffffff', { size: 0.8, life: 0.3 });
      c.hitIds ||= new Set();
      for (const pl of players()) { const key = pl.me ? 'me' : pl.id; if (!c.hitIds.has(key) && Math.hypot(pl.x - e.x, pl.z - e.z) < e.r + 1 && pl.y < 1.6) { c.hitIds.add(key); hurtAt(pl, e.dmg * 1.5); } }
      if (c.t <= 0) { B0.charge = null; if (c.again) { const dx = BT.x - e.x; const dz = BT.z - e.z; const d = Math.hypot(dx, dz) || 1; for (let k = 1; k <= 11; k++) groundRing(e.x + (dx / d) * k * 2, e.z + (dz / d) * k * 2, 1.1, '#ff3a3a', 0.6); B0.hold = 1.2; later(0.6, () => { if (bossLive()) B0.charge = { cx: dx / d, cz: dz / d, t: 0.75, hit: false, again: false }; }); } }
    }
    for (const w of [...B0.waves]) {
      const r0 = w.r; w.r += dt * 13; w.ring.scale.setScalar(w.r); w.ring.position.set(w.x, gh(w.x, w.z) + 0.3, w.z); w.ring.material.opacity = Math.max(0, 0.9 * (1 - w.r / 26));
      if (!w.hitIds) { w.hitIds = new Set(); if (link && coopHost) pendingFx.push(['wave', Math.round(w.x * 10) / 10, Math.round(w.z * 10) / 10, w.r]); }
      for (const pl of players()) { const d = Math.hypot(pl.x - w.x, pl.z - w.z); const key = pl.me ? 'me' : pl.id; if (!w.hitIds.has(key) && d >= r0 - 0.6 && d <= w.r + 0.6 && pl.y < 0.6) { w.hitIds.add(key); hurtAt(pl, bossAI.e.dmg * (w.mul || 1.3)); } }
      if (w.r > 26) { scene.remove(w.ring); B0.waves.splice(B0.waves.indexOf(w), 1); }
    }
    B0.poolT -= dt; if (B0.poolHit) { B0.poolHit = false; B0.poolT = 0.5; }
    for (const pl of [...B0.pools]) {
      pl.t -= dt; if (Math.random() < dt * 3) groundRing(pl.x, pl.z, pl.r, B0.color, 0.5);
      if (B0.poolT <= 0) for (const who of players()) if (Math.hypot(who.x - pl.x, who.z - pl.z) < pl.r && who.y < 1) { B0.poolHit = true; hurtAt(who, (who.me ? P.maxHp : who.maxHp || 100) * 0.04); }
      if (pl.t <= 0) B0.pools.splice(B0.pools.indexOf(pl), 1);
    }
    if (B0.spiral) {
      const sp = B0.spiral; sp.t -= dt; sp.acc += dt; sp.a += sp.spin * dt;
      while (sp.acc > 0.09) { sp.acc -= 0.09; for (let k = 0; k < 3; k++) eShot(e.x, e.z, sp.a + (k / 3) * Math.PI * 2, 9, 0.6, 0.7, 3.5); }
      if (sp.t <= 0) B0.spiral = null;
    }
    B0.blockT -= dt; B0.reflT -= dt;
    if (B0.mech) {
      B0.mech.tick(dt);
      if (!bossLive()) return;
      B0.mechT -= dt;
      if (B0.mechT <= 0 && !B0.charge && B0.hold <= 0) { pickTarget(); B0.mechT = B0.mech.cast() * (B0.enraged ? 0.85 : 1) + (e.legend ? 0 : B0.mech.every * 0.6); B0.t = Math.max(B0.t, 1.2); }
      if (e.legend) return;
    }
    B0.t -= dt;
    if (B0.t <= 0 && !B0.charge && B0.hold <= 0) {
      pickTarget();
      const list = (B0.enraged ? RAGE_MOVES : BOSS_MOVES).filter((m) => m !== B0.last);
      const m = list[Math.floor(Math.random() * list.length)]; B0.last = m;
      B0.t = bossMove(m) * (B0.enraged ? 0.85 : 1);
    }
  }
  function shotsTick(dt) {
    for (const sh of [...eShots]) {
      sh.life -= dt; sh.x += sh.vx * dt; sh.z += sh.vz * dt;
      sh.sp.position.set(sh.x, gh(sh.x, sh.z) + 1, sh.z);
      for (const pl of players()) if (sh.life > 0 && Math.hypot(pl.x - sh.x, pl.z - sh.z) < sh.r + 0.5 && pl.y < 1.5) { hurtAt(pl, (bossAI ? bossAI.e.dmg : 10) * sh.mul); sh.life = 0; }
      if (sh.life <= 0) { scene.remove(sh.sp); eShots.splice(eShots.indexOf(sh), 1); }
    }
  }

  // ---- the special movers (Dunsparce and Steelix dig, Gligar glides, Phanpy and Donphan roll, Qwilfish leaves spikes) ----
  function hurtPlayer(dmg) {
    if (P.hurt > 0 || over) return;
    const dm = Math.max(1, dmg * (P.armor >= 0 ? 100 / (100 + P.armor * 4) : 1 - P.armor * 0.02)); P.hp -= dm; P.hurt = 0.8; shake = 0.2; tag(P.x, 2.2, P.z, `-${Math.round(dm)}`, 'hurt');
    if (P.hp <= 0) { P.hp = 0; finish(false); }
  }
  function roleMove(e, d, dx, dz, dt) {
    e.modeT -= dt; e.act -= dt;
    const vis = !e.buried; e.m.sprite.visible = vis; e.m.shadow.visible = vis;
    if (e.role === 'burrow') {
      const R0 = e.big ? 3.4 : 2.2; const wind = e.big ? 1.05 : 0.85;
      if (e.mode === 'buried') {
        // moves underground towards you, a trail of dust above it; then a circle marks where it will burst out
        e.x += (dx / d) * e.spd * (e.big ? 1.2 : 1.35) * dt; e.z += (dz / d) * e.spd * (e.big ? 1.2 : 1.35) * dt;
        if (Math.random() < dt * 12) spark(e.x, 0.2, e.z, '#c8a878', { size: 0.7, life: 0.4, vy: 1 });
        if (e.act <= 0 && d < (e.big ? 7 : 5.5)) { e.mode = 'emerge'; e.modeT = wind; e.tx = P.x + (P.svx || 0) * 0.3; e.tz = P.z + (P.svz || 0) * 0.3; groundRing(e.tx, e.tz, R0, e.big ? '#b8c0d0' : '#d8b878', wind); }
        return true;
      }
      if (e.mode === 'emerge') {
        e.x += (e.tx - e.x) * Math.min(1, dt * 6); e.z += (e.tz - e.z) * Math.min(1, dt * 6);
        if (e.modeT <= 0) {
          e.mode = 'up'; e.modeT = e.big ? 2.6 : 2.2; e.buried = false;
          for (let k = 0; k < 14; k++) spark(e.x, 0.4, e.z, '#c8a878', { size: 0.8, life: 0.5, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 8 });
          if (Math.hypot(P.x - e.x, P.z - e.z) < R0 + 0.3 && P.y < 2) hurtPlayer(e.dmg * (e.big ? 1.6 : 1.3));
        }
        return true;
      }
      if (e.mode === 'up') { if (e.modeT <= 0) { e.mode = 'dig'; e.modeT = 0.5; } return true; }
      if (e.mode === 'dig') { if (Math.random() < dt * 20) spark(e.x, 0.3, e.z, '#c8a878', { size: 0.6, life: 0.3 }); if (e.modeT <= 0) { e.mode = 'buried'; e.buried = true; e.act = 1.2; } return true; }
    }
    if (e.role === 'glide') {
      if (e.mode === 'wind') {
        if (e.modeT <= 0) { e.mode = 'dash'; e.modeT = e.len / 16; }
        return true;
      }
      if (e.mode === 'dash') {
        e.x += e.gx * 16 * dt; e.z += e.gz * 16 * dt; e.alt = Math.sin((1 - e.modeT / (e.len / 16)) * Math.PI) * 1.2;
        if (Math.random() < 0.5) spark(e.x, 1, e.z, '#d8c8ff', { size: 0.5, life: 0.3 });
        if (Math.hypot(P.x - e.x, P.z - e.z) < e.r + 0.9 && P.y < 1.6) hurtPlayer(e.dmg * 1.3);
        if (e.modeT <= 0) { e.mode = ''; e.act = 3.5 + Math.random() * 1.5; e.alt = 0; }
        return true;
      }
      if (e.act <= 0 && d > 8 && d < 22) {
        // a line on the ground shows its path, then it swoops along it
        e.mode = 'wind'; e.modeT = 0.75; e.gx = dx / d; e.gz = dz / d; e.len = Math.min(30, d + 8);
        for (let k = 1; k <= 8; k++) groundRing(e.x + e.gx * e.len * (k / 8), e.z + e.gz * e.len * (k / 8), 0.7, '#ff4a4a', 0.75);
        return true;
      }
      return false;
    }
    if (e.role === 'roll') {
      if (e.mode === 'dizzy') { if (Math.random() < dt * 4) spark(e.x, 2, e.z, '#ffe060', { size: 0.4, life: 0.3 }); if (e.modeT <= 0) { e.mode = ''; e.act = 2 + Math.random() * 2; } return true; }
      if (e.mode === 'roll') {
        // rolls in a straight line and bounces off walls; knocks wild Pokémon aside too
        const px = e.x; const pz = e.z;
        e.x += e.gx * e.spd * 3.4 * dt; e.z += e.gz * e.spd * 3.4 * dt;
        const q = { x: e.x, z: e.z }; collide(world, q, e.r);
        if (Math.hypot(q.x - e.x, q.z - e.z) > 0.01 || Math.abs(gh(e.x, e.z) - gh(px, pz)) > 1) { e.gx = -e.gx + (Math.random() - 0.5) * 0.6; e.gz = -e.gz + (Math.random() - 0.5) * 0.6; const l = Math.hypot(e.gx, e.gz) || 1; e.gx /= l; e.gz /= l; e.x = px; e.z = pz; e.bounces = (e.bounces || 0) + 1; }
        if (Math.random() < 0.4) spark(e.x, 0.3, e.z, '#d8c8a8', { size: 0.6, life: 0.3 });
        if (Math.hypot(P.x - e.x, P.z - e.z) < e.r + 0.8 && P.y < 1.2) hurtPlayer(e.dmg * (e.big ? 1.8 : 1.4));
        if (e.modeT <= 0 || e.bounces > 3) { e.mode = 'dizzy'; e.modeT = 1.2; }
        return true;
      }
      if (e.act <= 0 && d < 24) { e.mode = 'roll'; e.modeT = 3; e.bounces = 0; e.gx = dx / d; e.gz = dz / d; groundRing(e.x, e.z, 1.6, '#ffd040', 0.4); return true; }
      return false;
    }
    if (e.role === 'spite' && !e.puffed && e.hp < e.maxHp * 0.45) { e.puffed = true; e.m.sprite.scale.multiplyScalar(1.35); banner('Attention aux piquants !', `${BY_ID.get(e.id).name} va lâcher ses piquants en tombant`, 'red'); }
    return false;
  }
  function spikes(e) {
    // eight spikes fly outwards: standing close and in their line hurts
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let s = 1; s <= 6; s++) spark(e.x + Math.cos(a) * s, 0.6, e.z + Math.sin(a) * s, '#c8d8a0', { size: 0.35, life: 0.25 + s * 0.04 });
    }
    const dx = P.x - e.x; const dz = P.z - e.z; const d = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx); const off = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5);
    if (d < 6.5 && (d < 1.6 || off > 0.32)) hurtPlayer(e.dmg * 1.4);
  }

  // ---- loop ----
  const player = new Mon(scene, speciesId, 2);
  let last = performance.now();
  let raf = 0;
  let mapT = 0;

  function update(dt) {
    time += dt;
    evolving = Math.max(0, evolving - dt);
    shake = Math.max(0, shake - dt);
    P.hurt = Math.max(0, P.hurt - dt);
    P.dashCd -= dt;
    P.incenseT = Math.max(0, P.incenseT - dt);
    stats.streakT -= dt;
    if (stats.streakT <= 0) stats.streak = 0;

    // movement relative to the camera
    let ix = 0;
    let iy = 0;
    if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) ix--;
    if (keys.has('d') || keys.has('arrowright')) ix++;
    if (keys.has('w') || keys.has('z') || keys.has('arrowup')) iy++;
    if (keys.has('s') || keys.has('arrowdown')) iy--;
    if (joy.on) { ix += joy.dx; iy -= joy.dy; }
    const il = P.stun > 0 ? 0 : Math.hypot(ix, iy);
    if (P.stun > 0) { P.stun -= dt; if (Math.random() < dt * 4) spark(P.x, 2.4, P.z, '#c8a0ff', { size: 0.6, life: 0.4, vy: 0.6 }); }
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    P.moving = il > 0.15;
    // On the Glacier's frozen lakes you slide: speed builds up and carries on.
    const onIce = world.ice && P.y < 0.3 && world.ponds.some((q) => Math.hypot(P.x - q.x, P.z - q.z) < q.r);
    let tvx = 0; let tvz = 0;
    if (P.moving) { const k = Math.min(1, il) / il; const sp0 = P.speed * (P.dash > 0 ? 2.6 : 1); tvx = (right.x * ix + fwd.x * iy) * k * sp0; tvz = (right.z * ix + fwd.z * iy) * k * sp0; }
    const grip = onIce ? Math.min(1, dt * 1.8) : 1;
    P.svx = (P.svx || 0) + (tvx - (P.svx || 0)) * grip; P.svz = (P.svz || 0) + (tvz - (P.svz || 0)) * grip;
    if (P.moving || (onIce && Math.hypot(P.svx, P.svz) > 0.3)) {
      const ox = P.x; const oz = P.z; const g0 = gh(ox, oz);
      const steep = (x, z) => P.y < 1.4 && (gh(x, z) - g0) / Math.max(0.001, Math.hypot(x - ox, z - oz)) > 1.05;
      let nx = P.x + P.svx * dt; let nz = P.z + P.svz * dt;
      if (steep(nx, nz)) { if (!steep(nx, oz)) nz = oz; else if (!steep(ox, nz)) nx = ox; else { nx = ox; nz = oz; } }
      P.x = nx; P.z = nz;
      if (P.moving) P.dir = facing(ix, -iy);
    }
    if (P.kbt > 0) { P.kbt -= dt; P.x += P.kbx * dt; P.z += P.kbz * dt; }
    if (P.pullFx && P.pullFx.t > 0) { const f = P.pullFx; f.t -= dt; const dx = f.x - P.x; const dz = f.z - P.z; const d = Math.hypot(dx, dz) || 1; if (d > 2) { P.x += (dx / d) * f.speed * dt; P.z += (dz / d) * f.speed * dt; collide(world, P, 0.6); } }
    for (const g of [...ghostShots]) { g.life -= dt; if (g.ring) { g.r += dt * 13; g.ring.scale.setScalar(g.r); g.ring.position.set(g.x, gh(g.x, g.z) + 0.3, g.z); g.ring.material.opacity = Math.max(0, 0.9 * (1 - g.r / 26)); if (g.r > 26) g.life = 0; } else { g.x += g.vx * dt; g.z += g.vz * dt; g.sp.position.set(g.x, gh(g.x, g.z) + 1, g.z); } if (g.life <= 0) { scene.remove(g.sp || g.ring); ghostShots.splice(ghostShots.indexOf(g), 1); } }
    P.dash = Math.max(0, P.dash - dt);
    P.vy -= 24 * dt;
    P.y = Math.max(0, P.y + P.vy * dt);
    collide(world, P, 0.6);
    P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);

    // hordes: the game's director, a spawn budget that grows with the zone clock, an alive cap, new species
    // joining about every minute, elites, and timed events (alphas, swarms, stampedes, elite waves, totems, summoners)
    stageTime += dt;
    if (!sanctuary && coopHost) director(dt);
    if (bossAI) bossTick(dt);
    if (eShots.length) shotsTick(dt);
    if (coopHost && mode !== 'endless' && !sanctuary && !finalSwarm && stageTime >= ZONE_LENGTH && !(guardian && guardian.boss)) {
      finalSwarm = true; finalAt = stageTime;
      banner('ENJAMBRE FINAL !', 'Tu ne devrais pas rester ici…', 'red');
    }
    if (mode === 'endless' && !guardianSpawned && stageTime >= ZONE_LENGTH - 1) wakeGuardian();
    // the guardian's altar: wake it, beat it, then walk into the portal
    if (altar && !guardianSpawned && mode !== 'endless' && coopHost) {
      const near = Math.hypot(P.x - altar.x, P.z - altar.z) < 3.2;
      $('.r3-prompt').hidden = !near;
      if (near && wantE) wakeGuardian();
    } else $('.r3-prompt').hidden = true;
    wantE = false;
    if (portal) {
      portal.ring.rotation.z += dt * 2;
      if (Math.random() < dt * 20) spark(portal.x + (Math.random() - 0.5) * 3, Math.random() * 3, portal.z + (Math.random() - 0.5) * 3, '#8ad8ff', { size: 0.5, life: 0.6, vy: 2 });
      if (Math.hypot(P.x - portal.x, P.z - portal.z) < 2.4) usePortal();
    }

    // enemies
    for (const e of enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.burn > 0) {
        e.burn -= dt;
        e.hitT -= dt;
        if (e.hitT <= 0) { e.hitT = 0.5; hit(e, 1.2, 'fire'); if (Math.random() < 0.5) spark(e.x, 1, e.z, '#ff8a2a', { size: 0.5, life: 0.3, vy: 2 }); }
        if (!enemies.includes(e)) continue;
      }
      if (e.kb > 0) { e.kb -= dt; e.x += e.kx * dt * 5; e.z += e.kz * dt * 5; collide(world, e, e.r); continue; }
      let tgx = P.x; let tgz = P.z;
      if (link && coopHost) { let best = Math.hypot(P.x - e.x, P.z - e.z); for (const m of link.mates()) { if ((m.pos.zone || 1) !== zone) continue; const dm = Math.hypot(m.pos.x - e.x, m.pos.z - e.z); if (dm < best) { best = dm; tgx = m.pos.x; tgz = m.pos.z; } } }
      const onMe = tgx === P.x && tgz === P.z;
      const dx = tgx - e.x;
      const dz = tgz - e.z;
      const d = Math.hypot(dx, dz) || 1;
      let spd = e.spd;
      if (e.remote) {
        e.x += (e.tx - e.x) * Math.min(1, dt * 10); e.z += (e.tz - e.z) * Math.min(1, dt * 10);
        const rd = Math.hypot(P.x - e.x, P.z - e.z); e.dir = facing((P.x - e.x) * right.x + (P.z - e.z) * right.z, -((P.x - e.x) * fwd.x + (P.z - e.z) * fwd.z));
        if (!e.hidden && e.dmg > 0 && rd < e.r + 0.7 && P.hurt <= 0 && P.y < 1.2) hurtPlayer(e.dmg);
        continue;
      }
      if (e.static) continue;
      if (bossAI && e === bossAI.e && (bossAI.charge || bossAI.hold > 0 || e.hidden)) { collide(world, e, e.r); continue; }
      if (e.charge && e.charge.t > 0) { e.charge.t -= dt; e.x += e.charge.dx * e.spd * 1.7 * dt; e.z += e.charge.dz * e.spd * 1.7 * dt; if (d < e.r + 0.8 && P.y < 1.2) hurtPlayer(e.dmg); if (e.charge.t <= 0 || d > 70) { enemies.splice(enemies.indexOf(e), 1); e.m.dispose(); } continue; }
      if (e.role) { if (roleMove(e, d, dx, dz, dt)) { collide(world, e, e.r); continue; } }
      else if (e.alpha) {
        // charges: a short wind-up, then a rush in a straight line
        e.act -= dt;
        if (e.act <= 0 && e.rush <= 0 && d < 26) { e.rush = 0.7; e.rx = dx / d; e.rz = dz / d; e.act = e.legend ? 3 : 4 + Math.random() * 2; groundRing(e.x, e.z, 2, e.legend ? '#ff5a8a' : '#ffd040', 0.4); }
        if (e.rush > 0) { e.rush -= dt; e.x += e.rx * e.spd * 3.2 * dt; e.z += e.rz * e.spd * 3.2 * dt; spd = 0; if (Math.random() < 0.4) spark(e.x, 0.3, e.z, '#e8d8b0', { size: 0.6, life: 0.3 }); }
      }
      if (e.summon) {
        e.act -= dt; spd *= 0.4;
        if (e.act <= 0 && enemies.length < 170) {
          e.act = 5;
          const pool = ZONE_POOLS[Math.min(2, zone - 1)];
          groundRing(e.x, e.z, 3, '#b88aff', 0.6);
          for (let k = 0; k < 2; k++) { const c = spawnEnemy(pool[Math.floor(Math.random() * pool.length)]); c.x = e.x + Math.cos(k * 3) * 2; c.z = e.z + Math.sin(k * 3) * 2; }
        }
      }
      e.x += (dx / d) * spd * dt;
      e.z += (dz / d) * spd * dt;
      collide(world, e, e.r);
      const sx = dx * right.x + dz * right.z;
      const sy = -(dx * fwd.x + dz * fwd.z);
      e.dir = facing(sx, sy);
      if (onMe && d < e.r + 0.7 && P.hurt <= 0 && P.y < 1.2) {
        // armour softens the blow; the hit shoves you back and gives a short moment of safety, as in the game
        const dmg = Math.max(1, e.dmg * (P.armor >= 0 ? 100 / (100 + P.armor * 4) : 1 - P.armor * 0.02));
        P.hp -= dmg;
        P.hurt = 0.8;
        shake = 0.15;
        { const k = Math.min(3, (e.boss ? 9 : 3 + Math.min(4, e.r * 2.5)) * 0.35); P.kbx = (-dx / d) * k * 6; P.kbz = (-dz / d) * k * 6; P.kbt = 0.18; }
        tag(P.x, 2.2, P.z, `-${Math.round(dmg)}`, 'hurt');
        if (P.hp <= 0) { P.hp = 0; finish(false); return; }
      }
      if (d > 60 && !e.boss) {
        const a = Math.random() * Math.PI * 2;
        e.x = P.x + Math.cos(a) * 30;
        e.z = P.z + Math.sin(a) * 30;
        collide(world, e, e.r);
      }
    }
    for (let i = 0; i < enemies.length; i += 2) {
      const a = enemies[i];
      const b = enemies[(i + 5) % enemies.length];
      if (a === b) continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dd = Math.hypot(dx, dz);
      const min = a.r + b.r;
      if (dd > 0 && dd < min) { a.x += (dx / dd) * (min - dd) * 0.5; a.z += (dz / dd) * (min - dd) * 0.5; }
    }

    // attacks
    const haste = 1 + vitVal('x-speed') + (has('quick-claw') ? 0.12 : 0) + (P.incenseT > 0 ? 0.6 : 0);
    for (const a of attacks) {
      if (a.kind === 'orbit') continue;
      a.t -= dt * haste;
      if (a.t <= 0) { fireAttack(a); a.t = a.cd; }
    }
    const orbit = attacks.find((a) => a.kind === 'orbit');
    if (orbit) {
      const n = 2 + Math.floor(orbit.lv / 2);
      for (let k = 0; k < n; k++) {
        const ang = time * 3 + (k / n) * Math.PI * 2;
        const ox = P.x + Math.cos(ang) * 3;
        const oz = P.z + Math.sin(ang) * 3;
        if (Math.random() < 0.5) spark(ox, 1, oz, '#c8a060', { size: 0.7, life: 0.12 });
        for (const e of enemies) {
          if (Math.hypot(e.x - ox, e.z - oz) < e.r + 0.6 && !(e.orbT > time)) { e.orbT = time + 0.5; hit(e, orbit.dmg * (1 + (orbit.lv - 1) * 0.25), 'ground', 3, ox, oz); }
        }
      }
    }
    if (ptype === 'fire') {
      P.heat = (P.heat || 6) - dt;
      if (P.heat <= 0) {
        P.heat = 6;
        groundRing(P.x, P.z, 4, 0xff7a2a, 0.4);
        for (const e of [...enemies]) if (Math.hypot(e.x - P.x, e.z - P.z) < 4 + e.r) { e.burn = 3; hit(e, 2, 'fire'); }
      }
    }
    for (const s of shots) {
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.sp.position.set(s.x, gh(s.x, s.z) + 1, s.z);
      for (const e of enemies) {
        if (s.life <= 0 || s.hits.has(e)) continue;
        if (Math.hypot(e.x - s.x, e.z - s.z) < e.r + 0.5) {
          s.hits.add(e);
          hit(e, s.dmg, s.type, 2, s.x - s.vx, s.z - s.vz);
          if (s.hits.size >= s.pierce) s.life = 0;
        }
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) { scene.remove(shots[i].sp); shots[i].sp.material.dispose(); shots.splice(i, 1); }

    // pick-ups
    const xpMul = 1 + vitVal('lucky-egg') + (has('exp-share') ? 0.15 : 0);
    for (let i = drops.length - 1; i >= 0; i--) {
      const g = drops[i];
      const dx = P.x - g.x;
      const dz = P.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < P.pick || g.pull) {
        g.pull = true;
        const sp = 18 * dt;
        g.x += (dx / (d || 1)) * Math.min(sp, d);
        g.z += (dz / (d || 1)) * Math.min(sp, d);
      }
      g.t += dt;
      g.sp.position.set(g.x, gh(g.x, g.z) + 0.2 + Math.abs(Math.sin(g.t * 3)) * 0.25, g.z);
      if (d < 0.9) {
        scene.remove(g.sp);
        g.sp.material.dispose();
        drops.splice(i, 1);
        if (g.kind === 'candy') { P.xp += g.v * xpMul * (BAG.has('lucky-egg') ? 1.25 : 1); if (P.xp >= P.next) levelUp(); }
        else if (g.kind === 'coin') stats.money += g.v * (BAG.has('amulet-coin') ? 1.5 : 1);
        else { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.25); tag(P.x, 2.2, P.z, '+PV', 'heal'); }
      }
    }
    
  }

  function render(now) {
    const t = now / 1000;
    // camera behind the Pokémon
    const h = camDist * 0.5;
    const sx = shake ? (Math.random() - 0.5) * 0.4 : 0;
    const ground = gh(P.x, P.z);
    camGround += (ground - camGround) * 0.12;
    { const cx = P.x + Math.sin(yaw) * camDist + sx; const cz = P.z + Math.cos(yaw) * camDist; let cy = camGround + h + P.y * 0.5; for (let k = 0.25; k <= 1; k += 0.25) cy = Math.max(cy, gh(P.x + (cx - P.x) * k, P.z + (cz - P.z) * k) + 1.8 + h * 0.25 * k); camera.position.set(cx, cy, cz); }
    camera.lookAt(P.x - Math.sin(yaw) * 3, camGround + 2.2 + P.y * 0.5, P.z - Math.cos(yaw) * 3);

    const anim = P.moving ? 'walk' : 'idle';
    player.frame(anim, frameAt(P.id, anim, t), P.dir);
    // co-op teammates, from their last sent positions (same zone only)
    if (link) {
      const seen = new Set();
      for (const m of link.mates()) {
        if ((m.pos.zone || 1) !== zone) continue;
        seen.add(m.id);
        let mon = mateMons.get(m.id);
        const sid = BY_ID.has(m.pos.id) ? m.pos.id : m.species;
        if (!mon) { mon = new Mon(scene, sid, 1.6); mon.px = m.pos.x; mon.pz = m.pos.z; mateMons.set(m.id, mon); }
        mon.px += (m.pos.x - mon.px) * 0.25; mon.pz += (m.pos.z - mon.pz) * 0.25;
        mon.frame('walk', frameAt(sid, 'walk', t), m.pos.dir || 0);
        const g0 = gh(mon.px, mon.pz); mon.place(mon.px, g0 + (m.pos.y || 0), mon.pz, g0);
      }
      for (const [id, mon] of mateMons) if (!seen.has(id)) { mon.dispose(); mateMons.delete(id); }
    }
    player.place(P.x, ground + P.y, P.z, ground);
    player.sprite.visible = !(P.hurt > 0 && Math.floor(t * 20) % 2);
    player.tint(evolving > 0 ? Math.abs(Math.sin(t * 12)) : 0);
    ring.position.set(P.x, ground + 0.1, P.z);
    ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);

    for (const e of enemies) {
      e.m.frame('walk', frameAt(e.id, 'walk', t + e.wob), e.dir);
      { const eg = gh(e.x, e.z); e.m.place(e.x, eg + (e.float ? 3.2 : 0), e.z, eg); }
      e.m.tint(e.flash > 0 ? 1 : 0);
    }
    for (const b of balls) { b.sp.position.y = gh(b.x, b.z) + Math.abs(Math.sin(t * 2 + b.x)) * 0.15; b.sp.rotation.y = t * 0.8 + b.x; }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= paused ? 0 : 1 / 60;
      const k = 1 - f.life / f.max;
      if (f.sp) {
        f.sp.position.x += f.vx / 60;
        f.sp.position.y += f.vy / 60;
        f.sp.position.z += f.vz / 60;
        f.sp.scale.setScalar(f.size * (1 + f.grow * k));
        f.sp.material.opacity = 1 - k;
      } else {
        f.ring.scale.setScalar(Math.max(0.01, f.radius * k));
        f.ring.material.opacity = 1 - k;
      }
      if (f.life <= 0) {
        const o = f.sp || f.ring;
        scene.remove(o);
        o.material.dispose();
        if (f.ring) f.ring.geometry.dispose();
        fx.splice(i, 1);
      }
    }
    renderer.render(scene, camera);

    // labels
    const [hx, hy, vis] = project(P.x, ground - 0.15, P.z);
    hpEl.style.transform = `translate(${hx}px, ${hy}px)`;
    hpEl.hidden = !vis;
    hpEl.querySelector('i').style.width = `${(P.hp / P.maxHp) * 100}%`;
    hpEl.querySelector('b').textContent = Math.ceil(P.hp);
    for (let i = tags.length - 1; i >= 0; i--) {
      const g = tags[i];
      g.t -= 1 / 60;
      g.y += 0.03;
      const [x, y, ok] = project(g.x, g.y, g.z);
      g.el.style.transform = `translate(${x}px, ${y}px)`;
      g.el.style.opacity = Math.min(1, g.t * 2);
      g.el.hidden = !ok;
      if (g.t <= 0) { g.el.remove(); tags.splice(i, 1); }
    }
    const near = balls.find((o) => Math.hypot(o.x - P.x, o.z - P.z) < 2.6);
    root.querySelector('.r3').classList.toggle('near-ball', !!near);
  }

  function loop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    shared.uTime.value = now / 1000;
    if (!paused) update(dt);
    if (over && !root.isConnected) return;
    render(now);
    mapT -= dt;
    if (mapT <= 0) { mapT = 0.1; drawMap(); hudTick(); }
    raf = requestAnimationFrame(loop);
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    link?.close();
    for (const m of mateMons.values()) m.dispose();
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    renderer.dispose();
  }

  hudStatic();
  hudTick();
  banner('À toi de survivre !', `${B.name} · Zone 1/3`, 'blue');
  raf = requestAnimationFrame(loop);
  void s0;
}

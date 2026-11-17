// The player's profile: kept in this browser and, when the server is there, on the server too
// (tied to the account, or to this device for a guest), like the original.
import { queueProfile } from '../api.js';

const KEY = 'pokebonk.guest';
export const STARTERS = [155, 4, 1, 7, 25];
export const LEAGUE_TOTAL = 138;

function fresh() {
  return {
    created: Date.now(), stardust: 0, league: [], seen: [], lastSpecies: 155, favorites: [], starter: null, starterJ: null,
    best: { classic: null, endless: 0 }, runs: [], lab: { hp: 0, dmg: 0, spd: 0 },
    stats: { runs: 0, kills: 0, wins: 0, evolutions: 0 },
    daily: { day: '', done: [] },
  };
}

export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && p.created) {
      const q = { ...fresh(), ...p };
      // Profiles made before the starter screens existed already have their League.
      if (q.starter == null && q.league.length) { q.starter = q.league.find((id) => [1, 4, 7].includes(id)) ?? q.league[0]; q.starterJ = q.league.find((id) => [152, 155, 158].includes(id)) ?? q.starter; }
      return q;
    }
  } catch { /* private mode or damaged data */ }
  return null;
}

export function createProfile() {
  const p = fresh();
  saveProfile(p);
  return p;
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full or blocked */ }
  queueProfile(p);
}

export function clearProfile() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Three daily missions, the same for everybody on a given day.
export function dailyTasks(p) {
  if (p.daily.day !== today()) p.daily = { day: today(), done: [], kills: 0, best: 0, evolved: 0 };
  return [
    { id: 'kills', goal: 150, value: p.daily.kills || 0 },
    { id: 'survive', goal: 300, value: p.daily.best || 0 },
    { id: 'evolve', goal: 1, value: p.daily.evolved || 0 },
  ];
}

export function recordRun(p, r) {
  p.stats.runs++;
  p.stats.kills += r.kills;
  if (r.victory) p.stats.wins++;
  if (r.species !== r.start) p.stats.evolutions++;
  p.stardust += r.dust;
  p.lastSpecies = r.start;
  p.seen = [...new Set([...p.seen, ...r.seen])];
  if (r.map) p.lastMap = r.map;
  if (r.victory && r.map && r.mode !== 'endless') p.mapsWon = [...new Set([...(p.mapsWon || []), r.map])];
  if (r.legendary) p.stats.legendaries = (p.stats.legendaries || 0) + 1;
  if (r.alphas) p.stats.alphas = (p.stats.alphas || 0) + r.alphas;
  dailyTasks(p);
  p.daily.kills = (p.daily.kills || 0) + r.kills;
  p.daily.best = Math.max(p.daily.best || 0, r.time);
  if (r.species !== r.start) p.daily.evolved = (p.daily.evolved || 0) + 1;
  if (r.mode === 'endless') p.best.endless = Math.max(p.best.endless, r.time);
  else if (r.victory && (!p.best.classic || r.time < p.best.classic)) p.best.classic = r.time;
  p.runs = [{ ...r, seen: undefined, at: Date.now() }, ...p.runs].slice(0, 30);
  // A won classic run brings a new member into the League.
  if (r.victory) {
    const pool = [10, 13, 16, 19, 21, 23, 27, 29, 32, 41, 43, 46, 48, 52, 54, 56, 60, 69, 74].filter((id) => !p.league.includes(id));
    if (pool.length) p.league.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  saveProfile(p);
}

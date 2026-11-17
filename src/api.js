// Talks to the PokéBonk server (app/server): accounts, the profile kept on the server, runs and
// leaderboards. When the site runs without its server (a plain static host), every call fails quietly
// and the game keeps working on this device only.
const TOKEN_KEY = 'pokebonk.token';
const base = new URL('./api/', location.href).href;
let online = null;

export const token = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

async function call(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  const t = token();
  if (t) headers.authorization = `Bearer ${t}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : null;
  if (!data) throw Object.assign(new Error('offline'), { code: 'offline' });
  if (!res.ok) throw Object.assign(new Error(data.error || 'error'), { code: data.error || 'error', status: res.status });
  return data;
}

// Is the server there? Asked once, quickly.
export async function available() {
  if (online !== null) return online;
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(base + 'health', { signal: ctl.signal }); clearTimeout(timer);
    online = res.ok && (res.headers.get('content-type') || '').includes('json');
  } catch { online = false; }
  return online;
}

// The account behind this device: the saved session, or a new guest account.
export async function session() {
  if (!(await available())) return null;
  if (token()) { try { return await call('GET', 'me'); } catch (e) { if (e.status === 401) setToken(null); else return null; } }
  try { const r = await call('POST', 'guest'); setToken(r.token); return r; } catch { return null; }
}
export async function login(name, password) { const r = await call('POST', 'login', { name, password }); setToken(r.token); return r; }
export async function register(name, password) { const r = await call('POST', 'register', { name, password }); setToken(r.token); return r; }
export async function logout() { try { await call('POST', 'logout'); } catch { /* already gone */ } setToken(null); }

// The profile follows the player: saved on the server a moment after each change.
let pending = null; let timer = 0;
export function queueProfile(profile) {
  if (!token() || online === false) return;
  pending = profile;
  clearTimeout(timer);
  timer = setTimeout(() => { const p = pending; pending = null; call('PUT', 'profile', { profile: p }).catch(() => {}); }, 1200);
}
export const postRun = (run) => (token() && online ? call('POST', 'runs', run).catch(() => null) : Promise.resolve(null));
export const leaderboard = (q = {}) => (online === false ? Promise.resolve(null) : call('GET', `leaderboard?${new URLSearchParams(q)}`).catch(() => null));
export const myRuns = () => (token() && online ? call('GET', 'runs/mine').catch(() => null) : Promise.resolve(null));

// Generic calls for the social screens (clans, friends, co-op, Trésors, account).
export const get = (path) => call('GET', path);
export const post = (path, body = {}) => call('POST', path, body);
export const put = (path, body = {}) => call('PUT', path, body);
export const isOnline = () => online === true && !!token();
export async function resetPassword(resetToken, password) { const r = await call('POST', 'password/reset', { token: resetToken, password }); setToken(r.token); return r; }

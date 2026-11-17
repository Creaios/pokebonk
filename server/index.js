// PokéBonk server: serves the built site (dist/) and the game's API, with a SQLite database.
// Accounts (sign-up, sign-in, guest accounts tied to the device), sessions, the player's profile saved
// on the server, every finished run, the season leaderboards and each player's best scores.
// Run it with `npm start` (after `npm run build`); PORT and DB_PATH can be set in the environment.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');
const DB_PATH = process.env.DB_PATH || resolve(here, '../data/pokebonk.db');
const PORT = Number(process.env.PORT || 8787);
const SESSION_DAYS = 60;
const MAPS = ['forest', 'desert', 'coast', 'glacier', 'canela', 'cave', 'encina', 'iris'];
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

if (!existsSync(dirname(DB_PATH))) mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE, pass_hash TEXT, guest INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS profiles (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, season INTEGER NOT NULL,
    map TEXT NOT NULL, mode TEXT NOT NULL, difficulty TEXT NOT NULL, species INTEGER NOT NULL, start INTEGER NOT NULL,
    kills INTEGER NOT NULL, time REAL NOT NULL, level INTEGER NOT NULL, victory INTEGER NOT NULL, legendary INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS runs_board ON runs(season, map, mode, difficulty, kills DESC);
  CREATE INDEX IF NOT EXISTS runs_account ON runs(account_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS clans (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE NOT NULL, tag TEXT NOT NULL, motto TEXT NOT NULL DEFAULT '',
    owner_id INTEGER NOT NULL REFERENCES accounts(id), open INTEGER NOT NULL DEFAULT 1, bank INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS clan_members (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', joined_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS friends (
    a INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, b INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (a, b));
  CREATE TABLE IF NOT EXISTS spins (
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, wheel INTEGER NOT NULL, slot INTEGER NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (account_id, wheel, slot));
  CREATE TABLE IF NOT EXISTS clan_messages (
    id INTEGER PRIMARY KEY, clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    text TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS clan_invites (
    clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    from_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, at INTEGER NOT NULL, PRIMARY KEY (clan_id, account_id));
  CREATE TABLE IF NOT EXISTS resets (
    token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
`);
// Columns added after the first release.
for (const [t, c] of [['accounts', 'email TEXT'], ['accounts', 'bonkoins INTEGER NOT NULL DEFAULT 0']]) { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c}`); } catch { /* already there */ } }

// Seasons are weeks, ending on Monday 00:00 UTC, like the game's countdown.
const SEASON_ZERO = Date.UTC(2026, 10, 2);
const seasonOf = (t = Date.now()) => Math.floor((t - SEASON_ZERO) / (7 * 864e5)) + 1;
const seasonEnd = (s = seasonOf()) => SEASON_ZERO + s * 7 * 864e5;

// ---- passwords and sessions ----
function hashPass(pw) { const salt = randomBytes(16); return `s1$${salt.toString('hex')}$${scryptSync(pw, salt, 32).toString('hex')}`; }
function checkPass(pw, stored) {
  const [, salt, hash] = String(stored || '').split('$');
  if (!salt || !hash) return false;
  const a = scryptSync(pw, Buffer.from(salt, 'hex'), 32); const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
function newSession(accountId) {
  const token = randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, accountId, Date.now() + SESSION_DAYS * 864e5);
  return token;
}
function accountFrom(req) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const row = db.prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ? AND s.expires_at > ?').get(m[1], Date.now());
  if (row) db.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').run(Date.now(), row.id);
  return row ? { ...row, token: m[1] } : null;
}
const publicAccount = (a) => ({ id: a.id, name: a.name, guest: !!a.guest, createdAt: a.created_at, bonkoins: a.bonkoins ?? 0, email: a.email ? a.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null });
function loadProfile(id) { const r = db.prepare('SELECT data, updated_at FROM profiles WHERE account_id = ?').get(id); return r ? { profile: JSON.parse(r.data), updatedAt: r.updated_at } : { profile: null, updatedAt: 0 }; }

// ---- small sign-in throttle per address ----
const tries = new Map();
function throttled(ip) { const t = tries.get(ip) || { n: 0, at: Date.now() }; if (Date.now() - t.at > 10 * 60e3) { t.n = 0; t.at = Date.now(); } t.n++; tries.set(ip, t); return t.n > 20; }

// ---- leaderboards ----
// Best run per player on a board: most K.O. (classic and survival), or fastest victory ("time").
function board({ map = 'forest', mode = 'classic', difficulty = 'normal', kind = 'kills', season = seasonOf() }) {
  const fastest = kind === 'time';
  const rows = db.prepare(`
    SELECT a.id AS accountId, a.name, a.guest, r.species, r.kills, r.time, r.level, r.created_at AS at
    FROM runs r JOIN accounts a ON a.id = r.account_id
    WHERE r.season = ? AND (? = 'all' OR r.map = ?) AND r.mode = ? AND r.difficulty = ? ${fastest ? 'AND r.victory = 1' : ''}
      AND r.id = (SELECT r2.id FROM runs r2 WHERE r2.account_id = r.account_id AND r2.season = r.season AND (? = 'all' OR r2.map = ?)
        AND r2.mode = r.mode AND r2.difficulty = r.difficulty ${fastest ? 'AND r2.victory = 1 ORDER BY r2.time ASC' : 'ORDER BY r2.kills DESC, r2.time ASC'} LIMIT 1)
    ORDER BY ${fastest ? 'r.time ASC' : 'r.kills DESC, r.time ASC'}`).all(season, map, map, mode, difficulty, map, map);
  return rows.map((r, i) => ({ rank: i + 1, ...r, guest: !!r.guest }));
}
// "Mondial": the sum of each player's best K.O. on every map this season.
function worldBoard(season = seasonOf()) {
  return db.prepare(`
    SELECT a.id AS accountId, a.name, a.guest, SUM(best) AS kills FROM (
      SELECT account_id, map, MAX(kills) AS best FROM runs WHERE season = ? AND mode = 'classic' GROUP BY account_id, map
    ) b JOIN accounts a ON a.id = b.account_id GROUP BY a.id ORDER BY kills DESC`).all(season).map((r, i) => ({ rank: i + 1, ...r, guest: !!r.guest }));
}

// ---- co-op rooms (kept in memory: a room lives while its trainers play) ----
const rooms = new Map();
const roomCode = () => { let c; do { c = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join(''); } while (rooms.has(c)); return c; };
const member = (acc, b) => ({ id: acc.id, name: acc.guest ? 'Invité' : acc.name, species: Math.floor(Number(b.species)) || 155, ready: false, seen: Date.now(), pos: null });
function createRoom(acc, b) {
  const room = { code: roomCode(), host: acc.id, map: MAPS.includes(b.map) ? b.map : 'forest', difficulty: ['normal', 'hard', 'nightmare'].includes(b.difficulty) ? b.difficulty : 'normal', members: [member(acc, b)], started: 0, seed: 0, created: Date.now() };
  rooms.set(room.code, room); return room;
}
function joinRoom(acc, code, b) {
  const room = rooms.get(code); if (!room) fail(404, 'no_room');
  if (!room.members.some((m) => m.id === acc.id)) { if (room.members.length >= 4) fail(409, 'full'); if (room.started) fail(409, 'started'); room.members.push(member(acc, b)); }
  return room;
}
const roomView = (room, acc) => ({ code: room.code, host: room.host, you: acc.id, map: room.map, difficulty: room.difficulty, started: room.started, seed: room.seed, members: room.members.map((m) => ({ id: m.id, name: m.name, species: m.species, ready: m.ready, pos: m.pos, online: Date.now() - m.seen < 6000 })) });
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) { r.members = r.members.filter((m) => now - m.seen < 30e3); if (!r.members.length || now - r.created > 6 * 3600e3) rooms.delete(c); } }, 10e3).unref();

// ---- Trésors wheel: 4 bag items, a title, a frame, two rare items, a look and the grand prize ----
const SPIN_COST = 3;
const WHEEL = [30, 27, 25, 21, 18, 14, 10, 8, 4, 1];

// ---- e-mail: SMTP over TLS when SMTP_HOST / SMTP_USER / SMTP_PASS are set, else the link is printed here ----
function sendMail(to, subject, text) {
  const host = process.env.SMTP_HOST;
  if (!host) { console.log(`[mail to ${to}] ${subject}\n${text}`); return Promise.resolve(); }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return new Promise((ok, ko) => {
    const sock = tlsConnect({ host, port: Number(process.env.SMTP_PORT || 465), servername: host }, () => {});
    const auth = Buffer.from(`\0${process.env.SMTP_USER}\0${process.env.SMTP_PASS}`).toString('base64');
    const body = [`From: PokéBonk <${from}>`, `To: <${to}>`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(text).toString('base64').replace(/.{76}/g, '$&\r\n'), '.'].join('\r\n');
    const steps = [`EHLO pokebonk`, `AUTH PLAIN ${auth}`, `MAIL FROM:<${from}>`, `RCPT TO:<${to}>`, 'DATA', body, 'QUIT'];
    let i = -1;
    sock.setEncoding('utf8'); sock.setTimeout(15000, () => { sock.destroy(); ko(new Error('smtp timeout')); });
    sock.on('data', (d) => { const code = +d.slice(0, 3); if (code >= 400) { sock.end(); ko(new Error(d.trim())); return; } if (/^\d{3}-/m.test(d.split('\r\n').filter(Boolean).pop())) return; i++; if (i < steps.length) sock.write(steps[i] + '\r\n'); else { sock.end(); ok(); } });
    sock.on('error', ko);
  });
}

// ---- HTTP ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}
async function readJson(req, max = 512e3) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error('too big'), { status: 413 }); chunks.push(c); }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}
const fail = (status, error) => { throw Object.assign(new Error(error), { status, error }); };

const routes = {
  'GET /api/health': () => ({ ok: true, season: seasonOf(), seasonEnds: seasonEnd() }),
  // A guest account: playable at once, kept on the server and tied to this device by its token.
  'POST /api/guest': () => {
    const now = Date.now();
    const id = db.prepare('INSERT INTO accounts (name, guest, created_at, last_seen) VALUES (?, 1, ?, ?)').run('Invité', now, now).lastInsertRowid;
    return { token: newSession(Number(id)), account: publicAccount({ id: Number(id), name: 'Invité', guest: 1, created_at: now }), profile: null };
  },
  'POST /api/register': async (req, acc, body) => {
    const name = String(body.name || '').trim(); const pw = String(body.password || '');
    if (!NAME_RE.test(name)) fail(400, 'name');
    if (pw.length < 8 || pw.length > 200) fail(400, 'password');
    if (db.prepare('SELECT 1 FROM accounts WHERE name_key = ?').get(name.toLowerCase())) fail(409, 'taken');
    const now = Date.now();
    // A guest who signs up keeps everything: the guest account becomes the real one.
    if (acc?.guest) {
      db.prepare('UPDATE accounts SET name = ?, name_key = ?, pass_hash = ?, guest = 0 WHERE id = ?').run(name, name.toLowerCase(), hashPass(pw), acc.id);
      return { token: acc.token, account: publicAccount({ ...acc, name, guest: 0 }), ...loadProfile(acc.id) };
    }
    const id = Number(db.prepare('INSERT INTO accounts (name, name_key, pass_hash, guest, created_at, last_seen) VALUES (?, ?, ?, 0, ?, ?)').run(name, name.toLowerCase(), hashPass(pw), now, now).lastInsertRowid);
    return { token: newSession(id), account: publicAccount({ id, name, guest: 0, created_at: now }), profile: null };
  },
  'POST /api/login': async (req, acc, body) => {
    if (throttled(req.socket.remoteAddress)) fail(429, 'slow');
    const row = db.prepare('SELECT * FROM accounts WHERE name_key = ? AND guest = 0').get(String(body.name || '').trim().toLowerCase());
    if (!row || !checkPass(String(body.password || ''), row.pass_hash)) fail(401, 'wrong');
    return { token: newSession(row.id), account: publicAccount(row), ...loadProfile(row.id) };
  },
  'POST /api/logout': (req, acc) => { if (acc) db.prepare('DELETE FROM sessions WHERE token = ?').run(acc.token); return { ok: true }; },
  'GET /api/me': (req, acc) => { if (!acc) fail(401, 'auth'); return { account: publicAccount(acc), ...loadProfile(acc.id) }; },
  'PUT /api/profile': async (req, acc, body) => {
    if (!acc) fail(401, 'auth');
    if (!body.profile || typeof body.profile !== 'object') fail(400, 'profile');
    const now = Date.now();
    // Prizes are the server's to give: the saved ones are kept whatever the client sends.
    const kept = loadProfile(acc.id).profile?.treasures;
    const data = { ...body.profile, treasures: kept || {} };
    db.prepare('INSERT INTO profiles (account_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(acc.id, JSON.stringify(data), now);
    return { ok: true, updatedAt: now };
  },
  // A finished run: checked for plausibility, stored, and placed on the boards.
  'POST /api/runs': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const map = MAPS.includes(b.map) ? b.map : 'forest';
    const mode = b.mode === 'endless' ? 'endless' : 'classic';
    const difficulty = ['normal', 'hard', 'nightmare'].includes(b.difficulty) ? b.difficulty : 'normal';
    const kills = Math.max(0, Math.floor(Number(b.kills) || 0)); const time = Math.max(0, Number(b.time) || 0); const level = Math.max(1, Math.floor(Number(b.level) || 1));
    if (time > 6 * 3600 || kills > time * 40 + 50 || level > 200) fail(422, 'implausible');
    const species = Math.floor(Number(b.species) || 0); const start = Math.floor(Number(b.start) || species);
    if (species < 1 || species > 251) fail(400, 'species');
    db.prepare('INSERT INTO runs (account_id, season, map, mode, difficulty, species, start, kills, time, level, victory, legendary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(acc.id, seasonOf(), map, mode, difficulty, species, start, kills, time, level, b.victory ? 1 : 0, b.legendary ? 1 : 0, Date.now());
    // Bonkoins: guardians and bosses drop them in the game; here a run pays for its victory, its legendary and its K.O.
    const coins = (b.victory ? 2 : 0) + (b.legendary ? 3 : 0) + Math.min(3, Math.floor(kills / 150));
    if (coins) db.prepare('UPDATE accounts SET bonkoins = bonkoins + ? WHERE id = ?').run(coins, acc.id);
    const rows = board({ map, mode, difficulty });
    const mine = rows.find((r) => r.accountId === acc.id);
    return { ok: true, rank: mine?.rank ?? null, of: rows.length, best: mine ? { kills: mine.kills, time: mine.time } : null, coins, bonkoins: (acc.bonkoins ?? 0) + coins };
  },
  'GET /api/leaderboard': (req, acc, b, q) => {
    const kind = q.get('kind') === 'time' ? 'time' : q.get('kind') === 'world' ? 'world' : 'kills';
    const season = Number(q.get('season')) || seasonOf();
    const rows = kind === 'world' ? worldBoard(season) : board({ map: q.get('map') || 'forest', mode: q.get('mode') || 'classic', difficulty: q.get('difficulty') || 'normal', kind, season });
    const limit = Math.max(1, Math.min(500, Number(q.get('limit')) || 100));
    return { season, seasonEnds: seasonEnd(season), total: rows.length, top: rows.slice(0, limit), me: acc ? rows.find((r) => r.accountId === acc.id) || null : null };
  },
  // ---- clans ----
  'GET /api/clans': (req, acc, b, q) => {
    const season = seasonOf(); const search = `%${(q.get('q') || '').toLowerCase()}%`;
    const rows = db.prepare(`SELECT c.id, c.name, c.tag, c.motto, c.open, c.bank, (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id) AS members,
      COALESCE((SELECT SUM(r.kills + r.victory * 200 + r.legendary * 400) FROM runs r JOIN clan_members m ON m.account_id = r.account_id WHERE m.clan_id = c.id AND r.season = ?), 0) AS points
      FROM clans c WHERE c.name_key LIKE ? OR lower(c.tag) LIKE ? ORDER BY points DESC, members DESC LIMIT 100`).all(season, search, search);
    return { season, clans: rows.map((r, i) => ({ rank: i + 1, ...r, open: !!r.open })) };
  },
  'GET /api/clans/mine': (req, acc) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id, role FROM clan_members WHERE account_id = ?').get(acc.id);
    if (!m) return { clan: null };
    const clan = db.prepare('SELECT id, name, tag, motto, open, bank, owner_id AS ownerId FROM clans WHERE id = ?').get(m.clan_id);
    const members = db.prepare(`SELECT a.id, a.name, cm.role, COALESCE((SELECT SUM(r.kills + r.victory * 200 + r.legendary * 400) FROM runs r WHERE r.account_id = a.id AND r.season = ?), 0) AS points,
      (SELECT MAX(created_at) FROM runs r WHERE r.account_id = a.id) AS lastRun FROM clan_members cm JOIN accounts a ON a.id = cm.account_id WHERE cm.clan_id = ? ORDER BY points DESC`).all(seasonOf(), clan.id);
    return { clan: { ...clan, open: !!clan.open, points: members.reduce((x, y) => x + y.points, 0) }, role: m.role, members };
  },
  'POST /api/clans': async (req, acc, b) => {
    if (!acc || acc.guest) fail(acc ? 403 : 401, acc ? 'guest' : 'auth');
    if (db.prepare('SELECT 1 FROM clan_members WHERE account_id = ?').get(acc.id)) fail(409, 'in_clan');
    const name = String(b.name || '').trim(); const tag = String(b.tag || '').trim().toUpperCase();
    if (!/^[\p{L}\p{N} _'-]{3,24}$/u.test(name)) fail(400, 'name');
    if (!/^[A-Z0-9]{2,5}$/.test(tag)) fail(400, 'tag');
    if (db.prepare('SELECT 1 FROM clans WHERE name_key = ?').get(name.toLowerCase())) fail(409, 'taken');
    const now = Date.now();
    const id = Number(db.prepare('INSERT INTO clans (name, name_key, tag, motto, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(name, name.toLowerCase(), tag, String(b.motto || '').slice(0, 120), acc.id, now).lastInsertRowid);
    db.prepare("INSERT INTO clan_members (account_id, clan_id, role, joined_at) VALUES (?, ?, 'chief', ?)").run(acc.id, id, now);
    return { ok: true, id };
  },
  'POST /api/clans/join': async (req, acc, b) => {
    if (!acc || acc.guest) fail(acc ? 403 : 401, acc ? 'guest' : 'auth');
    if (db.prepare('SELECT 1 FROM clan_members WHERE account_id = ?').get(acc.id)) fail(409, 'in_clan');
    const c = db.prepare('SELECT id, open FROM clans WHERE id = ?').get(Number(b.id));
    if (!c) fail(404, 'no_clan'); if (!c.open) fail(403, 'closed');
    if (db.prepare('SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?').get(c.id).n >= 300) fail(409, 'full');
    db.prepare('INSERT INTO clan_members (account_id, clan_id, joined_at) VALUES (?, ?, ?)').run(acc.id, c.id, Date.now());
    return { ok: true };
  },
  'POST /api/clans/leave': (req, acc) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id, role FROM clan_members WHERE account_id = ?').get(acc.id);
    if (!m) return { ok: true };
    db.prepare('DELETE FROM clan_members WHERE account_id = ?').run(acc.id);
    const next = db.prepare('SELECT account_id FROM clan_members WHERE clan_id = ? ORDER BY joined_at LIMIT 1').get(m.clan_id);
    if (!next) db.prepare('DELETE FROM clans WHERE id = ?').run(m.clan_id);
    else if (m.role === 'chief') { db.prepare("UPDATE clan_members SET role = 'chief' WHERE account_id = ?").run(next.account_id); db.prepare('UPDATE clans SET owner_id = ? WHERE id = ?').run(next.account_id, m.clan_id); }
    return { ok: true };
  },
  // The clan's piggy bank: members put Bonkoins in it.
  'POST /api/clans/donate': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id FROM clan_members WHERE account_id = ?').get(acc.id); if (!m) fail(404, 'no_clan');
    const n = Math.floor(Number(b.amount) || 0); if (n < 1 || n > (acc.bonkoins ?? 0)) fail(400, 'amount');
    db.prepare('UPDATE accounts SET bonkoins = bonkoins - ? WHERE id = ?').run(n, acc.id); db.prepare('UPDATE clans SET bank = bank + ? WHERE id = ?').run(n, m.clan_id);
    return { ok: true, bonkoins: acc.bonkoins - n };
  },
  // ---- clan mailbox and invitations ----
  'GET /api/clans/messages': (req, acc) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id FROM clan_members WHERE account_id = ?').get(acc.id); if (!m) fail(404, 'no_clan');
    return { messages: db.prepare('SELECT cm.id, cm.text, cm.at, a.name, a.id AS accountId FROM clan_messages cm JOIN accounts a ON a.id = cm.account_id WHERE cm.clan_id = ? ORDER BY cm.id DESC LIMIT 60').all(m.clan_id).reverse() };
  },
  'POST /api/clans/messages': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id FROM clan_members WHERE account_id = ?').get(acc.id); if (!m) fail(404, 'no_clan');
    const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 280); if (!text) fail(400, 'text');
    db.prepare('INSERT INTO clan_messages (clan_id, account_id, text, at) VALUES (?, ?, ?, ?)').run(m.clan_id, acc.id, text, Date.now());
    db.prepare('DELETE FROM clan_messages WHERE clan_id = ? AND id NOT IN (SELECT id FROM clan_messages WHERE clan_id = ? ORDER BY id DESC LIMIT 500)').run(m.clan_id, m.clan_id);
    return { ok: true };
  },
  'POST /api/clans/invite': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const m = db.prepare('SELECT clan_id FROM clan_members WHERE account_id = ?').get(acc.id); if (!m) fail(404, 'no_clan');
    const other = db.prepare('SELECT id FROM accounts WHERE name_key = ? AND guest = 0').get(String(b.name || '').trim().toLowerCase());
    if (!other) fail(404, 'no_player'); if (other.id === acc.id) fail(400, 'self');
    if (db.prepare('SELECT 1 FROM clan_members WHERE account_id = ?').get(other.id)) fail(409, 'other_in_clan');
    db.prepare('INSERT OR REPLACE INTO clan_invites (clan_id, account_id, from_id, at) VALUES (?, ?, ?, ?)').run(m.clan_id, other.id, acc.id, Date.now());
    return { ok: true };
  },
  'GET /api/invites': (req, acc) => {
    if (!acc) fail(401, 'auth');
    return { invites: db.prepare('SELECT ci.clan_id AS clanId, c.name, c.tag, a.name AS fromName, ci.at, (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) AS members FROM clan_invites ci JOIN clans c ON c.id = ci.clan_id JOIN accounts a ON a.id = ci.from_id WHERE ci.account_id = ? ORDER BY ci.at DESC').all(acc.id) };
  },
  'POST /api/invites/answer': async (req, acc, b) => {
    if (!acc || acc.guest) fail(acc ? 403 : 401, acc ? 'guest' : 'auth');
    const inv = db.prepare('SELECT clan_id FROM clan_invites WHERE clan_id = ? AND account_id = ?').get(Number(b.clanId), acc.id); if (!inv) fail(404, 'no_invite');
    db.prepare('DELETE FROM clan_invites WHERE clan_id = ? AND account_id = ?').run(inv.clan_id, acc.id);
    if (!b.accept) return { ok: true };
    if (db.prepare('SELECT 1 FROM clan_members WHERE account_id = ?').get(acc.id)) fail(409, 'in_clan');
    if (db.prepare('SELECT COUNT(*) AS n FROM clan_members WHERE clan_id = ?').get(inv.clan_id).n >= 300) fail(409, 'full');
    db.prepare('INSERT INTO clan_members (account_id, clan_id, joined_at) VALUES (?, ?, ?)').run(acc.id, inv.clan_id, Date.now());
    db.prepare('DELETE FROM clan_invites WHERE account_id = ?').run(acc.id);
    return { ok: true };
  },
  // ---- friends ----
  'GET /api/friends': (req, acc) => {
    if (!acc) fail(401, 'auth');
    const rows = db.prepare(`SELECT f.a, f.b, f.status, a.id, a.name, a.last_seen AS lastSeen, (SELECT species FROM runs r WHERE r.account_id = a.id ORDER BY created_at DESC LIMIT 1) AS species
      FROM friends f JOIN accounts a ON a.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE f.a = ? OR f.b = ?`).all(acc.id, acc.id, acc.id);
    const now = Date.now(); const view = (r) => ({ id: r.id, name: r.name, species: r.species, online: now - r.lastSeen < 5 * 60e3, lastSeen: r.lastSeen });
    return { friends: rows.filter((r) => r.status === 'ok').map(view), incoming: rows.filter((r) => r.status === 'pending' && r.b === acc.id).map(view), outgoing: rows.filter((r) => r.status === 'pending' && r.a === acc.id).map(view) };
  },
  'POST /api/friends/request': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const other = db.prepare('SELECT id FROM accounts WHERE name_key = ? AND guest = 0').get(String(b.name || '').trim().toLowerCase());
    if (!other) fail(404, 'no_player'); if (other.id === acc.id) fail(400, 'self');
    const back = db.prepare('SELECT status FROM friends WHERE a = ? AND b = ?').get(other.id, acc.id);
    if (back) { db.prepare("UPDATE friends SET status = 'ok' WHERE a = ? AND b = ?").run(other.id, acc.id); return { ok: true, status: 'ok' }; }
    if ((db.prepare("SELECT COUNT(*) AS n FROM friends WHERE (a = ? OR b = ?) AND status = 'ok'").get(acc.id, acc.id).n) >= 100) fail(409, 'full');
    db.prepare("INSERT OR IGNORE INTO friends (a, b, status, created_at) VALUES (?, ?, 'pending', ?)").run(acc.id, other.id, Date.now());
    return { ok: true, status: 'pending' };
  },
  'POST /api/friends/accept': async (req, acc, b) => { if (!acc) fail(401, 'auth'); db.prepare("UPDATE friends SET status = 'ok' WHERE a = ? AND b = ?").run(Number(b.id), acc.id); return { ok: true }; },
  'POST /api/friends/remove': async (req, acc, b) => { if (!acc) fail(401, 'auth'); db.prepare('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').run(acc.id, Number(b.id), Number(b.id), acc.id); return { ok: true }; },
  // ---- co-op rooms: a code to share, 2-4 trainers, the host starts; in a run each one sends its position ----
  'POST /api/coop/create': async (req, acc, b) => { if (!acc) fail(401, 'auth'); return roomView(createRoom(acc, b), acc); },
  'POST /api/coop/join': async (req, acc, b) => { if (!acc) fail(401, 'auth'); return roomView(joinRoom(acc, String(b.code || '').toUpperCase(), b), acc); },
  'POST /api/coop/state': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const room = rooms.get(String(b.code || '').toUpperCase()); if (!room) fail(404, 'no_room');
    const me = room.members.find((m) => m.id === acc.id); if (!me) fail(403, 'not_member');
    me.seen = Date.now();
    if (b.ready != null) me.ready = !!b.ready;
    if (b.species) me.species = Math.floor(Number(b.species)) || me.species;
    if (b.start && room.host === acc.id && room.members.length >= 1) { room.started = Date.now(); room.seed = Math.floor(Math.random() * 1e9); }
    // The host sends the world (enemies, zone, clock) and its K.O.; the others send their hits on those enemies.
    const isHost = room.host === acc.id;
    if (isHost && b.snap) room.snap = b.snap;
    for (const m of room.members) m.inbox ||= [];
    if (isHost && Array.isArray(b.kills) && b.kills.length) for (const m of room.members) if (m.id !== acc.id) m.inbox.push(...b.kills.slice(0, 200).map((k) => ['kill', ...k]));
    if (isHost && Array.isArray(b.fx) && b.fx.length) for (const m of room.members) if (m.id !== acc.id) m.inbox.push(...b.fx.slice(0, 300).map((x) => ['fx', ...x]));
    if (!isHost && Array.isArray(b.hits) && b.hits.length) { const h = room.members.find((m) => m.id === room.host); if (h) h.inbox.push(...b.hits.slice(0, 200).map((x) => ['hit', ...x])); }
    if (b.pos) me.pos = { x: +b.pos.x || 0, z: +b.pos.z || 0, y: +b.pos.y || 0, dir: b.pos.dir | 0, hp: +b.pos.hp || 0, lv: b.pos.lv | 0, id: b.pos.id | 0, zone: b.pos.zone | 0, dash: !!b.pos.dash, yaw: +b.pos.yaw || 0, maxHp: +b.pos.maxHp || 100 };
    if (b.leave) { room.members = room.members.filter((m) => m.id !== acc.id); if (!room.members.length) rooms.delete(room.code); else if (room.host === acc.id) room.host = room.members[0].id; return { ok: true }; }
    const out = roomView(room, acc);
    if (room.started) { out.events = (me.inbox || []).splice(0, 400); if (!isHost) out.snap = room.snap || null; }
    return out;
  },
  // ---- Trésors: a wheel of 10 rewards per starter family; each spin costs Bonkoins and never repeats a slot ----
  'GET /api/treasures': (req, acc) => {
    if (!acc) fail(401, 'auth');
    const spun = db.prepare('SELECT wheel, slot FROM spins WHERE account_id = ?').all(acc.id);
    return { bonkoins: acc.bonkoins ?? 0, cost: SPIN_COST, spun };
  },
  'POST /api/treasures/spin': async (req, acc, b) => {
    if (!acc) fail(401, 'auth');
    const wheel = Math.floor(Number(b.wheel)); if (!(wheel >= 0 && wheel < 6)) fail(400, 'wheel');
    if ((acc.bonkoins ?? 0) < SPIN_COST) fail(402, 'coins');
    const done = new Set(db.prepare('SELECT slot FROM spins WHERE account_id = ? AND wheel = ?').all(acc.id, wheel).map((r) => r.slot));
    const left = WHEEL.map((w, slot) => ({ w, slot })).filter((x) => !done.has(x.slot));
    if (!left.length) fail(409, 'complete');
    let r = Math.random() * left.reduce((x, y) => x + y.w, 0); let pick = left[0];
    for (const x of left) { if ((r -= x.w) <= 0) { pick = x; break; } }
    db.prepare('UPDATE accounts SET bonkoins = bonkoins - ? WHERE id = ?').run(SPIN_COST, acc.id);
    db.prepare('INSERT INTO spins (account_id, wheel, slot, at) VALUES (?, ?, ?, ?)').run(acc.id, wheel, pick.slot, Date.now());
    // the reward lands in the profile kept on the server
    const { profile } = loadProfile(acc.id);
    const p = profile || {}; p.treasures = p.treasures || {}; (p.treasures[wheel] ||= []).push(pick.slot);
    db.prepare('INSERT INTO profiles (account_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(acc.id, JSON.stringify(p), Date.now());
    return { slot: pick.slot, bonkoins: acc.bonkoins - SPIN_COST, left: left.length - 1, treasures: p.treasures };
  },
  // ---- e-mail and password reset ----
  'PUT /api/account/email': async (req, acc, b) => {
    if (!acc || acc.guest) fail(acc ? 403 : 401, acc ? 'guest' : 'auth');
    const email = String(b.email || '').trim();
    if (email && !/^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(email)) fail(400, 'email');
    db.prepare('UPDATE accounts SET email = ? WHERE id = ?').run(email || null, acc.id);
    return { ok: true };
  },
  'POST /api/password/forgot': async (req, acc, b) => {
    if (throttled(req.socket.remoteAddress)) fail(429, 'slow');
    const key = String(b.name || '').trim().toLowerCase();
    const row = db.prepare('SELECT id, name, email FROM accounts WHERE guest = 0 AND (name_key = ? OR lower(email) = ?)').get(key, key);
    // Same answer whether or not the account exists, so names and addresses can't be probed.
    if (row?.email) {
      const token = randomBytes(24).toString('base64url');
      db.prepare('INSERT INTO resets (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, row.id, Date.now() + 3600e3);
      const origin = process.env.PUBLIC_URL || `http://${req.headers.host}`;
      sendMail(row.email, 'PokéBonk · nouveau mot de passe', `Bonjour ${row.name},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable une heure) :\n${origin}/?reset=${token}\n\nSi tu n'as rien demandé, ignore ce message.`).catch((e) => console.error('mail', e.message));
    }
    return { ok: true };
  },
  'POST /api/password/reset': async (req, acc, b) => {
    const row = db.prepare('SELECT account_id FROM resets WHERE token = ? AND expires_at > ?').get(String(b.token || ''), Date.now());
    if (!row) fail(400, 'expired');
    const pw = String(b.password || ''); if (pw.length < 8 || pw.length > 200) fail(400, 'password');
    db.prepare('UPDATE accounts SET pass_hash = ? WHERE id = ?').run(hashPass(pw), row.account_id);
    db.prepare('DELETE FROM resets WHERE account_id = ?').run(row.account_id);
    db.prepare('DELETE FROM sessions WHERE account_id = ?').run(row.account_id);
    const a = db.prepare('SELECT * FROM accounts WHERE id = ?').get(row.account_id);
    return { token: newSession(a.id), account: publicAccount(a), ...loadProfile(a.id) };
  },
  'GET /api/runs/mine': (req, acc) => {
    if (!acc) fail(401, 'auth');
    return { runs: db.prepare('SELECT map, mode, difficulty, species, start, kills, time, level, victory, legendary, created_at AS at FROM runs WHERE account_id = ? ORDER BY created_at DESC LIMIT 30').all(acc.id) };
  },
};

async function serveStatic(req, res, path) {
  let file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST)) return send(res, 403, 'forbidden');
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(DIST, 'index.html'); }
  try {
    const data = await readFile(file);
    send(res, 200, data, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': /\/assets\//.test(file.replace(/\\/g, '/')) ? 'public, max-age=86400' : 'no-cache' });
  } catch { send(res, 404, 'not found'); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'not_found' });
  try {
    const acc = accountFrom(req);
    const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : {};
    send(res, 200, await handler(req, acc, body, url.searchParams));
  } catch (e) {
    send(res, e.status || 500, { error: e.error || (e.status ? e.message : 'server') });
    if (!e.status) console.error(e);
  }
});
// Old sessions are cleared now and then.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();
server.listen(PORT, () => console.log(`PokéBonk server on http://localhost:${PORT} (database ${DB_PATH})`));
export { server, db };

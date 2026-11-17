// The online side of the menus, filled from the server when it is there: clans, friends, co-op rooms,
// the Trésors wheel and the Saison panel. Without the server the screens keep their offline content.
import * as api from '../api.js';
import { ITEM_EFFECTS, ITEM_NAMES, collection, prizeOf } from './treasure-items.js';

const esc = (s) => String(s ?? '').replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' })[c]);
const face = (id) => `<img class="pix" src="./assets/portraits/${id || 25}.png" alt="" draggable="false" loading="lazy">`;
const ERR = {
  guest: 'Crée un compte (onglet « Créer un compte ») pour rejoindre un clan.', in_clan: 'Tu es déjà dans un clan.', taken: 'Ce nom est déjà pris.',
  name: 'Nom de 3 à 24 caractères.', tag: 'Tag de 2 à 5 lettres ou chiffres.', closed: 'Ce clan est fermé.', full: 'C’est complet.',
  no_player: 'Aucun dresseur à ce nom.', other_in_clan: 'Ce dresseur est déjà dans un clan.', text: 'Écris un message.', no_invite: 'Cette invitation n’existe plus.', self: 'C’est toi !', no_room: 'Aucun salon avec ce code.', started: 'La partie a déjà commencé.',
  coins: 'Il te manque des Bonkoins.', complete: 'Tu as déjà tout gagné sur cette roue.', amount: 'Pas assez de Bonkoins.', offline: 'Serveur injoignable.',
};
const say = (e) => ERR[e?.code] || 'Une erreur est survenue.';
async function ready() { return (await api.available()) && api.isOnline(); }
const ago = (t) => { if (!t) return 'jamais'; const m = Math.round((Date.now() - t) / 60e3); return m < 2 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };

// ---------------- Clans ----------------
export async function liveClans(box) {
  if (!(await ready())) return;
  const body = box.querySelector('.pg-body');
  const draw = async () => {
    const [mine, list, inv] = await Promise.all([api.get('clans/mine').catch(() => ({ clan: null })), api.get('clans').catch(() => ({ clans: [] })), api.get('invites').catch(() => ({ invites: [] }))]);
    const mail = mine.clan ? await api.get('clans/messages').catch(() => ({ messages: [] })) : null;
    const gloss = box.querySelector('.pg-gloss'); if (gloss) gloss.dataset.count = inv.invites.length || '';
    const chat = mail ? mail.messages.map((m) => `<div class="so-msg"><b>${esc(m.name)}</b><span>${esc(m.text)}</span><small>${ago(m.at)}</small></div>`).join('') || '<p class="so-empty">Pas encore de message : dis bonjour à ton clan !</p>' : '';
    const invites = inv.invites.length ? `<section class="so-box so-invites" data-mailbox><div class="grp-head"><b>Boîte aux lettres</b><small>${inv.invites.length} invitation${inv.invites.length > 1 ? 's' : ''}</small></div>${inv.invites.map((i) => `<div class="so-row"><span><b>[${esc(i.tag)}] ${esc(i.name)}</b><small>Invité par ${esc(i.fromName)} · ${i.members} membres · ${ago(i.at)}</small></span><button class="btn green" data-yes="${i.clanId}">Rejoindre</button><button class="btn ghost" data-no="${i.clanId}">Refuser</button></div>`).join('')}</section>` : '';
    if (!box.isConnected) return;
    const rank = list.clans.map((c) => `<div class="so-row"><em>${c.rank}</em><span><b>[${esc(c.tag)}] ${esc(c.name)}</b><small>${c.members}/300 membres · ${c.open ? 'ouvert' : 'sur invitation'}</small></span><strong>${c.points}<small> pts</small></strong>${mine.clan ? '' : `<button class="btn green" data-join="${c.id}" ${c.open ? '' : 'disabled'}>Rejoindre</button>`}</div>`).join('') || '<p class="so-empty">Aucun clan pour l’instant : fonde le premier !</p>';
    const left = mine.clan
      ? `<section class="so-box"><div class="grp-head"><b>[${esc(mine.clan.tag)}] ${esc(mine.clan.name)}</b><small>${mine.role === 'chief' ? 'Chef' : 'Membre'}</small></div>
          <p class="so-motto">${esc(mine.clan.motto) || 'Pas encore de devise.'}</p>
          <div class="so-stats"><span><b>${mine.clan.points}</b><small>points cette saison</small></span><span><b>${mine.members.length}</b><small>membres</small></span><span><b>${mine.clan.bank}</b><small>Bonkoins dans la tirelire</small></span></div>
          <div class="so-list">${mine.members.map((m) => `<div class="so-row"><span><b>${esc(m.name)}</b><small>${m.role === 'chief' ? 'Chef · ' : ''}dernière partie ${ago(m.lastRun)}</small></span><strong>${m.points}<small> pts</small></strong></div>`).join('')}</div>
          <div class="so-actions"><button class="btn gold" data-donate>Donner 3 Bonkoins</button><button class="btn ghost" data-leave>Quitter le clan</button></div>
          <div class="grp-head"><b>Inviter un dresseur</b><small>L’invitation arrive dans sa boîte aux lettres</small></div>
          <div class="so-join"><input class="pg-search" data-invite maxlength="16" placeholder="Nom du dresseur"><button class="btn green" data-send-invite>Inviter</button></div><p class="so-err"></p>
          <div class="grp-head" data-mailbox><b>Messagerie du clan</b><small>${mail.messages.length} message${mail.messages.length > 1 ? 's' : ''}</small></div>
          <div class="so-chat">${chat}</div>
          <div class="so-join"><input class="pg-search" data-msg maxlength="280" placeholder="Écrire au clan…"><button class="btn blue" data-post>Envoyer</button></div></section>`
      : `${invites}<section class="so-box"><div class="grp-head"><b>Fonder un clan</b><small>Jusqu’à 300 membres</small></div>
          <input class="pg-search" data-f="name" maxlength="24" placeholder="Nom du clan"><input class="pg-search" data-f="tag" maxlength="5" placeholder="Tag (2 à 5 lettres)"><input class="pg-search" data-f="motto" maxlength="120" placeholder="Devise (facultatif)">
          <button class="btn big green" data-create>Fonder le clan</button><p class="so-err"></p>
          <p class="so-note">Chaque partie valide d’un membre rapporte des points à son clan : K.O., victoires et légendaires.</p></section>`;
    body.innerHTML = `<div class="so-two"><div class="so-col">${left}</div><section class="so-box"><div class="grp-head"><b>Classement des clans</b><small>Saison ${list.season ?? ''}</small></div><input class="pg-search" data-search placeholder="Chercher un clan"><div class="so-list" data-rank>${rank}</div></section></div>`;
  };
  body.onclick = async (e) => {
    const err = body.querySelector('.so-err');
    try {
      if (e.target.closest('[data-create]')) { const v = (k) => body.querySelector(`[data-f="${k}"]`).value; await api.post('clans', { name: v('name'), tag: v('tag'), motto: v('motto') }); await draw(); }
      const j = e.target.closest('[data-join]'); if (j) { await api.post('clans/join', { id: +j.dataset.join }); await draw(); }
      if (e.target.closest('[data-leave]')) { await api.post('clans/leave'); await draw(); }
      if (e.target.closest('[data-donate]')) { await api.post('clans/donate', { amount: 3 }); await draw(); }
      if (e.target.closest('[data-send-invite]')) { const inp = body.querySelector('[data-invite]'); await api.post('clans/invite', { name: inp.value }); inp.value = ''; if (err) err.textContent = 'Invitation envoyée !'; }
      if (e.target.closest('[data-post]')) { const inp = body.querySelector('[data-msg]'); await api.post('clans/messages', { text: inp.value }); await draw(); body.querySelector('.so-chat')?.scrollTo(0, 1e6); }
      const y = e.target.closest('[data-yes]'); if (y) { await api.post('invites/answer', { clanId: +y.dataset.yes, accept: true }); await draw(); }
      const n = e.target.closest('[data-no]'); if (n) { await api.post('invites/answer', { clanId: +n.dataset.no, accept: false }); await draw(); }
    } catch (x) { if (err) err.textContent = say(x); else alert(say(x)); }
  };
  body.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-msg]')) body.querySelector('[data-post]')?.click(); };
  box.querySelector('.pg-gloss')?.addEventListener('click', (e) => { e.stopPropagation(); body.querySelector('[data-mailbox]')?.scrollIntoView({ behavior: 'smooth' }); }, true);
  body.oninput = async (e) => { if (!e.target.matches('[data-search]')) return; const l = await api.get(`clans?q=${encodeURIComponent(e.target.value)}`).catch(() => null); const box2 = body.querySelector('[data-rank]'); if (l && box2) box2.innerHTML = l.clans.map((c) => `<div class="so-row"><em>${c.rank}</em><span><b>[${esc(c.tag)}] ${esc(c.name)}</b><small>${c.members}/300 membres</small></span><strong>${c.points}<small> pts</small></strong></div>`).join('') || '<p class="so-empty">Aucun résultat.</p>'; };
  await draw();
}

// ---------------- Friends ----------------
export async function liveFriends(box, startCoopLobby) {
  if (!(await ready())) return;
  const main = box.querySelector('.fr-main'); const msg = document.createElement('p'); msg.className = 'so-err';
  box.querySelector('.fr-add')?.after(msg);
  const draw = async () => {
    const f = await api.get('friends').catch(() => null);
    if (!f || !box.isConnected) return;
    const row = (x, actions) => `<div class="so-row"><span class="so-av">${face(x.species)}</span><span><b>${esc(x.name)}</b><small>${x.online ? '<i class="so-on"></i>En ligne' : `Vu ${ago(x.lastSeen)}`}</small></span>${actions}</div>`;
    main.innerHTML = `<div class="grp-head"><b>Tes amis</b><small>${f.friends.length}/100</small></div>
      ${f.incoming.length ? `<div class="so-sub">Demandes reçues</div>${f.incoming.map((x) => row(x, `<button class="btn green" data-accept="${x.id}">Accepter</button><button class="btn ghost" data-remove="${x.id}">Refuser</button>`)).join('')}` : ''}
      ${f.friends.length ? f.friends.map((x) => row(x, `<button class="btn ghost" data-remove="${x.id}">Retirer</button>`)).join('') : '<p class="so-empty">Pas encore d’amis ici. Ajoute d’autres dresseurs par leur nom.</p>'}
      ${f.outgoing.length ? `<div class="so-sub">Demandes envoyées</div>${f.outgoing.map((x) => row(x, '<small>En attente</small>')).join('')}` : ''}`;
  };
  box.querySelector('.pg-body').addEventListener('click', async (e) => {
    try {
      if (e.target.closest('[data-add]')) { const inp = box.querySelector('.fr-add input'); const r = await api.post('friends/request', { name: inp.value }); msg.textContent = r.status === 'ok' ? 'Vous êtes amis !' : 'Demande envoyée.'; inp.value = ''; await draw(); }
      const a = e.target.closest('[data-accept]'); if (a) { await api.post('friends/accept', { id: +a.dataset.accept }); await draw(); }
      const r = e.target.closest('[data-remove]'); if (r) { await api.post('friends/remove', { id: +r.dataset.remove }); await draw(); }
      if (e.target.closest('[data-coop]')) { e.stopPropagation(); startCoopLobby(); }
    } catch (x) { msg.textContent = say(x); }
  }, true);
  await draw();
}

// ---------------- Co-op rooms ----------------
// A room with a code to share: 2 to 4 trainers, everyone says they're ready, the host starts.
export async function coopLobby(box, { species, map, difficulty, onStart }) {
  if (!(await ready())) { alert('Le Coopératif demande le serveur PokéBonk et un compte (même invité).'); return; }
  const wrap = document.createElement('div'); wrap.className = 'so-modal';
  wrap.innerHTML = `<div class="so-card"><button class="so-x" data-close>✕</button><h3>Coopératif</h3>
    <div data-step="pick"><button class="btn big green" data-new>Créer un salon</button><div class="so-join"><input class="pg-search" maxlength="5" placeholder="Code du salon"><button class="btn blue" data-go>Rejoindre</button></div><p class="so-err"></p></div>
    <div data-step="room" hidden></div></div>`;
  box.append(wrap);
  let room = null; let timer = 0;
  const close = (leave = true) => { clearInterval(timer); if (leave && room && !room.started) api.post('coop/state', { code: room.code, leave: true }).catch(() => {}); wrap.remove(); };
  const view = () => {
    const el = wrap.querySelector('[data-step="room"]'); const me = room.members.find((m) => m.id === room.you); const host = room.host === room.you;
    el.innerHTML = `<p class="so-code">Code du salon <b>${room.code}</b><small>Donne-le à tes amis pour qu’ils te rejoignent</small></p>
      <div class="so-list">${room.members.map((m) => `<div class="so-row"><span class="so-av">${face(m.species)}</span><span><b>${esc(m.name)}${m.id === room.host ? ' · hôte' : ''}</b><small>${m.ready ? 'Prêt !' : 'Pas encore prêt'}</small></span></div>`).join('')}</div>
      <div class="so-actions"><button class="btn ${me?.ready ? 'ghost' : 'green'}" data-ready>${me?.ready ? 'Pas prêt' : 'Je suis prêt'}</button>${host ? `<button class="btn big red" data-start ${room.members.every((m) => m.ready) ? '' : 'disabled'}>Lancer la partie</button>` : '<small>L’hôte lance la partie quand tout le monde est prêt.</small>'}</div>`;
  };
  const poll = async (extra = {}) => {
    try { room = await api.post('coop/state', { code: room.code, ...extra }); } catch { return; }
    if (room.started) { close(false); onStart(room); return; }
    view();
  };
  const enter = (r) => { room = r; wrap.querySelector('[data-step="pick"]').hidden = true; wrap.querySelector('[data-step="room"]').hidden = false; view(); timer = setInterval(() => poll(), 1000); };
  wrap.onclick = async (e) => {
    const err = wrap.querySelector('.so-err');
    try {
      if (e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-new]')) enter(await api.post('coop/create', { species, map, difficulty }));
      if (e.target.closest('[data-go]')) enter(await api.post('coop/join', { code: wrap.querySelector('.so-join input').value, species }));
      if (e.target.closest('[data-ready]')) await poll({ ready: !room.members.find((m) => m.id === room.you)?.ready });
      if (e.target.closest('[data-start]')) await poll({ start: true });
    } catch (x) { if (err) err.textContent = say(x); }
  };
}

// In a co-op run: send our position a few times a second and get our teammates'.
// The host also sends the shared world (outgoing().snap) and its K.O.; the others send their hits;
// incoming(reply) gets the host's world and the events meant for this player.
export function coopLink(code, getState, { outgoing = () => ({}), incoming = () => {} } = {}) {
  let mates = []; let stop = false;
  const tick = async () => {
    if (stop) return;
    try { const r = await api.post('coop/state', { code, pos: getState(), ...outgoing() }); mates = r.members.filter((m) => m.id !== r.you && m.pos && m.online); incoming(r); } catch { /* keep the last positions */ }
    setTimeout(tick, 150);
  };
  tick();
  return { mates: () => mates, close: () => { stop = true; api.post('coop/state', { code, leave: true }).catch(() => {}); } };
}

// ---------------- Trésors ----------------
export async function liveTreasures(box, getProfile, save) {
  if (!(await ready())) return;
  let state = await api.get('treasures').catch(() => null);
  if (!state || !box.isConnected) return;
  const body = box.querySelector('.pg-body');
  const wheel = () => +(body.querySelector('.tz-wheels .on')?.dataset.w || 0);
  // The server's list of prizes is the reference: the profile mirrors it for the menus.
  const mirror = () => { const p = getProfile(); p.treasures = {}; for (const x of state.spun) (p.treasures[x.wheel] ||= []).push(x.slot); return p; };
  mirror();
  // "Ma collection": bag items to take on a run, titles to wear, frames and looks won.
  const drawCollection = () => {
    const page = body.querySelector('.tz-page'); if (!page) return;
    let el = page.querySelector('.tz-coll');
    if (!el) { el = document.createElement('section'); el.className = 'so-box tz-coll'; page.append(el); }
    const p = getProfile(); const c = collection(p);
    const bagIds = Object.keys(c.bag).filter((k) => c.bag[k] > 0);
    el.innerHTML = `<div class="grp-head"><b>Ma collection</b><small>Les prix de tes roues</small></div>
      <div class="so-sub">Sac · à choisir avant une partie (« Préparer la partie »)</div>
      ${bagIds.length ? `<div class="tz-bag">${bagIds.map((id) => `<span title="${esc(ITEM_EFFECTS[id])}"><img class="pix" src="./assets/items/${id}.png" alt=""><b>${esc(ITEM_NAMES[id])}</b><small>×${c.bag[id]}</small></span>`).join('')}</div>` : '<p class="so-empty">Aucun objet pour l’instant.</p>'}
      <div class="so-sub">Titres</div>
      ${c.titles.length ? `<div class="tz-titles">${c.titles.map((t) => `<button class="${p.title === t ? 'on' : ''}" data-title="${esc(t)}">${esc(t)}${p.title === t ? ' · porté' : ''}</button>`).join('')}${p.title ? '<button data-title="">Retirer le titre</button>' : ''}</div>` : '<p class="so-empty">Aucun titre pour l’instant.</p>'}
      ${c.frames.length || c.looks.length ? `<div class="so-sub">Cadres et aspects</div><div class="tz-titles">${[...c.frames.map((f) => `<span>${esc(f)}</span>`), ...c.looks.map((l) => `<span>${esc(l.name)}${l.grand ? ' ★' : ''}</span>`)].join('')}</div>` : ''}`;
  };
  const apply = () => {
    const w = wheel(); const won = state.spun.filter((s) => s.wheel === w).map((s) => s.slot);
    box.querySelector('.tz-bonk b').textContent = state.bonkoins;
    const slots = body.querySelectorAll('.tz-prize, .tz-jack');
    slots.forEach((el, i) => el.classList.toggle('tz-won', won.includes(i)));
    body.querySelectorAll('.tz-wheels [data-w]').forEach((b) => { const n = state.spun.filter((s) => s.wheel === +b.dataset.w).length; const sm = b.querySelector('small'); if (sm) sm.textContent = `Obtenu ${n}/10`; });
    const spin = body.querySelector('.tz-spin'); const miss = body.querySelector('.tz-miss'); const turn = body.querySelector('.tz-cost small');
    if (turn) turn.textContent = won.length >= 10 ? 'Roue complète' : `Tour ${won.length + 1} sur 10`;
    if (spin) spin.disabled = state.bonkoins < state.cost || won.length >= 10;
    if (miss) miss.textContent = won.length >= 10 ? 'Tu as tout gagné sur cette roue !' : state.bonkoins < state.cost ? `Il te manque ${state.cost - state.bonkoins} Bonkoins.` : '';
    slots.forEach((el, i) => { el.title = prizeOf(w, i)?.name || ''; });
    drawCollection();
  };
  new MutationObserver(() => apply()).observe(body, { childList: true });
  body.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-title]');
    if (tb) { e.stopPropagation(); const p = getProfile(); p.title = tb.dataset.title || null; save(p); drawCollection(); return; }
    if (!e.target.closest('.tz-spin')) return;
    e.stopPropagation();
    const btn = e.target.closest('.tz-spin'); btn.disabled = true;
    try {
      const r = await api.post('treasures/spin', { wheel: wheel() });
      state.spun.push({ wheel: wheel(), slot: r.slot }); state.bonkoins = r.bonkoins;
      const p = mirror(); p.bonkoins = r.bonkoins; save(p);
      const prize = prizeOf(wheel(), r.slot);
      const miss = body.querySelector('.tz-miss'); if (miss && prize) setTimeout(() => { miss.textContent = `Gagné : ${prize.name} !`; }, 50);
      const el = body.querySelectorAll('.tz-prize, .tz-jack')[r.slot];
      el?.classList.add('tz-flash'); setTimeout(() => el?.classList.remove('tz-flash'), 1600);
      apply();
    } catch (x) { body.querySelector('.tz-miss').textContent = say(x); btn.disabled = false; }
  }, true);
  apply();
}

// ---------------- Saison panel (main menu) ----------------
export async function seasonPanel(root, labels) {
  if (!(await api.available())) return;
  const b = await api.leaderboard({ kind: 'world', limit: 6 });
  const list = root.querySelector('.mm-sp-list');
  if (!b || !list || !root.isConnected) return;
  list.innerHTML = b.top.length
    ? b.top.map((r, i) => `<li class="${i < 3 ? 'top' : ''}${b.me && r.accountId === b.me.accountId ? ' me' : ''}"><em>${r.rank}</em>${face(r.species)}<span><b>${r.guest ? labels.guest : esc(r.name)}</b><small>Somme des régions</small></span><strong>${r.kills}<small>K.O.</small></strong></li>`).join('')
      + (b.me && b.me.rank > 6 ? `<li class="me"><em>${b.me.rank}</em>${face(b.me.species)}<span><b>${labels.you}</b><small>sur ${b.total}</small></span><strong>${b.me.kills}<small>K.O.</small></strong></li>` : '')
    : `<li class="empty">${labels.empty}</li>`;
}

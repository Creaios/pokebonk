// The secondary menu screens, laid out like the original's: Missions, Labo, Succès, Classement,
// Clans, Builds, Réglages, Guide, Signaler, Trésors, Apps, Actualités, Amis, Fiche de dresseur,
// Nouveautés, Coopératif, Mutation du jour and Événement.
import { SCREENS as S } from './screens-data.js';
import { BY_ID } from './sprites.js';
import { leaderboard } from '../api.js';
import { coopLobby, liveClans, liveFriends, liveTreasures } from './social.js';

const icon = (name, cls = '') => `<img class="pix ${cls}" src="./assets/items/${name}.png" alt="" draggable="false">`;
const uiIcon = (name, cls = '') => `<img class="pix uiicon ${cls}" src="./assets/ui/icons/${name}.png" alt="" draggable="false">`;
const face = (id, cls = '') => `<img class="pix ${cls}" src="./assets/portraits/${id}.png" alt="" draggable="false" loading="lazy">`;
const pic = (src, cls = '') => (src ? `<img class="pix ${cls}" src="${src}" alt="" draggable="false" loading="lazy">` : '');
const md = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const esc = (s) => String(s).replace(/</g, '&lt;');
const dust = (n) => `<span class="currency dust">${uiIcon('stardust')}<span>${n}</span></span>`;
const untilMidnight = () => { const ms = new Date(new Date().toISOString().slice(0, 10) + 'T24:00:00Z') - Date.now(); return `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`; };
const seasonLeft = () => { const d = new Date(); const end = new Date(d); end.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7)); end.setUTCHours(0, 0, 0, 0); const ms = end - d; return `${Math.floor(ms / 86400000)} j ${Math.floor((ms % 86400000) / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`; };
const fmtK = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function makeScreens(env) {
  const { page, panel, closePanel, getProfile, saveProfile, renderMenu, leagueScreen, onLogout, wipe } = env;
  const P = () => getProfile();
  const coopOpts = () => ({ species: P().lastSpecies, map: P().lastMap || 'forest', difficulty: 'normal', onStart: (room) => env.startCoop?.(room) });
  const totalKills = () => P().stats.kills;

  // A full-screen modal window in the game's style.
  function overlay(cls, html) {
    const el = document.createElement('div');
    el.className = `ov dk ${cls}`;
    el.innerHTML = html;
    document.body.append(el);
    const close = () => { el.remove(); removeEventListener('keydown', esc2); };
    const esc2 = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', esc2);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    el.close = close;
    return el;
  }

  // ---- Missions ----
  function tasks() {
    const p = P();
    const box = page('tk', 'Missions', 'Reviens chaque jour : elles se renouvellent à 00:00 UTC', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<span class="pg-dust">${uiIcon('stardust')}<b>${p.stardust}</b></span>`);
    const progress = (t) => {
      const [, goal] = t.bar.split('/').map((x) => parseInt(x.replace(/\D/g, ''), 10) || 0);
      let v = 0;
      if (/Bats \d+ Pokémon sauvages/.test(t.desc)) v = Math.min(goal, p.daily?.kills || 0);
      return [v, goal];
    };
    const card = (rows, daily) => rows.map((t) => {
      const [v, g] = progress(t);
      return `<div class="tk-row ${t.lv}"><span class="tk-ball">${pic(t.ic)}</span><div class="tk-body"><div class="tk-title"><span class="tk-lv">${t.diff}</span><h3>${t.title}</h3></div><p>${t.desc}</p><div class="tk-bar"><i style="width:${g ? (v / g) * 100 : 0}%"></i><b>${v} / ${g}</b></div></div>
        <div class="tk-side"><span class="tk-reward">${uiIcon('stardust')}${t.reward}</span><button class="tk-reroll" data-reroll>${uiIcon('reroll')}Changer</button></div></div>`;
    }).join('') + `<div class="tk-prize"><div class="tk-prize-hd">${uiIcon('lock')}<span><b>Récompense ${daily ? 'du jour' : 'de la semaine'}</b><small>Récupère les trois missions pour l'obtenir · 0/3</small></span></div>
      <div class="tk-prize-items">${daily ? `<span class="tk-pi">${uiIcon('stardust')}<b>+50</b><small>Poussière Étoile</small></span><span class="tk-pi">${icon('rare-candy')}<b>Super Bonbon</b><small>Sac</small></span>`
        : `<span class="tk-pi">${uiIcon('stardust')}<b>+500</b><small>Poussière Étoile</small></span><span class="tk-pi">${icon('master-ball')}<b>Master Ball</b><small>Sac</small></span><span class="tk-pi">${icon('rare-candy')}<b>Super Bonbon</b><small>Sac</small></span><span class="tk-pi">${icon('everstone')}<b>Pierre Stase</b><small>Sac</small></span>`}</div></div>`;
    const head = (cls, kicker, title, extra = '') => `<div class="tk-head ${cls}"><small>${kicker}</small><h2>${title}</h2><span>Nouvelles missions dans ${untilMidnight()}</span>${extra}
      <div class="tk-track"><i></i><b>1</b><b>2</b><b>3</b><span class="tk-goal">${icon(cls === 'day' ? 'rare-candy' : 'master-ball')}</span></div></div>`;
    const week = Math.ceil((new Date() - new Date(new Date().getUTCFullYear(), 0, 1)) / 6048e5) % 10;
    box.querySelector('.pg-body').innerHTML = `
      <section class="tk-col">${head('day', 'Missions du jour', "Aujourd'hui", `<em class="tk-streak">Série : ${p.daily?.streak || 0} jours</em>`)}<div class="tk-list">${card(S.tasks.slice(0, 3), true)}</div></section>
      <section class="tk-col">${head('week', `Missions de la semaine ${week}`, 'Cette semaine')}<div class="tk-list">${card(S.tasks.slice(3, 6), false)}</div></section>
      <aside class="tk-bag"><div class="tk-head bag"><small>Objets pour tes parties</small><h2>Sac</h2><span>Emporte jusqu'à 2 en choisissant la région. Ils sont dépensés au début.</span></div>
        <div class="tk-bag-list">${S.bag.map((b) => { const m = b.txt.match(/^×(\d+)(.+?)([A-Z+Au].*)$/u); const name = m ? m[2] : b.txt; return `<div class="tk-bag-row"><span class="tk-bag-ic">${pic(b.ic)}<em>×${p.bag?.[name] || 0}</em></span><span><b>${name}</b><small>${m ? m[3] : ''}</small></span></div>`; }).join('')}</div>
        <p class="tk-bag-note">On les obtient avec les récompenses du jour et de la semaine.</p></aside>`;
    box.querySelector('.pg-body').onclick = (e) => { if (e.target.closest('[data-reroll]')) panel('Changer', "<p>Tu as déjà utilisé ton changement d'aujourd'hui.</p>"); };
  }

  // ---- Labo ----
  function lab() {
    const p = P();
    p.labUp ||= {};
    const box = page('lab', 'Labo', 'Dépense ta Poussière Étoile', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)',
      `<span class="pg-dust lab-dust">${uiIcon('stardust')}<b>${p.stardust}</b></span><button class="lab-mode on"><span class="lm-ic">${icon('rare-candy')}</span><span class="lm-tx"><b>Améliorations</b><em data-lvls></em></span><span class="lm-chip go" data-reach></span></button><button class="lab-mode" data-items><span class="lm-new">NOUVEAU</span><span class="lm-ic">${icon('ultra-ball')}</span><span class="lm-tx"><b>Objets</b><em>67/132 dans ton pool</em></span><span class="lm-chip hot">${uiIcon('stardust')}23 prêts !</span></button>`);
    const body = box.querySelector('.pg-body');
    const max = (c) => parseInt(c.lv.split('/')[1], 10) || 1;
    const cost = (c, lvl) => Math.round(parseInt(c.price.replace(/\D/g, ''), 10) * (1 + lvl * 0.5));
    const render = () => {
      let lv = 0; let all = 0; let reach = 0;
      for (const g of S.lab) for (const c of g.cards) { lv += p.labUp[c.id] || 0; all += max(c); if ((p.labUp[c.id] || 0) < max(c) && cost(c, p.labUp[c.id] || 0) <= p.stardust * 20) reach++; }
      box.querySelector('[data-lvls]').textContent = `${lv}/${all} niveaux`;
      box.querySelector('[data-reach]').textContent = `${reach} à portée`;
      box.querySelector('.lab-dust b').textContent = p.stardust;
      body.innerHTML = `<div class="lab-wrap">${S.lab.map((g) => {
        const [t, ...rest] = g.title.split(/(?=Améliorations)/);
        return `<div class="grp-head"><b>${t}</b><small>${rest.join('')}</small></div><div class="lab-grid">${g.cards.map((c) => {
          const l = p.labUp[c.id] || 0; const m = max(c); const k = cost(c, l);
          return `<div class="lab-card"><div class="lab-top"><span class="lab-ic">${pic(c.ic)}</span><span class="lab-lv">N. ${l}/${m}</span></div><div class="lab-bd"><h3>${c.name}</h3><p>${c.desc}</p><div class="pips">${Array.from({ length: m }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
            ${l >= m ? '<button class="lab-buy max" disabled>Max</button>' : `<button class="lab-buy ${p.stardust >= k ? 'can' : ''}" data-buy="${c.id}">${uiIcon('stardust')}${k}</button>`}</div>`;
        }).join('')}</div>`;
      }).join('')}</div>`;
    };
    render();
    body.onclick = (e) => {
      const id = e.target.closest('[data-buy]')?.dataset.buy;
      if (!id) return;
      const c = S.lab.flatMap((g) => g.cards).find((x) => x.id === id);
      const l = p.labUp[id] || 0; const k = cost(c, l);
      if (p.stardust < k) { panel('Labo', `<p>Il te manque ${k - p.stardust} de Poussière Étoile.</p>`); return; }
      p.stardust -= k;
      p.labUp[id] = l + 1;
      p.lab = { hp: p.labUp.hp || 0, dmg: p.labUp.dmg || 0, spd: p.labUp.spd || 0 };
      saveProfile(p);
      render();
    };
    box.querySelector('[data-items]').onclick = () => panel('Objets', "<p>Débloque des objets avec de la Poussière Étoile et mets-les dans le pool de tes Poké Balls. Ils apparaissent ensuite pendant tes parties.</p>");
    if (!p.labTour) {
      p.labTour = 1; saveProfile(p);
      const t = document.createElement('div');
      t.className = 'lab-tour';
      t.innerHTML = `<div class="lt-h">${uiIcon('idea')}<small>Étape 1 sur 8</small></div><h3>Poussière Étoile</h3><p>C'est la monnaie du Labo. On la gagne en jouant : à la fin de chaque partie (plus tu vas loin, plus tu en gagnes), en battant des boss, en capturant des Pokémon chromatiques et en accomplissant succès et missions.</p><div class="lt-dots">${'<i></i>'.repeat(8)}</div><div class="lt-btns"><button data-x>Sauter</button><button class="btn ghost small" data-x>Retour</button><button class="btn green small" data-x>Suivant</button></div>`;
      box.append(t);
      t.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) t.remove(); });
    }
  }

  // ---- Succès ----
  function quests() {
    const p = P();
    const done = S.quests.filter((q) => q.done).length;
    const box = page('qs', 'Succès', `${done}/427 terminées`, 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<button class="btn green small qs-all">${icon('poke-ball', 'btn-ball')}Tout récupérer</button><span class="pg-dust">${uiIcon('stardust')}<b>${p.stardust}</b></span>`);
    const cats = [['Tous'], ['Aventure', 'map-portal'], ['Combat', 'duel'], ['Boss', 'map-boss'], ['Difficulté', 'champion'], ['Défis', 'map-challenge'], ['Collection', 'shiny-charm'], ['Fusions', 'research'], ['Survie', 'record'], ['Failles et Reliques', 'map-unown'], ['Apparences', 'looks'], ['Secrets', 'lock']];
    let filter = 'all';
    const body = box.querySelector('.pg-body');
    const kills = totalKills();
    const live = (q) => { // the counters this rebuild knows about
      const [, goal] = q.bar.split('/').map((x) => x.trim());
      const g = parseFloat(goal) * (/k$/.test(goal) ? 1000 : /M$/.test(goal) ? 1e6 : 1) || 1;
      let v = 0;
      if (/^Fais|Obtiens 1|Rouleau/.test(q.desc) && /K\.?O/.test(q.desc)) v = kills;
      if (/^Joue(z)? \d+ parties/.test(q.desc)) v = p.stats.runs;
      if (/Ligue/.test(q.desc) && /membres/.test(q.desc)) v = p.league.length;
      return [Math.min(v, g), g, goal];
    };
    const render = () => {
      const list = S.quests.filter((q) => (filter === 'all' ? true : filter === 'done' ? q.done : filter === 'claim' ? false : !q.done));
      body.innerHTML = `<div class="qs-page">
        <div class="pg-seg qs-cats">${cats.map(([n, ic], i) => `<button class="${i === 0 ? 'on' : ''}">${ic ? uiIcon(ic) : ''}${n}</button>`).join('')}</div>
        <div class="qs-tools"><input class="pg-search" placeholder="Chercher un succès ou un Pokémon…"><div class="pg-seg">${[['all', 'Tous', S.quests.length], ['claim', 'À réclamer', 0], ['todo', 'En cours', S.quests.filter((q) => !q.done).length], ['done', 'Faits', done]].map(([k, n, c]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${n}<small class="q-n">${c}</small></button>`).join('')}</div>
          <span class="qs-sum">${done}/427 terminés<i><u style="width:${(done / 427) * 100}%"></u></i></span></div>
        <div class="qs-scroll"><div class="grp-head"><b>${filter === 'done' ? 'Faits' : 'En cours'}</b><small>${list.length}</small></div><div class="qs-grid">${list.map((q) => {
          const [v, g, goal] = live(q);
          return `<div class="q-card ${q.done ? 'done' : ''} ${q.secret ? 'secret' : ''}"><span class="q-ic">${pic(q.ic)}</span><div class="grow"><h3>${q.title}</h3><p>${q.desc}</p>${q.prize ? `<span class="q-title">${uiIcon('champion')}${q.prize}</span>` : ''}<div class="q-bar"><i style="width:${q.done ? 100 : (v / g) * 100}%"></i><b>${q.done ? 'Fait !' : `${fmtK(v)} / ${goal}`}</b></div><button class="q-track">${uiIcon('pin')}Suivre en partie</button></div><span class="q-reward">${uiIcon('stardust')}${q.reward}</span></div>`;
        }).join('')}</div></div></div>`;
    };
    render();
    body.onclick = (e) => {
      const f = e.target.closest('[data-f]');
      if (f) { filter = f.dataset.f; render(); }
      const c = e.target.closest('.qs-cats button');
      if (c) { body.querySelectorAll('.qs-cats button').forEach((b) => b.classList.toggle('on', b === c)); }
      const t = e.target.closest('.q-track');
      if (t) t.classList.toggle('on');
    };
    body.addEventListener('input', (e) => {
      if (!e.target.classList.contains('pg-search')) return;
      const q = e.target.value.toLowerCase();
      body.querySelectorAll('.q-card').forEach((c) => { c.hidden = q && !c.textContent.toLowerCase().includes(q); });
    });
  }

  // ---- Classement ----
  function rank() {
    const p = P();
    const box = page('rk', 'Classement', 'Records du serveur, validés contre la triche', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)');
    const regions = [['Mondial', 'Somme de toutes les régions', 151], ['Forêt Verte', 'Meilleure partie', 123], ['Désert Rocheux', 'Meilleure partie', 27], ['Côte Tempête', 'Meilleure partie', 54], ['Glacier céleste', 'Meilleure partie', 87], ['Île Cramois’Île', 'Meilleure partie', 58], ['Caverne Azurée', 'Meilleure partie', 41], ['Bois aux Chênes', 'Meilleure partie', 152]];
    const best = Math.max(0, ...p.runs.map((r) => r.kills));
    const parse = (t) => { const m = t.match(/^(\d+)?([A-Z0-9]{2,5})?(.+?)(Forêt.*?)(−[\d.]+[kM]?)?([\d.]+[kM]?)K\.O\.\d?$/u); return m ? { rank: m[1] || '', tag: m[2] || '', name: m[3], regs: (m[4] || '').match(/[A-ZÎÉ][a-zéêèûî]+[\d.]+[kM]?/gu) || [], total: m[6] } : { name: t, regs: [] }; };
    const pods = S.podium.map((x) => ({ ...parse(x.txt.replace(/\d$/, '')), pic: x.pic }));
    const order = [pods[1], pods[0], pods[2]].filter(Boolean);
    box.querySelector('.pg-body').innerHTML = `
      <aside class="rk-side">
        <div class="rk-kinds"><button class="on">${icon('poke-ball')}<b>Dresseurs</b><small>K.O., temps et Pokémon</small></button><button>${uiIcon('clan')}<b>Clans</b><small>Points d'équipe</small></button><button>${uiIcon('friends')}<b>Coopératif</b><small>Par équipes</small></button></div>
        <div class="rk-modes"><button class="on">${icon('poke-ball')}<b>K.O.</b><small>Global et régions</small></button><button>${face(155)}<b>Par Pokémon</b><small>Un par membre</small></button><button>${icon('moon-stone')}<b>Survie</b><small>Temps survécu</small></button><button>${uiIcon('champion')}<b>Contre la montre</b><small>Victoire la plus rapide</small></button></div>
        <div class="rk-regs">${regions.map(([n, s, id], i) => `<button class="${i === 0 ? 'on' : ''}"><span class="rk-reg-ic">${i === 0 ? uiIcon('crown') : `<img class="pix" src="./assets/icons/${id}.png" alt="">`}</span><span><b>${n}</b><small>${s}</small></span></button>`).join('')}</div>
      </aside>
      <section class="rk-main">
        <div class="rk-banner"><small>Classement des K.O.</small><h2>Mondial</h2><p>Additionne ta meilleure partie de chaque région (Forêt Verte + Désert Rocheux + Côte Tempête + Glacier céleste + Île Cramois’Île + Caverne Azurée + Bois aux Chênes + Ville de Rosalia), quelle que soit la difficulté. Joue toutes les régions pour monter.</p>
          <span class="rk-season"><i></i>Saison 3 · se termine dans ${seasonLeft()}</span><span class="rk-count">570.6k dresseurs</span></div>
        <div class="rk-scroll">
          <div class="rk-podium">${order.map((x, i) => { const place = i === 1 ? 1 : i === 0 ? 2 : 3; return `<div class="rk-pod p${place}"><span class="rk-av">${pic(x.pic)}</span><b><em class="ctag">${x.tag}</em>${esc(x.name)}</b><div class="rk-regchips">${x.regs.map((r) => { const m = r.match(/^(\D+)([\d.]+[kM]?)$/u); return m ? `<span><i>${m[1]}</i>${m[2]}</span>` : ''; }).join('')}</div><strong>${x.total}<small>K.O.</small></strong><div class="rk-base">${place}</div></div>`; }).join('')}</div>
          <div class="rk-table"><div class="rk-th"><span>#</span><span>Dresseur</span><span>Régions</span><span>Au n° 1</span><span>K.O.</span></div>
            ${S.rankRows.slice(1).map((r) => { const x = parse(r.txt); return `<div class="rk-row"><em>${x.rank}</em><span class="rk-who">${pic(r.pic, 'rk-mini')}<em class="ctag">${x.tag}</em><b>${esc(x.name)}</b></span><span class="rk-regs2">${x.regs.length} régions</span><span class="rk-gap">${(r.txt.match(/−[\d.]+[kM]?/) || [''])[0]}</span><strong>${x.total || ''}<small>K.O.</small></strong></div>`; }).join('')}
          </div>
        </div>
        <div class="rk-me">${face(p.lastSpecies)}<span><small>Ta saison</small><b>${best ? `<em>${best}</em> K.O.` : 'Pas encore classé'}</b><i>Joue une partie dans chaque région pour monter au classement Mondial.</i></span></div>
      </section>`;
    // The real boards from the server: the world sum, then one per region (best run of each player).
    const MAP_OF = { 'Forêt Verte': 'forest', 'Désert Rocheux': 'desert', 'Côte Tempête': 'coast', 'Glacier céleste': 'glacier', 'Île Cramois’Île': 'canela', 'Caverne Azurée': 'cave', 'Bois aux Chênes': 'encina' };
    const live = async (name) => {
      const q = name === 'Mondial' ? { kind: 'world' } : { kind: 'kills', map: MAP_OF[name] || 'forest' };
      const b = await leaderboard(q);
      if (!b || !box.isConnected) return;
      const top = b.top; const who = (r) => `${r.guest ? 'Invité' : esc(r.name)}<small> #${r.accountId}</small>`;
      box.querySelector('.rk-banner h2').textContent = name;
      box.querySelector('.rk-count').textContent = `${b.total} dresseur${b.total > 1 ? 's' : ''}`;
      const order = [top[1], top[0], top[2]];
      box.querySelector('.rk-podium').innerHTML = order.map((x, i) => { if (!x) return ''; const place = i === 1 ? 1 : i === 0 ? 2 : 3; return `<div class="rk-pod p${place}"><span class="rk-av">${face(x.species || 25)}</span><b>${who(x)}</b><em class="rk-ko">${x.kills} K.O.</em><span class="rk-step">${place}</span></div>`; }).join('') || '<p class="rk-empty">Personne n’est encore classé cette saison : à toi de jouer !</p>';
      const table = box.querySelector('.rk-table');
      table.innerHTML = `<div class="rk-th"><span>#</span><span>Dresseur</span><span>${name === 'Mondial' ? 'Régions' : 'Niveau'}</span><span>Temps</span><span>K.O.</span></div>` + top.slice(3).map((r) => `<div class="rk-row"><em>${r.rank}</em><span class="rk-who">${face(r.species || 25)}<b>${who(r)}</b></span><span>${r.level ?? '—'}</span><span>${r.time ? Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0') : '—'}</span><span>${r.kills}</span></div>`).join('');
      box.querySelector('.rk-me b').innerHTML = b.me ? `<em>${b.me.kills}</em> K.O. · n° ${b.me.rank} sur ${b.total}` : 'Pas encore classé';
    };
    live('Mondial');
    box.querySelector('.pg-body').onclick = (e) => {
      const b = e.target.closest('.rk-side button'); if (!b) return;
      b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (b.closest('.rk-regs')) live(b.querySelector('b')?.textContent.trim() || 'Mondial');
    };
  }

  // ---- Clans ----
  function clans() {
    queueMicrotask(() => liveClans(box));
    const box = page('cl', 'Clans', 'Joue en équipe et grimpe dans le classement des clans', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<button class="pg-gloss">${uiIcon('mail')}Boîte aux lettres</button>`);
    const p = P();
    const days = new Set(p.runs.map((r) => new Date(r.at).toISOString().slice(0, 10))).size;
    box.querySelector('.pg-body').innerHTML = `
      <aside class="cl-hero"><div class="cl-stage"><img class="pix" src="./assets/ui/avatars/professor.png" alt=""><button class="cl-reroll">${uiIcon('reroll')}</button></div>
        <h2>Fonde ton clan</h2><p>Choisis un nom et un sigle, dessine ton emblème et invite d'autres dresseurs. Tout ce que vous jouez rapporte des points au clan.</p>
        <button class="btn big green cl-create">${uiIcon('clan')}Créer un clan<span class="cl-cost">${uiIcon('stardust')}5000</span></button><button class="btn ghost cl-how">Comment ils fonctionnent</button>
        <small class="cl-req-h">Pour fonder un clan</small>
        <div class="cl-freq">${uiIcon('lock')}<span>Jours différents joués</span><b>${Math.min(7, days)}/7</b><i style="width:${(Math.min(7, days) / 7) * 100}%"></i></div>
        <div class="cl-freq">${uiIcon('lock')}<span>Victoires</span><b>${Math.min(5, p.stats.wins)}/5</b><i style="width:${(Math.min(5, p.stats.wins) / 5) * 100}%"></i></div>
        <div class="cl-fact">${uiIcon('treasure')}<span><b>De 30 à 300 membres</b><small>Agrandis-le avec de la Poussière Étoile</small></span></div>
        <div class="cl-fact">${uiIcon('champion')}<span><b>Des prix chaque saison</b><small>Le top 50 gagne de la Poussière Étoile et des ornements</small></span></div>
        <div class="cl-fact">${uiIcon('clan')}<span><b>Ton sigle, partout</b><small>À côté de ton nom dans les classements et les profils</small></span></div>
      </aside>
      <section class="cl-main"><div class="cl-tabs"><button class="on">${uiIcon('clan')}Chercher un clan</button><button>${uiIcon('champion')}Classement des clans</button><span class="cl-rec">Clans qui recrutent</span><button class="cl-refresh">${uiIcon('reroll')}Actualiser</button></div>
        <input class="pg-search" placeholder="Chercher un clan par nom ou sigle…">
        <div class="pg-seg"><button class="on">Tous<small class="q-n">${S.clans.length}</small></button><button>Entrée immédiate<small class="q-n">3</small></button><button>Sur demande<small class="q-n">17</small></button><button>Sans conditions<small class="q-n">18</small></button></div>
        <div class="cl-grid">${S.clans.map((c, i) => {
          const name = c.name.replace(c.tag, '').replace(c.lv, '').trim();
          const [, seats, pts] = c.meta.match(/^(\d+\/\d+)(.*)$/) || [0, '', c.meta];
          const motto = c.txt.replace(c.tag, '').replace(name, '').replace(c.lv, '').replace(c.meta, '').replace(/(Demander|Rejoindre)$/, '').trim();
          const join = /Rejoindre$/.test(c.txt);
          const [m, n] = seats.split('/').map(Number);
          return `<div class="cl-card"><span class="cl-emb">${pic(c.emb)}</span><div class="cl-tx"><b><em class="ctag">${c.tag}</em>${esc(name)}<i>${c.lv}</i></b>${motto ? `<p>${esc(motto)}</p>` : ''}<span class="cl-meta"><i><u style="width:${(m / n) * 100}%"></u></i>${seats} <span>${pts}</span></span></div><button class="btn small ${join ? 'green' : 'blue'}" data-ask="${i}">${uiIcon('invite')}${join ? 'Rejoindre' : 'Demander'}</button></div>`;
        }).join('')}</div></section>`;
    box.querySelector('.pg-body').onclick = (e) => {
      if (e.target.closest('[data-ask]') || e.target.closest('.cl-create')) panel('Clans', "<p>Les clans demandent un compte. Crée un compte pour rejoindre ou fonder un clan ; ta progression d'invité sera conservée.</p>", [{ label: 'Créer un compte', cls: 'green', run: () => { closePanel(); onLogout('register'); } }]);
      if (e.target.closest('.cl-how')) panel('Comment fonctionnent les clans', '<ul><li>Chaque K.O., chaque victoire et chaque mission de ses membres rapporte des points au clan.</li><li>Le clan monte de niveau et peut accueillir jusqu’à 300 membres.</li><li>Le top 50 des clans gagne de la Poussière Étoile et des ornements à la fin de chaque saison.</li></ul>');
    };
  }

  // ---- Builds ----
  function builds() {
    const p = P();
    const box = page('bd', 'Builds', 'Ce que tu veux et ce que tu ne veux pas, pour chaque Pokémon', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)');
    const list = p.league.filter((id) => BY_ID.get(id));
    box.querySelector('.pg-body').innerHTML = `<div class="bd-page">
      <div class="bd-tabs"><button class="on">★ Mes builds</button><button>${uiIcon('download')}Location</button></div>
      <div class="bd-info">${icon('tm-case')}<p><b>Ton build, Pokémon par Pokémon.</b> Marque avec ★ ce que tu veux voir sortir plus souvent et avec ✕ ce que tu ne veux pas voir. Cela s'applique au début de chaque partie avec ce Pokémon ou sa lignée.</p></div>
      <div class="bd-tools"><input class="pg-search" placeholder="Chercher un Pokémon ou un créateur…"><span class="bd-chip">· Avec build <b>0</b></span><button class="bd-chip on">${uiIcon('unlock')}Copie autorisée</button><button class="bd-chip">${uiIcon('download')}Importer un code</button></div>
      <div class="bd-grid">${list.map((id) => { const s = BY_ID.get(id); return `<div class="bd-card">${face(id)}<b>${s.name}</b><span class="tdot ty-${s.types[0]}"></span><p>Pas encore de plan</p><div class="bd-foot"><span>★ 0 favoris</span><span>✕ 0 archivés</span><button class="bd-edit" data-id="${id}">Modifier</button></div></div>`; }).join('')}</div></div>`;
    box.querySelector('.pg-body').onclick = (e) => { const b = e.target.closest('.bd-edit'); if (b) panel(`Build · ${BY_ID.get(+b.dataset.id).name}`, '<p>Choisis les attaques et vitamines à favoriser (★) ou à écarter (✕). Elles seront proposées plus ou moins souvent pendant tes parties avec ce Pokémon.</p>'); };
  }

  // ---- Réglages ----
  function settings() {
    const st = JSON.parse(localStorage.getItem('pokebonk.settings') || '{}');
    const set = (k, v) => { st[k] = v; localStorage.setItem('pokebonk.settings', JSON.stringify(st)); };
    const box = page('st', 'Réglages', 'Conservés à la sortie', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)');
    const cats = [['son', 'Son', 'Volume, musique et cris', 'metronome', '#ff9a3a'], ['gfx', 'Graphismes', 'Qualité, caméra et flashs', 'silph-scope', '#3a8cff'], ['ctl', 'Commandes', 'Visée et caméra', 'pp-up', '#36c96a'], ['keys', 'Touches', 'Changer touches et boutons', 'tm-case', '#ffd23a'], ['ui', 'Interface', 'Thème, taille et ce qui s’affiche', 'star-piece', '#ff5a5f'], ['lang', 'Langue', 'Textes du jeu', 'poke-ball', '#8a5cff'], ['acc', 'Compte', 'Nom, mot de passe, réinitialisation et suppression', 'master-ball', '#ff5a5f']];
    let cur = 'son';
    const slider = (k, label, def) => `<div class="st-box"><div class="st-row"><b>${label}</b><em data-v="${k}">${st[k] ?? def}%</em></div><input type="range" min="0" max="100" value="${st[k] ?? def}" data-k="${k}"></div>`;
    const toggle = (k, label, def) => `<label class="st-box st-tg"><b>${label}</b><input type="checkbox" data-t="${k}" ${(st[k] ?? def) ? 'checked' : ''}><i></i></label>`;
    const tracks = [['Automatique', 'Celle de la saison ou de l’événement en cours'], ['La cascade', 'Thème de la sortie du jeu'], ['Crépuscule à Rosalia', 'Thème de la Saison 3'], ['Nuit à la Tour Lavanville', 'Thème de l’événement d’Halloween'], ['Route sauvage', 'Musique de partie'], ['À toute allure', 'Musique de partie'], ['Sans répit', 'Musique de partie'], ['Hautes herbes', 'Musique de partie'], ['Vent de Johto', 'Musique de partie'], ['Un légendaire apparaît !', 'Combat contre un légendaire']];
    const panels = {
      son: () => `<div class="st-two">${slider('vol', 'Volume général', 80)}${slider('music', 'Musique', 50)}${slider('fx', 'Effets', 70)}${slider('cries', 'Cris des Pokémon', 60)}${toggle('mute', 'Couper le son en arrière-plan', true)}</div>
        <div class="st-box st-music"><b>Musique du menu</b><small>Écoutez chaque morceau et choisissez celui qui jouera dans les menus</small><div class="st-tracks">${tracks.map(([n, s], i) => `<button class="st-track ${(st.track ?? 0) === i ? 'on' : ''}" data-track="${i}"><span class="st-play">▶</span><span><b>${n}</b><small>${s}</small></span><em>${(st.track ?? 0) === i ? 'Choisie' : 'Choisir'}</em></button>`).join('')}</div></div>`,
      gfx: () => `<div class="st-two">${slider('quality', 'Qualité', 75)}${slider('fov', 'Champ de vision', 50)}${toggle('reducefx', 'Réduire les effets (flashs et secousses)', document.documentElement.classList.contains('reduce-fx'))}${toggle('shake', 'Secousses de l’écran', true)}${toggle('dmgnums', 'Nombres de dégâts', true)}${toggle('fps', 'Afficher les FPS', false)}</div>`,
      ctl: () => `<div class="st-two">${slider('sens', 'Sensibilité de la caméra', 50)}${toggle('invert', 'Inverser la caméra', false)}${toggle('aim', 'Visée à la souris', false)}${toggle('autorot', 'Caméra qui suit le déplacement', true)}</div>`,
      keys: () => `<div class="st-keys">${[['Avancer', 'Z / W'], ['Reculer', 'S'], ['Gauche', 'Q / A'], ['Droite', 'D'], ['Sauter', 'Espace'], ['Glisser', 'Maj'], ['Ultimate', 'R'], ['Ouvrir', 'E'], ['Encens', 'C'], ['Pause', 'Échap']].map(([a, k]) => `<div class="st-box st-row"><b>${a}</b><kbd>${k}</kbd></div>`).join('')}</div>`,
      ui: () => `<div class="st-two">${toggle('dark', 'Thème sombre', true)}${slider('uisize', 'Taille de l’interface', 100)}${toggle('minimap', 'Mini-carte', true)}${toggle('season', 'Carte de saison en partie', true)}</div>`,
      lang: () => '<div class="st-box"><b>Langue du jeu</b><small>Utilise le bouton de langue en haut à gauche du menu principal pour changer de langue.</small></div>',
      acc: () => '<div class="st-box"><b>Compte invité</b><small>Ta progression est enregistrée sur cet appareil. Crée un compte pour la retrouver partout.</small><div class="st-btns"><button class="btn green small" data-acc="register">Créer un compte</button><button class="btn red small" data-acc="reset">Effacer la progression invité</button></div></div>',
    };
    const body = box.querySelector('.pg-body');
    const render = () => {
      const c = cats.find((x) => x[0] === cur);
      body.innerHTML = `<nav class="st-nav">${cats.map(([k, n, s, ic, col]) => `<button class="${k === cur ? 'on' : ''}" data-cat="${k}" style="--sc:${col}"><span class="st-ic">${icon(ic)}</span><span><b>${n}</b><small>${s}</small></span></button>`).join('')}</nav>
        <section class="st-panel"><header>${icon(c[3])}<span><b>${c[1]}</b><small>${c[2]}</small></span>${cur === 'son' ? '<button class="btn ghost small" data-reset>Réinitialiser</button>' : ''}</header><div class="st-body">${panels[cur]()}</div></section>`;
    };
    render();
    body.onclick = (e) => {
      const c = e.target.closest('[data-cat]'); if (c) { cur = c.dataset.cat; render(); return; }
      const tr = e.target.closest('[data-track]'); if (tr) { set('track', +tr.dataset.track); render(); return; }
      if (e.target.closest('[data-reset]')) { for (const k of ['vol', 'music', 'fx', 'cries', 'track']) delete st[k]; localStorage.setItem('pokebonk.settings', JSON.stringify(st)); render(); return; }
      const a = e.target.closest('[data-acc]');
      if (a?.dataset.acc === 'register') onLogout('register');
      if (a?.dataset.acc === 'reset') panel('Effacer la progression', '<p>Toute ta progression d’invité sera supprimée de cet appareil.</p>', [{ label: 'Effacer', cls: 'red', run: () => { localStorage.removeItem('pokebonk.guest'); closePanel(); onLogout(); } }]);
    };
    body.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k) { set(k, +e.target.value); body.querySelector(`[data-v="${k}"]`).textContent = `${e.target.value}%`; } });
    body.addEventListener('change', (e) => {
      const k = e.target.dataset.t; if (!k) return;
      set(k, e.target.checked);
      if (k === 'reducefx') { document.documentElement.classList.toggle('reduce-fx', e.target.checked); localStorage.setItem('pokebonk.reduceFx', e.target.checked ? '1' : ''); }
    });
  }

  // ---- Guide du dresseur ----
  const CHAPTERS = [['Premiers pas', 'poke-ball', '#ff5a5f', 1], ['La partie', 'level', '#1fa86a', 0], ['La carte', 'map-unown', '#0d9fae', 0], ['Ta Ligue', 'ultra-ball', '#2f72e8', 1], ['Modes de jeu', 'moon-stone', '#6a4cd8', 1], ['Progression', 'rare-candy', '#a24fe0', 1], ['Défis et collection', 'star-piece', '#f08a1c', 1], ['Communauté', 'clan', '#2563d8', 0]];
  function guide(start = 0) {
    let i = start;
    const pages = S.guide;
    const el = overlay('gd', '<div class="gd-win"></div>');
    const p = P();
    const render = () => {
      const pg = pages[i];
      const ch = CHAPTERS[pg.ch];
      const inCh = pages.filter((x) => x.ch === pg.ch);
      const k = inCh.indexOf(pg) + 1;
      const chIcon = (c) => (c[3] ? icon(c[1]) : uiIcon(c[1]));
      el.querySelector('.gd-win').innerHTML = `<header class="gd-h"><span class="gd-logo">${uiIcon('idea')}</span><span><small>PokéBonk</small><b>Guide du dresseur</b></span>
          <nav class="gd-chs">${CHAPTERS.map((c, n) => `<button class="${n === pg.ch ? 'on' : ''}" style="--gc:${c[2]}" data-ch="${n}" title="${c[0]}">${chIcon(c)}${n === pg.ch ? `<b>${c[0]}</b>` : ''}</button>`).join('')}</nav>
          <button class="gd-skip" data-close>Passer le guide <kbd>Esc</kbd></button></header>
        <div class="gd-main"><div class="gd-art" style="--gc:${ch[2]}"><div class="gd-glow"></div>${face(p.lastSpecies, 'gd-hero')}${[16, 19, 10, 13, 43, 21, 41].map((id, n) => `<img class="pix gd-mob" style="--a:${n * 51}deg" src="./assets/portraits/${id}.png" alt="">`).join('')}</div>
          <div class="gd-tx"><p class="gd-k" style="--gc:${ch[2]}">${chIcon(ch)}Chapitre ${pg.ch + 1} · ${ch[0]}<em>${k}/${inCh.length}</em></p><h2>${md(pg.title)}</h2><p class="gd-lead">${md(pg.lead)}</p>
          <ul>${pg.pts.map(([kind, ic, t]) => `<li>${kind === 'item' ? icon(ic) : uiIcon(ic)}<span>${md(t)}</span></li>`).join('')}</ul></div></div>
        <footer class="gd-f"><div class="gd-dots">${pages.map((_, n) => `<i class="${n === i ? 'on' : n < i ? 'seen' : ''}"></i>`).join('')}</div><button class="btn ghost" data-prev ${i ? '' : 'disabled'}>Retour</button><span>${i + 1} / ${pages.length}</span><button class="btn green" data-next>${i === pages.length - 1 ? 'Terminer' : 'Suivant'}</button></footer>`;
    };
    render();
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) { if (i === pages.length - 1) el.close(); else { i++; render(); } }
      if (e.target.closest('[data-prev]') && i) { i--; render(); }
      const c = e.target.closest('[data-ch]'); if (c) { i = pages.findIndex((x) => x.ch === +c.dataset.ch); render(); }
    });
    addEventListener('keydown', function nav(e) { if (!el.isConnected) { removeEventListener('keydown', nav); return; } if (e.key === 'ArrowRight' && i < pages.length - 1) { i++; render(); } if (e.key === 'ArrowLeft' && i) { i--; render(); } });
  }

  // ---- Signaler ----
  function report() {
    let kind = 0;
    const el = overlay('fb', `<div class="fb-win"><header>${uiIcon('bug')}<span><b>Aide-nous à nous améliorer</b><small>Signale un bug ou dis-nous ton idée. L'équipe te lit.</small></span></header>
      <div class="fb-kinds"><button class="on" data-k="0">${uiIcon('bug')}Un bug</button><button data-k="1">${uiIcon('idea')}Une idée</button><button data-k="2">${uiIcon('megaphone')}Autre chose</button></div>
      <textarea maxlength="2000" placeholder="Que s'est-il passé ? Que faisais-tu juste avant ? Si tu peux le reproduire, raconte-nous les étapes."></textarea>
      <div class="fb-row"><label><input type="checkbox" checked><span><b>Joindre les données techniques</b><small>Navigateur, version et erreurs récentes.</small></span></label><em>0/2000</em></div>
      <footer><a href="https://discord.com/invite/X7KusQqx8X" target="_blank" rel="noopener">Tu préfères en parler ? Discord</a><button class="btn ghost" data-close>Annuler</button><button class="btn blue" data-send>${uiIcon('send')}Envoyer</button></footer></div>`);
    const ta = el.querySelector('textarea');
    const ph = ["Que s'est-il passé ? Que faisais-tu juste avant ? Si tu peux le reproduire, raconte-nous les étapes.", 'Raconte-nous ton idée : ce que tu aimerais voir dans le jeu et pourquoi.', 'Dis-nous ce que tu veux nous dire.'];
    ta.addEventListener('input', () => { el.querySelector('em').textContent = `${ta.value.length}/2000`; });
    el.addEventListener('click', (e) => {
      const k = e.target.closest('[data-k]'); if (k) { kind = +k.dataset.k; el.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b === k)); ta.placeholder = ph[kind]; }
      if (e.target.closest('[data-send]')) {
        if (ta.value.trim().length < 5) { ta.focus(); return; }
        location.href = `mailto:contacto@pokebonk.com?subject=${encodeURIComponent(['Bug', 'Idée', 'Message'][kind] + ' PokéBonk')}&body=${encodeURIComponent(ta.value)}`;
        el.close();
      }
    });
    setTimeout(() => ta.focus(), 50);
  }

  // ---- Trésors ----
  function treasures() {
    const wheels = [[4, 'Salamèche', 'Braise Éternelle', 'Bronze Ardent', 'Apprenti de la Braise', 'Cadre Cendres'], [1, 'Bulbizarre', 'Feuille Éternelle', 'Bronze Floral', 'Apprenti des Bois', 'Cadre Lianes'], [7, 'Carapuce', 'Vague Éternelle', 'Bronze Marin', 'Apprenti des Flots', 'Cadre Écume'], [63, 'Abra', 'Esprit Éternel', 'Bronze Psy', 'Apprenti Médium', 'Cadre Mirage'], [92, 'Fantominus', 'Ombre Éternelle', 'Bronze Spectral', 'Apprenti des Ombres', 'Cadre Brume'], [25, 'Pikachu', 'Foudre Éternelle', 'Bronze Électrique', 'Apprenti de l’Orage', 'Cadre Étincelles']];
    let w = 0;
    queueMicrotask(() => liveTreasures(box, P, saveProfile));
    const box = page('tz', 'Trésors', 'Dépense tes Bonkoins dans une roue de récompenses', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<button class="pg-gloss" data-odds>${uiIcon('idea')}Probabilités</button><span class="pg-dust tz-bonk">${uiIcon('bonk')}<b>0</b></span>`);
    const body = box.querySelector('.pg-body');
    const render = () => {
      const [id, name, jack, bronze, title, frame] = wheels[w];
      const prize = (ic, n, r, item = true) => `<div class="tz-prize r-${r}"><i></i>${item ? icon(ic) : ic}<b>${n}</b></div>`;
      body.innerHTML = `<div class="tz-page"><div class="tz-wheels">${wheels.map((x, n) => `<button class="${n === w ? 'on' : ''}" data-w="${n}">${face(x[0])}<span><b>${x[1]}</b><small>Obtenu 0/10</small></span></button>`).join('')}</div>
        <div class="tz-board">${prize('rare-candy', 'Super Bonbon ×4', 'c')}<div class="tz-jack"><span class="tz-tags"><i>Apparence</i><i>Cadre épique</i><i>Titre</i></span><img class="pix tz-frame" src="./assets/ui/frames/tr-fire-2.png" alt="">${face(id, 'tz-skin')}<span class="tz-jl"><small>Gros lot</small><b>${jack}</b></span></div>${prize(`<img class="pix tz-medal" src="./assets/ui/frames/tr-fire-1.png" alt="">${face(id, 'tz-mini')}`, bronze, 'e', false)}
          ${prize('amulet-coin', 'Pièce Rune ×3', 'c')}${prize('master-ball', 'Master Ball ×2', 'r')}
          ${prize('lucky-egg', 'Œuf Chance ×3', 'c')}${prize('honey', 'Miel ×2', 'c')}${prize(`<span class="tz-crown">${uiIcon('crown')}</span>`, title, 'u', false)}${prize(`<img class="pix tz-medal" src="./assets/ui/frames/look-metal.png" alt="">${face(id, 'tz-mini')}`, frame, 'u', false)}${prize('shiny-stone', 'Pierre Éclat ×2', 'r')}</div>
        <p class="tz-hint">Touche un prix pour voir ce que c'est.</p></div>
        <aside class="tz-side"><small>Roue</small><h2>Trésors de ${name}</h2><div class="tz-got"><span>Obtenu</span><b>0/10</b></div><div class="tz-pips">${'<i></i>'.repeat(10)}</div><div class="grow"></div>
          <div class="tz-cost">${uiIcon('bonk')}<b>3</b><small>Tour 1 sur 10</small></div><button class="btn big tz-spin" disabled>Tourner !</button><p class="tz-miss">Il te manque 3 Bonkoins.</p><p class="tz-note">${uiIcon('bonk')}Les gardiens et les boss en lâchent parfois.</p></aside>`;
    };
    render();
    body.onclick = (e) => {
      const b = e.target.closest('[data-w]'); if (b) { w = +b.dataset.w; render(); }
      const pz = e.target.closest('.tz-prize, .tz-jack'); if (pz) panel(pz.querySelector('b').textContent, '<p>Une récompense de la roue. Chaque tour en donne une, sans doublon, jusqu’au gros lot.</p>');
    };
    box.querySelector('[data-odds]').onclick = () => panel('Probabilités', '<ul><li>Commun : 46 %</li><li>Peu commun : 28 %</li><li>Rare : 16 %</li><li>Épique : 8 %</li><li>Gros lot : 2 % (garanti au 10e tour)</li></ul>');
  }

  // ---- Apps ----
  function apps() {
    const box = page('dkapp', '', '', 'transparent');
    box.querySelector('.pg-title').remove();
    const shots = ['forest', 'desert', 'glacier', 'coast', 'horde'];
    let os = 0;
    const OS = [['Windows', 'Windows 10 et 11', '🖥', 'Télécharger pour Windows', 'Installateur · 112 MB · v1.4.0'], ['macOS', 'Intel et Apple Silicon', '💻', 'Télécharger pour macOS', 'DMG · 118 MB · v1.4.0'], ['Linux et Steam Deck', 'AppImage · .deb', '🎮', 'Télécharger pour Linux', 'AppImage · 120 MB · v1.4.0'], ['Android', 'Android 7 ou plus récent', '📱', 'Télécharger pour Android', 'APK · 96 MB · v1.4.0']];
    const body = box.querySelector('.pg-body');
    box.style.setProperty('--dk-bg', `url('${new URL('./assets/ui/desktop/forest.webp', location.href).href}')`);
    const render = () => {
      body.innerHTML = `<div class="dk-tx"><p class="dk-tags"><em class="gold">App officielle</em><em>Gratuit</em></p><h1>PokéBonk, hors du navigateur</h1><p class="dk-lead">Le même compte et la même progression que sur le web, dans une app faite pour jouer.</p>
        <ul><li>Utilise toute votre carte graphique : plus de FPS et sans saccades</li><li>Vrai plein écran, fenêtre et résolution à votre goût</li><li>Se met à jour seule, à la manette et sur Steam Deck</li></ul>
        <div class="dk-os">${OS.map((o, i) => `<button class="${i === os ? 'on' : ''}" data-os="${i}"><i>${o[2]}</i><b>${o[0]}</b><small>${o[1]}</small></button>`).join('')}</div>
        <div class="dk-dl"><a class="btn big red" href="https://pokebonk.com/" target="_blank" rel="noopener"><b>${OS[os][3]}</b><small>${OS[os][4]}</small></a><a class="dk-alt" href="https://pokebonk.com/" target="_blank" rel="noopener">Ou : portable, sans installation</a></div>
        <ol class="dk-steps"><li><b>Téléchargez-la</b><small>Gratuite, sans nouveau compte</small></li><li><b>Ouvrez-la</b><small>Si Windows vous avertit : « Informations complémentaires » puis « Exécuter quand même »</small></li><li><b>On joue !</b><small>Connectez-vous avec votre compte habituel</small></li></ol>
        <p class="dk-warn">Téléchargez-la uniquement ici : toute autre « appli PokéBonk » n'est pas la nôtre et peut voler votre compte.</p></div>
        <div class="dk-shots">${shots.map((s, i) => `<button class="${i === 0 ? 'on' : ''}" data-shot="${s}"><img src="./assets/ui/desktop/${s}.webp" alt=""></button>`).join('')}</div>`;
    };
    render();
    body.onclick = (e) => {
      const o = e.target.closest('[data-os]'); if (o) { os = +o.dataset.os; render(); }
      const s = e.target.closest('[data-shot]'); if (s) { box.style.setProperty('--dk-bg', `url('${new URL(`./assets/ui/desktop/${s.dataset.shot}.webp`, location.href).href}')`); body.querySelectorAll('[data-shot]').forEach((x) => x.classList.toggle('on', x === s)); }
    };
  }

  // ---- Actualités ----
  function news() {
    const box = page('nw', 'Actualités', 'Nouveautés, événements et correctifs de PokéBonk', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)');
    const p = P();
    p.newsRead ||= [];
    let sel = 0;
    const tagCls = (t) => (/Mise/.test(t) ? 'maj' : /Avis/.test(t) ? 'avis' : 'nouv');
    const body = box.querySelector('.pg-body');
    const render = () => {
      const n = S.news[sel];
      body.innerHTML = `<div class="nw-list">${S.news.map((x, i) => `<button class="nw-card ${tagCls(x.tag)} ${i === sel ? 'on' : ''} ${p.newsRead.includes(i) || i === 0 ? '' : 'unread'}" data-n="${i}"><span class="nw-thumb">${pic(x.ic || './assets/ui/icons/news.png')}</span><span class="nw-ctx"><span class="nw-meta"><span class="nw-tag">${x.tag}</span>${uiIcon('pin')}<small>${x.date}</small></span><b>${x.title}</b><small class="nw-sum">${x.sum}</small></span><i class="nw-dot"></i></button>`).join('')}</div>
        <article class="nw-art"><header class="nw-hero ${tagCls(n.tag)}">${pic(n.ic || './assets/ui/icons/news.png', 'nw-hero-ic')}<div><p><span class="nw-tag">${n.tag}</span>${uiIcon('pin')}<span>Verrouillée</span><span>${n.date}</span></p><h2>${n.title}</h2><p class="nw-sum2">${n.sum}</p></div></header>
          <div class="nw-body">${sel === 0 && S.newsArticle ? S.newsArticle : `<p>${n.sum}</p><p>Retrouve tous les détails dans le jeu et sur le Discord de PokéBonk.</p>`}</div></article>`;
    };
    render();
    body.onclick = (e) => { const c = e.target.closest('[data-n]'); if (c) { sel = +c.dataset.n; if (!p.newsRead.includes(sel)) { p.newsRead.push(sel); saveProfile(p); } render(); } };
  }

  // ---- Amis ----
  function friends() {
    queueMicrotask(() => liveFriends(box, () => coopLobby(box, coopOpts())));
    const box = page('fr', 'Amis', 'Tes amis, leurs demandes et qui est en train de jouer', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<button class="pg-gloss">${uiIcon('mail')}Boîte aux lettres</button>`);
    box.querySelector('.pg-body').innerHTML = `<section class="fr-main"><div class="grp-head"><b>Tes amis</b><small>0/100</small></div><div class="fr-empty">${uiIcon('friends')}<h3>Pas encore d'amis ici</h3><p>Ajoute d'autres dresseurs par leur nom ou depuis leur fiche. Quand ils accepteront, tu les verras ici avec leur statut et pourras les inviter dans ton clan.</p></div></section>
      <aside class="fr-side"><div class="fr-box"><header>${uiIcon('friend-add')}<span><b>Ajouter un ami</b><small>La demande arrive dans sa boîte aux lettres</small></span></header><div class="fr-add"><input class="pg-search" placeholder="Nom du dresseur"><button class="btn green" data-add>${uiIcon('friend-add')}Envoyer la demande</button></div><button class="pg-chip small" data-copy>Copier le lien de ma fiche</button></div>
        <div class="fr-box"><div class="grp-head"><b>Jouer avec des amis</b><small>Coopératif · BÊTA</small></div><p>Crée un salon et invite tes amis connectés : le mode classique de 2 à 4 dresseurs.</p><button class="btn green fr-coop" data-coop>${uiIcon('friends')}Coopératif</button></div></aside>`;
    box.querySelector('.pg-body').onclick = (e) => {
      if (e.target.closest('[data-add]')) panel('Amis', '<p>Les amis demandent un compte. Crée un compte pour envoyer des demandes d’ami.</p>', [{ label: 'Créer un compte', cls: 'green', run: () => { closePanel(); onLogout('register'); } }]);
      if (e.target.closest('[data-copy]')) { navigator.clipboard?.writeText(location.origin + '/'); e.target.textContent = 'Lien copié !'; }
      if (e.target.closest('[data-coop]')) { box.back(); setTimeout(() => coop(), 0); }
    };
  }

  // ---- Fiche de dresseur ----
  function trainer() {
    const p = P();
    const box = page('pf', 'Fiche de dresseur', 'Voilà comment te voient les autres dresseurs', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', '<button class="btn blue small pf-share">Partager ma fiche</button>');
    const fav = p.runs.length ? p.runs.reduce((m, r) => ((m[r.start] = (m[r.start] || 0) + 1), m), {}) : {};
    const favId = Object.entries(fav).sort((a, b) => b[1] - a[1])[0];
    const time = Math.round(p.runs.reduce((s, r) => s + r.time, 0) / 60);
    const stat = (ic, v, k, item = true) => `<div class="pf-stat">${item ? icon(ic) : uiIcon(ic)}<span><b>${v}</b><small>${k}</small></span></div>`;
    box.querySelector('.pg-body').innerHTML = `<div class="pf-page">
      <section class="pf-head"><div class="pf-av">${face(p.lastSpecies)}<button class="btn blue small">Changer</button></div><div><h2>Invité</h2><small>Dresseur depuis le ${new Date(p.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</small><p><em class="pf-chip">Pas encore classé cette saison</em>${favId ? `<em class="pf-chip fav">Favori : ${BY_ID.get(+favId[0])?.name} (${favId[1]} parties)</em>` : ''}</p></div>
        <div class="pf-badges">${['top10', 'top25', 'top50', 'top100', 'elite', 'master'].map((r) => `<span><img class="pix" src="./assets/ui/ranks/${r}.png" alt=""><small>×0</small></span>`).join('')}</div></section>
      <div class="pf-stats">${stat('poke-ball', p.stats.runs, 'Parties')}${stat('check', p.stats.wins, 'Victoires', false)}${stat('master-ball', p.stats.kills, 'K.O.')}${stat('metronome', `${time} min`, 'Temps de jeu')}${stat('map-boss', 0, 'Gardiens', false)}${stat('star-piece', 0, 'Légendaires')}${stat('protein', 0, 'Alphas')}${stat('rare-candy', Math.max(1, ...p.runs.map((r) => r.level || 1)), 'Niveau maximum')}${stat('ultra-ball', `${p.league.length}/138`, 'Ligue')}${stat('great-ball', `${p.seen.length} vus`, 'Pokédex')}${stat('shiny-charm', 0, 'Chromatiques', false)}${stat('champion', 0, 'Médailles de temps', false)}</div>
      <section class="pf-box"><div class="grp-head"><b>Favoris</b><small>Ses Pokémon favoris de la Ligue</small></div><div class="pf-favs">${(p.favorites || []).map((id) => `<span class="pf-fav">${face(id)}<b>${BY_ID.get(id)?.name || ''}</b></span>`).join('') || '<p class="pf-empty">Ajoute des favoris depuis La Ligue.</p>'}</div></section>
      <div class="pf-two"><section class="pf-box"><div class="grp-head"><b>Records par région</b><small>K.O. · contre la montre</small></div>${p.runs.length ? `<div class="pf-rec"><b>Forêt Verte</b><small>Normal</small><strong>${Math.max(...p.runs.map((r) => r.kills))} <small>K.O.</small></strong><em class="pf-build">Build</em><span>${p.best.classic ? `${Math.floor(p.best.classic / 60)}:${String(Math.floor(p.best.classic % 60)).padStart(2, '0')}` : '—:——'}</span></div>` : '<p class="pf-empty">Joue une partie pour établir un record.</p>'}</section>
        <section class="pf-box"><div class="grp-head"><b>Vitrine des badges de saison</b><small>0 badges</small></div><p class="pf-empty">Aucun pour l'instant. Termine une saison dans le top 100 mondial ou dans le top 50 d'une région pour gagner ton premier badge.</p></section></div>
      <section class="pf-box"><div class="grp-head"><b>Dernières parties</b><small>${p.runs.length ? `Dernière fois : ${new Date(p.runs[0].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</small></div>${p.runs.slice(0, 8).map((r) => `<div class="pf-run">${face(r.species)}<b>${BY_ID.get(r.species)?.name}</b><small>${new Date(r.at).toLocaleDateString('fr-FR')}</small><span>${r.mode === 'endless' ? 'Survie' : 'Classique'} · Forêt Verte</span><span>${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}</span><strong>${r.kills} K.O.</strong></div>`).join('') || '<p class="pf-empty">Aucune partie pour l’instant.</p>'}</section></div>`;
    box.querySelector('.pf-share').onclick = (e) => { navigator.clipboard?.writeText(location.origin + '/'); e.target.textContent = 'Lien copié !'; };
  }

  // ---- Nouveautés ----
  function version() {
    const el = overlay('rel', `<div class="rel-win"><h2>Nouveautés</h2><div class="rel-scroll">${S.versions.map((v, i) => {
      const m = v.head.match(/^(v[\d.]+)(Cette version)?(\d+ [^\d]+ \d{4})(.*)$/u) || [0, v.head, '', '', v.title];
      return `<details class="rel ${i === 0 ? 'cur' : ''}" ${i === 0 ? 'open' : ''}><summary><b>${m[1]}</b>${m[2] ? '<em>Cette version</em>' : ''}<span>${m[3]}</span><p>${m[4]}</p></summary>${v.cats.map((c) => { const h = c.h.replace(/\d+$/, ''); const n = (c.h.match(/\d+$/) || [''])[0]; const k = /Nouveau/.test(h) ? 'new' : /Am/.test(h) ? 'imp' : /quil/.test(h) ? 'bal' : 'fix'; return `<div class="rel-cat ${k}"><div class="rel-cat-h">${pic(c.ic)}<b>${h}</b><i>${n}</i></div><ul>${c.li.map((x) => `<li>${x}</li>`).join('')}</ul></div>`; }).join('')}</details>`;
    }).join('')}</div><button class="btn green" data-close>Fermer</button></div>`);
    void el;
  }

  // ---- Coopératif ----
  function coop() {
    queueMicrotask(() => box.addEventListener('click', (e) => { if (e.target.closest('[data-need]')) { e.stopPropagation(); coopLobby(box, coopOpts()); } }, true));
    const box = page('cp', 'Coopératif', 'Joue avec tes amis · BÊTA', 'linear-gradient(100deg,#ff5a5f,#ff9a3a)');
    const seg = (items, on = 0, cls = '') => `<div class="cp-seg ${cls}">${items.map((x, i) => `<button class="${i === on ? 'on' : ''}">${x}</button>`).join('')}</div>`;
    box.querySelector('.pg-body').innerHTML = `
      <aside class="cp-left"><section class="cp-box"><h3 class="green">${uiIcon('friends')}Avec des amis<small>2-4 dresseurs</small></h3><div class="cp-in"><div class="cp-card"><b>Crée un salon</b><small>Tu choisis la carte et la difficulté, et tu invites tes amis ou ton clan</small><button class="btn big green" data-need>${uiIcon('friends')}Créer un salon</button></div><p class="cp-or">ou</p>
        <div class="cp-card"><b>Rejoins avec un code</b><small>C'est le créateur du salon qui te le donne</small><div class="cp-code"><input maxlength="1"><input maxlength="1"><input maxlength="1"><input maxlength="1"></div><button class="btn ghost" data-need>Rejoindre</button></div></div></section>
        <section class="cp-box"><h3 class="purple">${uiIcon('idea')}Comment jouer</h3><div class="cp-in"><div class="cp-rule">${uiIcon('map-boss')}<span><b>Une horde pour chacun</b><small>Elle te poursuit. Si vous restez groupés, les hordes s'additionnent.</small></span></div><div class="cp-rule">${uiIcon('map-boss')}<span><b>Des boss pour tous</b><small>Le gardien et le légendaire sont à toute l'équipe et tiennent plus longtemps.</small></span></div><div class="cp-rule">${uiIcon('map-shrine')}<span><b>Relevez-vous</b><small>Un coéquipier K.O. revient si vous restez près de lui.</small></span></div></div></section></aside>
      <section class="cp-mid"><div class="cp-find"><div class="cp-find-l"><em>BETA</em><h2>Trouver une partie</h2><p>On te met avec d'autres dresseurs qui cherchent aussi une équipe</p><button class="btn big red" data-need>${uiIcon('friends')}Trouver une partie</button><small>26 dresseurs cherchent en ce moment</small></div>
        <div class="cp-find-r"><label><span>Mode</span>${seg(['Classique', 'Survie'])}</label><label><span>Équipe</span>${seg(['Peu importe', 'Duo', 'Trio', 'Escouade'])}</label><label><span>Carte</span><button class="cp-map"><img class="pix" src="./assets/ui/icons/map-portal.png" alt=""><span><b>Peu importe</b><small>Peu importe la carte</small></span>⌄</button></label><label><span>Difficulté</span>${seg(['Peu importe', 'Normal', 'Difficile 🔒', 'Cauchemar 🔒'])}</label></div></div>
        <section class="cp-board"><h3 class="orange">${uiIcon('champion')}Classement coopératif<small>Saison 3 · 59.6k équipes</small></h3><div class="cp-in">${seg(['Duo', 'Trio', 'Escouade'])}<button class="cp-map wide"><img class="pix" src="./assets/icons/123.png" alt=""><b>Forêt Verte</b>⌄</button>${seg(['Normal', 'Difficile', 'Cauchemar', 'Survie'], 0, 'right')}
          <div class="cp-rows">${S.coopRank.map((r, i) => `<div class="cp-row top${i + 1}"><em>${i < 3 ? uiIcon('champion') : i + 1}</em><span class="cp-stack">${r.pics.map((x) => pic(x)).join('')}</span><span class="cp-who"><b>${esc(r.who.replace(/(Victoire|·).*$/, '').trim())}</b><small>${esc((r.who.match(/(Victoire.*|· .*)$/) || [''])[0])}</small></span><strong>${r.val.replace('K.O.', '')}<small>K.O.</small></strong></div>`).join('')}</div></div>
          <div class="cp-me">${face(P().lastSpecies)}<span><small>Ta meilleure équipe</small><b>Tu n'as pas encore d'équipe dans ce classement</b></span><button class="btn small orange-btn">Tout voir</button></div></section></section>
      <aside class="cp-inv"><h3 class="blue">${uiIcon('mail')}Invitations</h3><div class="cp-empty">${uiIcon('mail')}<p>Quand un ami ou un membre de ton clan t'invitera dans son salon, ça apparaîtra ici.</p></div></aside>`;
    const body = box.querySelector('.pg-body');
    body.onclick = (e) => {
      const b = e.target.closest('.cp-seg button'); if (b) b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (e.target.closest('[data-need]')) panel('Coopératif', '<p>Le mode coopératif se joue en ligne et demande un compte. Crée un compte pour inviter des amis ou trouver une équipe.</p>', [{ label: 'Créer un compte', cls: 'green', run: () => { closePanel(); onLogout('register'); } }]);
    };
    body.addEventListener('input', (e) => { if (e.target.matches('.cp-code input') && e.target.value) e.target.nextElementSibling?.focus(); });
  }

  // ---- Mutation du jour ----
  function mutation() {
    const box = page('mu', '', '', 'transparent');
    box.querySelector('.pg-title').remove();
    box.style.setProperty('--mu-bg', `url('${new URL('./assets/ui/banners/mut-glass.jpg', location.href).href}')`);
    const ms = new Date(new Date().toISOString().slice(0, 10) + 'T24:00:00Z') - Date.now();
    const left = `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min ${Math.floor((ms % 60000) / 1000)} s`;
    const muts = [['Cristal', 'mut-glass', 'Aujourd’hui'], ['Métronome', 'metronome', 'Revient d…', 1], ['Pokérus', 'mut-pokerus', 'Revient d…'], ['Fièvre de Bonbons', 'rare-candy', 'Revient d…', 1], ['Jour et Nuit', 'moon-stone', 'Revient d…', 1], ['Sauvages Dynamax', 'mut-dynamax', 'Revient d…']];
    box.querySelector('.pg-body').innerHTML = `<section class="mu-main"><div class="mu-top"><span class="mu-gem">${uiIcon('mut-glass')}</span><div><p class="mu-chips"><span><i></i>Mutation du jour</span><em>Change dans ${left}</em><b>Normal</b></p><h1>Cristal</h1><p class="mu-lead">Tu infliges le double de dégâts, mais tu n'as qu'un quart de tes PV.</p>
        <ul><li class="hot">Tes PV max tombent au quart.</li><li class="hot">×2 dégâts sur tous tes coups.</li><li>Forêt Verte · la même carte et la même graine pour tous, sans Sac</li><li>Ta meilleure partie du jour compte : le plus loin que tu ailles et, en cas d'égalité, les K.O.</li></ul></div></div>
      <div class="mu-path">${[['1', 'Zone 1', 'Tu commences ici'], ['2', 'Zone 2', '+60 de Poussière'], [uiIcon('champion'), 'Zone 3', 'Titre', 'gold'], [face(P().lastSpecies), 'Sanctuaire', 'Cadre', 'ice'], [uiIcon('mut-glass'), 'Victoire', 'Fond de profil', 'gem']].map(([a, b, c, k]) => `<div class="mu-step ${k || ''}"><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join('')}</div>
      <div class="mu-gems">${muts.map(([n, ic, s, item], i) => `<span class="mu-g ${i === 0 ? 'on' : ''}">${item ? icon(ic) : uiIcon(ic)}<span><b>${n}</b><small>${s}</small><i>●●●</i></span></span>`).join('')}<span class="mu-g king">${uiIcon('crown')}<span><b>Roi des Mutations</b><small>0 victoires sur 6</small></span></span></div>
      <div class="mu-go"><button class="btn big red" data-play>${uiIcon('mut-glass')}Jouer</button><small>Tu ne l'as pas encore jouée aujourd'hui</small></div></section>
      <aside class="mu-rank"><h3>Classement</h3><div class="pg-seg"><button class="on">${uiIcon('mut-glass')}Aujourd'hui</button><button>${icon('metronome')}Hier</button><button>${uiIcon('mut-dynamax')}Il y a 2 jours</button></div>
        <div class="mu-rows">${S.muRank.map((r) => { const m = r.who.match(/^([A-Z0-9]{2,5})(.+?)([\d.]+[kM]? K\.O\.)$/u) || [0, '', r.who, '']; return `<div class="mu-row"><em class="m${r.rank}">${r.rank}</em>${pic(r.pic)}<span><b><i class="ctag">${m[1]}</i>${esc(m[2])}</b><small>${m[3]}</small></span><strong>${r.val}</strong></div>`; }).join('')}</div></aside>`;
    box.querySelector('[data-play]').onclick = () => { box.back(); setTimeout(() => leagueScreen('classic'), 0); };
  }

  // ---- Événement ----
  function event() {
    const box = page('ev', 'Événement', '', 'linear-gradient(100deg,#1f9a6a,#36c96a)');
    box.querySelector('.pg-title small').remove();
    box.style.setProperty('--ev-bg', `url('${new URL('./assets/ui/events/exp-card.jpg', location.href).href}')`);
    box.querySelector('.pg-h').insertAdjacentHTML('beforeend', `<div class="ev-tabs"><kbd>Q</kbd><div class="pg-seg"><button class="on">Jouer</button><button>Livre des Sceaux</button><button>Succès</button><button>Classement</button><button>Prix</button></div><kbd>E</kbd></div><span class="pg-dust">${uiIcon('exp-seal')}<b>0</b></span>`);
    box.querySelector('.pg-body').innerHTML = `<section class="ev-main"><p class="ev-left"><i></i>Se termine dans ${seasonLeft()}</p><h1>La Grande Expédition</h1><p class="ev-lead">La Vallée sauvage s'ouvre : entre avec ton équipement, pille les caisses Rocket et les Chambres anciennes et pars avec Roucarnage avant la Nuit Rouge.</p>
        <ol class="ev-steps"><li>${uiIcon('exp-bag')}<span><b>Prépare-toi</b><small>Au PC de Bill, tu choisis ce que tu emportes et ce que tu assures. Si tu tombes, tu perds tout ce qui n'est pas assuré.</small></span></li><li>${uiIcon('exp-shard')}<span><b>Pille</b><small>96 caisses Rocket et 4 Chambres anciennes. Plus tu t'enfonces, meilleur est le butin.</small></span></li><li>${uiIcon('exp-flag')}<span><b>Sors vivant</b><small>Tiens 15 s dans le cercle quand Roucarnage se pose et tu repars avec tout. Sortir rapporte des Sceaux.</small></span></li></ol></section>
      <footer class="ev-foot"><div class="ev-day"><b>Un jour dans la vallée</b><small>25 minutes, 6 vols de Roucarnage</small><div class="ev-time"><i></i>${['3:00', '7:00', '11:00', '15:00', '19:00', '22:00'].map((t, n) => `<span style="left:${8 + n * 17}%"><u></u>${t}</span>`).join('')}</div><div class="ev-phases"><span>Matin</span><span>Après-midi doré</span><span>Crépuscule</span><span class="red">Nuit Rouge</span></div></div>
        <div class="ev-stat"><small>Tes Sceaux</small><b>${uiIcon('exp-seal')}0</b></div><div class="ev-stat"><small>Ton meilleur score</small><b>—</b></div><div class="ev-stat wide"><small>Prochaine récompense</small><b>${uiIcon('champion')}Encore 40</b><i><u></u></i></div>
        <button class="btn big ev-go" data-go>${uiIcon('exp-bag')}Aller au PC de Bill <kbd>Enter</kbd></button></footer>`;
    box.querySelector('[data-go]').onclick = () => panel('La Grande Expédition', '<p>La Grande Expédition se joue dans la Vallée sauvage, une grande carte en ligne. Cette version du site propose la Forêt Verte en mode classique et Survie.</p>', [{ label: 'Jouer en Forêt Verte', cls: 'red', run: () => { closePanel(); box.back(); setTimeout(() => leagueScreen('classic'), 0); } }]);
  }

  return { tasks, lab, quests, rank, clans, builds, settings, guide, report, treasures, apps, news, friends, trainer, version, coop, mutation, event };
}

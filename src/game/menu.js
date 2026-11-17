// Everything after "Jouer en invité !": the main menu, La Ligue (choosing the Pokémon),
// Choisis une carte (map, mode and difficulty), the Pokédex, the Boutique and the side panels.
import { BY_ID, animSprite } from './sprites.js';
import { wipe } from './wipe.js';
import { makeScreens } from './screens.js';
import { LEAGUE_TOTAL, clearProfile, dailyTasks, recordRun, saveProfile } from './profile.js';
import { startRun3D } from './run3d.js';
import { postRun } from '../api.js';
import { seasonPanel } from './social.js';
import { ITEM_EFFECTS, ITEM_NAMES, collection } from './treasure-items.js';
import { BIOMES, biome } from './biomes.js';
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
import { startPreview } from './world3d.js';
import { TYPE_CHART, TYPE_FR } from './types.js';
import { EVOLVE_AT, GUARDIANS, kitFor, mainType, starterInfo } from './kits.js';
import { DEX, ITEMS, MOVES_LIST } from './dex.js';
import { DEX_INFO } from './dex-info.js';
import { stageCard, hydrateStages, typeIcon, typeChip, fillSilhouettes, TYPE_COLOR } from './stage.js';

const DISCORD_SVG = '<svg viewBox="0 0 127.14 96.36" aria-hidden="true"><path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"/></svg>';
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const TYPE_ICON = { normal: '◎', fire: '🔥', water: '💧', grass: '🍃', electric: '⚡', ice: '❄', fighting: '✊', poison: '☠', ground: '⛰', flying: '🪶', psychic: '🌀', bug: '🐞', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '☾', steel: '⚙', fairy: '✦' };
const CHART_ORDER = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];
const MUTATIONS = [
  { name: 'Sauvages Dynamax', color: '#e0303e', art: 'mut-dynamax', icon: '<img class="pix uiicon" src="./assets/ui/icons/rival.png" alt="">', desc: 'Des Pokémon sauvages géants apparaissent : plus de PV, plus de dégâts et plus de récompenses.' },
  { name: 'Jour et Nuit', color: '#2e3a8a', art: '', icon: '<img class="pix" src="./assets/items/moon-stone.png" alt="">', desc: 'La carte alterne entre le jour et la nuit. Les Pokémon de nuit sont plus forts quand le soleil se couche.' },
];
const SHOP_SETS = [
  { id: 'sakura', name: 'Hanami', desc: 'Printemps éternel : les pétales ne cessent de tomber et la lumière des lanternes pulse sous la lune.', bg: 'Cerisier Millénaire', frame: 'Branche de Cerisier', skin: 'Esprit Sakura', prices: [50000, 60000, 80000], member: 58 },
  { id: 'abyss', name: 'Abîme', desc: 'Lumière vivante dans l’obscurité totale : des méduses qui pulsent, du plancton qui scintille et des bulles qui montent sans fin.', bg: 'Fosse Luminescente', frame: 'Corail Abyssal', skin: 'Léviathan', prices: [60000, 75000, 100000], member: 129 },
  { id: 'kintsugi', name: 'Or Brisé', desc: 'Porcelaine noire réparée à l’or liquide : la lumière parcourt chaque fissure et la poussière dorée flotte dans l’air.', bg: 'Terre de Porcelaine', frame: 'Porcelaine et Or', skin: 'Kintsugi', prices: [75000, 90000, 120000], member: 143 },
  { id: 'vitral', name: 'Cathédrale', desc: 'Cristal de mille couleurs : la lumière entre à flots, change à chaque instant et la poussière danse dans ses rayons.', bg: 'Rosace Éternelle', frame: 'Vitrail Sacré', skin: 'Verrière', prices: [90000, 110000, 150000], member: 133 },
  { id: 'dawn', name: 'Lever du Jour', desc: 'Au-dessus des nuages, le premier soleil du jour : des rayons qui tournent, des nuages qui passent et des grains d’or.', bg: 'Mer de Nuages', frame: 'Ailes de l’Aube', skin: 'Aube Céleste', prices: [120000, 150000, 200000], member: 147 },
];
const VITAMIN_DEX = [
  ['protein', 'Protéine', 'Dégâts physiques'], ['calcium', 'Calcium', 'Dégâts spéciaux'], ['iron', 'Fer', 'Armure'], ['zinc', 'Zinc', 'Bouclier régénérable'], ['carbos', 'Carburant', 'Vitesse'],
  ['hp-up', 'Plus de PV', 'PV max.'], ['pp-up', 'Plus de PP', 'Projectiles'], ['x-speed', 'Huile', "Vitesse d'attaque"], ['dire-hit', 'Direct +', 'Probabilité de critique'], ['x-attack', 'Vitesse +', 'Vitesse de projectile'],
  ['x-defense', 'Défense +', 'Esquive'], ['x-attack', 'Attaque X', "Probabilité d'état"], ['comet-shard', 'Poussière Étoile', 'Zone'], ['elixir', 'Élixir', 'Durée'], ['super-potion', 'Super Potion', 'Régénération'],
  ['nugget', 'Pépite', 'Pokédollars'], ['rare-candy', 'Bonbon Exp.', 'Expérience'], ['star-piece', 'Morceau d’Étoile', 'Chance'], ['max-potion', 'Potion Max', 'Vol de vie'], ['escape-rope', 'Corde Sortie', 'Ramassage'],
];

const icon = (name, cls = '') => `<img class="pix ${cls}" src="./assets/items/${name}.png" alt="" draggable="false">`;
const uiIcon = (name, cls = '') => `<img class="pix uiicon ${cls}" src="./assets/ui/icons/${name}.png" alt="" draggable="false">`;
const face = (id, cls = '') => `<img class="pix ${cls}" src="./assets/portraits/${id}.png" alt="" draggable="false" loading="lazy">`;
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const ty = (t) => `<i class="ty ty-${t}">${TYPE_FR[t] || t}</i>`;
const tyDot = (t) => `<span class="tdot-img" title="${TYPE_FR[t] || t}"><img class="pix" src="./assets/ui/types/${t}.png" alt=""></span>`;
void TYPE_ICON;
const nextEvo = (id) => { for (const s of BY_ID.values()) if (s.evoFrom === id) return s.id; return null; };
const firstOf = (id) => { let s = BY_ID.get(id); while (s?.evoFrom && BY_ID.get(s.evoFrom)) s = BY_ID.get(s.evoFrom); return s?.id ?? id; };
const seasonEnd = () => { const d = new Date(); const end = new Date(d); end.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7)); end.setUTCHours(0, 0, 0, 0); return end - d; };
const left = (ms) => `${Math.floor(ms / 86400000)} j ${Math.floor((ms % 86400000) / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`;

function weakness(types) {
  const out = {};
  for (const atk of CHART_ORDER) out[atk] = types.reduce((m, d) => m * (TYPE_CHART.chart[CHART_ORDER.indexOf(atk)]?.[CHART_ORDER.indexOf(d)] ?? 1), 1);
  return out;
}

export function createGame({ ui, picker, getTexts, onLogout, setScene }) {
  let profile = null;
  let stopPreview = null;
  const screen = document.createElement('div');
  screen.className = 'screen mm main-menu dk';
  let focus = 0;

  function show(p) {
    profile = p;
    profile.favorites ||= [];
    next();
  }

  // First visit: choose the Kanto partner, then the Johto one, then the menu.
  function next() {
    if (!profile.starter) starterScreen(false);
    else if (!profile.starterJ) starterScreen(true);
    else renderMenu();
  }

  let dly = 0;
  const item = (cls, ic, title, sub, color, act, badge = 0) => `<button class="mm-item ${cls}" style="--c:${color};--d:${(dly++ * 0.05).toFixed(2)}s" data-act="${act}"><span class="mm-ic">${ic}</span><span class="mm-tx"><b>${title}</b><small>${sub}</small></span>${badge ? `<span class="mm-badge">${badge}</span>` : ''}</button>`;

  function leaderboard() {
    // Local season board: your best runs, ranked by K.O.
    return [...profile.runs].sort((a, b) => b.kills - a.kills).slice(0, 7);
  }

  function renderMenu() {
    stopPreview?.();
    stopPreview = null;
    const g = getTexts().g;
    const p = profile;
    setScene(true);
    const tasks = dailyTasks(p);
    const msLeft = new Date(new Date().toISOString().slice(0, 10) + 'T24:00:00Z') - Date.now();
    const quests = g.questList.filter((q) => q.test(p)).length;
    const board = leaderboard();
    const sEnd = seasonEnd();
    const newDex = p.seen.filter((id) => !(p.dexSeen || []).includes(id)).length;
    dly = 6;
    const mut = MUTATIONS[Math.floor(Date.now() / 86400000) % MUTATIONS.length];

    screen.innerHTML = `
      <div class="mm-top">
        <div class="lang-pick-slot"></div>
        <button class="mm-ico-btn" data-act="fullscreen" title="Plein écran">${uiIcon('fullscreen')}</button>
        <button class="mm-pillbtn treasure" data-act="treasures">${icon('amulet-coin')}Trésors</button>
        <button class="mm-pillbtn shop" data-act="shop"><span class="mm-new">NOUVEAU</span>${icon('silph-scope')}Boutique</button>
        <button class="mm-pillbtn apps" data-act="apps">${uiIcon('chat')}Apps</button>
        <div class="trainer">
          <button class="tr-av" title="Voir ma fiche de dresseur" data-act="trainer">${face(p.lastSpecies)}</button>
          <div class="tr-tx"><b>${p.accountName ? p.accountName.replace(/</g, '&lt;') : g.guest}</b>${p.title ? `<small class="tr-title">${p.title.replace(/</g, '&lt;')}</small>` : ''}</div>
          <div class="tr-cur">
            <span class="currency" title="${g.dust}">${uiIcon('stardust')}${p.stardust}</span>
            <span class="currency bonk" title="${g.bonk}">${uiIcon('bonk')}0</span>
            <span class="currency" title="${g.league}">${icon('poke-ball')}${p.league.length}/${LEAGUE_TOTAL}</span>
          </div>
          <button class="tr-mail" title="${g.news}" data-act="news">${uiIcon('news')}</button>
          <button class="tr-mail" title="Amis" data-act="friends">${uiIcon('friends')}</button>
          <button class="tr-mail" title="Signaler" data-act="report">${uiIcon('bug')}<span class="mm-badge">1</span></button>
          <button class="btn small ghost tr-out" data-act="logout">${g.logout}</button>
        </div>
      </div>
      <div class="mm-left">
        <div class="logo hero mm-logo"><div class="logo-word">Poké<span class="logo-bonk"><i style="--i:0">B</i><i style="--i:1">o</i><i style="--i:2">n</i><i style="--i:3">k</i>${icon('poke-ball', 'logo-ball')}</span><small class="logo-com">.com</small></div><button class="logo-ver fresh" data-act="version"><b>Bêta</b>v0.9.25</button></div>
        <div class="mm-modes">
          <button class="mm-item play" style="--c:var(--red)" data-act="play"><span class="mm-ic">${icon('poke-ball')}</span><span class="mm-tx"><b>${g.play}</b><small>${fill(g.classic, { n: p.league.length, total: LEAGUE_TOTAL })}</small></span><span class="mm-partner">${face(p.lastSpecies)}</span><span class="mm-shine" aria-hidden="true"></span></button>
          <div class="mm-pair">
            <button class="mm-item endless" style="--c:#5a4cd8;--d:.05s" data-act="endless" title="${g.endlessTitle}"><span class="mm-ic">${icon('moon-stone')}</span><span class="mm-tx"><b>${g.endless}</b><small>${p.best.endless ? fill(g.record, { time: clock(p.best.endless) }) : g.endlessSub}</small></span></button>
            <button class="mm-item coop" style="--c:#1fa86a;--d:.1s" data-act="coop"><span class="mm-ic">${uiIcon('friends')}</span><span class="mm-tx"><b>Coopératif</b><small>Entre amis · 2-4</small></span><span class="mm-beta">BETA</span></button>
          </div>
          <button class="mm-item mutation" style="--c:${mut.color};--mu-art:${mut.art ? `url('${new URL(`./assets/ui/banners/${mut.art}.jpg`, location.href).href}')` : 'none'}" data-act="daynight" title="${mut.desc}"><span class="mm-ic">${mut.icon}</span><span class="mm-tx"><b>${mut.name}</b><small>Mutation du jour</small></span></button>
        </div>
        <div class="mm-today">
          <button class="mm-item event" style="--c:#9a6aff;--ev-img:url('${new URL('./assets/ui/events/exp-card.jpg', location.href).href}');--d:.2s" data-act="event"><span class="mm-ic">${icon('tm-case')}</span><span class="mm-tx"><small>Événement ! Se termine dans ${left(sEnd).replace(/ \d+ min$/, '')}</small><b>La Grande Expédition</b></span></button>
          <button class="mm-item tasks" style="--c:#f2a516;--d:.25s" data-act="tasks"><span class="mm-ic">${icon('great-ball')}</span><span class="mm-tx"><b>${g.tasks}</b><span class="mm-pips">${tasks.map((x) => `<i class="${x.value >= x.goal ? 'on' : ''}"></i>`).join('')}</span><small>${fill(g.tasksSub, { time: `${Math.floor(msLeft / 3600000)} h ${Math.floor((msLeft % 3600000) / 60000)} min` })}</small></span></button>
        </div>
        <div class="mm-tiles">
          ${item('tile', icon('ultra-ball'), g.dex, `${p.seen.length}/251`, 'var(--blue)', 'dex', newDex)}
          ${item('tile', icon('rare-candy'), g.lab, String(p.stardust), 'var(--purple)', 'lab')}
          ${item('tile', icon('star-piece'), g.quests, `${quests}/${g.questList.length}`, 'var(--orange)', 'quests')}
          ${item('tile', uiIcon('gold'), g.rank, left(sEnd).replace(/ \d+ min$/, ''), 'var(--yellow-d)', 'rank')}
          ${item('tile clan', uiIcon('clan'), g.clan, g.noClan, '#2563d8', 'clan')}
          ${item('tile', icon('tm-case'), g.builds, fill(g.buildsSub, { n: 0 }), '#1fb7a6', 'builds')}
        </div>
        <div class="mm-small">
          ${item('mini', icon('metronome'), g.settings, '', 'var(--ink-2)', 'settings')}
          ${item('mini guide', uiIcon('idea'), g.guide, '', 'var(--yellow-d)', 'guide')}
          ${item('mini round bug', uiIcon('bug'), g.report, '', 'var(--ink-2)', 'report')}
          ${item('mini discord', `<span class="dc-logo">${DISCORD_SVG}</span>`, 'Discord', '', '#5865f2', 'discord')}
          ${item('mini x', `<span class="x-logo">${X_SVG}</span>`, 'Charcher', '', '#14171a', 'x')}
        </div>
      </div>
      <aside class="mm-season">
        <div class="mm-sp-head">${uiIcon('gold')}<span><b>Saison 3</b><small>Se termine dans ${left(sEnd)}</small></span></div>
        <div class="mm-sp-tabs"><button class="on">${icon('poke-ball')}K.O.</button><button>${icon('moon-stone')}</button><button>${uiIcon('gold')}</button><button>${uiIcon('clan')}</button></div>
        <div class="mm-sp-scope">${uiIcon('crown')}<span><b>Mondial</b><small>Somme de toutes les régions</small></span><i>⌄</i></div>
        <ol class="mm-sp-list">${board.length ? board.map((r, i) => `<li class="${i < 3 ? 'top' : ''}"><em>${i + 1}</em>${face(r.species)}<span><b>${g.guest}</b><small>${BY_ID.get(r.species).name} · ${r.mode === 'endless' ? g.endless : 'Forêt Verte'}</small></span><strong>${r.kills}<small>K.O.</small></strong></li>`).join('') : `<li class="empty">${g.seasonEmpty}</li>`}</ol>
        <p class="mm-sp-rew">Récompenses : le top 100 gagne un badge, un cadre et de la Poussière</p>
        <div class="mm-sp-badges">${['#1', '#2-3', '#4-10', '#11-25', '#26-50', '#51-100'].map((r, i) => `<span>${uiIcon(['crown', 'champion', 'record', 'gold', 'shiny-charm', 'target'][i])}<small>${r}</small></span>`).join('')}</div>
        <button class="btn blue mm-sp-all" data-act="rank">Voir le classement complet</button>
      </aside>
      <footer class="mm-legal-foot">
        <p>PokéBonk est un fan-game non officiel, gratuit et sans but lucratif : sans publicité ni achats, et le jeu n'accepte pas de dons. Il n'est ni affilié, ni parrainé, ni approuvé par Nintendo, The Pokémon Company, Creatures Inc. ou GAME FREAK inc. Pokémon et les noms des personnages sont des marques de leurs titulaires respectifs. © 1995-2026 Nintendo / Creatures Inc. / GAME FREAK inc. Sprites de PMD SpriteCollab (CC BY-NC 4.0).</p>
        <p><a href="legal.html#licencias" target="_blank" rel="noopener">Crédits</a> · <a href="legal.html" target="_blank" rel="noopener">Mentions légales et confidentialité</a> · <a href="legal.html#retirada" target="_blank" rel="noopener">Retrait de contenu</a> · <a href="mailto:contacto@pokebonk.com">contacto@pokebonk.com</a> · Fan-game survivor 3D par <a class="author" href="https://x.com/ImCharcher" target="_blank" rel="noopener noreferrer">Charcher</a></p>
      </footer>`;
    ui.replaceChildren(screen);
    seasonPanel(screen, { guest: g.guest, you: 'Toi', empty: g.seasonEmpty });
    if (picker) screen.querySelector('.lang-pick-slot').replaceWith(picker);
    const items = [...screen.querySelectorAll('.mm-item')];
    const setFocus = (i) => { focus = (i + items.length) % items.length; items.forEach((el, k) => el.classList.toggle('focus', k === focus)); };
    items.forEach((el, i) => el.addEventListener('mouseenter', () => setFocus(i)));
    setFocus(0);
    screen.onclick = (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) action(act);
    };
  }

  function action(act) {
    const g = getTexts().g;
    const scr = screens();
    const routes = { tasks: scr.tasks, lab: scr.lab, quests: scr.quests, rank: scr.rank, clan: scr.clan || scr.clans, builds: scr.builds, settings: scr.settings, guide: () => scr.guide(0), report: scr.report, treasures: scr.treasures, apps: scr.apps, news: scr.news, friends: scr.friends, trainer: scr.trainer, version: scr.version, coop: scr.coop, daynight: scr.mutation, event: scr.event };
    if (routes[act]) return routes[act]();
    switch (act) {
      case 'play': return leagueScreen('classic');
      case 'endless': return leagueScreen('endless');
      case 'dex': return dexScreen();
      case 'shop': return shopScreen();
      case 'fullscreen': return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
      case 'discord': return window.open('https://discord.com/invite/X7KusQqx8X', '_blank', 'noopener');
      case 'x': return window.open('https://x.com/ImCharcher', '_blank', 'noopener');
      case 'report': location.href = 'mailto:contacto@pokebonk.com?subject=PokéBonk'; return;
      case 'logout': return panel(g.logoutTitle, `<p>${g.logoutText}</p>`, [{ label: g.logout, cls: 'blue', run: () => { closePanel(); wipe(() => onLogout()); } }]);
      case 'coop': case 'friends': case 'clan': return panel(act === 'clan' ? g.clan : 'Coopératif', `<p>${act === 'clan' ? g.clanText : 'Le mode coopératif se joue avec 1 à 3 amis. Il nécessite un compte.'}</p>`, [{ label: getTexts().tabRegister, cls: 'green', run: () => { closePanel(); onLogout('register'); } }]);
      case 'daynight': { const mut = MUTATIONS[Math.floor(Date.now() / 86400000) % MUTATIONS.length]; return panel(mut.name, `<p>Mutation du jour : ${mut.desc}</p>`, [{ label: g.play, cls: 'red', run: () => { closePanel(); leagueScreen('classic'); } }]); }
      case 'event': return panel('La Grande Expédition', '<p>Événement de la semaine : termine des cartes pour remplir la jauge de l’expédition et gagner des récompenses.</p>');
      case 'treasures': return panel('Trésors', `<p>Les Bonkoins tombent parfois des gardiens et des boss. Dépense-les ici en Trésors.</p><p class="lab-dust">${uiIcon('bonk')}<b>0</b> Bonkoins</p>`);
      case 'apps': return panel('Apps', '<p>Installe PokéBonk sur ton ordinateur ou ton téléphone depuis le menu de ton navigateur (« Installer l’application » ou « Ajouter à l’écran d’accueil »).</p>');
      case 'news': return panel(getTexts().news, `<p><b>v0.9.25</b></p><ul>${getTexts().newsItems.map((n) => `<li>${n}</li>`).join('')}</ul>`);
      case 'tasks': {
        const tasks = dailyTasks(profile);
        return panel(g.tasks, `<ul class="task-list">${tasks.map((x) => `<li class="${x.value >= x.goal ? 'done' : ''}"><span>${g.taskNames[x.id]}</span><div class="bar"><i style="width:${Math.min(100, (x.value / x.goal) * 100)}%"></i></div><small>${x.id === 'survive' ? `${clock(Math.min(x.value, x.goal))} / ${clock(x.goal)}` : `${Math.min(x.value, x.goal)} / ${x.goal}`}</small></li>`).join('')}</ul>`);
      }
      case 'lab': return labPanel();
      case 'quests': return panel(g.questsTitle, `<ul class="quest-list">${g.questList.map((q) => `<li class="${q.test(profile) ? 'done' : ''}">${icon(q.test(profile) ? 'star-piece' : 'poke-ball')}<span>${q.name}</span></li>`).join('')}</ul>`);
      case 'rank': return panel(g.rankTitle, screen.querySelector('.mm-sp-list')?.outerHTML || '');
      case 'builds': return panel(g.builds, `<p>${g.buildsText}</p>`);
      case 'settings': return settingsPanel();
      case 'guide': return panel(g.guideTitle, `<ul>${g.guideText.map((x) => `<li>${x}</li>`).join('')}</ul>`);
      default: return null;
    }
  }

  let screensApi = null;
  const screens = () => (screensApi ||= makeScreens({ page, panel, closePanel, getProfile: () => profile, saveProfile, renderMenu, leagueScreen: (m) => leagueScreen(m), onLogout, wipe, startCoop: (room) => run(profile.lastSpecies, 'classic', room.difficulty, room.map, room) }));

  // ---- side panels ----
  let modal = null;
  function panel(title, body, buttons = []) {
    closePanel();
    const g = getTexts().g;
    modal = document.createElement('div');
    modal.className = 'modal dk';
    modal.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="ribbon">${icon('poke-ball', 'hd-ball')}${title}</div><div class="panel-body">${body}</div>
      <div class="panel-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || 'red'}" data-i="${i}">${b.label}</button>`).join('')}<button class="btn ghost" data-close>${g.close}</button></div></div>`;
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) closePanel();
      const b = e.target.closest('[data-i]');
      if (b) buttons[+b.dataset.i].run();
    });
    document.body.append(modal);
    return modal;
  }
  function closePanel() { modal?.remove(); modal = null; }

  function labPanel() {
    const g = getTexts().g;
    const cost = (lvl) => 40 + lvl * 40;
    const rows = Object.keys(g.labUps).map((k) => {
      const lvl = profile.lab[k];
      return `<li><span><b>${g.labUps[k]}</b><small>${g.lv} ${lvl}/5</small></span>${lvl >= 5 ? `<em>${g.maxed}</em>` : `<button class="btn small blue" data-buy="${k}" ${profile.stardust < cost(lvl) ? 'disabled' : ''}>${uiIcon('stardust')}${cost(lvl)}</button>`}</li>`;
    }).join('');
    const m = panel(g.labTitle, `<p>${g.labText}</p><p class="lab-dust">${uiIcon('stardust')}<b>${profile.stardust}</b> ${g.dust}</p><ul class="lab-list">${rows}</ul>`);
    m.addEventListener('click', (e) => {
      const k = e.target.closest('[data-buy]')?.dataset.buy;
      if (!k || profile.stardust < cost(profile.lab[k])) return;
      profile.stardust -= cost(profile.lab[k]);
      profile.lab[k]++;
      saveProfile(profile);
      labPanel();
      renderMenu();
    });
  }

  function settingsPanel() {
    const g = getTexts().g;
    const reduced = document.documentElement.classList.contains('reduce-fx');
    const m = panel(g.settingsTitle, `<label class="set-row"><input type="checkbox" data-set="fx" ${reduced ? 'checked' : ''}> ${g.reduceFx}</label>`, [{ label: g.resetGuest, cls: 'red', run: () => { clearProfile(); closePanel(); onLogout(); } }]);
    m.querySelector('[data-set="fx"]').addEventListener('change', (e) => {
      document.documentElement.classList.toggle('reduce-fx', e.target.checked);
      try { localStorage.setItem('pokebonk.reduceFx', e.target.checked ? '1' : ''); } catch { /* ignore */ }
    });
  }

  // A full-screen page with the game's header (Esc Retour + coloured title pill).
  function page(cls, title, sub, color, extra = '') {
    const box = document.createElement('div');
    box.className = `screen pg dk ${cls}`;
    box.innerHTML = `<header class="pg-h"><button class="pg-back" data-back><kbd>Esc</kbd>Retour</button><div class="pg-title" style="--pc:${color}"><b>${title}</b><small>${sub}</small></div>${extra}</header><div class="pg-body"></div>`;
    ui.replaceChildren(box);
    setScene(true);
    const back = () => { removeEventListener('keydown', esc); renderMenu(); };
    const esc = (e) => { if (e.key === 'Escape' && box.isConnected && !modal) back(); };
    addEventListener('keydown', esc);
    box.querySelector('[data-back]').onclick = back;
    box.back = back;
    box.esc = esc;
    return box;
  }

  // ---- First-time starter choice (Kanto, then Johto) ----
  const TYPE_COLOR = { grass: '#36c96a', fire: '#ff8c12', water: '#3a8cff', poison: '#a24cf0', ice: '#4fd0e0' };
  function starterScreen(johto) {
    const ids = johto ? [152, 155, 158] : [1, 4, 7];
    let sel = 1;
    let locked = false;
    setScene(true);
    const box = document.createElement('div');
    box.className = 'screen sp dk';
    box.innerHTML = `
      <div class="sp-head">${johto
        ? '<small>La région de Johto s’ouvre</small><h1>Choisis ton partenaire de Johto !</h1><p>Il rejoindra ta Ligue. Les deux autres viendront plus tard : vaincs 3 000 Pokémon de Johto et capture-les pendant une partie.</p>'
        : '<small>Ton aventure commence ici</small><h1>Choisis ton compagnon !</h1><p>Ce sera le premier membre de ta Ligue. Les deux autres te rejoindront plus tard : termine leur défi et capture-les dans une partie.</p>'}</div>
      <div class="sp-row">${ids.map((id, i) => {
        const sp = BY_ID.get(id);
        const info = starterInfo(id);
        const ty2 = sp.types[1] || sp.types[0];
        return `<button class="sp-card" style="--d:${i * 0.08}s" data-i="${i}">
          <div class="ls-show sp-show" style="--c:${TYPE_COLOR[sp.types[0]] || '#ff5a5f'};--c2:${TYPE_COLOR[ty2] || TYPE_COLOR[sp.types[0]]}">
            <div class="ls-rays"></div><div class="ls-num">#${String(id).padStart(3, '0')}</div>
            <div class="ls-stage"><div class="ls-pedestal"></div><span class="sp-spr" data-id="${id}"></span></div>
            <div class="ls-plate"><small>${info.role}</small><h1>${sp.name}</h1><div class="row">${sp.types.map(ty).join('')}</div></div>
            <div class="ls-flash"></div><div class="ls-stamp">Je te choisis !</div>
          </div>
          <div class="sp-info"><div class="sp-pas"><small>Passif</small><b>${info.passive.name}</b><span>${info.passive.desc}</span></div>
          <div class="sp-move">${tyDot(info.type || sp.types[0])}<span><small>Attaque de départ</small><b>${info.attack.name}</b></span></div></div>
        </button>`;
      }).join('')}</div>
      <div class="sp-foot"><button class="btn big red sp-go"></button><span><kbd>←</kbd> <kbd>→</kbd> Choisir · <kbd>Enter</kbd> Confirmer</span></div>`;
    ui.replaceChildren(box);
    box.querySelectorAll('.sp-spr').forEach((el) => el.replaceWith(animSprite(+el.dataset.id, 5, 'idle')));
    const cards = [...box.querySelectorAll('.sp-card')];
    const go = box.querySelector('.sp-go');
    const pick = (i) => {
      if (locked) return;
      sel = (i + ids.length) % ids.length;
      cards.forEach((c, k) => c.classList.toggle('on', k === sel));
      go.innerHTML = `${icon('poke-ball', 'btn-ball')}Je te choisis, ${BY_ID.get(ids[sel]).name} ! <kbd>Enter</kbd>`;
    };
    const confirm = () => {
      if (locked || modal) return;
      const id = ids[sel];
      const name = BY_ID.get(id).name;
      const m = panel(`Choisir ${name} ?`, `<div class="center sp-confirm-face">${face(id)}</div><p class="muted">${johto ? 'Ce sera ton partenaire de Johto et tu ne pourras plus le changer. Les deux autres te rejoindront plus tard.' : 'Ce sera ton partenaire de départ et tu ne pourras pas le changer ensuite. Les deux autres te rejoindront plus tard.'}</p>`,
        [{ label: `Oui, je choisis ${name}`, cls: 'red', run: () => { closePanel(); choose(); } }]);
      m.querySelector('[data-close]').textContent = 'Choisir à nouveau';
      m.classList.add('sp-confirm');
    };
    const choose = () => {
      locked = true;
      removeEventListener('keydown', keys);
      const id = ids[sel];
      cards[sel].querySelector('.ls-show').classList.add('go');
      cards.forEach((c, k) => c.classList.toggle('out', k !== sel));
      if (johto) profile.starterJ = id; else profile.starter = id;
      if (!profile.league.includes(id)) profile.league.push(id);
      profile.lastSpecies = id;
      profile.seen = [...new Set([...profile.seen, id])];
      saveProfile(profile);
      setTimeout(() => wipe(() => next()), 1300);
    };
    cards.forEach((c, i) => {
      c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pick(i); });
      c.addEventListener('click', () => (i === sel ? confirm() : pick(i)));
    });
    go.onclick = confirm;
    const keys = (e) => {
      if (!box.isConnected) { removeEventListener('keydown', keys); return; }
      if (modal) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); pick(sel + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pick(sel - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm(); }
    };
    addEventListener('keydown', keys);
    pick(1);
  }

  // ---- La Ligue: choosing the Pokémon ----
  function leagueScreen(mode, chosenId) {
    const p = profile;
    const all = [...BY_ID.values()].filter((s) => s.id <= 251 && !s.evoFrom || p.league.includes(s.id)).filter((s) => ![20, 24, 95, 143].includes(s.id) || p.league.includes(s.id));
    let chosen = chosenId ?? (p.league.includes(p.lastSpecies) ? p.lastSpecies : p.league[0]);
    let region = BY_ID.get(chosen).gen === 2 ? 2 : 1;
    let filter = 'all';
    const box = page('league', 'La Ligue', `${p.league.length}/${LEAGUE_TOTAL} membres`, 'linear-gradient(100deg,#ff5a5f,#ff7a5a)', '<button class="pg-gloss">📖 Glossaire</button>');
    const body = box.querySelector('.pg-body');

    function render() {
      const s = BY_ID.get(chosen);
      const kit = kitFor(s, BY_ID);
      const t = mainType(s);
      const chain = [firstOf(s.id)];
      for (let e = nextEvo(chain[0]); e; e = nextEvo(e)) chain.push(e);
      const w = weakness(s.types);
      const weak = Object.entries(w).filter(([, v]) => v > 1);
      const res = Object.entries(w).filter(([, v]) => v < 1);
      const strong = CHART_ORDER.filter((d) => (TYPE_CHART.chart[CHART_ORDER.indexOf(t)]?.[CHART_ORDER.indexOf(d)] ?? 1) > 1);
      const st = s.stats;
      const maxHp = Math.round(40 + st.hp * 0.9);
      const runs = p.runs.filter((r) => firstOf(r.start) === firstOf(s.id));
      const owned = p.league.includes(chosen);
      const list = all.filter((x) => (region === 1 ? x.gen !== 2 : x.gen === 2)).filter((x) => filter !== 'mine' || p.league.includes(x.id));
      body.innerHTML = `
        <section class="lg-main">
          <div class="lg-head">
            <div class="lg-top">
            ${stageCard(s.id, s.types, { cls: 'ls-stagecard', wardrobe: true, scale: 4 })}
            <div class="lg-id">
              <p><small>#${String(s.id).padStart(3, '0')} · ${s.name.toUpperCase()}</small><em class="gen">Gén. ${s.gen} · ${s.gen === 2 ? 'Johto' : 'Kanto'}</em><em class="rar">Commun</em></p>
              <div class="lg-name"><h2>${s.name}</h2><button class="lg-fav ${p.favorites.includes(s.id) ? 'on' : ''}" data-fav>★ ${p.favorites.includes(s.id) ? 'Dans tes Favoris' : 'Ajouter aux Favoris'}</button></div>
              <div class="lg-types">${s.types.map(typeChip).join('')}</div>
              <div class="lg-evo"><div><h4>ÉVOLUE PENDANT LA PARTIE</h4>
              <div class="ls-evo-row">${chain.map((id, i) => `${i ? `<span class="ls-evo-arrow"><small>N. ${EVOLVE_AT[i - 1]}</small></span>` : ''}<span class="ls-evo-mon" ${id === s.id ? 'data-shown' : ''}>${face(id)}</span>`).join('')}</div></div>
              <div class="ls-wonrow"><small>Victoires</small><span class="ls-won ${runs.some((r) => r.victory && r.difficulty !== 'hard') ? 'on' : ''}" style="--c:var(--green)">Normal</span><span class="ls-won" style="--c:var(--orange)">Difficile</span><span class="ls-won" style="--c:var(--purple)">Cauchemar</span></div></div>
            </div>
            </div>
            <div class="lg-stats"><h4>STATISTIQUES</h4>${[['PV', st.hp], ['Attaque', st.atk], ['Défense', st.def], ['Atq. Spé.', st.spa], ['Déf. Spé.', st.spd], ['Vitesse', st.spe]].map(([k, v], i) => `<div class="stat-row"><span>${k}</span><div class="sb"><i style="--w:${Math.min(100, (v / 178) * 100)}%;--i:${i};background:var(${v >= 100 ? '--green' : '--blue'})"></i></div><span>${v}</span></div>`).join('')}</div>
            <div class="lg-game"><h4>EN PARTIE</h4><ul>
              <li><span>PV max.</span><b>${maxHp}</b></li><li><span>Armure</span><b>-2</b></li><li><span>Esquive</span><b>4%</b></li>
              <li><span>Vitesse</span><b>×${(1 + (st.spe - 60) / 800).toFixed(2)}</b></li><li><span>Dégâts physiques</span><b>×${(1 + Math.max(0, st.atk - 84) / 1000).toFixed(2)}</b></li>
              <li><span>Dégâts spéciaux</span><b>×${(1 + Math.max(0, st.spa - 84) / 280).toFixed(2)}</b></li><li><span>Régénération</span><b>0.5/s</b></li><li><span>Proba. de critique</span><b>5%</b></li></ul></div>
          </div>
          <div class="lg-panels">
            <section class="lg-pan"><h3>${tyDot(t)} Passif et kit</h3><div class="lg-pan-b">
              <h5>PASSIF DE CLASSE</h5><b class="big">${kit.passive.name}</b><p>${kit.passive.desc}</p>
              <h5>KIT D'ATTAQUES</h5>
              <div class="lg-kit"><article>${tyDot(t)}<div><b>${kit.attack.name} <em class="start">De départ</em></b><small>${kit.attack.shape} · ${kit.attack.cls}</small><p>${kit.attack.desc}</p><span class="chips"><i>Dégâts ${kit.attack.dmg}</i><i>Recharge ${kit.attack.cd} s</i>${kit.attack.range ? `<i>Portée ${kit.attack.range} m</i>` : ''}</span></div></article>
              <article class="soon">${tyDot('psychic')}<div><b>Onde Psy <em>N. 2</em></b><small>Zone · Spécial</small><p>Une onde repousse et frappe les ennemis proches.</p></div></article></div>
            </div></section>
            <section class="lg-pan"><h3>${tyDot(t)} Ultimate (touche R) et types</h3><div class="lg-pan-b">
              ${(kit.ults || [kit.ult]).map((u, i) => `<article class="lg-ult">${face(chain[Math.min(i, chain.length - 1)])}<div><b>${u.name}</b><p>${u.desc}</p></div></article>`).join('')}
              <h5>TYPES</h5>
              <div class="lg-tyrow"><span class="weak">Faible contre</span>${weak.map(([k, v]) => `<span class="tchip">${tyDot(k)}<small>×${(v > 1 ? 1.35 : v).toFixed(2)}</small></span>`).join('') || '—'}</div>
              <div class="lg-tyrow"><span class="res">Résiste</span>${res.map(([k]) => `<span class="tchip">${tyDot(k)}<small>×0.80</small></span>`).join('') || '—'}</div>
              <div class="lg-tyrow"><span class="eff">Efficace contre</span>${strong.map((k) => `<span class="tchip">${tyDot(k)}</span>`).join('') || '—'}</div>
            </div></section>
          </div>
          <footer class="lg-foot">
            <div class="lg-mine"><b>TES PARTIES</b><span><b>${runs.length}</b> Parties</span><span><b>${runs.filter((r) => r.victory).length}</b> Victoires</span><span><b>${Math.max(0, ...runs.map((r) => r.kills))}</b> Record de K.O.</span><span><b>${Math.max(1, ...runs.map((r) => r.level || 1))}</b> Niveau max</span></div>
            <button class="pg-chip" data-panel="atk">🔥 Attaques</button><button class="pg-chip" data-panel="plan">★ Plan</button><button class="pg-chip" data-panel="rank">🏅 Classement</button>
            <button class="btn big red lg-go" ${owned ? '' : 'disabled'}>${icon('poke-ball', 'btn-ball')}${owned ? 'Je te choisis !' : 'Pas encore dans ta Ligue'} <kbd>Enter</kbd></button>
          </footer>
        </section>
        <aside class="lg-side">
          <div class="pg-seg"><button class="${filter === 'all' ? 'on' : ''}" data-filter="all">Tous</button><button class="${filter === 'mine' ? 'on' : ''}" data-filter="mine">Dans ma Ligue</button><button disabled>✦ Chromatique</button><button disabled>👕 Vestiaire</button></div>
          <div class="lg-tools"><button data-random>🔄 Au hasard</button><input class="pg-search" placeholder="Rechercher par nom…"></div>
          <div class="lg-favs"><span><b>Vos Favoris</b><small>${p.favorites.length}/6</small></span>${[0, 1, 2, 3, 4, 5].map((i) => (p.favorites[i] ? `<button data-pick="${p.favorites[i]}">${face(p.favorites[i])}</button>` : '<i>+</i>')).join('')}</div>
          <div class="lg-tdots">${TYPES.map(tyDot).join('')}</div>
          <div class="lg-regions"><button class="${region === 1 ? 'on' : ''}" data-region="1"><i class="red"></i>Kanto <small>${all.filter((x) => x.gen !== 2 && p.league.includes(x.id)).length}/79</small></button><button class="${region === 2 ? 'on' : ''}" data-region="2"><i class="gold"></i>Johto <small>${all.filter((x) => x.gen === 2 && p.league.includes(x.id)).length}/59</small></button></div>
          <div class="lg-grid">${list.map((x) => {
            const own = p.league.includes(x.id);
            return `<button class="lg-cell ${own ? 'own' : 'locked'} ${x.id === chosen ? 'on' : ''}" data-pick="${x.id}">${own ? face(x.id) : `<img class="pix sil" data-sil="${x.id}" alt="">`}${own ? '' : uiIcon('lock', 'lk')}<small>${own ? x.name : '???'}</small></button>`;
          }).join('')}</div>
          <div class="lg-prog"><b>PROGRESSION</b><i><u style="width:${(p.league.length / LEAGUE_TOTAL) * 100}%"></u></i><b>${p.league.length}/${LEAGUE_TOTAL}</b><div class="lg-next">${all.filter((x) => !p.league.includes(x.id)).slice(0, 3).map((x) => `<span><img class="pix" data-sil="${x.id}" alt=""><em>Plus près<i><u style="width:${Math.min(100, p.runs.length * 10)}%"></u></i></em>${Math.min(100, p.runs.length * 10)}%</span>`).join('')}</div></div>
        </aside>`;
      hydrateStages(body);
      fillSilhouettes(body);
    }
    render();
    body.onclick = (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { chosen = +pick.dataset.pick; render(); return; }
      const r = e.target.closest('[data-region]');
      if (r) { region = +r.dataset.region; render(); return; }
      const f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; render(); return; }
      if (e.target.closest('[data-random]')) { chosen = p.league[Math.floor(Math.random() * p.league.length)]; render(); return; }
      if (e.target.closest('[data-fav]')) {
        p.favorites = p.favorites.includes(chosen) ? p.favorites.filter((x) => x !== chosen) : [...p.favorites, chosen].slice(0, 6);
        saveProfile(p);
        render();
        return;
      }
      if (e.target.closest('[data-panel]')) {
        const k = kitFor(BY_ID.get(chosen), BY_ID);
        panel('Attaques', `<ul><li><b>${k.attack.name}</b> — ${k.attack.desc}</li><li><b>Onde Psy</b>, <b>Tonnerre</b>, <b>Tourbi-Sable</b>, <b>Tranch’Air</b> : à apprendre en montant de niveau.</li><li><b>${k.ult.name}</b> (R) — ${k.ult.desc}</li></ul>`);
        return;
      }
      if (e.target.closest('.lg-go') && p.league.includes(chosen)) { removeEventListener('keydown', box.esc); removeEventListener('keydown', enter); mapScreen(mode, chosen); }
    };
    body.addEventListener('input', (e) => {
      if (!e.target.classList.contains('pg-search')) return;
      const q = e.target.value.toLowerCase();
      body.querySelectorAll('.lg-cell').forEach((c) => { c.hidden = q && !BY_ID.get(+c.dataset.pick).name.toLowerCase().includes(q); });
    });
    const enter = (e) => { if (e.key === 'Enter' && box.isConnected && !modal && document.activeElement?.tagName !== 'INPUT') body.querySelector('.lg-go')?.click(); };
    addEventListener('keydown', enter);
  }

  // A still sprite frame (idle, facing down) drawn into an <img>, optionally as a dark silhouette.
  function spriteStill(img, id, scale, silhouette = false) {
    const sp = BY_ID.get(id);
    const a = sp.sheet.anims.idle || sp.sheet.anims.walk;
    const src = new Image();
    src.src = `./assets/pmd/${id}.png`;
    src.onload = () => {
      const c = document.createElement('canvas');
      c.width = a.fw * scale;
      c.height = a.fh * scale;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, a.y, a.fw, a.fh, 0, 0, c.width, c.height);
      if (silhouette) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#5a6078'; g.fillRect(0, 0, c.width, c.height); }
      img.src = c.toDataURL();
    };
  }

  // ---- Choisis une carte ----
  function mapScreen(mode0, speciesId, mapId0) {
    const p = profile;
    let mode = mode0;
    let diff = 'normal';
    const s = BY_ID.get(speciesId);
    const won = new Set(p.mapsWon || []);
    const isOpen = (i) => i === 0 || won.has(BIOMES[i - 1].id);
    let mapId = mapId0 && isOpen(BIOMES.findIndex((m) => m.id === mapId0)) ? mapId0 : (p.lastMap && isOpen(BIOMES.findIndex((m) => m.id === p.lastMap)) ? p.lastMap : 'forest');
    let realm = biome(mapId).johto ? 2 : 1;
    const johtoOpen = won.has('cave');
    const realmBtn = (r) => r === 1
      ? `<button class="rg-realm ${realm === 1 ? 'on' : ''}" data-realm="1" style="--c:#e8433a;--c2:#ff8a4a"><span class="rg-emb">${face(151)}</span><span class="rg-rn"><small>Gén. 1</small><b>Kanto</b><span class="rg-pips">${BIOMES.slice(0, 6).map((m) => `<i class="${won.has(m.id) || m.id === mapId ? 'on' : ''}"></i>`).join('')}</span></span></button>`
      : `<button class="rg-realm ${realm === 2 ? 'on' : ''} ${johtoOpen ? '' : 'locked'}" data-realm="2" ${johtoOpen ? '' : 'disabled'} title="${johtoOpen ? '' : 'Termine la Caverne Azurée pour voyager à Johto'}" style="--c:#c8901a;--c2:#f2c94a"><span class="rg-emb ${johtoOpen ? '' : 'sil'}"><img class="pix" src="./assets/icons/250.png" alt=""></span><span class="rg-rn"><small>Gén. 2</small><b>Johto</b><span class="rg-pips">${BIOMES.slice(6).map((m) => `<i class="${won.has(m.id) ? 'on' : ''}"></i>`).join('')}</span></span>${johtoOpen ? '' : uiIcon('lock')}</button>`;
    const box = page('maps', 'Choisis une carte', '', 'linear-gradient(100deg,#ff5a5f,#ff7a5a)', `<div class="rg-realms">${realmBtn(1)}${realmBtn(2)}</div>`);
    box.querySelector('.pg-title small').remove();
    const body = box.querySelector('.pg-body');
    const cards = () => BIOMES.map((m, i) => ({ m, i })).filter(({ m }) => (realm === 2) === m.johto).map(({ m, i }) => {
      const open = isOpen(i);
      return `<button class="rg-item ${m.id === mapId ? 'on' : ''} ${open ? '' : 'locked'}" data-map="${m.id}" ${open ? '' : 'disabled'} title="${open ? '' : m.unlock}" style="--d:${i * 0.05}s;--sky:${hex(m.look.sky[0])};--gr:${hex(m.ground[0])}"><span class="rg-sw"><img class="pix" src="./assets/icons/${m.guardians[0][0]}.png" alt=""></span><span class="rg-tx"><b>${m.name}</b><span class="row">${m.types.map((t) => typeIcon(t, 18)).join('')}</span></span>${open ? '' : uiIcon('lock')}</button>`;
    }).join('');
    const info = (m) => `<small>Région</small><h2>${m.name}</h2><div class="mp-desc"><div class="row">${m.types.map(typeChip).join('')}</div><p>${m.desc}</p></div>`;
    const guards = (m) => `<b>GARDIENS</b> <small>· à chaque partie, un au hasard par zone</small><div>${m.guardians.map((g, z) => `<span class="mp-zone"><small>ZONE ${z + 1}</small><span>${g.map((id) => face(id)).join('')}</span></span><i>›</i>`).join('')}<span class="mp-zone sanct"><small>${m.sanctuary.name.toUpperCase()}</small><span>${won.has(m.id) ? face(m.legendaries[0]) : '<u></u>'}</span></span></div>`;
    const best = (m) => p.runs.filter((r) => r.mode === mode && (r.map || 'forest') === m.id).reduce((x, r) => Math.max(x, r.kills), 0);
    const m0 = biome(mapId);
    body.innerHTML = `
      <div class="mp-cards">${cards()}</div>
      <section class="mp-view">
        <div class="mp-info">${info(m0)}</div>
        <div class="mp-mon">${face(s.id)}<span><small>Ton Pokémon</small><b>${s.name}</b>${typeChip(s.types[0])}</span><button data-change>Changer</button></div>
        <div class="mp-guards">${guards(m0)}</div>
      </section>
      <aside class="mp-side">
        <div class="mp-side-h"><b>Préparer la partie</b><small class="mp-mapname">${m0.name}</small></div>
        <div class="mp-side-b">
          <h4>MODE</h4>
          <div class="mp-modes"><button class="${mode === 'classic' ? 'on' : ''}" data-mode="classic">${icon('poke-ball')}<span><b>Classique</b><small>Zones, gardiens et sanctuaire</small></span></button><button class="${mode === 'endless' ? 'on' : ''}" data-mode="endless">${icon('moon-stone')}<span><b>Survie</b><small>Infini : hordes et jalons</small></span></button></div>
          ${(() => { const bag = collection(p).bag; const ids = Object.keys(bag).filter((k) => bag[k] > 0); return ids.length ? `<h4>SAC <small class="mp-bag-hint">jusqu’à 2 objets · utilisés au départ</small></h4><div class="mp-bag">${ids.map((id) => `<button data-bag="${id}" title="${ITEM_EFFECTS[id]}">${icon(id)}<span><b>${ITEM_NAMES[id]}</b><small>×${bag[id]}</small></span></button>`).join('')}</div>` : ''; })()}
          <h4>DIFFICULTÉ</h4>
          <div class="mp-diffs"><button class="on" data-diff="normal"><b>Normal</b><small>×1 Poussière</small></button><button ${won.has(mapId) ? '' : 'disabled'} data-diff="hard"><b>${won.has(mapId) ? '' : '🔒 '}Difficile</b><small>×1,75 Poussière · ennemis +70 %</small></button><button disabled data-diff="nightmare"><b>🔒 Cauchemar</b><small>×2,5 Poussière · ennemis +160 %</small></button></div>
          <h4 class="mp-row">TES SCORES · NORMAL <button class="pg-chip small" data-rank>🏅 Classement</button></h4>
          <div class="mp-score"><b class="mp-best">${best(m0)} K.O.</b><small>${best(m0) ? 'Ton meilleur score sur cette carte' : 'Pas encore de score sur cette carte'}</small><em>Se termine dans ${left(seasonEnd())}</em></div>
          <h4>CONTRE LA MONTRE · NORMAL</h4>
          <div class="mp-medals"><span>${uiIcon('record')}<b>Bronze</b><small>n'importe quelle victoire</small></span><span>${uiIcon('record')}<b>Argent</b><small>moins de 24:00</small></span><span>${uiIcon('record')}<b>Or</b><small>moins de 18:00</small></span><span>${uiIcon('champion')}<b>Champion</b><small>moins de 12:00</small></span></div>
        </div>
        <button class="btn big red mp-go">${icon('poke-ball', 'btn-ball')}Commencer ! <kbd>Enter</kbd></button>
      </aside>`;
    // The whole screen shows the map in 3D, blurred everywhere except through the region window.
    box.classList.add('mp-screen');
    box.insertAdjacentHTML('afterbegin', '<canvas class="mp-world"></canvas><div class="mp-veil"></div>');
    const veil = box.querySelector('.mp-veil');
    const view = body.querySelector('.mp-view');
    const hole = () => {
      if (!box.isConnected) { removeEventListener('resize', hole); return; }
      const b = box.getBoundingClientRect(); const r = view.getBoundingClientRect();
      const x = r.left - b.left; const y = r.top - b.top; const w = r.width; const h = r.height; const k = 26;
      veil.style.clipPath = `path(evenodd, "M 0 0 H ${b.width} V ${b.height} H 0 Z M ${x + k} ${y} H ${x + w - k} A ${k} ${k} 0 0 1 ${x + w} ${y + k} V ${y + h - k} A ${k} ${k} 0 0 1 ${x + w - k} ${y + h} H ${x + k} A ${k} ${k} 0 0 1 ${x} ${y + h - k} V ${y + k} A ${k} ${k} 0 0 1 ${x + k} ${y} Z")`;
    };
    requestAnimationFrame(hole);
    addEventListener('resize', hole);
    setScene(false);
    const preview = () => {
      stopPreview?.();
      const old = box.querySelector('.mp-world'); const fresh = document.createElement('canvas'); fresh.className = 'mp-world'; old.replaceWith(fresh);
      const m = biome(mapId);
      stopPreview = startPreview(fresh, [...m.residents.slice(0, 18), ...m.guardians[0].slice(0, 2)], () => view.getBoundingClientRect(), m);
    };
    preview();
    const select = (id) => {
      mapId = id; p.lastMap = id; saveProfile(p);
      const m = biome(id);
      body.querySelectorAll('[data-map]').forEach((c) => c.classList.toggle('on', c.dataset.map === id));
      body.querySelector('.mp-info').innerHTML = info(m);
      body.querySelector('.mp-guards').innerHTML = guards(m);
      body.querySelector('.mp-mapname').textContent = m.name;
      body.querySelector('.mp-best').textContent = `${best(m)} K.O.`;
      preview();
    };
    const bagPick = new Set();
    const start = () => {
      removeEventListener('keydown', enter); removeEventListener('keydown', box.esc);
      const bag = [...bagPick]; p.bagUsed = p.bagUsed || {}; for (const id of bag) p.bagUsed[id] = (p.bagUsed[id] || 0) + 1; if (bag.length) saveProfile(p);
      run(speciesId, mode, diff, mapId, null, bag);
    };
    box.onclick = (e) => {
      const rl = e.target.closest('[data-realm]');
      if (rl && !rl.disabled) {
        realm = +rl.dataset.realm;
        box.querySelectorAll('[data-realm]').forEach((b) => b.classList.toggle('on', b === rl));
        body.querySelector('.mp-cards').innerHTML = cards();
        const first = BIOMES.find((m, i) => (realm === 2) === m.johto && isOpen(i));
        if (first && biome(mapId).johto !== (realm === 2)) select(first.id);
      }
      const bg = e.target.closest('[data-bag]');
      if (bg) { const id = bg.dataset.bag; if (bagPick.has(id)) bagPick.delete(id); else if (bagPick.size < 2) bagPick.add(id); body.querySelectorAll('[data-bag]').forEach((b) => b.classList.toggle('on', bagPick.has(b.dataset.bag))); }
      const mc = e.target.closest('[data-map]');
      if (mc && !mc.disabled) select(mc.dataset.map);
      const md = e.target.closest('[data-mode]');
      if (md) { mode = md.dataset.mode; body.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === md)); }
      const df = e.target.closest('[data-diff]');
      if (df && !df.disabled) { diff = df.dataset.diff; body.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', b === df)); }
      if (e.target.closest('[data-change]')) { removeEventListener('keydown', enter); removeEventListener('keydown', box.esc); stopPreview?.(); stopPreview = null; leagueScreen(mode, speciesId); }
      if (e.target.closest('[data-rank]')) action('rank');
      if (e.target.closest('.mp-go')) start();
    };
    const enter = (e) => { if (e.key === 'Enter' && box.isConnected && !modal) start(); };
    addEventListener('keydown', enter);
  }

  // ---- Pokédex ----
  function dexScreen() {
    const p = profile;
    p.dexSeen = [...p.seen];
    saveProfile(p);
    let tab = 'mon';
    let sel = 1;
    let filter = 'all';
    let typeF = null;
    const box = page('dex', 'Pokédex', `${p.seen.length}/251 vus`, 'linear-gradient(100deg,#ff5a5f,#ff9a3a)', `<div class="pg-seg tabs"><button class="on" data-tab="mon">Pokémon</button><button data-tab="atk">Attaques</button><button data-tab="vit">Vitamines</button><button data-tab="obj">Objets</button></div><button class="pg-carnet">${icon('tm-case')}<span><small>CARNET</small><b>${p.seen.length}/129</b></span></button><button class="pg-gloss">📖 Glossaire</button>`);
    const body = box.querySelector('.pg-body');
    const seen = new Set(p.seen);
    const caught = new Set(p.league);

    function detail(html) { return `<aside class="dx-detail">${html}</aside>`; }
    function dexDetail(id, name, tys, known, isCaught) {
      const [h, w, st, flavor, line, gen] = DEX_INFO[id] || [0, 0, [0, 0, 0, 0, 0, 0], '', [id], 1];
      const card = stageCard(id, tys, { cls: 'dx-show', num: true, silhouette: !known, scale: 5, plate: known ? { sub: `Gen ${gen}`, name, types: tys } : { sub: 'Non enregistré', name: '???' } });
      if (!known) return `${card}<div class="dx-info"><div class="dx-note">Aucune donnée sur ce Pokémon. Rencontre-le dans une partie pour l’enregistrer dans ton Pokédex.</div></div>`;
      const rows = [['PV', st[0]], ['Attaque', st[1]], ['Défense', st[2]], ['Atq. Spé.', st[3]], ['Déf. Spé.', st[4]], ['Vitesse', st[5]]];
      return `${card}<div class="dx-info"><div class="dx-note">${flavor}</div>
        <div class="dx-meta"><span>Hauteur ${(h / 10).toLocaleString('fr-FR')} m</span><span>Poids ${(w / 10).toLocaleString('fr-FR')} kg</span>${isCaught ? `<span class="ok">${uiIcon('check')}Capturé</span>` : ''}</div>
        <h5>Recherche</h5><div class="dx-research"><i></i><b>0 / 69</b></div>
        <h5>Statistiques de base</h5><div class="dx-stats2">${rows.map(([k, v], i) => `<div class="stat-row"><span>${k}</span><div class="sb"><i style="--w:${Math.min(100, (v / 160) * 100)}%;--i:${i};background:${v >= 60 ? 'var(--blue)' : '#ff5a5f'}"></i></div><span>${v}</span></div>`).join('')}</div>
        <h5>Lignée évolutive</h5><div class="dx-line">${line.map((x, i) => `${i ? '<i class="dx-arr">›</i>' : ''}<button class="dx-lmon ${x === id ? 'on' : ''}" data-sel="${x}">${seen.has(x) ? face(x) : `<img class="pix dx-sil" data-sil="${x}" alt="">`}<small>${seen.has(x) ? DEX[x - 1][1] : '???'}</small></button>`).join('')}</div></div>`;
    }
    function render() {
      if (tab === 'mon') {
        const list = DEX.filter(([id, , types]) => (filter === 'seen' ? seen.has(id) : filter === 'caught' ? caught.has(id) : filter === 'shiny' ? false : true) && (!typeF || types.split('/').includes(typeF)));
        const [id, name, types] = DEX[sel - 1];
        const known = seen.has(id);
        const sp = BY_ID.get(id);
        body.innerHTML = `<section class="dx-main">
          <div class="dx-tools"><input class="pg-search" placeholder="Chercher par nom ou numéro…"><div class="pg-seg"><button class="${filter === 'all' ? 'on' : ''}" data-f="all">Tous</button><button class="${filter === 'seen' ? 'on' : ''}" data-f="seen">Vus</button><button class="${filter === 'caught' ? 'on' : ''}" data-f="caught">Capturés</button><button class="${filter === 'shiny' ? 'on' : ''}" data-f="shiny">Chromatique</button></div><small>251 Pokémon</small></div>
          <div class="dx-chips"><span>VUS <b>${seen.size}/251</b></span><span>CHROMATIQUES <b>0/2</b></span><span>FAMILLES CAPTURÉES <b>${new Set(p.league.map(firstOf)).size}</b></span></div>
          <div class="lg-tdots">${TYPES.map((t) => `<button class="${typeF === t ? 'on' : ''}" data-type="${t}">${tyDot(t)}</button>`).join('')}</div>
          <div class="dx-grid">${list.map(([i]) => `<button class="dx-cell ${seen.has(i) ? 'known' : ''} ${caught.has(i) ? 'caught' : ''} ${i === sel ? 'on' : ''}" data-sel="${i}" style="--tc:${TYPE_COLOR[DEX[i - 1][2].split('/')[0]] || '#5ab8ff'}">${seen.has(i) ? `<img class="pix" src="./assets/portraits/${i}.png" alt="" loading="lazy">` : `<img class="pix dx-sil" data-sil="${i}" alt="">`}<small>${String(i).padStart(3, '0')}</small>${caught.has(i) ? '<i class="dx-ball"></i>' : ''}</button>`).join('')}</div>
        </section>${detail(dexDetail(id, name, types.split('/'), known, caught.has(id)))}`;
      } else if (tab === 'atk') {
        const list = MOVES_LIST.filter(([, type]) => !typeF || type === typeF);
        const [n, type, cls, power] = list[Math.min(sel, list.length - 1)] || MOVES_LIST[0];
        body.innerHTML = `<section class="dx-main">
          <div class="dx-tools"><input class="pg-search" placeholder="Chercher une attaque…"><div class="pg-seg"><button class="on">Tous</button><button>Physique</button><button>Spécial</button><button>Fusions</button></div><small>${MOVES_LIST.length} attaques</small></div>
          <div class="lg-tdots">${TYPES.map((t) => `<button class="${typeF === t ? 'on' : ''}" data-type="${t}">${tyDot(t)}</button>`).join('')}</div>
          <div class="dx-grid moves">${list.slice(0, 400).map(([nm, t, c], i) => `<button class="dx-move ${i === sel ? 'on' : ''}" data-sel="${i}">${tyDot(t)}<span><b>${nm}</b><small>${c === 'physical' ? 'Physique' : c === 'special' ? 'Spécial' : 'Statut'}</small></span></button>`).join('')}</div>
        </section>${detail(`<div class="dx-mv-h">${tyDot(type)}<div><b>${n}</b><span>${ty(type)}<i class="ty cls">${cls === 'physical' ? 'Physique' : cls === 'special' ? 'Spécial' : 'Statut'}</i></span></div></div><div class="dx-note">Puissance de base : <b>${power || '—'}</b>. Les attaques s’apprennent en montant de niveau pendant une partie et se renforcent jusqu’au niveau 8.</div>`)}`;
      } else if (tab === 'vit') {
        const [ic, n, stat] = VITAMIN_DEX[Math.min(sel, VITAMIN_DEX.length - 1)];
        body.innerHTML = `<section class="dx-main">
          <div class="dx-tools"><input class="pg-search" placeholder="Chercher une vitamine…"><small>${VITAMIN_DEX.length} vitamines</small></div>
          <div class="dx-grid vits">${VITAMIN_DEX.map(([i2, nm, st], i) => `<button class="dx-vit ${i === sel ? 'on' : ''}" data-sel="${i}">${icon(i2)}<b>${nm}</b><small>${st}</small></button>`).join('')}</div>
        </section>${detail(`<div class="dx-mv-h vit">${icon(ic)}<div><b>${n}</b><small>${stat}</small></div></div>
          <h5>CE QUE DONNE CHAQUE NIVEAU</h5><p class="dx-small">Total donné par la vitamine à chaque niveau, si toutes ses améliorations étaient de rareté commune.</p>
          <div class="dx-levels">${Array.from({ length: 10 }, (_, i) => `<span class="${i === 9 ? 'max' : ''}"><small>N. ${i + 1}</small><b>+${(i + 1) * 10}%</b></span>`).join('')}</div>
          <p class="dx-small">Niveau max : 10.</p><h5>SELON LA RARETÉ DE LA CARTE</h5>
          <div class="dx-rar">${[['Commun', '+10%', '#c8ccd8'], ['Peu commun', '+12%', '#36c96a'], ['Rare', '+14.5%', '#3a8cff'], ['Épique', '+17.5%', '#a24cf0'], ['Légendaire', '+21%', '#f2b705']].map(([a, b, c]) => `<span style="--rc:${c}"><b>${a}</b><em>${b}</em></span>`).join('')}</div>
          <p class="dx-small">Au départ, tu portes jusqu'à 3 vitamines à la fois.</p>`)}`;
      } else {
        const it = ITEMS[Math.min(sel, ITEMS.length - 1)];
        body.innerHTML = `<section class="dx-main">
          <div class="dx-tools"><input class="pg-search" placeholder="Chercher un objet…"><div class="pg-seg"><button class="on">Tous</button><button>Débloqués</button><button>À débloquer</button><button>Archivés</button></div><small>${ITEMS.length} objets</small></div>
          <div class="dx-grid objs">${ITEMS.map(([k, nm], i) => `<button class="dx-obj ${i === sel ? 'on' : ''}" data-sel="${i}">${icon(k)}${uiIcon('lock', 'lk')}<span><b>${nm}</b><small>● Objet</small></span></button>`).join('')}</div>
        </section>${detail(`<div class="dx-mv-h obj">${icon(it[0])}<div><b>${it[1]}</b><small>Objet</small></div></div><div class="dx-note">${it[2]}</div><p class="dx-small">🔒 À débloquer au Labo avec de la Poussière Étoile.</p>`)}`;
      }
    }
    const render0 = render;
    render = () => { render0(); hydrateStages(body); fillSilhouettes(body); };
    render();
    box.querySelector('.tabs').onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      sel = tab === 'mon' ? 1 : 0;
      typeF = null;
      box.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      render();
    };
    body.onclick = (e) => {
      const c = e.target.closest('[data-sel]');
      if (c) { sel = +c.dataset.sel; render(); return; }
      const f = e.target.closest('[data-f]');
      if (f) { filter = f.dataset.f; render(); return; }
      const t = e.target.closest('[data-type]');
      if (t) { typeF = typeF === t.dataset.type ? null : t.dataset.type; render(); }
    };
    body.addEventListener('input', (e) => {
      if (!e.target.classList.contains('pg-search')) return;
      const q = e.target.value.toLowerCase();
      body.querySelectorAll('.dx-grid > button').forEach((b) => {
        const txt = b.textContent.toLowerCase();
        const id = b.classList.contains('dx-cell') ? DEX[+b.dataset.sel - 1] : null;
        b.hidden = q && !(id ? (seen.has(id[0]) && id[1].toLowerCase().includes(q)) || String(id[0]).includes(q) : txt.includes(q));
      });
    });
  }

  // ---- Boutique ----
  function shopScreen() {
    let tab = 'cos';
    let sub = 'sets';
    const box = page('shop', 'Boutique', 'Des cosmétiques exclusifs, à toi pour toujours', 'linear-gradient(100deg,#1fb07a,#5ad05a)', `<span class="pg-dust">${uiIcon('stardust')}<b>${profile.stardust}</b></span>`);
    const body = box.querySelector('.pg-body');
    const price = (n) => `<em class="sc-price">${uiIcon('stardust')}${kfmt(n)}</em>`;
    function render() {
      let html = `<div class="sh-tabs"><button class="${tab === 'obj' ? 'on' : ''}" data-tab="obj">${icon('oran-berry')}Objets</button><button class="${tab === 'cos' ? 'on' : ''} cos" data-tab="cos">${uiIcon('stardust')}Cosmétiques</button></div>`;
      if (tab === 'obj') {
        html += `<div class="sh-objs">${ITEMS.slice(0, 18).map(([k, n, d], i) => `<article>${icon(k)}<b>${n}</b><small>${d}</small>${price(2000 + (i % 6) * 1500)}</article>`).join('')}</div>`;
      } else {
        html += `<div class="pg-seg sh-sub">${[['sets', 'Collections'], ['bg', 'Fonds'], ['frame', 'Cadres'], ['skin', 'Apparences']].map(([k, n]) => `<button class="${sub === k ? 'on' : ''}" data-sub="${k}">${n}</button>`).join('')}</div>`;
        if (sub === 'sets') {
          html += `<div class="sh-sets">${SHOP_SETS.map((s) => `<article class="sh-set sh-${s.id}" style="background-image:linear-gradient(90deg,#0e0b24 0%,#0e0b24cc 35%,#0e0b2400 70%),url('./assets/ui/banners/st-${s.id}.jpg')"><div class="sh-set-tx"><h3>${s.name}</h3><p>${s.desc}</p></div><div class="sh-set-items">
            <span class="sh-it"><span class="pic bg" style="background-image:url('./assets/ui/banners/st-${s.id}.jpg')"></span><b>${s.bg}</b><small>Fond de profil</small>${price(s.prices[0])}</span>
            <span class="sh-it"><span class="pic fr"><img src="./assets/ui/frames/st-${s.id}.png" alt="">${face(155, 'in')}</span><b>${s.frame}</b><small>Cadre Épique</small>${price(s.prices[1])}</span>
            <span class="sh-it"><span class="pic sk sk-${s.id}">${face(s.member)}</span><b>${s.skin}</b><small>Apparence</small>${price(s.prices[2])}</span>
          </div></article>`).join('')}</div>`;
        } else {
          html += `<div class="sh-grid">${SHOP_SETS.map((s) => {
            const pic = sub === 'bg' ? `<span class="pic bg" style="background-image:url('./assets/ui/banners/st-${s.id}.jpg')"></span>` : sub === 'frame' ? `<span class="pic fr"><img src="./assets/ui/frames/st-${s.id}.png" alt="">${face(155, 'in')}</span>` : `<span class="pic sk sk-${s.id}">${face(s.member)}</span>`;
            const name = sub === 'bg' ? s.bg : sub === 'frame' ? s.frame : s.skin;
            const p = s.prices[sub === 'bg' ? 0 : sub === 'frame' ? 1 : 2];
            return `<article class="sh-card ${sub}">${pic}<b>${name}</b><small>${sub === 'skin' ? BY_ID.get(s.member)?.name || DEX[s.member - 1][1] : s.name}</small>${price(p)}</article>`;
          }).join('')}</div>`;
        }
      }
      body.innerHTML = html;
    }
    render();
    body.onclick = (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; render(); return; }
      const s = e.target.closest('[data-sub]');
      if (s) { sub = s.dataset.sub; render(); return; }
      const card = e.target.closest('.sh-it, .sh-card, .sh-objs article');
      if (card) panel('Boutique', `<p>Il te faut plus de Poussière Étoile pour acheter cet article. Joue des parties pour en gagner !</p><p class="lab-dust">${uiIcon('stardust')}<b>${profile.stardust}</b> Poussière Étoile</p>`);
    };
  }

  // ---- the run ----
  function run(id, mode, difficulty, mapId = profile.lastMap || 'forest', coop = null, bag = []) {
    wipe(() => startGame(id, mode, difficulty, mapId, coop, bag));
  }

  function startGame(id, mode, difficulty, mapId, coop = null, bag = []) {
    stopPreview?.();
    stopPreview = null;
    setScene(false);
    const holder = document.createElement('div');
    holder.className = 'screen run-screen dk';
    ui.replaceChildren(holder);
    startRun3D({
      root: holder, speciesId: id, mode, difficulty, biome: biome(mapId), coop, bag, bonus: profile.lab, profile: { best: { ...profile.best, kills: Math.max(0, ...profile.runs.map((r) => r.kills)) } },
      onExit: (result, next) => {
        recordRun(profile, result);
        postRun(result).then((r) => { if (r?.rank) profile.serverRank = { rank: r.rank, of: r.of, map: result.map }; });
        if (next === 'again') run(id, mode, difficulty, mapId);
        else wipe(() => renderMenu());
      },
    });
  }

  return { show, rerender: () => { if (profile && ui.contains(screen)) renderMenu(); } };
}

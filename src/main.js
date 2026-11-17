import './style.css';
import { LANGS, DEFAULT_LANG, texts } from './i18n.js';
import { startScene } from './scene.js';
import * as api from './api.js';

const LANG_KEY = 'kawabonk.lang';
const root = document.documentElement;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---- Language -------------------------------------------------------------

function savedLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl && LANGS.some((l) => l.code === fromUrl)) return fromUrl;
  try { return localStorage.getItem(LANG_KEY) || 'auto'; } catch { return 'auto'; }
}

let choice = savedLang();
let lang = choice === 'auto' ? DEFAULT_LANG : choice;
let t = texts(lang);

function applyTexts() {
  root.lang = lang === 'zht' ? 'zh-Hant' : lang;
  root.dataset.lang = lang;
  $('[data-lang-code]', pick).textContent = LANGS.find((l) => l.code === lang).tag;
  $('.lang-btn', pick).title = t.lang;
  $('.lang-btn', pick).setAttribute('aria-label', t.lang);
  $('.logo-ver', authScreen).title = t.news;
  for (const el of [...$$('[data-t]'), ...$$('[data-t]', authScreen)]) {
    const value = t[el.dataset.t];
    if (typeof value === 'string') el.textContent = value;
  }
  renderLangList();
  renderBody();
}

function renderLangList() {
  const list = $('.lang-list', pick);
  const check = '<img class="pix check" src="./assets/ui/icons/check.png" alt="" draggable="false">';
  const items = [
    `<button class="lang-opt${choice === 'auto' ? ' on' : ''}" role="option" data-code="auto"><b>${t.auto}</b><small>${LANGS.find((l) => l.code === DEFAULT_LANG).name}</small>${choice === 'auto' ? check : ''}</button>`,
    ...LANGS.map((l) => `<button class="lang-opt${choice === l.code ? ' on' : ''}" role="option" data-code="${l.code}"><b>${l.name}</b>${choice === l.code ? check : ''}</button>`),
  ];
  list.innerHTML = items.join('');
}

const pick = $('.lang-pick');
function setOpen(open) {
  pick.classList.toggle('open', open);
  $('.lang-btn', pick).setAttribute('aria-expanded', String(open));
}
$('.lang-btn').addEventListener('click', (e) => { e.stopPropagation(); setOpen(!pick.classList.contains('open')); });
$('.lang-list').addEventListener('click', (e) => {
  const opt = e.target.closest('.lang-opt');
  if (!opt) return;
  choice = opt.dataset.code;
  try { localStorage.setItem(LANG_KEY, choice); } catch { /* private mode */ }
  lang = choice === 'auto' ? DEFAULT_LANG : choice;
  t = texts(lang);
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  history.replaceState(null, '', url);
  setOpen(false);
  applyTexts();
  game?.rerender();
});
document.addEventListener('click', (e) => { if (!pick.contains(e.target)) setOpen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); closeModal(); } });

// ---- Sign-in card ---------------------------------------------------------

let tab = 'guest';
const body = $('[data-body]');
const err = $('.err');
const form = { name: '', pw: '', pw2: '', mail: '' };

function pwField(id, placeholder, autocomplete) {
  return `<div class="pw-field"><input class="field" id="${id}" placeholder="${placeholder}" type="password" autocomplete="${autocomplete}" maxlength="200" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="pw-eye" type="button" tabindex="-1">${t.show}</button></div>`;
}
const nameField = () => `<input class="field" id="f-name" placeholder="${t.name}" maxlength="16" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false">`;

function renderBody() {
  err.textContent = '';
  body.classList.toggle('reg', tab === 'register');
  for (const b of $$('.auth-tabs .pill')) {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  }
  if (tab === 'guest') {
    body.innerHTML = `<div class="auth-perks">
        <div><img class="pix" src="./assets/items/poke-ball.png" alt="" draggable="false">${t.perk1}</div>
        <div><img class="pix" src="./assets/items/rare-candy.png" alt="" draggable="false">${t.perk2}</div>
        <div><img class="pix" src="./assets/items/star-piece.png" alt="" draggable="false">${t.perk3}</div>
      </div>
      <button class="btn big red" data-act="guest"><img class="pix btn-ball" src="./assets/items/poke-ball.png" alt="" draggable="false">${t.playGuest}</button>`;
  } else if (tab === 'login') {
    body.innerHTML = `${nameField()}${pwField('f-pw', t.password, 'current-password')}
      <div class="auth-hint bad" data-caps hidden>${t.caps}</div>
      <button class="btn big blue" data-act="login">${t.login}</button>
      <button class="auth-forgot" type="button" data-act="forgot">Mot de passe oublié ?</button>`;
  } else {
    body.innerHTML = `${nameField()}<div class="auth-hint" data-name-hint></div>
      ${pwField('f-pw', t.password, 'new-password')}
      <div class="pw-meter"><i></i><span>${t.pwRule}</span></div>
      ${pwField('f-pw2', t.password2, 'new-password')}
      <div class="auth-hint" data-match-hint></div>
      <input class="field" id="f-mail" type="email" maxlength="200" placeholder="E-mail (facultatif, pour retrouver ton mot de passe)" autocomplete="email">
      <div class="auth-hint bad" data-caps hidden>${t.caps}</div>
      <div class="auth-warn">${t.warn}</div>
      <button class="btn big green" data-act="register" disabled>${t.register}</button>
      <p class="auth-terms">${t.terms}</p>`;
  }
  // Keep what was typed when switching tabs or language.
  if ($('#f-name')) $('#f-name').value = form.name;
  if ($('#f-pw')) $('#f-pw').value = form.pw;
  if ($('#f-pw2')) $('#f-pw2').value = form.pw2;
  if ($('#f-mail')) $('#f-mail').value = form.mail;
  if (tab === 'register') validate();
}

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

function strength(pw) {
  if (!pw) return 0;
  let score = Math.min(pw.length, 16) / 16;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  score = score * 0.6 + (kinds / 4) * 0.4;
  return pw.length < 8 ? Math.min(score, 0.3) : score;
}

function validate() {
  const nameHint = $('[data-name-hint]');
  const matchHint = $('[data-match-hint]');
  const meter = $('.pw-meter');
  const nameOk = NAME_RE.test(form.name);
  nameHint.textContent = form.name ? (nameOk ? t.nameOk : t.nameRule) : '';
  nameHint.className = `auth-hint ${form.name ? (nameOk ? 'ok' : 'bad') : ''}`;

  const s = strength(form.pw);
  const color = s < 0.35 ? '#e0303e' : s < 0.7 ? '#f2a516' : '#1fa04e';
  meter.style.setProperty('--w', `${Math.round(s * 100)}%`);
  meter.style.setProperty('--c', color);
  meter.classList.toggle('bad', !!form.pw && form.pw.length < 8);
  meter.querySelector('span').textContent = !form.pw ? t.pwRule : form.pw.length < 8 ? t.pwRule : s < 0.7 ? t.pwOk : t.pwStrong;

  const same = form.pw2 && form.pw === form.pw2;
  matchHint.textContent = form.pw2 ? (same ? t.match : t.mismatch) : '';
  matchHint.className = `auth-hint ${form.pw2 ? (same ? 'ok' : 'bad') : ''}`;

  $('[data-act="register"]').disabled = !(nameOk && form.pw.length >= 8 && same);
}

$('.auth-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.pill');
  if (!b || b.dataset.tab === tab) return;
  tab = b.dataset.tab;
  renderBody();
});

body.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'f-name') form.name = e.target.value;
  if (id === 'f-pw') form.pw = e.target.value;
  if (id === 'f-pw2') form.pw2 = e.target.value;
  if (id === 'f-mail') form.mail = e.target.value;
  err.textContent = '';
  if (tab === 'register') validate();
});

body.addEventListener('keydown', (e) => {
  const caps = $('[data-caps]');
  if (caps && e.getModifierState) caps.hidden = !e.getModifierState('CapsLock');
  if (e.key === 'Enter' && e.target.classList.contains('field')) $('.auth-body .btn')?.click();
});

body.addEventListener('click', (e) => {
  const eye = e.target.closest('.pw-eye');
  if (eye) {
    const input = eye.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.textContent = show ? t.hide : t.show;
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'guest') api.session().then((acc) => playAsGuest(acc));
  if (act === 'login') {
    if (!form.name || !form.pw) { err.textContent = t.fillIn; return; }
    signIn(() => api.login(form.name.trim(), form.pw), true);
  }
  if (act === 'register') signIn(async () => { const r = await api.register(form.name.trim(), form.pw); if (form.mail.trim()) await api.put('account/email', { email: form.mail.trim() }).catch(() => {}); return r; }, false);
  if (act === 'forgot') forgotPassword();
});

// Sign-in and sign-up go through the server; its profile replaces this device's on sign-in.
const AUTH_ERRORS = { wrong: 'Nom ou mot de passe incorrect.', taken: 'Ce nom est déjà pris.', name: t.nameRule, password: t.pwRule, slow: 'Trop d’essais : réessaie dans quelques minutes.' };
async function signIn(request, replaceLocal) {
  const btn = $('.auth-body .btn');
  if (btn) btn.disabled = true;
  err.textContent = '';
  try {
    if (!(await api.available())) { err.textContent = t.offline; return; }
    const r = await request();
    if (replaceLocal) { try { if (r.profile) localStorage.setItem('pokebonk.guest', JSON.stringify(r.profile)); else localStorage.removeItem('pokebonk.guest'); } catch { /* private mode */ } }
    form.pw = ''; form.pw2 = '';
    playAsGuest(r);
  } catch (e) {
    err.textContent = AUTH_ERRORS[e.code] || t.offline;
  } finally { if (btn?.isConnected) { if (tab === 'register') validate(); else btn.disabled = false; } }
}

// Forgotten password: a link valid for an hour goes to the account's e-mail address.
function forgotPassword() {
  const m = openModal(`<div class="ribbon">Mot de passe oublié</div>
    <p>Entre ton nom de dresseur ou ton e-mail : si le compte a une adresse, un lien pour choisir un nouveau mot de passe y sera envoyé.</p>
    <input class="field" data-who maxlength="200" placeholder="Nom de dresseur ou e-mail" value="${form.name.replace(/"/g, '')}">
    <p class="auth-hint" data-msg></p><button class="btn blue" data-send>Envoyer le lien</button>`);
  m.querySelector('[data-send]').onclick = async () => {
    const msg = m.querySelector('[data-msg]');
    if (!(await api.available())) { msg.textContent = t.offline; return; }
    try { await api.post('password/forgot', { name: m.querySelector('[data-who]').value }); msg.className = 'auth-hint ok'; msg.textContent = 'Si ce compte a une adresse e-mail, le lien vient d’y être envoyé (valable une heure).'; }
    catch (e) { msg.className = 'auth-hint bad'; msg.textContent = e.code === 'slow' ? AUTH_ERRORS.slow : t.offline; }
  };
}
// Opening the e-mailed link (?reset=...) asks for the new password, then signs in.
function resetFromLink(resetToken) {
  const url = new URL(location.href); url.searchParams.delete('reset'); history.replaceState(null, '', url);
  const m = openModal(`<div class="ribbon">Nouveau mot de passe</div>
    <input class="field" type="password" data-p1 maxlength="200" placeholder="${t.password}" autocomplete="new-password">
    <input class="field" type="password" data-p2 maxlength="200" placeholder="${t.password2}" autocomplete="new-password">
    <p class="auth-hint bad" data-msg></p><button class="btn green" data-save>Enregistrer et jouer</button>`);
  m.querySelector('[data-save]').onclick = async () => {
    const p1 = m.querySelector('[data-p1]').value; const msg = m.querySelector('[data-msg]');
    if (p1.length < 8) { msg.textContent = t.pwRule; return; }
    if (p1 !== m.querySelector('[data-p2]').value) { msg.textContent = t.mismatch; return; }
    try {
      const r = await api.resetPassword(resetToken, p1);
      try { if (r.profile) localStorage.setItem('pokebonk.guest', JSON.stringify(r.profile)); } catch { /* private mode */ }
      closeModal(); playAsGuest(r);
    } catch (e) { msg.textContent = e.code === 'expired' ? 'Ce lien a expiré : demande-en un nouveau.' : t.offline; }
  };
}

// ---- Pop-up panels ---------------------------------------------------------

let modal = null;
function openModal(html) {
  closeModal();
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });
  document.body.append(modal);
  return modal;
}
function closeModal() {
  if (!modal) return;
  clearInterval(modal.timer);
  modal.remove();
  modal = null;
}

$('.logo-ver').addEventListener('click', () => {
  $('.logo-ver').classList.remove('fresh');
  openModal(`<div class="ribbon"><img class="pix hd-ball" src="./assets/items/star-piece.png" alt="">${t.news}</div>
    <p><b>v0.9.25</b></p>
    <ul>${t.newsItems.map((n) => `<li>${n}</li>`).join('')}</ul>
    <button class="btn red" data-close>${t.close}</button>`);
});

// ---- After "Jouer en invité !": guest profile, main menu, runs ----------------

const ui = $('#ui');
const authScreen = $('.auth-page');
const scene = $('#game');

function setScene(visible) {
  scene.hidden = !visible;
  if (visible) backdrop.show();
  else backdrop.hide();
}

let game = null;
const gameOptions = {
  ui,
  picker: pick,
  getTexts: () => t,
  setScene,
  onLogout: (nextTab) => {
    closeModal();
    if (nextTab !== 'register') api.logout();
    setScene(true);
    ui.replaceChildren(authScreen);
    $('.mm-top', authScreen).append(pick);
    tab = nextTab || 'guest';
    renderBody();
  },
};
// The menus and the 3D engine load only once the player goes past the start screen.
const loadGame = () => Promise.all([import('./game/menu.js'), import('./game/profile.js'), import('./game/game.css'), import('./game/game3d.css'), import('./game/wipe.js'), import('./game/screens.css')]);

function playAsGuest(remote = null) {
  // A guest's or player's profile kept on the server comes back on any device signed in to it.
  if (remote?.profile && remote.account?.guest) { try { if (!localStorage.getItem('pokebonk.guest')) localStorage.setItem('pokebonk.guest', JSON.stringify(remote.profile)); } catch { /* private mode */ } }
  const m = openModal(`<div class="ribbon"><img class="pix hd-ball" src="./assets/items/poke-ball.png" alt="">${t.g.creating}</div>
    <div class="load-bar"><i></i></div>`);
  const loading = loadGame();
  let p = 0;
  m.timer = setInterval(() => {
    p = Math.min(100, p + 18 + Math.random() * 14);
    m.querySelector('.load-bar i').style.width = `${p}%`;
    if (p >= 100) {
      clearInterval(m.timer);
      loading.then(([menu, prof, , , w]) => {
        closeModal();
        w.wipe(() => {
          game ||= menu.createGame(gameOptions);
          const p = prof.loadProfile() || prof.createProfile();
          if (remote?.account) { p.accountName = remote.account.guest ? null : remote.account.name; p.accountId = remote.account.id; }
          prof.saveProfile(p);
          game.show(p);
        });
      });
    }
  }, 120);
}

try { if (localStorage.getItem('pokebonk.reduceFx')) root.classList.add('reduce-fx'); } catch { /* ignore */ }

// ---- Phones held upright ----------------------------------------------------

if (matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window) root.classList.add('touch');
$('.rotate-skip').addEventListener('click', () => root.classList.add('rotate-ok'));

applyTexts();
const backdrop = startScene($('#game'));
{ const resetToken = new URLSearchParams(location.search).get('reset'); if (resetToken) resetFromLink(resetToken); }

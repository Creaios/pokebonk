import { FAMILY_ULTS } from './ults.js';
// What each Pokémon brings into a run: a class passive, a starting attack, an Ultimate (R),
// plus the attacks and vitamins that level-ups can offer. The Héricendre line uses the
// texts from the game's League screen; the others follow the same pattern by type.
export const EVOLVE_AT = [22, 44];

const BY_TYPE = {
  fire: {
    passive: { name: 'Brume de chaleur', desc: "Les flammes de ton dos grandissent avec le feu qui t'entoure : ×1,04 dégâts de Feu par ennemi brûlé à moins de 8 m, jusqu'à ×1,24. Toutes les 6 s, une onde de chaleur (4 m) brûle les ennemis proches." },
    attack: { id: 'cone', name: 'Feu Envieux', kind: 'cone', cls: 'Spécial', shape: 'Cône', dmg: 5.6, cd: 1.8, range: 7, desc: 'Lance un torrent en cône devant toi. Peut infliger brûlé.', burn: 0.3 },
    ult: { name: 'Dos Ardent', desc: 'Les flammes du dos explosent en deux anneaux de feu qui laissent le sol en flammes.' },
    ults: [{ name: 'Dos Ardent', desc: 'Les flammes du dos explosent en deux anneaux de feu qui laissent le sol en flammes.' }, { name: 'Roue de Calima', desc: 'Un anneau de feu et un tour complet du terrain dans une roue de flammes qui brûle tout ce qu’elle touche.' }, { name: 'Explosion de Calima', desc: 'Un dôme d’air tremblant couvre le terrain et huit volcans explosent, réduisant tout en cendres.' }],
    color: '#ff7a2a',
  },
  water: {
    passive: { name: 'Carapace ruisselante', desc: "L'eau qui coule sur toi soigne 1 % de tes PV par ennemi touché par une attaque Eau, toutes les 2 s au plus." },
    attack: { id: 'shot', name: 'Pistolet à O', kind: 'shot', cls: 'Spécial', shape: 'Projectile', dmg: 6, cd: 1.1, range: 14, desc: "Tire un jet d'eau sur l'ennemi le plus proche. Le traverse." },
    ult: { name: 'Hydrocanon', desc: 'Un raz-de-marée circulaire repousse et frappe tous les ennemis autour de toi.' },
    color: '#3a9cff',
  },
  grass: {
    passive: { name: 'Engrais', desc: 'Tes attaques Plante soignent 0,5 PV par ennemi touché. Les herbes autour de toi ralentissent les ennemis de 10 %.' },
    attack: { id: 'whip', name: 'Fouet Lianes', kind: 'whip', cls: 'Physique', shape: 'Arc', dmg: 7, cd: 1.4, range: 5, desc: 'Deux lianes fouettent en arc devant toi.' },
    ult: { name: 'Tempête Florale', desc: 'Une tornade de feuilles tranchantes tourne autour de toi et happe les ennemis.' },
    color: '#5ad05a',
  },
  electric: {
    passive: { name: 'Statik', desc: 'Les ennemis qui te touchent ont 30 % de chances d’être paralysés 1 s.' },
    attack: { id: 'chain', name: 'Éclair', kind: 'chain', cls: 'Spécial', shape: 'Chaîne', dmg: 6.5, cd: 1.2, range: 10, desc: 'Un éclair frappe l’ennemi le plus proche puis rebondit sur 2 autres.' },
    ult: { name: 'Fatal-Foudre', desc: 'La foudre s’abat dix fois autour de toi.' },
    color: '#ffd23a',
  },
  normal: {
    passive: { name: 'Fuite', desc: '+10 % de vitesse de déplacement.' },
    attack: { id: 'shot', name: 'Météores', kind: 'shot', cls: 'Spécial', shape: 'Projectile', dmg: 5, cd: 1, range: 12, desc: 'Des étoiles filent vers l’ennemi le plus proche.' },
    ult: { name: 'Ultralaser', desc: 'Un rayon balaie tout devant toi.' },
    color: '#ffe9a8',
  },
};
BY_TYPE.bug = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Piqûre', desc: 'Pique l’ennemi le plus proche.' }, color: '#9ac83a' };
BY_TYPE.poison = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Dard-Venin', desc: 'Un dard empoisonné file vers l’ennemi le plus proche.' }, color: '#a24cf0' };
BY_TYPE.flying = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Tornade', desc: 'Une rafale frappe l’ennemi le plus proche.' }, color: '#a8c8ff' };
BY_TYPE.ground = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: "Coud'Boue", desc: 'Projette de la boue sur l’ennemi le plus proche.' }, color: '#b88a4a' };
BY_TYPE.rock = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Jet-Pierres', desc: 'Lance une pierre sur l’ennemi le plus proche.' }, color: '#a89878' };
BY_TYPE.fighting = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Poing Karaté', desc: 'Un coup vif sur l’ennemi le plus proche.' }, color: '#e0503a' };
BY_TYPE.psychic = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Choc Mental', desc: 'Une onde psychique frappe l’ennemi le plus proche.' }, color: '#ff5ad0' };

BY_TYPE.ice = { ...BY_TYPE.normal, attack: { ...BY_TYPE.normal.attack, name: 'Crocs Givre', desc: 'Mord l’ennemi le plus proche avec des crocs glacés.' }, color: '#7ae0f0' };

// The six starters' own class (role), passive and first attack, from the game's data.
const STARTER_KITS = {
  1: { role: 'Guérisseur', passive: { name: 'Photosynthèse', desc: "+1,5 régénération et +25 % soin. Tes attaques Plante te soignent un peu (0,4 % des PV par coup, jusqu'à 5 fois par seconde)." }, attack: { ...BY_TYPE.grass.attack, name: 'Fouet Lianes' } },
  4: { role: 'Assaut ardent', passive: { name: 'Mer de flammes', desc: 'Sous 40 % de PV, ×1,4 dégâts. +10 % dégâts Feu.' }, attack: { ...BY_TYPE.fire.attack, name: 'Flammèche', desc: 'Crache des flammèches en cône devant toi. Peut infliger brûlé.' } },
  7: { role: 'Défenseur', passive: { name: 'Carapace torrentielle', desc: "+15 d'armure. Toutes les 8 s, ta carapace te donne un bouclier de 8 % de tes PV. Tant que tu as un bouclier, ×1,25 dégâts." }, attack: { ...BY_TYPE.water.attack, name: 'Pistolet à O' } },
  152: { role: 'Gardienne florale', passive: { name: 'Parfum Apaisant', desc: "+15 % PV max. et -8 % dégâts. Toutes les 4 s, un anneau de parfum (5 m ; Méganium, 7 m) charme les ennemis 3 s (ils font 40 % de dégâts en moins) et te soigne de 1 % de PV par ennemi touché, jusqu'à 6 %." }, attack: { ...BY_TYPE.grass.attack, name: 'Désherbaffe', desc: 'Fonce en traçant un sillon d’herbe qui frappe les ennemis devant toi.' } },
  155: { role: 'Volcan', passive: BY_TYPE.fire.passive, attack: BY_TYPE.fire.attack },
  158: { role: 'Mâchoires', passive: { name: 'Sans Limite', desc: '+20 % dégâts, mais tes attaques ne causent aucun état, sauf Mouillé (et la prise de Croque Fort).' }, attack: { id: 'bite', name: 'Crocs Givre', kind: 'whip', cls: 'Physique', shape: 'Morsure', dmg: 8, cd: 1.3, range: 4, desc: 'Mord les ennemis devant toi avec des crocs glacés.' }, type: 'ice' },
};

export function familyOf(species, byId) {
  let s = species;
  while (s?.evoFrom && byId.get(s.evoFrom)) s = byId.get(s.evoFrom);
  return s?.id ?? species.id;
}

export function mainType(species) {
  const t = species.types[0] === 'normal' && species.types[1] ? species.types[1] : species.types[0];
  return BY_TYPE[t] ? t : 'normal';
}

export function kitFor(species, byId) {
  const base = BY_TYPE[mainType(species)];
  const fam = byId ? familyOf(species, byId) : species.id;
  const own = byId ? STARTER_KITS[fam] : null;
  const kit = own ? { ...base, ...own, ult: base.ult, ults: base.ults, color: base.color } : { ...base };
  const ults = FAMILY_ULTS[fam];
  if (ults) { kit.ults = ults.map((u, i) => ({ ...(base.ults?.[i] || base.ult), ...u })); kit.ult = { ...base.ult, ...ults[0] }; }
  return kit;
}

export function starterInfo(id) {
  return STARTER_KITS[id];
}

// Attacks a level-up can teach (the Pokémon carries up to 3, a 4th slot opens later).
export const EXTRA_ATTACKS = [
  { id: 'orbit', name: 'Tourbi-Sable', kind: 'orbit', type: 'ground', cls: 'Physique', shape: 'Orbite', dmg: 4, cd: 0, desc: 'Des rochers tournent autour de toi et frappent au contact.' },
  { id: 'pulse', name: 'Onde Psy', kind: 'pulse', type: 'psychic', cls: 'Spécial', shape: 'Zone', dmg: 6, cd: 2.6, desc: 'Une onde repousse et frappe les ennemis proches.' },
  { id: 'bolt', name: 'Tonnerre', kind: 'bolt', type: 'electric', cls: 'Spécial', shape: 'Frappe', dmg: 9, cd: 1.7, desc: 'La foudre frappe des ennemis au hasard autour de toi.' },
  { id: 'gust', name: 'Tranch’Air', kind: 'shot', type: 'flying', cls: 'Spécial', shape: 'Projectile', dmg: 5, cd: 0.9, range: 14, desc: 'Des lames d’air filent vers les ennemis.' },
];

// Vitamins: passive bonuses, up to 3 carried, level 1 to 10.
export const VITAMINS = [
  { id: 'protein', name: 'Protéine', stat: 'Dégâts physiques', icon: 'protein', per: 0.1 },
  { id: 'calcium', name: 'Calcium', stat: 'Dégâts spéciaux', icon: 'calcium', per: 0.1 },
  { id: 'iron', name: 'Fer', stat: 'Armure', icon: 'iron', per: 2 },
  { id: 'carbos', name: 'Carburant', stat: 'Vitesse', icon: 'carbos', per: 0.06 },
  { id: 'hp-up', name: 'Plus de PV', stat: 'PV max.', icon: 'hp-up', per: 0.1 },
  { id: 'pp-up', name: 'Plus de PP', stat: 'Projectiles', icon: 'pp-up', per: 1 },
  { id: 'x-speed', name: 'Huile', stat: "Vitesse d'attaque", icon: 'x-speed', per: 0.08 },
  { id: 'dire-hit', name: 'Direct +', stat: 'Probabilité de critique', icon: 'dire-hit', per: 0.05 },
  { id: 'stardust', name: 'Poussière Étoile', stat: 'Zone', icon: 'comet-shard', per: 0.1 },
  { id: 'super-potion', name: 'Super Potion', stat: 'Régénération', icon: 'super-potion', per: 0.4 },
  { id: 'lucky-egg', name: 'Bonbon Exp.', stat: 'Expérience', icon: 'rare-candy', per: 0.1 },
  { id: 'magnet', name: 'Corde Sortie', stat: 'Ramassage', icon: 'escape-rope', per: 1.5 },
];

export const RARITIES = [
  { id: 'common', name: 'Commun', mult: 1, color: '#c8ccd8', weight: 50 },
  { id: 'uncommon', name: 'Peu commun', mult: 1.2, color: '#36c96a', weight: 28 },
  { id: 'rare', name: 'Rare', mult: 1.45, color: '#3a8cff', weight: 14 },
  { id: 'epic', name: 'Épique', mult: 1.75, color: '#a24cf0', weight: 6 },
  { id: 'legend', name: 'Légendaire', mult: 2.1, color: '#f2b705', weight: 2 },
];

// Rarity of an upgrade card, rolled for each card like the game does: Rare only from about level 3,
// Épique from about level 8, Légendaire from about level 14, and each zone counts as 12 more levels.
export function rollRarity(level = 1, zone = 1, luck = 0) {
  const a = Math.max(0, luck) / 100;
  const o = level + luck / 8 + (zone - 1) * 12;
  const s = (e, t) => Math.max(0, Math.min(1, (o - e) / (t - e)));
  const w = [70 / (1 + a), 24 * (1 + 0.5 * a), 5 * (1 + a) ** 2 * s(3, 10), 0.9 * (1 + a) ** 3 * s(8, 18), 0.12 * (1 + a) ** 4 * s(14, 26)];
  let n = Math.random() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < 5; i++) { if ((n -= w[i]) <= 0) return RARITIES[i]; }
  return RARITIES[0];
}

// Items found in the Poké Balls lying on the map.
export const BALL_ITEMS = [
  { id: 'leftovers', name: 'Restes', desc: 'Régénère 1 PV par seconde.' },
  { id: 'choice-band', name: 'Bandeau Choix', desc: '+20 % de dégâts physiques.' },
  { id: 'quick-claw', name: 'Vive Griffe', desc: '+12 % de vitesse d’attaque.' },
  { id: 'exp-share', name: 'Multi Exp', desc: '+15 % d’expérience.' },
  { id: 'silk-scarf', name: 'Mouchoir Soie', desc: '+15 % de dégâts.' },
  { id: 'soft-sand', name: 'Sable Doux', desc: '+2 de portée de ramassage.' },
  { id: 'charcoal', name: 'Charbon', desc: '+20 % de dégâts de Feu.' },
  { id: 'mystic-water', name: 'Eau Mystique', desc: '+20 % de dégâts d’Eau.' },
  { id: 'miracle-seed', name: 'Graine Miracle', desc: '+20 % de dégâts Plante.' },
  { id: 'magnet', name: 'Aimant', desc: '+20 % de dégâts Électrik.' },
];

export const GUARDIANS = [
  { zone: 1, ids: [123, 26, 55] },
  { zone: 2, ids: [127, 62, 53] },
  { zone: 3, ids: [34, 76, 59] },
];

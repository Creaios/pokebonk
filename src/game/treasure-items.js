// What the Trésors wheels hold, as in the game: each starter family's wheel has 10 prizes, four stacks of
// bag items, a title, a frame, two Pierres Éclat, two Master Balls, a look and the grand prize. Bag items
// go in the Sac before a run and are used up when it starts.
export const ITEM_NAMES = { 'rare-candy': 'Super Bonbon', 'lucky-egg': 'Œuf Chance', 'amulet-coin': 'Pièce Rune', honey: 'Miel', 'shiny-stone': 'Pierre Éclat', 'master-ball': 'Master Ball' };
export const ITEM_EFFECTS = {
  'rare-candy': 'Ton Pokémon gagne deux niveaux au début de la partie : deux améliorations à choisir.',
  'lucky-egg': '+25 % d’expérience pendant la partie.',
  'amulet-coin': '+50 % de Pokédollars ramassés pendant la partie.',
  honey: 'Un Pokémon Alpha de plus apparaît dans chaque zone (vers 4 minutes).',
  'shiny-stone': 'Un Pokémon chromatique apparaît à coup sûr dans la première zone, entre 40 s et 2 min 30.',
  'master-ball': 'Le premier Pokémon chromatique est capturé à coup sûr dès qu’il tombe à moitié de ses PV : il ne peut plus s’enfuir.',
};
export const WHEELS = [
  { species: 4, name: 'Trésors de Salamèche', items: [['rare-candy', 4], ['amulet-coin', 3], ['lucky-egg', 3], ['honey', 2]], title: 'Apprenti de la Braise', frame: 'Cadre Cendres', look: 'Bronze Ardent', grandTitle: 'Seigneur des Flammes', grandFrame: 'Couronne de Feu', grandLook: 'Braise Éternelle' },
  { species: 1, name: 'Trésors de Bulbizarre', items: [['lucky-egg', 4], ['rare-candy', 3], ['honey', 3], ['amulet-coin', 2]], title: 'Apprenti de la Sève', frame: 'Cadre Feuillage', look: 'Rosée d’Émeraude', grandTitle: 'Gardien de la Jungle', grandFrame: 'Couronne de Lianes', grandLook: 'Jungle Éternelle' },
  { species: 7, name: 'Trésors de Carapuce', items: [['amulet-coin', 4], ['honey', 3], ['rare-candy', 3], ['lucky-egg', 2]], title: 'Apprenti de la Marée', frame: 'Cadre Écume', look: 'Perle Marine', grandTitle: 'Souverain des Marées', grandFrame: 'Couronne de Marée', grandLook: 'Marée Éternelle' },
  { species: 63, name: 'Trésors d’Abra', items: [['honey', 4], ['lucky-egg', 3], ['amulet-coin', 3], ['rare-candy', 2]], title: 'Apprenti de la Psyché', frame: 'Cadre Glyphe', look: 'Rêve Étoilé', grandTitle: 'Maître de l’Esprit', grandFrame: 'Couronne Psychique', grandLook: 'Esprit Éternel' },
  { species: 92, name: 'Trésors de Fantominus', items: [['rare-candy', 4], ['honey', 3], ['amulet-coin', 3], ['lucky-egg', 2]], title: 'Apprenti des Ombres', frame: 'Cadre Feu Follet', look: 'Ombre Lavande', grandTitle: 'Seigneur des Cauchemars', grandFrame: 'Couronne spectrale', grandLook: 'Cauchemar Éternel' },
  { species: 25, name: 'Trésors de Pikachu', items: [['amulet-coin', 4], ['rare-candy', 3], ['lucky-egg', 3], ['honey', 2]], title: 'Apprenti des Volts', frame: 'Cadre Étincelle', look: 'Néon Volt', grandTitle: 'Roi de la Tempête', grandFrame: 'Couronne de Foudre', grandLook: 'Tempête Éternelle' },
];

// The prize behind one slot of one wheel.
export function prizeOf(wheel, slot) {
  const w = WHEELS[wheel];
  if (!w) return null;
  if (slot < 4) { const [id, n] = w.items[slot]; return { kind: 'bag', id, n, name: `${ITEM_NAMES[id]} ×${n}` }; }
  if (slot === 4) return { kind: 'title', name: w.title };
  if (slot === 5) return { kind: 'frame', name: w.frame };
  if (slot === 6) return { kind: 'bag', id: 'shiny-stone', n: 2, name: `${ITEM_NAMES['shiny-stone']} ×2` };
  if (slot === 7) return { kind: 'bag', id: 'master-ball', n: 2, name: `${ITEM_NAMES['master-ball']} ×2` };
  if (slot === 8) return { kind: 'look', name: w.look, species: w.species };
  return { kind: 'grand', name: w.grandLook, title: w.grandTitle, frame: w.grandFrame, species: w.species };
}

// Everything the player won: bag items still to use, titles, frames and looks.
export function collection(p) {
  const bag = {}; const titles = []; const frames = []; const looks = [];
  for (const [wheel, slots] of Object.entries(p.treasures || {})) {
    for (const slot of slots) {
      const x = prizeOf(+wheel, slot); if (!x) continue;
      if (x.kind === 'bag') bag[x.id] = (bag[x.id] || 0) + x.n;
      if (x.kind === 'title') titles.push(x.name);
      if (x.kind === 'frame') frames.push(x.name);
      if (x.kind === 'look') looks.push({ name: x.name, species: x.species });
      if (x.kind === 'grand') { looks.push({ name: x.name, species: x.species, grand: true }); titles.push(x.title); frames.push(x.frame); }
    }
  }
  for (const [id, used] of Object.entries(p.bagUsed || {})) bag[id] = Math.max(0, (bag[id] || 0) - used);
  return { bag, titles, frames, looks };
}

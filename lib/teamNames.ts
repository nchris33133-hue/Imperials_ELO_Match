/**
 * Random team name generator — combines a front word (color-coded) with a back word.
 */

export interface TeamNameResult {
  name: string;
  color: string;
}

const FRONT_WORDS: { word: string; color: string }[] = [
  // Red
  { word: 'Ember', color: '#ff4757' },
  { word: 'Blaze', color: '#ff4757' },
  { word: 'Crimson', color: '#ff4757' },
  { word: 'Charmander', color: '#ff4757' },
  // Blue
  { word: 'Cobalt', color: '#00b4d8' },
  { word: 'Frost', color: '#00b4d8' },
  { word: 'Squirtle', color: '#00b4d8' },
  { word: 'Tide', color: '#00b4d8' },
  // Black
  { word: 'Onyx', color: '#8a9bb5' },
  { word: 'Shadow', color: '#8a9bb5' },
  { word: 'Raven', color: '#8a9bb5' },
  { word: 'Umbreon', color: '#8a9bb5' },
  // White
  { word: 'Ghost', color: '#e8edf3' },
  { word: 'Blizzard', color: '#e8edf3' },
  { word: 'Ivory', color: '#e8edf3' },
  { word: 'Togekiss', color: '#e8edf3' },
  // Purple
  { word: 'Venom', color: '#cc80ff' },
  { word: 'Mystic', color: '#cc80ff' },
  { word: 'Dusk', color: '#cc80ff' },
  { word: 'Gengar', color: '#cc80ff' },
];

const BACK_WORDS = [
  'Cannons', 'Blitz', 'Strike', 'Surge', 'Assault',
  'Guns', 'Blades', 'Shields', 'Bolts', 'Arrows',
  'Squad', 'Gang', 'Mob', 'Crew', 'Posse',
  'Troopers', 'Renegades', 'Raiders', 'Chaos', 'Force',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate team names for N teams.
 * Picks N random front words (no duplicates) and pairs each with a random back word.
 */
export function generateTeamNames(teamCount: number): TeamNameResult[] {
  const fronts = shuffle(FRONT_WORDS).slice(0, teamCount);
  const backs = shuffle(BACK_WORDS);
  return fronts.map((f, i) => ({
    name: `${f.word} ${backs[i % backs.length]}`,
    color: f.color,
  }));
}

/**
 * Regenerate names — just generates a fresh random set.
 */
export function regenerateTeamNames(teamCount: number): TeamNameResult[] {
  return generateTeamNames(teamCount);
}

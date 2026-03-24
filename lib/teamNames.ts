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

// Group front words by color so we can enforce one color per team
const COLOR_GROUPS = new Map<string, { word: string; color: string }[]>();
for (const fw of FRONT_WORDS) {
  if (!COLOR_GROUPS.has(fw.color)) COLOR_GROUPS.set(fw.color, []);
  COLOR_GROUPS.get(fw.color)!.push(fw);
}
const ALL_COLORS = Array.from(COLOR_GROUPS.keys());

/**
 * Generate team names for N teams.
 * Each team gets a unique color — one random front word picked per color group.
 */
export function generateTeamNames(teamCount: number): TeamNameResult[] {
  // Pick N distinct colors, then one random word from each color group
  const colors = shuffle(ALL_COLORS).slice(0, teamCount);
  const fronts = colors.map(c => {
    const group = COLOR_GROUPS.get(c)!;
    return group[Math.floor(Math.random() * group.length)];
  });
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

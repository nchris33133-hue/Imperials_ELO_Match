/**
 * Random team name generator — themed, color-coded, and rotating.
 * Each color slot has multiple themed pools that cycle on each balance.
 */

// Cyan / Blue — slot 0
const CYAN_NAMES = [
  // Pokemon
  'Squirtle Squad', 'Vaporeon Vibes', 'Kyogre Krew', 'Glaceon Gang', 'Lapras Legends',
  // Anime
  'Blue Exorcists', 'Aqua Konosuba', 'Tanjiro Tides', 'Rem Supremacy', 'Spirit Detectives',
  // Pop culture
  'Heisenberg Blue', 'Avatar State', 'Na\'vi Nation', 'Ice Ice Baby', 'Blue Shells',
  // Vibe
  'Certified Chill', 'Main Characters', 'Touch Grass FC', 'No Thoughts Blue', 'Ctrl+Z Energy',
];

// Red — slot 1
const RED_NAMES = [
  // Pokemon
  'Charizard Chaos', 'Team Magma', 'Blaziken Blitz', 'Flareon Fury', 'Groudon Grindset',
  // Anime
  'Akatsuki Rejects', 'Red Riot', 'Crimson Titans', 'Itachi Did Nothing Wrong', 'Power of Friendship',
  // Pop culture
  'Red Wedding FC', 'Sith Happens', 'Cherry Bomb', 'Red Flags United', 'Netflix & Dodge',
  // Vibe
  'Unhinged Energy', 'Rent Free FC', 'Caught in 4K', 'Red Pill Dodgers', 'No Chill Zone',
];

// Green — slot 2
const GREEN_NAMES = [
  // Pokemon
  'Bulbasaur Bunch', 'Sceptile Strikers', 'Leafeon Lads', 'Rayquaza Raid', 'Treecko Troop',
  // Anime
  'Tatsumaki Tornado', 'Green Naruto', 'Zoro Got Lost Again', 'Deku Does His Best', 'Broly Mode',
  // Pop culture
  'Shrek is Love', 'Yoda Younglings', 'Green Goblin Mode', 'Grass Touchers', 'Pickle Rick FC',
  // Vibe
  'Delulu is the Solulu', 'Slay & Display', 'Chronically Online', 'It\'s Giving Green', 'Toxic Trait FC',
];

// Orange — slot 3
const ORANGE_NAMES = [
  // Pokemon
  'Dragonite Dynasty', 'Arcanine Army', 'Infernape Impact', 'Charmander Chads', 'Rapidash Rush',
  // Anime
  'Naruto Runners', 'One Punch Squad', 'Chainsaw Devils', 'DBZ Filler Arc', 'Talk no Jutsu',
  // Pop culture
  'Cheeto Dusted', 'Orange is the New W', 'Nemo Found Us', 'Firefox FC', 'Fanta Menace',
  // Vibe
  'NPC Energy', 'Vibe Check FC', 'Living Their Best Life', 'Emotional Damage', 'Trust the Process',
];

// Purple — slot 4
const PURPLE_NAMES = [
  // Pokemon
  'Gengar Gang', 'Mewtwo Mindset', 'Espeon Elites', 'Mismagius Mystics', 'Shadow Ball Senders',
  // Anime
  'Gojo Stans', 'Frieza Force', 'Purple Haze JoJo', 'Beerus Destroyers', 'Sasuke Left the Chat',
  // Pop culture
  'Thanos Snapped', 'Purple Rain FC', 'Grape Ape Mode', 'Purple Reign', 'Lean Team Supreme',
  // Vibe
  'Understood the Assignment', 'Ate & Left No Crumbs', 'Serotonin Squad', 'Galaxy Brain FC', 'Era: Winning',
];

const ALL_POOLS = [CYAN_NAMES, RED_NAMES, GREEN_NAMES, ORANGE_NAMES, PURPLE_NAMES];

let cycleCounter = 0;

/**
 * Generate team names for N teams. Each call cycles to new names.
 * Returns an array of N names, one per team slot (color-matched).
 */
export function generateTeamNames(teamCount: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < teamCount; i++) {
    const pool = ALL_POOLS[i % ALL_POOLS.length];
    const index = (cycleCounter + i) % pool.length;
    names.push(pool[index]);
  }
  cycleCounter++;
  return names;
}

/**
 * Regenerate names — advances the cycle counter by a larger step
 * to avoid near-repeats on consecutive regenerates.
 */
export function regenerateTeamNames(teamCount: number): string[] {
  cycleCounter += 3;
  return generateTeamNames(teamCount);
}

import { Player, Session, Settings, VetLevel } from './types';

export const WIN_FACTOR = 1.15;
export const LOSS_FACTOR = 0.85;

export function kForGames(games: number): number {
  if (games < 10) return 40;
  if (games < 20) return 32;
  if (games < 30) return 26;
  return 20;
}

export function vetLevel(p: Player): VetLevel {
  if (p.veteran === 2) return 2;
  if ((p.veteran as any) === true || p.veteran === 1) return 1;
  return 0;
}

export function isProvisional(p: Player, settings: Settings): boolean {
  const vl = vetLevel(p);
  const threshold =
    vl === 2 ? settings.superVetProvGames :
    vl === 1 ? settings.vetProvGames :
    settings.provGames;
  return p.games < threshold;
}

export function getTier(elo: number) {
  if (elo >= 1350) return { key: 'di', label: 'Diamond', cls: 'tier-di' };
  if (elo >= 1200) return { key: 'pl', label: 'Platinum', cls: 'tier-pl' };
  if (elo >= 1100) return { key: 'go', label: 'Gold', cls: 'tier-go' };
  if (elo >= 950) return { key: 'si', label: 'Silver', cls: 'tier-si' };
  return { key: 'br', label: 'Bronze', cls: 'tier-br' };
}

export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export function teamEffectiveElo(
  players: Player[],
  isSmaller: boolean,
  settings: Settings
): number {
  if (!players.length) return settings.baseElo;
  const avg = players.reduce((s, p) => s + p.elo, 0) / players.length;
  const gNet = players.reduce((s, p) => s + (p.gender === 'M' ? 1 : -1), 0) / players.length;
  return Math.round(
    avg +
    gNet * settings.genderWeight +
    (isSmaller ? settings.unequalBonus : 0)
  );
}

/** Points awarded per placement: 1st=3, 2nd=2.5, 3rd=2, 4th=1.5, 5th=1 */
export const PLACEMENT_POINTS = [3, 2.5, 2, 1.5, 1];

/** LMS bonus: 1st=1, 2nd=0.5 */
export const LMS_POINTS = [1, 0.5];

/**
 * Apply match results: compute ELO deltas for all players using pairwise
 * comparisons between teams, then return updated players and a session record.
 *
 * @param teams - array of teams (each an array of Players)
 * @param placements - placement per team index (1 = 1st place, etc.)
 * @param label - session label
 * @param settings - current app settings
 * @param lmsFinishers - [male 1st, male 2nd, female 1st, female 2nd] (optional)
 * @returns { players, session, deltas } with updated ELO values
 */
export function applyMatchResults(
  teams: Player[][],
  placements: number[],
  label: string,
  settings: Settings,
  lmsFinishers: [string | null, string | null, string | null, string | null] = [null, null, null, null],
  manualChanges: import('@/lib/types').TeamChangeEntry[] = []
): { players: Player[]; session: Session; deltas: Record<string, number> } {
  // Compute effective ELO per team
  const minSize = Math.min(...teams.map(t => t.length));
  const teamElos = teams.map((t) =>
    teamEffectiveElo(t, t.length < minSize, settings)
  );

  // Accumulate raw delta per player id
  const deltaMap = new Map<number, number>();
  teams.forEach(t => t.forEach(p => deltaMap.set(p.id, 0)));

  const numTeams = teams.length;

  // Pairwise comparisons
  for (let i = 0; i < numTeams; i++) {
    for (let j = i + 1; j < numTeams; j++) {
      const rankI = placements[i];
      const rankJ = placements[j];

      // Lower rank number = better placement
      const scoreI = rankI < rankJ ? 1 : rankI > rankJ ? 0 : 0.5;
      const scoreJ = 1 - scoreI;

      const eI = expectedScore(teamElos[i], teamElos[j]);
      const eJ = 1 - eI;

      // Update team I players
      for (const p of teams[i]) {
        const k = kForGames(p.games);
        const diff = scoreI - eI;
        const factor = diff >= 0 ? WIN_FACTOR : LOSS_FACTOR;
        const d = k * diff * factor;
        deltaMap.set(p.id, (deltaMap.get(p.id) ?? 0) + d);
      }

      // Update team J players
      for (const p of teams[j]) {
        const k = kForGames(p.games);
        const diff = scoreJ - eJ;
        const factor = diff >= 0 ? WIN_FACTOR : LOSS_FACTOR;
        const d = k * diff * factor;
        deltaMap.set(p.id, (deltaMap.get(p.id) ?? 0) + d);
      }
    }
  }

  // Normalize by (numTeams - 1) so total magnitude stays consistent
  const norm = numTeams - 1;
  const deltas: Record<string, number> = {};
  const pointGains: Record<string, number> = {};
  const updatedPlayers: Player[] = [];

  for (let ti = 0; ti < numTeams; ti++) {
    for (const p of teams[ti]) {
      const rawDelta = (deltaMap.get(p.id) ?? 0) / norm;
      const roundedDelta = Math.round(rawDelta);
      deltas[p.name] = roundedDelta;

      const newPlacements: [number, number, number, number, number] = [...p.placements] as [number, number, number, number, number];
      const placeIdx = placements[ti] - 1; // 0-indexed
      if (placeIdx >= 0 && placeIdx < 5) {
        newPlacements[placeIdx]++;
      }

      // Placement points for this session
      const placePts = PLACEMENT_POINTS[placeIdx] ?? 0;
      // LMS bonus — male 1st/2nd at [0]/[1], female 1st/2nd at [2]/[3]
      let lmsBonus = 0;
      if (lmsFinishers[0] === p.name || lmsFinishers[2] === p.name) lmsBonus = LMS_POINTS[0];
      else if (lmsFinishers[1] === p.name || lmsFinishers[3] === p.name) lmsBonus = LMS_POINTS[1];

      const sessionGain = placePts;
      pointGains[p.name] = sessionGain;

      updatedPlayers.push({
        ...p,
        elo: Math.max(0, p.elo + roundedDelta),
        games: p.games + 1,
        placements: newPlacements,
        lastDelta: roundedDelta,
        pts: p.pts + placePts,
        lastGain: sessionGain,
        lms: p.lms + lmsBonus,
        prevRank: p.prevRank, // preserved; overwritten in handleRecordMatch
        streak: p.streak + 1,
      });
    }
  }

  // Build session teams sorted by placement
  const sessionTeams = teams.map((t, i) => ({
    rank: placements[i] as 1 | 2 | 3 | 4 | 5,
    players: t.map(p => p.name),
  })).sort((a, b) => a.rank - b.rank);

  const session: Session = {
    label,
    date: new Date().toISOString().split('T')[0],
    teams: sessionTeams,
    eloDeltas: deltas,
    pointGains,
    lms: lmsFinishers,
    ...(manualChanges.length > 0 ? { manualChanges } : {}),
  };

  return { players: updatedPlayers, session, deltas };
}

/**
 * Preview ELO deltas without applying them.
 */
export function previewMatchDeltas(
  teams: Player[][],
  placements: number[],
  settings: Settings,
  lmsFinishers: [string | null, string | null, string | null, string | null] = [null, null, null, null]
): Record<string, number> {
  const { deltas } = applyMatchResults(teams, placements, '', settings, lmsFinishers);
  return deltas;
}

export function defaultSettings(): Settings {
  return {
    genderWeight: 50,
    genderBalanceWeight: 120,
    unequalBonus: 30,
    provGames: 10,
    vetProvGames: 20,
    superVetProvGames: 30,
    vetStartElo: 1100,
    superVetStartElo: 1200,
    baseElo: 1000,
  };
}

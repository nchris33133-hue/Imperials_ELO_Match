import { Player, AppState } from './types';
import { defaultSettings } from './elo';

const STORAGE_KEY = 'vi_elo_v8';
const SEED_MERGE_KEY = 'vi_seed_merge_v1';

function migratePlacements(p: any): [number, number, number, number, number] {
  const pl = p.placements ?? [0, 0, 0, 0, 0];
  if (pl.length === 4) return [...pl, 0] as [number, number, number, number, number];
  if (pl.length === 5) return pl as [number, number, number, number, number];
  return [0, 0, 0, 0, 0];
}

function migratePlayerFields(p: any): Partial<Player> {
  return {
    pts: p.pts ?? 0,
    lastGain: p.lastGain ?? null,
    lms: p.lms ?? 0,
    prevRank: p.prevRank ?? null,
    streak: p.streak ?? 0,
  };
}

export function normalizePlayers(raw: any[]): Player[] {
  return raw.map(p => ({
    ...p,
    veteran: p.veteran === true ? 1 : p.veteran === false ? 0 : p.veteran,
    placements: migratePlacements(p),
    ...migratePlayerFields(p),
  }));
}

export function loadState(seedPlayers: Player[]): AppState {
  if (typeof window === 'undefined') return defaultState(seedPlayers);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState(seedPlayers);
    const loaded = JSON.parse(raw);
    let players = (loaded.players ?? seedPlayers).map((p: any) => ({
      ...p,
      placements: migratePlacements(p),
      ...migratePlayerFields(p),
    }));

    // One-time merge: apply pts/lms/streak/lastGain from seed (Excel import) into localStorage players
    if (!localStorage.getItem(SEED_MERGE_KEY)) {
      const seedByName = new Map(seedPlayers.map(s => [s.name, s]));
      players = players.map((p: any) => {
        const seed = seedByName.get(p.name);
        if (seed) {
          return {
            ...p,
            pts: seed.pts,
            lms: seed.lms,
            streak: seed.streak,
            lastGain: seed.lastGain,
          };
        }
        return p;
      });
      localStorage.setItem(SEED_MERGE_KEY, '1');
    }

    return {
      players,
      nextId: loaded.nextId ?? seedPlayers.length + 1,
      settings: { ...defaultSettings(), ...(loaded.settings ?? {}) },
      sessions: loaded.sessions ?? [],
    };
  } catch {
    return defaultState(seedPlayers);
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultState(seedPlayers: Player[]): AppState {
  return {
    players: seedPlayers,
    nextId: seedPlayers.length + 1,
    settings: defaultSettings(),
    sessions: [],
  };
}

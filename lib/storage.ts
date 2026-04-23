import { Player, AppState } from './types';
import { defaultSettings } from './elo';
import { supabase, SUPABASE_TABLE, STATE_ROW_ID } from './supabase';

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
    buddyGroup: p.buddyGroup ?? null,
  };
}

/** Normalize raw player data (from seed JSON or loaded state) */
export function normalizePlayers(raw: any[]): Player[] {
  return raw.map(p => ({
    ...p,
    veteran: p.veteran === true ? 1 : p.veteran === false ? 0 : p.veteran,
    placements: migratePlacements(p),
    ...migratePlayerFields(p),
  }));
}

/** Migrate players from a loaded state blob */
function migratePlayers(loaded: any, seedPlayers: Player[]): Player[] {
  let players = (loaded.players ?? seedPlayers).map((p: any) => ({
    ...p,
    placements: migratePlacements(p),
    ...migratePlayerFields(p),
  }));
  return players;
}

/** Apply one-time seed merge (Excel import) if not already done */
function applySeedMerge(players: Player[], seedPlayers: Player[]): Player[] {
  if (typeof window === 'undefined') return players;
  if (localStorage.getItem(SEED_MERGE_KEY)) return players;

  const seedByName = new Map(seedPlayers.map(s => [s.name, s]));
  const merged = players.map((p: any) => {
    const seed = seedByName.get(p.name);
    if (seed) {
      return { ...p, pts: seed.pts, lms: seed.lms, streak: seed.streak, lastGain: seed.lastGain };
    }
    return p;
  });
  localStorage.setItem(SEED_MERGE_KEY, '1');
  return merged;
}

function migrateSettings(loadedSettings: any): any {
  const s = { ...(loadedSettings ?? {}) };
  // unequalBonus (flat bonus on smaller team) → rosterDepthBonus (per-player gap)
  if (s.unequalBonus !== undefined && s.rosterDepthBonus === undefined) {
    s.rosterDepthBonus = Math.round(s.unequalBonus / 2);
  }
  delete s.unequalBonus;
  return s;
}

function buildState(loaded: any, seedPlayers: Player[]): AppState {
  let players = migratePlayers(loaded, seedPlayers);
  players = applySeedMerge(players, seedPlayers);
  // One-time: roll historical LMS bonus into accumulated pts so "total points" includes BP
  let ptsIncludeLms = loaded.ptsIncludeLms === true;
  if (!ptsIncludeLms) {
    players = players.map(p => ({ ...p, pts: p.pts + (p.lms ?? 0) }));
    ptsIncludeLms = true;
  }
  // Derive nextBuddyGroupId: max existing group + 1 (or 1 if none)
  const maxGroup = players.reduce((m: number, p: Player) => (p.buddyGroup ?? 0) > m ? p.buddyGroup! : m, 0);
  return {
    players,
    nextId: loaded.nextId ?? seedPlayers.length + 1,
    nextBuddyGroupId: loaded.nextBuddyGroupId ?? maxGroup + 1,
    ptsIncludeLms,
    settings: { ...defaultSettings(), ...migrateSettings(loaded.settings) },
    sessions: loaded.sessions ?? [],
  };
}

function defaultState(seedPlayers: Player[]): AppState {
  return {
    players: seedPlayers,
    nextId: seedPlayers.length + 1,
    nextBuddyGroupId: 1,
    ptsIncludeLms: true,
    settings: defaultSettings(),
    sessions: [],
  };
}

// --------------- Load ---------------

/** Load state: try Supabase first, fall back to localStorage, then seed */
export async function loadStateAsync(seedPlayers: Player[]): Promise<AppState> {
  // Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('state')
        .eq('id', STATE_ROW_ID)
        .single();

      if (!error && data?.state) {
        const state = buildState(data.state, seedPlayers);
        // Also cache to localStorage
        saveToLocalStorage(state);
        return state;
      }
    } catch {
      // Fall through to localStorage
    }
  }

  // Fall back to localStorage
  return loadFromLocalStorage(seedPlayers);
}

function loadFromLocalStorage(seedPlayers: Player[]): AppState {
  if (typeof window === 'undefined') return defaultState(seedPlayers);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState(seedPlayers);
    return buildState(JSON.parse(raw), seedPlayers);
  } catch {
    return defaultState(seedPlayers);
  }
}

// Keep the sync version for backwards compat (used nowhere critical now)
export function loadState(seedPlayers: Player[]): AppState {
  return loadFromLocalStorage(seedPlayers);
}

// --------------- Save ---------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Save state to both Supabase and localStorage (debounced Supabase write) */
export function saveState(state: AppState): void {
  saveToLocalStorage(state);
  debouncedSaveToSupabase(state);
}

function saveToLocalStorage(state: AppState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function debouncedSaveToSupabase(state: AppState): void {
  if (!supabase) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToSupabase(state);
  }, 500);
}

async function saveToSupabase(state: AppState): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from(SUPABASE_TABLE)
      .upsert({
        id: STATE_ROW_ID,
        state,
        updated_at: new Date().toISOString(),
      });
  } catch {
    // Silent fail — localStorage is the fallback
  }
}

// --------------- Real-time ---------------

/** Subscribe to real-time changes from Supabase. Returns unsubscribe function. */
export function subscribeToChanges(
  seedPlayers: Player[],
  onUpdate: (state: AppState) => void
): (() => void) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: SUPABASE_TABLE,
        filter: `id=eq.${STATE_ROW_ID}`,
      },
      (payload) => {
        const newData = (payload.new as any)?.state;
        if (newData) {
          const state = buildState(newData, seedPlayers);
          saveToLocalStorage(state);
          onUpdate(state);
        }
      }
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

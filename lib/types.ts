export type Gender = 'M' | 'F';
export type VetLevel = 0 | 1 | 2;

export interface Player {
  id: number;
  name: string;
  gender: Gender;
  elo: number;
  games: number;
  placements: [number, number, number, number, number];
  veteran: VetLevel;
  lastDelta: number | null;
  /** Accumulated placement points (3/2.5/2/1.5/1 per session) */
  pts: number;
  /** Points gained in last session (placement + LMS) */
  lastGain: number | null;
  /** Accumulated Last Man/Woman Standing bonus points */
  lms: number;
  /** Previous rank position (for computing rank change on export) */
  prevRank: number | null;
  /** Consecutive sessions attended (resets to 0 if player misses a session) */
  streak: number;
}

export interface TeamChangeEntry {
  type: 'move' | 'remove' | 'add';
  player: string;
  from?: string;
  to?: string;
  reason: string;
  timestamp: string;
}

export interface SessionTeam {
  rank: 1 | 2 | 3 | 4 | 5;
  players: string[];
  name?: string;
  color?: string;
}

export interface Session {
  label: string;
  date: string;
  teams: SessionTeam[];
  eloDeltas?: Record<string, number>;
  /** Points gained per player this session (placement + LMS) */
  pointGains?: Record<string, number>;
  /** LMS finishers: [male 1st, male 2nd, female 1st, female 2nd] */
  lms?: [string | null, string | null, string | null, string | null];
  /** Snapshot of all players before this match was applied (for rollback) */
  preMatchPlayers?: Player[];
  /** Audit log of manual team changes made after balancing */
  manualChanges?: TeamChangeEntry[];
}

export interface Settings {
  genderWeight: number;
  genderBalanceWeight: number;
  unequalBonus: number;
  provGames: number;
  vetProvGames: number;
  superVetProvGames: number;
  vetStartElo: number;
  superVetStartElo: number;
  baseElo: number;
}

export interface AppState {
  players: Player[];
  nextId: number;
  settings: Settings;
  sessions: Session[];
}

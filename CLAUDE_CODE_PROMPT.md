# CLAUDE CODE PROMPT — Vienna Imperials ELO System

## Mission

Rebuild the Vienna Imperials ELO ranking and team-balancing tool as a **Next.js app deployable to Vercel**, replacing the current single-file HTML prototype. Preserve all business logic exactly. Add localStorage persistence on the client.

Read `HANDOFF.md` in full before starting. It contains the complete specification of the ELO system, team builder algorithm, data models, and known edge cases.

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript throughout
- **Styling**: Tailwind CSS
- **State**: React state + localStorage (no backend required — this is a client-only app)
- **Fonts**: Google Fonts — `Bebas Neue` (headings), `IBM Plex Mono` (numbers), `DM Sans` (body)
- **Deployment**: Vercel (static export or edge runtime is fine)

No database, no auth, no API routes needed. Everything runs in the browser.

---

## Design System

Replicate the existing dark theme exactly:

```css
--bg: #070a13
--s1: #0c1220   /* card background */
--s2: #121b2e   /* input/hover background */
--s3: #1a2540   /* subtle fill */
--bo: #1e2e48   /* border */
--acc: #F5C518  /* yellow accent */
--red: #ff4757
--blu: #00b4d8
--grn: #2ecc71
--tx:  #c8d8ec  /* body text */
--dm:  #3d5270  /* muted text */

/* Tier colours */
--bronze:   #e8943a
--silver:   #9eb4cc
--gold:     #F5C518
--platinum: #00b4d8
--diamond:  #cc80ff

/* Team colours (5 teams) */
--c1: #00b4d8
--c2: #ff4757
--c3: #2ecc71
--c4: #f39c12
--c5: #cc80ff
```

---

## Project Structure

```
/
├── app/
│   ├── layout.tsx          # root layout, fonts, dark bg
│   ├── page.tsx            # tab shell (Rankings default)
│   └── globals.css
├── components/
│   ├── Rankings.tsx
│   ├── Roster.tsx
│   ├── TeamBuilder.tsx
│   ├── History.tsx
│   └── Settings.tsx
├── lib/
│   ├── elo.ts              # ALL ELO logic (pure functions)
│   ├── balancer.ts         # team builder algorithm
│   ├── types.ts            # shared TypeScript types
│   └── storage.ts          # localStorage read/write
├── data/
│   ├── players.json        # seed — 100 players (see below)
│   └── history.json        # seed — 17 sessions (see below)
└── HANDOFF.md
```

---

## TypeScript Types

```typescript
// lib/types.ts

export type Gender = 'M' | 'F';
export type VetLevel = 0 | 1 | 2;  // 0=regular, 1=veteran, 2=super veteran

export interface Player {
  id: number;
  name: string;
  gender: Gender;
  elo: number;
  games: number;
  placements: [number, number, number, number]; // [1st, 2nd, 3rd, 4th] counts
  veteran: VetLevel;
  lastDelta: number | null;
}

export interface SessionTeam {
  rank: 1 | 2 | 3 | 4;
  players: string[];
}

export interface Session {
  label: string;
  date: string; // ISO
  teams: SessionTeam[];
}

export interface Settings {
  genderWeight: number;        // default 50
  genderBalanceWeight: number; // default 120
  unequalBonus: number;        // default 30
  provGames: number;           // default 10
  vetProvGames: number;        // default 20
  superVetProvGames: number;   // default 30
  vetStartElo: number;         // default 1100
  superVetStartElo: number;    // default 1200
  baseElo: number;             // default 1000
}

export interface AppState {
  players: Player[];
  nextId: number;
  settings: Settings;
}
```

---

## ELO Logic — `lib/elo.ts`

Implement these pure functions exactly:

```typescript
export const WIN_FACTOR  = 1.15;
export const LOSS_FACTOR = 0.85;

// K decreases with experience
export function kForGames(games: number): number {
  if (games < 10) return 40;
  if (games < 20) return 32;
  if (games < 30) return 26;
  return 20;
}

export function vetLevel(p: Player): VetLevel {
  if (p.veteran === 2) return 2;
  if (p.veteran === true || p.veteran === 1) return 1;
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
  if (elo >= 1350) return { key: 'di', label: 'Diamond',  cls: 'tier-di' };
  if (elo >= 1200) return { key: 'pl', label: 'Platinum', cls: 'tier-pl' };
  if (elo >= 1100) return { key: 'go', label: 'Gold',     cls: 'tier-go' };
  if (elo >= 950)  return { key: 'si', label: 'Silver',   cls: 'tier-si' };
  return                   { key: 'br', label: 'Bronze',  cls: 'tier-br' };
}

export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Team effective ELO used for win probability and team score display
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
```

---

## Team Balancer — `lib/balancer.ts`

```typescript
// Three-phase algorithm — implement exactly as described:

export function balanceNTeams(players: Player[], n: number, settings: Settings): Player[][] {
  // Phase 1: compute strict target sizes
  const total = players.length;
  const base = Math.floor(total / n);
  const extras = total % n;
  const teamSizes = Array.from({ length: n }, (_, i) => base + (i < extras ? 1 : 0));

  // Sort by gender-adjusted score (FULL genderWeight, not half)
  const gw = settings.genderWeight;
  const scored = [...players]
    .map(p => ({ ...p, _s: p.elo + (p.gender === 'M' ? gw : -gw) }))
    .sort((a, b) => b._s - a._s);

  const women = scored.filter(p => p.gender === 'F');
  const men   = scored.filter(p => p.gender === 'M');

  // Phase 1: snake-draft women across teams
  const teams: Player[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < women.length; i++) {
    const round = Math.floor(i / n);
    const pos = round % 2 === 0 ? (i % n) : (n - 1 - (i % n));
    teams[pos].push(women[i]);
  }

  // Phase 2: fill men greedily to weakest team with room
  const remaining = [...men];
  while (remaining.length) {
    const open = teams
      .map((t, i) => ({ i, room: teamSizes[i] - t.length, elo: teamEffectiveElo(t, false, settings) }))
      .filter(x => x.room > 0)
      .sort((a, b) => a.elo - b.elo);
    if (!open.length) break;
    teams[open[0].i].push(remaining.shift()!);
  }

  // Phase 3: swap optimisation minimising totalCost
  // totalCost = eloCost + genderCost
  // eloCost   = sum of |eloA - eloB| for all team pairs
  // genderCost = genderBalanceWeight × (maxF - minF)²
  const cost = (ts: Player[][]): number => {
    let elo = 0;
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++)
        elo += Math.abs(teamEffectiveElo(ts[i], false, settings) - teamEffectiveElo(ts[j], false, settings));
    const counts = ts.map(t => t.filter(p => p.gender === 'F').length);
    const spread = Math.max(...counts) - Math.min(...counts);
    return elo + settings.genderBalanceWeight * spread * spread;
  };

  let improved = true, iter = 0;
  while (improved && iter++ < 400) {
    improved = false;
    outer: for (let ti = 0; ti < n; ti++) {
      for (let tj = ti + 1; tj < n; tj++) {
        const cur = cost(teams);
        for (let pi = 0; pi < teams[ti].length; pi++) {
          for (let pj = 0; pj < teams[tj].length; pj++) {
            const nTi = [...teams[ti].slice(0, pi), teams[tj][pj], ...teams[ti].slice(pi + 1)];
            const nTj = [...teams[tj].slice(0, pj), teams[ti][pi], ...teams[tj].slice(pj + 1)];
            const test = teams.map((t, k) => k === ti ? nTi : k === tj ? nTj : t);
            if (cost(test) < cur - 0.5) {
              teams[ti] = nTi; teams[tj] = nTj;
              improved = true; break outer;
            }
          }
        }
      }
    }
  }
  return teams;
}
```

---

## Storage — `lib/storage.ts`

```typescript
const STORAGE_KEY = 'vi_elo_v8';

export function loadState(seedPlayers: Player[]): AppState {
  if (typeof window === 'undefined') return defaultState(seedPlayers);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState(seedPlayers);
    const loaded = JSON.parse(raw);
    return {
      players: loaded.players ?? seedPlayers,
      nextId: loaded.nextId ?? seedPlayers.length + 1,
      settings: { ...defaultSettings(), ...(loaded.settings ?? {}) },
    };
  } catch {
    return defaultState(seedPlayers);
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Bump STORAGE_KEY (e.g. v9) whenever seed data changes to force fresh load
```

---

## Component Specs

### Rankings
- Sort players by `elo` descending
- Columns: `#` · Tier badge · Name + gender tag · ELO (mono) · ±Last delta · Placements (🥇🥈🥉④) · Status tag
- Tier dividers between groups
- Status tags: `PROV` (red), `VET` (gold), `S·VET` (purple)
- Legend footer
- 4-stat overview cards: Players / Sessions / Avg ELO / Top ELO

### Roster
- Add player form: name, gender select, veteran level select (Regular/Veteran/Super Veteran)
- Table with inline gender dropdown and veteran-level dropdown per row
- Changing veteran level: `newElo = currentElo + (eloMap[newLevel] - eloMap[oldLevel])`
- Delete button per row (with confirm)
- Callout explaining gender was auto-assigned

### Team Builder
- Search input to filter player list
- Team count selector: 2 / 3 / 4 / 5 buttons
- Player grid with checkboxes (show name, gender, ELO, status tag)
- Constraints: min `n×5`, max `n×6`. Show count in red if out of range.
- "Balance N Teams" button (disabled when out of range)
- Result: N team cards in responsive grid, each showing effective ELO, M/F count, player list
- Summary row: ELO gaps between all pairs + gender distribution with ✓ Even / ⚠ indicator
- "Regenerate" button

### History
- Collapsible sessions (oldest at bottom, newest at top)
- Each session: label, team count, total players, expandable team cards by placement rank
- Show only placements 1–4 (5th not tracked)

### Settings
- All settings from the Settings spec above as sliders/number inputs
- Reset button (restores seed data)
- Methodology explanation section

---

## Seed Data

Copy `data/players.json` and `data/history.json` directly from the project files (`players_v5.json` and `history_v5.json` in the source). Import them in the relevant components/storage.

Important: the seed `veteran` field uses `true`/`false` from the original Python export. Normalise on load:
```typescript
veteran: p.veteran === true ? 1 : p.veteran === false ? 0 : p.veteran
```

---

## Vercel Deployment Notes

- This is a **pure client-side app** — no API routes, no server state
- Use `output: 'export'` in `next.config.js` for static export, OR just deploy normally (Vercel handles Next.js natively)
- No environment variables needed
- The existing site is at `imperials-dodgeball.vercel.app` — this tool should live at `/rankings` or as a standalone deployment

---

## What NOT to Change

- The ELO formula, K schedule, asymmetric factors, and pairwise session math — these are deliberate design decisions explained in HANDOFF.md
- The gender balance algorithm — specifically that gender-adjusted sort uses **full** genderWeight (not half), and that women are distributed before men
- The strict 5–6 player per team constraint — this is a hard club requirement
- The LMS bonus stripping logic (relevant if you re-seed from XLS)
- 5th place not being tracked (indistinguishable from absent in source data)

---

## Suggested Enhancements (out of scope for initial build, listed for reference)

- Admin mode to record new sessions directly in the app and append to history
- Per-player profile page showing ELO history chart
- Export to JSON / copy-to-clipboard for sharing team splits
- Integration with the main imperials-dodgeball.vercel.app site (shared header/nav)

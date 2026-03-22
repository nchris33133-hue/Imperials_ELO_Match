# Vienna Imperials — ELO Ranking System Handoff

## What This Is

A ranking and team-balancing tool for the Vienna Imperials Dodgeball Club's Social League. It ships as a single self-contained HTML file and is ready to be rebuilt as a proper Vercel app. The core data (100 players, 17 historical sessions) was computed from the club's Excel standings sheet (`Social_League_platzierungen.xlsx`).

---

## Current State

- **100 players** seeded from Social League history
- **17 sessions** of historical ELO data computed and baked in
- **ELO range**: 898–1143 (base 1000)
- **15 players** with 10+ sessions (established)
- Single HTML file with all logic, styles, and data inline — no build step, no dependencies beyond Google Fonts

---

## The ELO System

### Starting ELO

| Level | Starting ELO | K provisional window |
|---|---|---|
| Regular | 1000 | 10 sessions |
| Veteran | 1100 | 20 sessions |
| Super Veteran | 1200 | 30 sessions |

### K-Factor Schedule (LoL-inspired)

| Sessions played | K |
|---|---|
| 0–9 | 40 (provisional, fast placement) |
| 10–19 | 32 (established) |
| 20–29 | 26 (experienced) |
| 30+ | 20 (stable veteran) |

### Asymmetric Gains/Losses

Wins earn **×1.15**, losses cost **×0.85**. This gives a mild positive incentive for consistent participation — mirrors League of Legends LP system.

### Multi-Team Pairwise ELO

Each session has 2–5 teams ranked 1st–4th (5th not tracked — indistinguishable from absent in source data). Every pair of teams generates a head-to-head ELO calculation:

```
K_per_pair = K_base ÷ (n_teams − 1)
```

This keeps max gain/loss constant regardless of how many teams played (~+K/2 for 1st, ~-K/2 for last at even odds).

### Gender Adjustment (ELO calc only)

Each team's **effective ELO** for win probability:
```
effective_elo = avg(individual ELOs) 
              + genderWeight × (net_male_ratio)
              + unequalBonus (if this team is smaller, e.g. 5v6)
```

Default `genderWeight = 50`. Does **not** move individual ratings — only affects match outcome predictions.

### LMS Bonus Handling

The spreadsheet adds +1 pt (Last Man/Woman Standing winner) and +0.5 pt (LMS 2nd) on top of team placement scores. The simulation strips these before grouping players into teams, so players on the same team are correctly grouped regardless of individual bonuses.

### Last-Place Ambiguity

A missing score (0 pts) in the spreadsheet means either **absent** or **last place** — indistinguishable. So 5th place is not tracked and no last-place ELO penalty was applied to historical data.

---

## Team Builder Logic

### Constraints
- Min 5 players per team, max 6
- Valid range for N teams: `N×5` to `N×6` players selected
- Supports 2, 3, 4, or 5 teams

### Algorithm (3 phases)

**Phase 1 — Gender distribution first**
Women are snake-drafted across teams independently before any men are placed. Strongest woman → Team A, 2nd → Team B, etc. This guarantees women are spread before ELO balancing begins.

**Phase 2 — Men fill greedily**
Men are assigned to whichever team currently has the lowest effective ELO, up to that team's target size (`floor(total/n)` or `ceil(total/n)`). Team sizes are fixed before this phase starts and never deviate.

**Phase 3 — Swap optimisation**
Iterative pairwise swaps (up to 400 iterations) minimise a combined cost:
```
totalCost = eloCost + genderCost

eloCost     = sum of |eloA - eloB| across all team pairs
genderCost  = genderBalanceWeight × (maxFemaleCount - minFemaleCount)²
```

Default `genderBalanceWeight = 120`. Squaring the gender spread makes large imbalances very expensive. Swaps are always between two players of different teams — team sizes are invariant throughout.

### Scoring for Sort/Balance

Uses **full** `genderWeight` (not half) in the sort:
```
player_score = elo + (gender === 'M' ? genderWeight : -genderWeight)
```

---

## Settings (all tunable)

| Setting | Default | Effect |
|---|---|---|
| genderWeight | 50 | ELO pts for gender composition in win probability |
| genderBalanceWeight | 120 | How hard team builder enforces even F distribution |
| unequalBonus | 30 | ELO bonus for smaller team in 5v6 |
| provGames | 10 | Standard provisional window |
| vetProvGames | 20 | Veteran provisional window |
| superVetProvGames | 30 | Super Veteran provisional window |
| vetStartElo | 1100 | Veteran starting ELO |
| superVetStartElo | 1200 | Super Veteran starting ELO |
| baseElo | 1000 | Regular starting ELO |

Changing veteran status adds/subtracts the ELO delta to current score (does not reset game history).

---

## Data Model

### Player
```typescript
{
  id: number,
  name: string,
  gender: 'M' | 'F',
  elo: number,
  games: number,          // sessions attended
  placements: [number, number, number, number],  // [1st, 2nd, 3rd, 4th] counts
  veteran: 0 | 1 | 2,    // 0=regular, 1=veteran, 2=super veteran
  lastDelta: number | null
}
```

### Session (history)
```typescript
{
  label: string,          // human-readable name
  date: string,           // ISO date
  teams: [
    { rank: 1 | 2 | 3 | 4, players: string[] }
  ]
}
```

---

## Tabs / Features

| Tab | What it does |
|---|---|
| 🏆 Rankings | Live ELO leaderboard. Tier badges (Bronze/Silver/Gold/Platinum/Diamond), placement history (🥇🥈🥉④), PROV/VET/S·VET tags, last-session delta |
| 👥 Roster | Add/remove players. Inline gender and veteran-level dropdowns. Changing veteran level adjusts ELO by the tier delta. |
| ⚖️ Teams | Select present players (search + checkboxes), pick 2–5 teams, balance button enforces 5–6 per team with even gender spread |
| 📋 History | 17 historical sessions, collapsible, showing team rosters by placement |
| ⚙️ Settings | All tunable parameters + ELO methodology explanation |

---

## Persistence

Uses `localStorage` key `vi_elo_v8`. Bump the key whenever seed data changes to force a fresh load on existing browsers.

---

## Files

- `imperials-elo-v8.html` — the full working single-file app
- `players_v5.json` — computed player data (seed)
- `history_v5.json` — computed session history (seed)
- `Social_League_platzierungen.xlsx` — original source data
- `CLAUDE_CODE_PROMPT.md` — rebuild spec for Claude Code

---

## Known Limitations / Future Work

- No backend — all state lives in localStorage. Multi-device sync not possible without a DB.
- Gender assignments for ~30 single-name players were inferred from first name and may need manual correction in the Roster tab.
- Sessions added via the UI currently don't feed back into the history tab (history is seeded from XLS only). A future version should merge live sessions into history.
- The `Social League X` session had non-standard scoring (8/6/5/4/3/2 pts instead of 3/2.5/2/1). The LMS-stripping logic falls back gracefully but the base-rank mapping is approximate for that session.

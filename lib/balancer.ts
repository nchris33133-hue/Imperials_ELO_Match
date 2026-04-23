import { Player, Settings } from './types';
import { teamEffectiveElo } from './elo';

export function balanceNTeams(players: Player[], n: number, settings: Settings): Player[][] {
  const total = players.length;
  const base = Math.floor(total / n);
  const extras = total % n;
  const teamSizes = Array.from({ length: n }, (_, i) => base + (i < extras ? 1 : 0));

  const women = [...players].filter(p => p.gender === 'F').sort((a, b) => b.elo - a.elo);
  const men = [...players].filter(p => p.gender === 'M').sort((a, b) => b.elo - a.elo);

  const teams: Player[][] = Array.from({ length: n }, () => []);

  // --- Step 1: Distribute men via snake draft to get initial ELO spread ---
  for (let i = 0; i < men.length; i++) {
    const round = Math.floor(i / n);
    const pos = round % 2 === 0 ? (i % n) : (n - 1 - (i % n));
    if (teams[pos].length < teamSizes[pos]) {
      teams[pos].push(men[i]);
    } else {
      // Find team with room that has lowest ELO
      const open = teams
        .map((t, idx) => ({ idx, room: teamSizes[idx] - t.length, elo: teamEffectiveElo(t, teamSizes, settings) }))
        .filter(x => x.room > 0)
        .sort((a, b) => a.elo - b.elo);
      if (open.length) teams[open[0].idx].push(men[i]);
    }
  }

  // --- Step 2: Determine female allocation — stronger teams get more females ---
  const femaleBase = Math.floor(women.length / n);
  const femaleExtras = women.length % n;
  // Rank teams by average ELO (descending) — strongest teams get the extra females
  const teamsByStrength = teams
    .map((t, i) => ({ i, avgElo: t.length ? t.reduce((s, p) => s + p.elo, 0) / t.length : 0 }))
    .sort((a, b) => b.avgElo - a.avgElo);
  const femaleSlots = Array(n).fill(femaleBase);
  for (let e = 0; e < femaleExtras; e++) {
    femaleSlots[teamsByStrength[e].i]++;
  }

  // --- Step 3: Assign females to teams, strongest first ---
  const strengthOrder = teamsByStrength.map(t => t.i);
  const displaced: Player[] = [];
  let wIdx = 0;
  for (const ti of strengthOrder) {
    const count = femaleSlots[ti];
    // Remove men from this team to make room for females
    while (teams[ti].length + count > teamSizes[ti] && teams[ti].length > 0) {
      const weakest = teams[ti]
        .map((p, pi) => ({ p, pi }))
        .filter(x => x.p.gender === 'M')
        .sort((a, b) => a.p.elo - b.p.elo)[0];
      if (!weakest) break;
      teams[ti].splice(weakest.pi, 1);
      displaced.push(weakest.p);
    }
    for (let f = 0; f < count && wIdx < women.length; f++) {
      teams[ti].push(women[wIdx++]);
    }
  }

  // --- Step 4: Fill displaced men into teams with open slots (lowest ELO first) ---
  displaced.sort((a, b) => b.elo - a.elo);
  for (const m of displaced) {
    const open = teams
      .map((t, i) => ({ i, room: teamSizes[i] - t.length, elo: teamEffectiveElo(t, teamSizes, settings) }))
      .filter(x => x.room > 0)
      .sort((a, b) => a.elo - b.elo);
    if (!open.length) break;
    teams[open[0].i].push(m);
  }

  // --- Unify buddy groups: move split group members together where possible ---
  unifyBuddies(teams);

  const cost = (ts: Player[][]): number => {
    let elo = 0;
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++)
        elo += Math.abs(teamEffectiveElo(ts[i], teamSizes, settings) - teamEffectiveElo(ts[j], teamSizes, settings));
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
          // Don't break up buddy groups during swap-optimization
          if (teams[ti][pi].buddyGroup != null) continue;
          for (let pj = 0; pj < teams[tj].length; pj++) {
            if (teams[tj][pj].buddyGroup != null) continue;
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

/**
 * Move split buddy-group members together via swaps with same-gender non-buddied
 * partners. Each group ends up on the team where the plurality of its members
 * already sit. Best-effort — leaves a group split if no valid swap partner exists.
 */
function unifyBuddies(teams: Player[][]): void {
  // groupId -> teamIdx -> members on that team
  const byGroup = new Map<number, Map<number, Player[]>>();
  teams.forEach((team, ti) => {
    for (const p of team) {
      if (p.buddyGroup == null) continue;
      let m = byGroup.get(p.buddyGroup);
      if (!m) { m = new Map(); byGroup.set(p.buddyGroup, m); }
      const list = m.get(ti) ?? [];
      list.push(p);
      m.set(ti, list);
    }
  });

  for (const [, teamMap] of byGroup) {
    if (teamMap.size <= 1) continue; // already unified
    // Target = team already holding the most group members
    const entries = [...teamMap.entries()].sort((a, b) => b[1].length - a[1].length);
    const targetTi = entries[0][0];
    for (let e = 1; e < entries.length; e++) {
      const [sourceTi, members] = entries[e];
      for (const member of members) {
        const candidates = teams[targetTi]
          .filter(p => p.buddyGroup == null)
          .sort((a, b) => {
            const sameGenderA = a.gender === member.gender ? 0 : 1;
            const sameGenderB = b.gender === member.gender ? 0 : 1;
            if (sameGenderA !== sameGenderB) return sameGenderA - sameGenderB;
            return Math.abs(a.elo - member.elo) - Math.abs(b.elo - member.elo);
          });
        if (candidates.length === 0) continue; // leave split
        const partner = candidates[0];
        teams[sourceTi] = teams[sourceTi].filter(p => p.id !== member.id).concat(partner);
        teams[targetTi] = teams[targetTi].filter(p => p.id !== partner.id).concat(member);
      }
    }
  }
}

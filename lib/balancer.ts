import { Player, Settings } from './types';
import { teamEffectiveElo } from './elo';

export function balanceNTeams(players: Player[], n: number, settings: Settings): Player[][] {
  const total = players.length;
  const base = Math.floor(total / n);
  const extras = total % n;
  const teamSizes = Array.from({ length: n }, (_, i) => base + (i < extras ? 1 : 0));

  const gw = settings.genderWeight;
  const scored = [...players]
    .map(p => ({ ...p, _s: p.elo + (p.gender === 'M' ? gw : -gw) }))
    .sort((a, b) => b._s - a._s);

  const women = scored.filter(p => p.gender === 'F');
  const men = scored.filter(p => p.gender === 'M');

  const teams: Player[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < women.length; i++) {
    const round = Math.floor(i / n);
    const pos = round % 2 === 0 ? (i % n) : (n - 1 - (i % n));
    teams[pos].push(women[i]);
  }

  const remaining = [...men];
  while (remaining.length) {
    const open = teams
      .map((t, i) => ({ i, room: teamSizes[i] - t.length, elo: teamEffectiveElo(t, false, settings) }))
      .filter(x => x.room > 0)
      .sort((a, b) => a.elo - b.elo);
    if (!open.length) break;
    teams[open[0].i].push(remaining.shift()!);
  }

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

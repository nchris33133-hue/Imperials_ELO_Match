import * as XLSX from 'xlsx';
import { Player } from './types';
import { getTier } from './elo';

/** Map internal ELO tiers to the 4-tier public system */
function mapTier(elo: number): string {
  const { key } = getTier(elo);
  if (key === 'di' || key === 'pl') return 'platinum';
  if (key === 'go') return 'gold';
  if (key === 'si') return 'silver';
  return 'bronze';
}

/**
 * Export players as XLSX in the Social League format.
 * Columns: Name, Points, Gain, Played, Streak, Gender, Tier, BP, Change
 * Sorted by Points descending, ELO as tiebreaker.
 */
export function downloadRankingsXLSX(players: Player[]): void {
  // Sort by placement points descending, ELO as tiebreaker
  const sorted = [...players].sort((a, b) => b.pts - a.pts || b.elo - a.elo);

  const rows = sorted.map((p, idx) => {
    const currentRank = idx + 1;
    const change = p.prevRank != null ? p.prevRank - currentRank : 0;

    return {
      Name: p.name,
      Points: p.pts,
      Gain: p.lastGain ?? 0,
      Played: p.games,
      Streak: p.streak,
      Gender: p.gender === 'M' ? 'male' : 'female',
      Tier: mapTier(p.elo),
      BP: p.lms,
      Change: change,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rankings');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `social-league-rankings-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

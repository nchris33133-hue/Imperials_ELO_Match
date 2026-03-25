'use client';

import { useState, useMemo } from 'react';
import { isProvisional, vetLevel, teamEffectiveElo, applyMatchResults, previewMatchDeltas } from '@/lib/elo';
import { balanceNTeams } from '@/lib/balancer';
import { generateTeamNames, regenerateTeamNames, type TeamNameResult } from '@/lib/teamNames';
import type { Player, Session, Settings, TeamChangeEntry } from '@/lib/types';

const RANK_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  5: '5th',
};

interface TeamBuilderProps {
  players: Player[];
  settings: Settings;
  onRecordMatch: (updatedPlayers: Player[], session: Session) => void;
  sessionCount: number;
}

export default function TeamBuilder({ players, settings, onRecordMatch, sessionCount }: TeamBuilderProps) {
  const [search, setSearch] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [teams, setTeams] = useState<Player[][] | null>(null);
  const [teamNames, setTeamNames] = useState<TeamNameResult[]>([]);

  // Match mode state
  const [matchMode, setMatchMode] = useState(false);
  const [placements, setPlacements] = useState<number[]>([]);
  const [sessionLabel, setSessionLabel] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [lmsMale1st, setLmsMale1st] = useState<string | null>(null);
  const [lmsMale2nd, setLmsMale2nd] = useState<string | null>(null);
  const [lmsFemale1st, setLmsFemale1st] = useState<string | null>(null);
  const [lmsFemale2nd, setLmsFemale2nd] = useState<string | null>(null);

  // Audit log for manual team changes
  const [manualChanges, setManualChanges] = useState<TeamChangeEntry[]>([]);
  const [pendingChange, setPendingChange] = useState<{
    type: 'move' | 'remove' | 'add';
    playerId: number;
    playerName: string;
    fromTeam?: number;
    toTeam?: number;
    fromTeamName?: string;
    toTeamName?: string;
  } | null>(null);
  const [changeReason, setChangeReason] = useState('');

  const filteredPlayers = useMemo(
    () =>
      players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [players, search]
  );

  const recommendedMin = teamCount * 5;
  const recommendedMax = teamCount * 6;
  const selectionInRange =
    selected.size >= recommendedMin && selected.size <= recommendedMax;
  const canBalance = selected.size >= teamCount;

  const togglePlayer = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setTeams(null);
    setMatchMode(false);
  };

  const handleBalance = () => {
    if (!canBalance) return;
    const selectedPlayers = players.filter((p) => selected.has(p.id));
    const result = balanceNTeams(selectedPlayers, teamCount, settings);
    setTeams(result);
    setTeamNames(generateTeamNames(teamCount));
    setMatchMode(false);
    setPlacements(new Array(teamCount).fill(0));
    setSessionLabel(`Session ${sessionCount + 1}`);
    setManualChanges([]);
  };

  const handleRegenerate = () => {
    if (!canBalance) return;
    const selectedPlayers = players.filter((p) => selected.has(p.id));
    const result = balanceNTeams(selectedPlayers, teamCount, settings);
    setTeams(result);
    setTeamNames(regenerateTeamNames(teamCount));
    setMatchMode(false);
    setPlacements(new Array(teamCount).fill(0));
    setManualChanges([]);
  };

  const handleStartMatch = () => {
    setMatchMode(true);
    setPlacements(new Array(teamCount).fill(0));
    setShowConfirm(false);
    setLmsMale1st(null);
    setLmsMale2nd(null);
    setLmsFemale1st(null);
    setLmsFemale2nd(null);
  };

  const handleCancelMatch = () => {
    setMatchMode(false);
    setPlacements(new Array(teamCount).fill(0));
    setShowConfirm(false);
    setLmsMale1st(null);
    setLmsMale2nd(null);
    setLmsFemale1st(null);
    setLmsFemale2nd(null);
  };

  const setPlacement = (teamIndex: number, rank: number) => {
    setPlacements((prev) => {
      const next = [...prev];
      next[teamIndex] = rank;
      return next;
    });
    setShowConfirm(false);
  };

  // Check if all placements are valid (all assigned, no duplicates)
  const allPlacementsValid = useMemo(() => {
    if (!teams) return false;
    const assigned = placements.filter((p) => p > 0);
    if (assigned.length !== teams.length) return false;
    const unique = new Set(assigned);
    return unique.size === assigned.length;
  }, [placements, teams]);

  // Preview deltas when placements are valid
  const previewDeltas = useMemo(() => {
    if (!teams || !allPlacementsValid) return null;
    return previewMatchDeltas(teams, placements, settings, [lmsMale1st, lmsMale2nd, lmsFemale1st, lmsFemale2nd]);
  }, [teams, placements, allPlacementsValid, settings, lmsMale1st, lmsMale2nd, lmsFemale1st, lmsFemale2nd]);

  const handleRecordResult = () => {
    if (!teams || !allPlacementsValid) return;
    const label = sessionLabel.trim() || `Session ${sessionCount + 1}`;
    const { players: updatedPlayers, session } = applyMatchResults(
      teams,
      placements,
      label,
      settings,
      [lmsMale1st, lmsMale2nd, lmsFemale1st, lmsFemale2nd],
      manualChanges,
      teamNames.map(t => ({ name: t.name, color: t.color }))
    );
    onRecordMatch(updatedPlayers, session);
    setTeams(null);
    setMatchMode(false);
    setSelected(new Set());
    setPlacements([]);
    setShowConfirm(false);
    setManualChanges([]);
  };

  const getStatusTags = (player: Player) => {
    const tags: { label: string; color: string }[] = [];
    if (isProvisional(player, settings)) {
      tags.push({ label: 'PROV', color: '#f39c12' });
    }
    const vl = vetLevel(player);
    if (vl === 2) tags.push({ label: 'S·VET', color: '#cc80ff' });
    else if (vl === 1) tags.push({ label: 'VET', color: '#2ecc71' });
    return tags;
  };

  // Players not currently in any team (available to add)
  const availablePlayers = useMemo(() => {
    if (!teams) return [];
    const inTeam = new Set(teams.flat().map(p => p.id));
    return players.filter(p => !inTeam.has(p.id));
  }, [teams, players]);

  // Request a manual change — opens the justification modal
  const requestMovePlayer = (playerId: number, fromTeam: number, toTeam: number) => {
    if (!teams || fromTeam === toTeam) return;
    const player = teams[fromTeam].find(p => p.id === playerId);
    if (!player) return;
    setPendingChange({
      type: 'move',
      playerId,
      playerName: player.name,
      fromTeam,
      toTeam,
      fromTeamName: teamNames[fromTeam]?.name || `Team ${fromTeam + 1}`,
      toTeamName: teamNames[toTeam]?.name || `Team ${toTeam + 1}`,
    });
    setChangeReason('');
  };

  const requestRemoveFromTeam = (playerId: number, teamIndex: number) => {
    if (!teams) return;
    const player = teams[teamIndex].find(p => p.id === playerId);
    if (!player) return;
    setPendingChange({
      type: 'remove',
      playerId,
      playerName: player.name,
      fromTeam: teamIndex,
      fromTeamName: teamNames[teamIndex]?.name || `Team ${teamIndex + 1}`,
    });
    setChangeReason('');
  };

  const requestAddToTeam = (playerId: number, teamIndex: number) => {
    if (!teams) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    setPendingChange({
      type: 'add',
      playerId,
      playerName: player.name,
      toTeam: teamIndex,
      toTeamName: teamNames[teamIndex]?.name || `Team ${teamIndex + 1}`,
    });
    setChangeReason('');
  };

  // Apply the pending change after justification is provided
  const confirmPendingChange = () => {
    if (!pendingChange || !changeReason.trim()) return;

    const entry: TeamChangeEntry = {
      type: pendingChange.type,
      player: pendingChange.playerName,
      reason: changeReason.trim(),
      timestamp: new Date().toISOString(),
    };

    if (pendingChange.type === 'move') {
      entry.from = pendingChange.fromTeamName;
      entry.to = pendingChange.toTeamName;
      setTeams(prev => {
        if (!prev) return prev;
        const player = prev[pendingChange.fromTeam!].find(p => p.id === pendingChange.playerId);
        if (!player) return prev;
        const next = prev.map(t => [...t]);
        next[pendingChange.fromTeam!] = next[pendingChange.fromTeam!].filter(p => p.id !== pendingChange.playerId);
        next[pendingChange.toTeam!] = [...next[pendingChange.toTeam!], player];
        return next;
      });
    } else if (pendingChange.type === 'remove') {
      entry.from = pendingChange.fromTeamName;
      setTeams(prev => {
        if (!prev) return prev;
        const next = prev.map(t => [...t]);
        next[pendingChange.fromTeam!] = next[pendingChange.fromTeam!].filter(p => p.id !== pendingChange.playerId);
        return next;
      });
    } else if (pendingChange.type === 'add') {
      entry.to = pendingChange.toTeamName;
      const player = players.find(p => p.id === pendingChange.playerId);
      if (!player) return;
      setTeams(prev => {
        if (!prev) return prev;
        const next = prev.map(t => [...t]);
        next[pendingChange.toTeam!] = [...next[pendingChange.toTeam!], player];
        return next;
      });
    }

    setManualChanges(prev => [...prev, entry]);
    setPendingChange(null);
    setChangeReason('');
  };

  const cancelPendingChange = () => {
    setPendingChange(null);
    setChangeReason('');
  };

  // Compute summary data when teams exist
  const summary = useMemo(() => {
    if (!teams) return null;

    const elos = teams.map((t) => teamEffectiveElo(t, false, settings));
    const pairs: { a: number; b: number; gap: number }[] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        pairs.push({ a: i + 1, b: j + 1, gap: Math.abs(elos[i] - elos[j]) });
      }
    }

    const genders = teams.map((t) => ({
      m: t.filter((p) => p.gender === 'M').length,
      f: t.filter((p) => p.gender === 'F').length,
    }));
    const fCounts = genders.map((g) => g.f);
    const maxF = Math.max(...fCounts);
    const minF = Math.min(...fCounts);
    const genderEven = maxF - minF <= 1;

    return { elos, pairs, genders, genderEven };
  }, [teams, settings]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      {/* Search */}
      {!matchMode && (
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
          style={{
            backgroundColor: '#121b2e',
            border: '1px solid #1e2e48',
            color: '#c8d8ec',
          }}
        />
      )}

      {/* Team count selector */}
      {!matchMode && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#c8d8ec' }}>
            Teams:
          </span>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setTeamCount(n);
                  setTeams(null);
                }}
                className="w-10 h-10 rounded-lg text-sm font-bold transition-all"
                style={{
                  backgroundColor:
                    teamCount === n ? '#F5C518' : '#0c1220',
                  color: teamCount === n ? '#070a13' : '#c8d8ec',
                  border: `1px solid ${teamCount === n ? '#F5C518' : '#1e2e48'}`,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selection count */}
      {!matchMode && (
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-semibold"
            style={{ color: canBalance ? '#c8d8ec' : '#ff4757' }}
          >
            {selected.size} selected{' '}
            <span className="font-normal" style={{ color: selectionInRange ? '#3d5270' : '#F5C518' }}>
              (recommended {recommendedMin}–{recommendedMax})
            </span>
          </span>
        </div>
      )}

      {/* Player grid */}
      {!matchMode && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto rounded-lg p-3"
          style={{ backgroundColor: '#0c1220', border: '1px solid #1e2e48' }}
        >
          {filteredPlayers.map((player) => {
            const isSelected = selected.has(player.id);
            const tags = getStatusTags(player);
            return (
              <label
                key={player.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(245,197,24,0.08)'
                    : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(245,197,24,0.3)' : 'transparent'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => togglePlayer(player.id)}
                  className="accent-[#F5C518] w-4 h-4 flex-shrink-0"
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: '#c8d8ec' }}
                  >
                    {player.name}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        player.gender === 'M'
                          ? 'rgba(0,180,216,0.15)'
                          : 'rgba(255,105,180,0.15)',
                      color: player.gender === 'M' ? '#00b4d8' : '#ff69b4',
                    }}
                  >
                    {player.gender}
                  </span>
                  {tags.map((tag) => (
                    <span
                      key={tag.label}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
                <span
                  className="text-xs font-mono flex-shrink-0"
                  style={{ color: '#3d5270' }}
                >
                  {player.elo}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Balance button */}
      {!matchMode && (
        <button
          onClick={handleBalance}
          disabled={!canBalance}
          className="w-full py-3 rounded-lg text-sm font-bold transition-all"
          style={{
            backgroundColor: canBalance ? '#F5C518' : '#1e2e48',
            color: canBalance ? '#070a13' : '#3d5270',
            cursor: canBalance ? 'pointer' : 'not-allowed',
          }}
        >
          Balance {teamCount} Teams
        </button>
      )}

      {/* Match mode header */}
      {matchMode && teams && (
        <div
          className="rounded-lg px-5 py-4 flex flex-col gap-3"
          style={{
            backgroundColor: '#0c1220',
            border: '1px solid #F5C518',
            boxShadow: '0 0 20px rgba(245,197,24,0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded"
                style={{ backgroundColor: 'rgba(245,197,24,0.15)', color: '#F5C518' }}
              >
                MATCH MODE
              </span>
              <span className="text-sm" style={{ color: '#c8d8ec' }}>
                Assign placements to each team
              </span>
            </div>
            <button
              onClick={handleCancelMatch}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: 'rgba(255,71,87,0.1)',
                color: '#ff4757',
                border: '1px solid rgba(255,71,87,0.3)',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Session label input */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: '#3d5270' }}>
              Label:
            </span>
            <input
              type="text"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder={`Session ${sessionCount + 1}`}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: '#121b2e',
                border: '1px solid #1e2e48',
                color: '#c8d8ec',
              }}
            />
          </div>

          {/* LMS — Last Man/Woman Standing */}
          <div
            className="rounded-lg px-4 py-3 flex flex-col gap-3"
            style={{ backgroundColor: '#070a13', border: '1px solid #1e2e48' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: '#cc80ff' }}>
                LAST MAN / WOMAN STANDING
              </span>
              <span className="text-[10px]" style={{ color: '#3d5270' }}>
                (optional — 1st +1pt, 2nd +0.5pt)
              </span>
            </div>

            {/* Male LMS */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00b4d8' }}>
                Last Man Standing
              </span>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#F5C518' }}>1st</span>
                  <select
                    value={lmsMale1st ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setLmsMale1st(val);
                      if (val && val === lmsMale2nd) setLmsMale2nd(null);
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: '#121b2e',
                      border: '1px solid #1e2e48',
                      color: '#c8d8ec',
                      minWidth: 160,
                    }}
                  >
                    <option value="">— none —</option>
                    {teams.flat().filter(p => p.gender === 'M').map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#9eb4cc' }}>2nd</span>
                  <select
                    value={lmsMale2nd ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setLmsMale2nd(val);
                      if (val && val === lmsMale1st) setLmsMale1st(null);
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: '#121b2e',
                      border: '1px solid #1e2e48',
                      color: '#c8d8ec',
                      minWidth: 160,
                    }}
                  >
                    <option value="">— none —</option>
                    {teams.flat().filter(p => p.gender === 'M' && p.name !== lmsMale1st).map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Female LMS */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ff4757' }}>
                Last Woman Standing
              </span>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#F5C518' }}>1st</span>
                  <select
                    value={lmsFemale1st ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setLmsFemale1st(val);
                      if (val && val === lmsFemale2nd) setLmsFemale2nd(null);
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: '#121b2e',
                      border: '1px solid #1e2e48',
                      color: '#c8d8ec',
                      minWidth: 160,
                    }}
                  >
                    <option value="">— none —</option>
                    {teams.flat().filter(p => p.gender === 'F').map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#9eb4cc' }}>2nd</span>
                  <select
                    value={lmsFemale2nd ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setLmsFemale2nd(val);
                      if (val && val === lmsFemale1st) setLmsFemale1st(null);
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: '#121b2e',
                      border: '1px solid #1e2e48',
                      color: '#c8d8ec',
                      minWidth: 160,
                    }}
                  >
                    <option value="">— none —</option>
                    {teams.flat().filter(p => p.gender === 'F' && p.name !== lmsFemale1st).map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {teams && summary && (
        <div className="flex flex-col gap-4">
          {/* Team cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team, i) => {
              const color = teamNames[i]?.color || '#c8d8ec';
              const mCount = team.filter((p) => p.gender === 'M').length;
              const fCount = team.filter((p) => p.gender === 'F').length;
              const currentPlacement = placements[i] || 0;

              return (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: '#0c1220',
                    border: `1px solid ${matchMode && currentPlacement > 0 ? color : '#1e2e48'}`,
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: `2px solid ${color}`,
                      background: `linear-gradient(135deg, ${color}15, transparent)`,
                    }}
                  >
                    <span
                      className="text-sm font-bold flex items-center gap-2"
                      style={{ color }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      {teamNames[i]?.name || `Team ${i + 1}`}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-mono"
                        style={{ color: '#c8d8ec' }}
                      >
                        ELO {summary.elos[i].toFixed(0)}
                      </span>
                      <span className="text-xs" style={{ color: '#3d5270' }}>
                        {mCount}M / {fCount}F
                      </span>
                    </div>
                  </div>

                  {/* Placement selector (match mode only) */}
                  {matchMode && (
                    <div
                      className="flex items-center gap-2 px-4 py-3"
                      style={{ borderBottom: '1px solid #1e2e48' }}
                    >
                      <span className="text-xs font-medium" style={{ color: '#3d5270' }}>
                        Place:
                      </span>
                      <div className="flex gap-1.5">
                        {Array.from({ length: teams.length }, (_, r) => r + 1).map(
                          (rank) => {
                            const isSelected = currentPlacement === rank;
                            const isTaken =
                              !isSelected && placements.some((p, idx) => idx !== i && p === rank);
                            return (
                              <button
                                key={rank}
                                onClick={() => setPlacement(i, rank)}
                                disabled={isTaken}
                                className="w-9 h-9 rounded-lg text-xs font-bold transition-all"
                                style={{
                                  backgroundColor: isSelected
                                    ? color
                                    : isTaken
                                    ? '#070a13'
                                    : '#121b2e',
                                  color: isSelected
                                    ? '#070a13'
                                    : isTaken
                                    ? '#1e2e48'
                                    : '#c8d8ec',
                                  border: `1px solid ${
                                    isSelected ? color : isTaken ? '#121b2e' : '#1e2e48'
                                  }`,
                                  cursor: isTaken ? 'not-allowed' : 'pointer',
                                  opacity: isTaken ? 0.4 : 1,
                                }}
                              >
                                {RANK_LABELS[rank] ?? `${rank}th`}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* Player list */}
                  <div className="flex flex-col">
                    {team.map((p) => {
                      const delta = previewDeltas?.[p.name];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-4 py-2"
                          style={{ borderBottom: '1px solid #1e2e4830' }}
                        >
                          <span
                            className="text-sm"
                            style={{ color: '#c8d8ec' }}
                          >
                            {p.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-mono"
                              style={{ color: '#3d5270' }}
                            >
                              {p.elo}
                            </span>
                            {matchMode && delta !== undefined && (
                              <span
                                className="text-xs font-mono font-bold"
                                style={{
                                  color: delta > 0 ? '#2ecc71' : delta < 0 ? '#ff4757' : '#3d5270',
                                }}
                              >
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                            {!matchMode && teams && teams.length > 1 && (
                              <>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const toTeam = Number(e.target.value);
                                    if (!isNaN(toTeam)) requestMovePlayer(p.id, i, toTeam);
                                  }}
                                  className="text-[10px] rounded px-1 py-0.5 outline-none"
                                  style={{
                                    backgroundColor: '#121b2e',
                                    border: '1px solid #1e2e48',
                                    color: '#3d5270',
                                    width: 50,
                                  }}
                                  title="Move to team"
                                >
                                  <option value="">Move</option>
                                  {teams.map((_, ti) =>
                                    ti !== i ? (
                                      <option key={ti} value={ti}>
                                        {teamNames[ti]?.name || `Team ${ti + 1}`}
                                      </option>
                                    ) : null
                                  )}
                                </select>
                                <button
                                  onClick={() => requestRemoveFromTeam(p.id, i)}
                                  className="text-[10px] font-bold rounded px-1.5 py-0.5 transition-opacity hover:opacity-80"
                                  style={{
                                    backgroundColor: 'rgba(255,71,87,0.15)',
                                    color: '#ff4757',
                                    border: '1px solid rgba(255,71,87,0.3)',
                                  }}
                                  title="Remove from team"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add player to team */}
                    {!matchMode && availablePlayers.length > 0 && (
                      <div className="px-4 py-2" style={{ borderTop: '1px solid #1e2e48' }}>
                        <select
                          value=""
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            if (!isNaN(pid)) requestAddToTeam(pid, i);
                          }}
                          className="w-full text-xs rounded px-2 py-1.5 outline-none"
                          style={{
                            backgroundColor: '#121b2e',
                            border: '1px solid #1e2e48',
                            color: '#3d5270',
                          }}
                        >
                          <option value="">+ Add player...</option>
                          {availablePlayers
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.gender}, {p.elo})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary row */}
          <div
            className="rounded-lg px-4 py-3 flex flex-wrap items-center gap-4"
            style={{
              backgroundColor: '#0c1220',
              border: '1px solid #1e2e48',
            }}
          >
            {/* ELO gaps */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: '#c8d8ec' }}
              >
                ELO Gaps:
              </span>
              {summary.pairs.map((pair) => (
                <span
                  key={`${pair.a}-${pair.b}`}
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: '#121b2e',
                    color: pair.gap > 50 ? '#ff4757' : '#2ecc71',
                  }}
                >
                  T{pair.a}–T{pair.b}: {pair.gap.toFixed(0)}
                </span>
              ))}
            </div>

            {/* LMS winners */}
            {(lmsMale1st || lmsMale2nd || lmsFemale1st || lmsFemale2nd) && matchMode && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#cc80ff' }}>
                  LM:
                </span>
                {lmsMale1st && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#121b2e', color: '#F5C518' }}>
                    M1st {lmsMale1st} +1
                  </span>
                )}
                {lmsMale2nd && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#121b2e', color: '#9eb4cc' }}>
                    M2nd {lmsMale2nd} +0.5
                  </span>
                )}
                {lmsFemale1st && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#121b2e', color: '#F5C518' }}>
                    F1st {lmsFemale1st} +1
                  </span>
                )}
                {lmsFemale2nd && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#121b2e', color: '#9eb4cc' }}>
                    F2nd {lmsFemale2nd} +0.5
                  </span>
                )}
              </div>
            )}

            {/* Gender distribution */}
            <div className="flex items-center gap-2 ml-auto">
              <span
                className="text-xs font-semibold"
                style={{ color: '#c8d8ec' }}
              >
                Gender:
              </span>
              {summary.genders.map((g, i) => (
                <span
                  key={i}
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: '#121b2e',
                    color: '#c8d8ec',
                  }}
                >
                  T{i + 1} {g.m}M/{g.f}F
                </span>
              ))}
              {summary.genderEven ? (
                <span className="text-sm" style={{ color: '#2ecc71' }}>
                  ✓
                </span>
              ) : (
                <span className="text-sm" style={{ color: '#ff4757' }}>
                  ⚠
                </span>
              )}
            </div>
          </div>

          {/* Manual changes audit log */}
          {manualChanges.length > 0 && (
            <div
              className="rounded-lg px-4 py-3 flex flex-col gap-2"
              style={{
                backgroundColor: '#0c1220',
                border: '1px solid rgba(243,156,18,0.3)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(243,156,18,0.15)', color: '#f39c12' }}
                >
                  CHANGES LOG
                </span>
                <span className="text-[10px]" style={{ color: '#3d5270' }}>
                  {manualChanges.length} manual {manualChanges.length === 1 ? 'change' : 'changes'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                {manualChanges.map((change, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-0.5 px-3 py-2 rounded"
                    style={{ backgroundColor: '#070a13', border: '1px solid #1e2e48' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{
                          backgroundColor:
                            change.type === 'move' ? 'rgba(0,180,216,0.15)' :
                            change.type === 'add' ? 'rgba(46,204,113,0.15)' :
                            'rgba(255,71,87,0.15)',
                          color:
                            change.type === 'move' ? '#00b4d8' :
                            change.type === 'add' ? '#2ecc71' :
                            '#ff4757',
                        }}
                      >
                        {change.type}
                      </span>
                      <span className="text-xs" style={{ color: '#c8d8ec' }}>
                        <strong>{change.player}</strong>
                        {change.type === 'move' && <> from {change.from} to {change.to}</>}
                        {change.type === 'remove' && <> from {change.from}</>}
                        {change.type === 'add' && <> to {change.to}</>}
                      </span>
                    </div>
                    <span className="text-[11px] italic" style={{ color: '#3d5270' }}>
                      &ldquo;{change.reason}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!matchMode ? (
            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#F5C518',
                  border: '1px solid #F5C518',
                }}
              >
                Regenerate
              </button>
              <button
                onClick={handleStartMatch}
                className="flex-1 py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  backgroundColor: '#2ecc71',
                  color: '#070a13',
                  border: '1px solid #2ecc71',
                }}
              >
                Start Match
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Record result button */}
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!allPlacementsValid}
                  className="w-full py-3 rounded-lg text-sm font-bold transition-all"
                  style={{
                    backgroundColor: allPlacementsValid ? '#F5C518' : '#1e2e48',
                    color: allPlacementsValid ? '#070a13' : '#3d5270',
                    cursor: allPlacementsValid ? 'pointer' : 'not-allowed',
                  }}
                >
                  {allPlacementsValid
                    ? 'Record Result'
                    : `Assign all placements (${placements.filter((p) => p > 0).length}/${teams?.length ?? 0})`}
                </button>
              ) : (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{
                    backgroundColor: 'rgba(245,197,24,0.05)',
                    border: '1px solid rgba(245,197,24,0.3)',
                  }}
                >
                  <p className="text-sm text-center" style={{ color: '#c8d8ec' }}>
                    This will update all player ELO ratings and save the session. Continue?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                      style={{
                        backgroundColor: 'transparent',
                        color: '#c8d8ec',
                        border: '1px solid #1e2e48',
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleRecordResult}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                      style={{
                        backgroundColor: '#F5C518',
                        color: '#070a13',
                      }}
                    >
                      Confirm & Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Justification modal for manual changes */}
      {pendingChange && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) cancelPendingChange(); }}
        >
          <div
            className="w-full max-w-md rounded-xl flex flex-col gap-4"
            style={{
              backgroundColor: '#0c1220',
              border: '1px solid #1e2e48',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded uppercase"
                style={{
                  backgroundColor:
                    pendingChange.type === 'move' ? 'rgba(0,180,216,0.15)' :
                    pendingChange.type === 'add' ? 'rgba(46,204,113,0.15)' :
                    'rgba(255,71,87,0.15)',
                  color:
                    pendingChange.type === 'move' ? '#00b4d8' :
                    pendingChange.type === 'add' ? '#2ecc71' :
                    '#ff4757',
                }}
              >
                {pendingChange.type}
              </span>
              <span className="text-sm font-semibold" style={{ color: '#c8d8ec' }}>
                Manual Change
              </span>
            </div>

            <p className="text-sm" style={{ color: '#c8d8ec' }}>
              {pendingChange.type === 'move' && (
                <>Move <strong>{pendingChange.playerName}</strong> from <strong>{pendingChange.fromTeamName}</strong> to <strong>{pendingChange.toTeamName}</strong></>
              )}
              {pendingChange.type === 'remove' && (
                <>Remove <strong>{pendingChange.playerName}</strong> from <strong>{pendingChange.fromTeamName}</strong></>
              )}
              {pendingChange.type === 'add' && (
                <>Add <strong>{pendingChange.playerName}</strong> to <strong>{pendingChange.toTeamName}</strong></>
              )}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#3d5270' }}>
                Justification (required)
              </label>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Why is this change needed?"
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{
                  backgroundColor: '#121b2e',
                  border: '1px solid #1e2e48',
                  color: '#c8d8ec',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && changeReason.trim()) {
                    e.preventDefault();
                    confirmPendingChange();
                  }
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelPendingChange}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#c8d8ec',
                  border: '1px solid #1e2e48',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingChange}
                disabled={!changeReason.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  backgroundColor: changeReason.trim() ? '#F5C518' : '#1e2e48',
                  color: changeReason.trim() ? '#070a13' : '#3d5270',
                  cursor: changeReason.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Player, Settings, Session } from '@/lib/types';
import { getTier, isProvisional, vetLevel } from '@/lib/elo';

interface RankingsProps {
  players: Player[];
  settings: Settings;
  sessions: Session[];
}

const TIER_COLORS: Record<string, string> = {
  Diamond: '#cc80ff',
  Platinum: '#00b4d8',
  Gold: '#F5C518',
  Silver: '#9eb4cc',
  Bronze: '#e8943a',
};

const TIER_ORDER = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

type SortKey = 'elo' | 'pts' | 'lastGain' | 'games' | 'streak' | 'lms' | 'name';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  elo: 'ELO',
  pts: 'Pts',
  lastGain: 'Gain',
  games: 'GP',
  streak: 'Strk',
  lms: 'BP',
  name: 'Name',
};

function getSortValue(p: Player, key: SortKey): number | string {
  switch (key) {
    case 'elo': return p.elo;
    case 'pts': return p.pts;
    case 'lastGain': return p.lastGain ?? -Infinity;
    case 'games': return p.games;
    case 'streak': return p.streak;
    case 'lms': return p.lms;
    case 'name': return p.name.toLowerCase();
  }
}

export default function Rankings({ players, settings, sessions }: RankingsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('elo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...players];
    list.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let cmp: number;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb);
      } else {
        cmp = (va as number) - (vb as number);
      }
      if (cmp === 0) cmp = b.elo - a.elo; // tiebreak by ELO
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [players, sortKey, sortDir]);

  const totalPlayers = players.length;
  const totalSessions = sessions.length;
  const avgElo =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length)
      : 0;
  const topElo = players.length > 0 ? Math.max(...players.map((p) => p.elo)) : 0;

  // Only group by tier when sorting by ELO
  const showTierGroups = sortKey === 'elo';

  const groupedByTier = useMemo(() => {
    if (!showTierGroups) return null;
    const groups: { tier: string; players: { player: Player; rank: number }[] }[] = [];
    let currentTierLabel: string | null = null;
    sorted.forEach((player, idx) => {
      const tier = getTier(player.elo);
      if (tier.label !== currentTierLabel) {
        currentTierLabel = tier.label;
        groups.push({ tier: tier.label, players: [] });
      }
      groups[groups.length - 1].players.push({ player, rank: idx + 1 });
    });
    return groups;
  }, [sorted, showTierGroups]);

  const GRID_COLS = '3rem 5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem 4.5rem 4.5rem 3rem 3.5rem 10rem 4.5rem';

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' \u25BC' : ' \u25B2';
  };

  const headerStyle = (key: SortKey): React.CSSProperties => ({
    cursor: 'pointer',
    color: sortKey === key ? '#c8d8ec' : '#3d5270',
    userSelect: 'none',
  });

  function renderRow(player: Player, rank: number) {
    const tier = getTier(player.elo);
    const tierColor = TIER_COLORS[tier.label] || '#3d5270';
    const provisional = isProvisional(player, settings);
    const vet = vetLevel(player);
    const delta = player.lastDelta;

    return (
      <div
        key={player.id}
        className="grid items-center px-4 py-3 border-b transition-colors hover:brightness-110"
        style={{
          gridTemplateColumns: GRID_COLS,
          borderColor: '#1e2e48',
          backgroundColor: '#0c1220',
        }}
      >
        {/* Rank */}
        <span className="font-mono text-sm" style={{ color: '#3d5270' }}>
          {rank}
        </span>

        {/* Tier Badge */}
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: tierColor }}
          />
          <span className="text-xs font-semibold" style={{ color: tierColor }}>
            {tier.label}
          </span>
        </div>

        {/* Name + Gender */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: '#c8d8ec' }}>
            {player.name}
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor:
                player.gender === 'M'
                  ? 'rgba(0,180,216,0.15)'
                  : 'rgba(255,71,87,0.15)',
              color: player.gender === 'M' ? '#00b4d8' : '#ff4757',
            }}
          >
            {player.gender}
          </span>
        </div>

        {/* Pts */}
        <span
          className="text-right font-mono text-sm"
          style={{ color: player.pts > 0 ? '#2ecc71' : '#3d5270' }}
        >
          {player.pts > 0 ? player.pts : '—'}
        </span>

        {/* Gain */}
        <span
          className="text-right font-mono text-sm"
          style={{
            color: player.lastGain != null && player.lastGain > 0 ? '#2ecc71' : '#3d5270',
          }}
        >
          {player.lastGain != null
            ? player.lastGain > 0
              ? `+${player.lastGain}`
              : `${player.lastGain}`
            : '—'}
        </span>

        {/* Games Played */}
        <span className="text-right font-mono text-sm" style={{ color: '#c8d8ec' }}>
          {player.games}
        </span>

        {/* Streak */}
        <span
          className="text-right font-mono text-sm"
          style={{ color: player.streak > 0 ? '#F5C518' : '#3d5270' }}
        >
          {player.streak > 0 ? player.streak : '—'}
        </span>

        {/* ELO */}
        <span
          className="text-right font-mono text-sm font-semibold"
          style={{ color: '#c8d8ec' }}
        >
          {player.elo}
        </span>

        {/* Delta */}
        <span
          className="text-right font-mono text-sm"
          style={{
            color:
              delta === null || delta === 0
                ? '#3d5270'
                : delta > 0
                ? '#2ecc71'
                : '#ff4757',
          }}
        >
          {delta === null
            ? '—'
            : delta > 0
            ? `+${delta}`
            : delta === 0
            ? '0'
            : `${delta}`}
        </span>

        {/* BP */}
        <span
          className="text-center font-mono text-sm"
          style={{ color: player.lms > 0 ? '#cc80ff' : '#3d5270' }}
        >
          {player.lms > 0 ? player.lms : '—'}
        </span>

        {/* Change */}
        <span
          className="text-center font-mono text-sm"
          style={{
            color:
              player.prevRank == null
                ? '#3d5270'
                : player.prevRank > rank
                ? '#2ecc71'
                : player.prevRank < rank
                ? '#ff4757'
                : '#3d5270',
          }}
        >
          {player.prevRank == null
            ? '—'
            : player.prevRank > rank
            ? `+${player.prevRank - rank}`
            : player.prevRank < rank
            ? `${player.prevRank - rank}`
            : '0'}
        </span>

        {/* Placements */}
        <div className="flex items-center justify-center gap-3">
          <PlacementBadge count={player.placements[0]} color="#F5C518" label="1st" />
          <PlacementBadge count={player.placements[1]} color="#9eb4cc" label="2nd" />
          <PlacementBadge count={player.placements[2]} color="#e8943a" label="3rd" />
          <PlacementBadge count={player.placements[3]} color="#3d5270" label="4th" />
          <PlacementBadge count={player.placements[4]} color="#cc80ff" label="5th" />
        </div>

        {/* Status */}
        <div className="flex justify-center">
          {provisional ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(255,71,87,0.15)', color: '#ff4757' }}
            >
              PROV
            </span>
          ) : vet === 2 ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(204,128,255,0.15)', color: '#cc80ff' }}
            >
              S·VET
            </span>
          ) : vet === 1 ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(245,197,24,0.15)', color: '#F5C518' }}
            >
              VET
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" style={{ color: '#c8d8ec' }}>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Players" value={totalPlayers} color="#00b4d8" />
        <StatCard label="Total Sessions" value={totalSessions} color="#2ecc71" />
        <StatCard label="Average ELO" value={avgElo} color="#F5C518" />
        <StatCard label="Top ELO" value={topElo} color="#cc80ff" />
      </div>

      {/* Rankings Table */}
      <div
        className="rounded-xl overflow-hidden border"
        style={{ backgroundColor: '#0c1220', borderColor: '#1e2e48' }}
      >
        {/* Table Header */}
        <div
          className="grid items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{
            gridTemplateColumns: GRID_COLS,
            color: '#3d5270',
            borderColor: '#1e2e48',
          }}
        >
          <span>#</span>
          <span>Tier</span>
          <span style={headerStyle('name')} onClick={() => handleSort('name')}>
            Name{sortIndicator('name')}
          </span>
          <span className="text-right" style={headerStyle('pts')} onClick={() => handleSort('pts')}>
            Pts{sortIndicator('pts')}
          </span>
          <span className="text-right" style={headerStyle('lastGain')} onClick={() => handleSort('lastGain')}>
            Gain{sortIndicator('lastGain')}
          </span>
          <span className="text-right" style={headerStyle('games')} onClick={() => handleSort('games')}>
            GP{sortIndicator('games')}
          </span>
          <span className="text-right" style={headerStyle('streak')} onClick={() => handleSort('streak')}>
            Strk{sortIndicator('streak')}
          </span>
          <span className="text-right" style={headerStyle('elo')} onClick={() => handleSort('elo')}>
            ELO{sortIndicator('elo')}
          </span>
          <span className="text-right">±Delta</span>
          <span className="text-center" style={headerStyle('lms')} onClick={() => handleSort('lms')}>
            BP{sortIndicator('lms')}
          </span>
          <span className="text-center">Chg</span>
          <span className="text-center">Placements</span>
          <span className="text-center">Status</span>
        </div>

        {/* Table Body */}
        {showTierGroups && groupedByTier
          ? groupedByTier.map((group) => {
              const tierColor = TIER_COLORS[group.tier] || '#3d5270';
              return (
                <div key={group.tier}>
                  {/* Tier Divider */}
                  <div
                    className="flex items-center gap-3 px-4 py-2 border-b"
                    style={{ borderColor: '#1e2e48', backgroundColor: '#070a13' }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tierColor }}
                    />
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: tierColor }}
                    >
                      {group.tier}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ backgroundColor: tierColor, opacity: 0.25 }}
                    />
                  </div>
                  {group.players.map(({ player, rank }) => renderRow(player, rank))}
                </div>
              );
            })
          : sorted.map((player, idx) => renderRow(player, idx + 1))}
      </div>

      {/* Legend Footer */}
      <div
        className="mt-6 rounded-xl border px-6 py-4"
        style={{ backgroundColor: '#0c1220', borderColor: '#1e2e48' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#3d5270' }}>
          Legend
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {/* Tier Colors */}
          {TIER_ORDER.map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-xs" style={{ color: '#c8d8ec' }}>
                {tier}
              </span>
            </div>
          ))}

          <div className="w-px h-4 self-center" style={{ backgroundColor: '#1e2e48' }} />

          {/* Status Tags */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(255,71,87,0.15)', color: '#ff4757' }}
            >
              PROV
            </span>
            <span className="text-xs" style={{ color: '#3d5270' }}>
              Provisional
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(245,197,24,0.15)', color: '#F5C518' }}
            >
              VET
            </span>
            <span className="text-xs" style={{ color: '#3d5270' }}>
              Veteran
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(204,128,255,0.15)', color: '#cc80ff' }}
            >
              S·VET
            </span>
            <span className="text-xs" style={{ color: '#3d5270' }}>
              Super Veteran
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{ backgroundColor: '#0c1220', borderColor: '#1e2e48' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: '#3d5270' }}>
        {label}
      </p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function PlacementBadge({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1" title={label}>
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-mono" style={{ color }}>
        {count}
      </span>
    </div>
  );
}

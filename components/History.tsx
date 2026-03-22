'use client';

import { useState } from 'react';
import { Session } from '@/lib/types';

interface HistoryProps {
  sessions: Session[];
}

const RANK_COLORS: Record<number, string> = {
  1: '#F5C518',
  2: '#9eb4cc',
  3: '#e8943a',
  4: '#ff4757',
  5: '#cc80ff',
};

const RANK_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  5: '5th',
};

const RANK_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
  4: '\uD83D\uDFE5',
  5: '\uD83D\uDFE3',
};

export default function History({ sessions }: HistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const toggle = (index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (sorted.length === 0) {
    return (
      <div style={{ color: '#3d5270', textAlign: 'center', padding: '48px 0', fontSize: 15 }}>
        No session history yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map((session, idx) => {
        const expanded = expandedIds.has(idx);
        const teamCount = session.teams.length;
        const totalPlayers = session.teams.reduce((sum, t) => sum + t.players.length, 0);
        const hasDeltas = !!session.eloDeltas;
        const rankedTeams = [...session.teams]
          .filter((t) => t.rank >= 1 && t.rank <= 5)
          .sort((a, b) => a.rank - b.rank);

        return (
          <div
            key={idx}
            style={{
              background: '#0c1220',
              border: `1px solid ${hasDeltas ? 'rgba(245,197,24,0.2)' : '#1e2e48'}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <button
              onClick={() => toggle(idx)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#c8d8ec',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#c8d8ec' }}>
                    {session.label}
                  </span>
                  {hasDeltas && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(245,197,24,0.12)',
                        color: '#F5C518',
                      }}
                    >
                      RECORDED
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#3d5270' }}>
                  {new Date(session.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 12, color: '#3d5270' }}>
                  {teamCount} team{teamCount !== 1 ? 's' : ''} &middot; {totalPlayers} player
                  {totalPlayers !== 1 ? 's' : ''}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: '#3d5270',
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                  }}
                >
                  &#9660;
                </span>
              </div>
            </button>

            {/* Expanded content */}
            {expanded && (
              <div
                style={{
                  padding: '4px 18px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                {rankedTeams.map((team, tIdx) => (
                  <div
                    key={tIdx}
                    style={{
                      background: '#070a13',
                      border: `1px solid ${RANK_COLORS[team.rank] ?? '#1e2e48'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                        borderBottom: `1px solid #1e2e48`,
                        paddingBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{RANK_MEDALS[team.rank]}</span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: RANK_COLORS[team.rank] ?? '#c8d8ec',
                        }}
                      >
                        {RANK_LABELS[team.rank] ?? `${team.rank}th`} Place
                      </span>
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {team.players.map((player, pIdx) => {
                        const delta = session.eloDeltas?.[player];
                        return (
                          <li
                            key={pIdx}
                            style={{
                              fontSize: 13,
                              color: '#c8d8ec',
                              padding: '2px 0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{player}</span>
                            {delta !== undefined && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700,
                                  color: delta > 0 ? '#2ecc71' : delta < 0 ? '#ff4757' : '#3d5270',
                                }}
                              >
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

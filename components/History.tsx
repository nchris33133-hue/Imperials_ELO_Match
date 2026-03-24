'use client';

import { useState } from 'react';
import { Session } from '@/lib/types';

interface HistoryProps {
  sessions: Session[];
  seedCount: number;
  onRollback: (sessionIndex: number) => void;
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

export default function History({ sessions, seedCount, onRollback }: HistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null);

  // Keep original indices so we can map back for rollback
  const sorted = sessions
    .map((s, i) => ({ session: s, originalIndex: i }))
    .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());

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

  // Find the latest user-recorded session's original index (for rollback eligibility)
  const latestUserIndex = sessions.length > seedCount ? sessions.length - 1 : -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map(({ session, originalIndex }, idx) => {
        const expanded = expandedIds.has(idx);
        const teamCount = session.teams.length;
        const totalPlayers = session.teams.reduce((sum, t) => sum + t.players.length, 0);
        const hasDeltas = !!session.eloDeltas;
        const isUserSession = originalIndex >= seedCount;
        const canRollback = isUserSession && session.preMatchPlayers && originalIndex >= seedCount;
        const rankedTeams = [...session.teams]
          .filter((t) => t.rank >= 1 && t.rank <= 5)
          .sort((a, b) => a.rank - b.rank);

        // Count how many user sessions would be rolled back (this one + all after it)
        const rollbackCount = isUserSession ? sessions.length - originalIndex : 0;

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#3d5270' }}>
                  {teamCount}T &middot; {totalPlayers}P
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
              <div style={{ padding: '4px 12px 14px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 8,
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

                {/* Manual changes audit log */}
                {session.manualChanges && session.manualChanges.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      background: '#070a13',
                      border: '1px solid rgba(243,156,18,0.25)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: 'rgba(243,156,18,0.12)',
                          color: '#f39c12',
                        }}
                      >
                        MANUAL CHANGES
                      </span>
                      <span style={{ fontSize: 11, color: '#3d5270' }}>
                        {session.manualChanges.length} {session.manualChanges.length === 1 ? 'change' : 'changes'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {session.manualChanges.map((change, cIdx) => (
                        <div
                          key={cIdx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            padding: '8px 10px',
                            background: '#0c1220',
                            borderRadius: 6,
                            borderLeft: `3px solid ${
                              change.type === 'move' ? '#00b4d8' :
                              change.type === 'add' ? '#2ecc71' :
                              '#ff4757'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                textTransform: 'uppercase',
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
                            <span style={{ fontSize: 12, color: '#c8d8ec' }}>
                              <strong>{change.player}</strong>
                              {change.type === 'move' && <>{' '}from {change.from} to {change.to}</>}
                              {change.type === 'remove' && <>{' '}from {change.from}</>}
                              {change.type === 'add' && <>{' '}to {change.to}</>}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#3d5270', fontStyle: 'italic' }}>
                            &ldquo;{change.reason}&rdquo;
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rollback button */}
                {canRollback && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #1e2e48', paddingTop: 14 }}>
                    {confirmRollback === originalIndex ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: '#ff4757', flex: '1 1 100%' }}>
                          {rollbackCount > 1
                            ? `This will undo ${rollbackCount} sessions. Are you sure?`
                            : 'Undo this session and restore previous player state?'}
                        </span>
                        <button
                          onClick={() => {
                            onRollback(originalIndex);
                            setConfirmRollback(null);
                          }}
                          style={{
                            padding: '6px 14px',
                            background: 'rgba(255,71,87,0.15)',
                            border: '1px solid #ff4757',
                            borderRadius: 6,
                            color: '#ff4757',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Confirm Rollback
                        </button>
                        <button
                          onClick={() => setConfirmRollback(null)}
                          style={{
                            padding: '6px 14px',
                            background: 'transparent',
                            border: '1px solid #3d5270',
                            borderRadius: 6,
                            color: '#3d5270',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRollback(originalIndex)}
                        style={{
                          padding: '6px 14px',
                          background: 'transparent',
                          border: '1px solid #3d5270',
                          borderRadius: 6,
                          color: '#c8d8ec',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ff4757')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3d5270')}
                      >
                        Rollback{rollbackCount > 1 ? ` (${rollbackCount} sessions)` : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Player, Session, Settings, AppState } from '@/lib/types';
import { defaultSettings } from '@/lib/elo';
import { loadState, saveState, normalizePlayers } from '@/lib/storage';
import Rankings from '@/components/Rankings';
import Roster from '@/components/Roster';
import TeamBuilder from '@/components/TeamBuilder';
import History from '@/components/History';
import SettingsPanel from '@/components/Settings';
import seedPlayersRaw from '@/data/players.json';
import sessionsData from '@/data/history.json';

function renameKey(obj: Record<string, number>, oldKey: string, newKey: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k === oldKey ? newKey : k] = v;
  }
  return result;
}

const tabs = [
  { key: 'rankings', label: '🏆 Rankings' },
  { key: 'roster', label: '👥 Roster' },
  { key: 'teams', label: '⚖️ Teams' },
  { key: 'history', label: '📋 History' },
  { key: 'settings', label: '⚙️ Settings' },
] as const;

type TabKey = typeof tabs[number]['key'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('rankings');
  const [state, setState] = useState<AppState | null>(null);
  const seedSessions = sessionsData as Session[];

  // Merge seed sessions with user-recorded sessions
  const allSessions = useMemo(() => {
    if (!state) return seedSessions;
    return [...seedSessions, ...state.sessions];
  }, [seedSessions, state]);

  useEffect(() => {
    const seedPlayers = normalizePlayers(seedPlayersRaw);
    const loaded = loadState(seedPlayers);
    setState(loaded);
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const handleUpdatePlayers = useCallback((players: Player[]) => {
    setState(prev => prev ? { ...prev, players } : prev);
  }, []);

  const handleUpdateNextId = useCallback((nextId: number) => {
    setState(prev => prev ? { ...prev, nextId } : prev);
  }, []);

  const handleUpdateSettings = useCallback((settings: Settings) => {
    setState(prev => prev ? { ...prev, settings } : prev);
  }, []);

  const handleRenamePlayer = useCallback((oldName: string, newName: string) => {
    setState(prev => {
      if (!prev) return prev;
      // Update player name
      const players = prev.players.map(p =>
        p.name === oldName ? { ...p, name: newName } : p
      );
      // Update all session references
      const sessions = prev.sessions.map(s => {
        const teams = s.teams.map(t => ({
          ...t,
          players: t.players.map(n => n === oldName ? newName : n),
        }));
        const eloDeltas = s.eloDeltas ? renameKey(s.eloDeltas, oldName, newName) : s.eloDeltas;
        const pointGains = s.pointGains ? renameKey(s.pointGains, oldName, newName) : s.pointGains;
        const lms = s.lms
          ? s.lms.map(n => n === oldName ? newName : n) as [string | null, string | null, string | null, string | null]
          : s.lms;
        const preMatchPlayers = s.preMatchPlayers
          ? s.preMatchPlayers.map(p => p.name === oldName ? { ...p, name: newName } : p)
          : s.preMatchPlayers;
        return { ...s, teams, eloDeltas, pointGains, lms, preMatchPlayers };
      });
      return { ...prev, players, sessions };
    });
  }, []);

  const handleRecordMatch = useCallback((updatedPlayers: Player[], session: Session) => {
    setState(prev => {
      if (!prev) return prev;
      // Save snapshot of all players before applying changes (for rollback)
      const sessionWithSnapshot: Session = {
        ...session,
        preMatchPlayers: prev.players.map(p => ({ ...p })),
      };
      // Merge updated players into the full roster
      const playerMap = new Map(updatedPlayers.map(p => [p.id, p]));
      const mergedPlayers = prev.players.map(p => {
        const updated = playerMap.get(p.id);
        if (updated) return updated; // streak already incremented in applyMatchResults
        // Reset streak for non-participants
        return { ...p, streak: 0 };
      });
      return {
        ...prev,
        players: mergedPlayers,
        sessions: [...prev.sessions, sessionWithSnapshot],
      };
    });
  }, []);

  const handleRollback = useCallback((sessionIndex: number) => {
    setState(prev => {
      if (!prev) return prev;
      // sessionIndex is relative to allSessions (seed + user)
      // User sessions start after seed sessions
      const userIndex = sessionIndex - seedSessions.length;
      if (userIndex < 0 || userIndex >= prev.sessions.length) return prev;
      const session = prev.sessions[userIndex];
      if (!session.preMatchPlayers) return prev;
      return {
        ...prev,
        players: session.preMatchPlayers,
        sessions: prev.sessions.slice(0, userIndex),
      };
    });
  }, [seedSessions.length]);

  const handleReset = useCallback(() => {
    const seedPlayers = normalizePlayers(seedPlayersRaw);
    const fresh: AppState = {
      players: seedPlayers,
      nextId: seedPlayers.length + 1,
      settings: defaultSettings(),
      sessions: [],
    };
    setState(fresh);
  }, []);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dm text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: '#F5C518' }}>
          VIENNA IMPERIALS
        </h1>
        <p className="text-dm text-sm">ELO Ranking & Team Builder</p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 mb-6 border-b border-bo pb-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-acc text-acc'
                : 'border-transparent text-dm hover:text-tx'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      {activeTab === 'rankings' && (
        <Rankings players={state.players} settings={state.settings} sessions={allSessions} />
      )}
      {activeTab === 'roster' && (
        <Roster
          players={state.players}
          settings={state.settings}
          onUpdatePlayers={handleUpdatePlayers}
          onRenamePlayer={handleRenamePlayer}
          nextId={state.nextId}
          onUpdateNextId={handleUpdateNextId}
        />
      )}
      {activeTab === 'teams' && (
        <TeamBuilder
          players={state.players}
          settings={state.settings}
          onRecordMatch={handleRecordMatch}
          sessionCount={allSessions.length}
        />
      )}
      {activeTab === 'history' && (
        <History sessions={allSessions} seedCount={seedSessions.length} onRollback={handleRollback} />
      )}
      {activeTab === 'settings' && (
        <SettingsPanel
          settings={state.settings}
          onUpdateSettings={handleUpdateSettings}
          onReset={handleReset}
          players={state.players}
        />
      )}
    </div>
  );
}

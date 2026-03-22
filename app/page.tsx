'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Player, Session, Settings, AppState } from '@/lib/types';
import { defaultSettings } from '@/lib/elo';
import { loadStateAsync, saveState, normalizePlayers, subscribeToChanges } from '@/lib/storage';
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
  const [syncStatus, setSyncStatus] = useState<'local' | 'synced' | 'offline'>('local');
  const isRemoteUpdate = useRef(false);
  const seedSessions = sessionsData as Session[];

  // Merge seed sessions with user-recorded sessions
  const allSessions = useMemo(() => {
    if (!state) return seedSessions;
    return [...seedSessions, ...state.sessions];
  }, [seedSessions, state]);

  // Load state from Supabase (or localStorage fallback)
  useEffect(() => {
    const seedPlayers = normalizePlayers(seedPlayersRaw);
    loadStateAsync(seedPlayers).then(loaded => {
      setState(loaded);
      setSyncStatus(process.env.NEXT_PUBLIC_SUPABASE_URL ? 'synced' : 'local');
    });
  }, []);

  // Subscribe to real-time changes from other users
  useEffect(() => {
    const seedPlayers = normalizePlayers(seedPlayersRaw);
    const unsubscribe = subscribeToChanges(seedPlayers, (remoteState) => {
      isRemoteUpdate.current = true;
      setState(remoteState);
    });
    return unsubscribe;
  }, []);

  // Save state on change (skip if update came from remote)
  useEffect(() => {
    if (!state) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    saveState(state);
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
      // Compute each player's current rank by pts (for Chg column)
      const prevSorted = [...prev.players].sort((a, b) => b.pts - a.pts || b.elo - a.elo);
      const prevRankMap = new Map<number, number>();
      prevSorted.forEach((p, idx) => prevRankMap.set(p.id, idx + 1));

      // Merge updated players into the full roster
      const playerMap = new Map(updatedPlayers.map(p => [p.id, p]));
      const mergedPlayers = prev.players.map(p => {
        const updated = playerMap.get(p.id);
        if (updated) return { ...updated, prevRank: prevRankMap.get(p.id) ?? null };
        // Reset streak for non-participants, keep their prevRank
        return { ...p, streak: 0, prevRank: prevRankMap.get(p.id) ?? null };
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
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: '#F5C518' }}>
            VIENNA IMPERIALS
          </h1>
          <p className="text-dm text-sm">ELO Ranking & Team Builder</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: syncStatus === 'synced' ? '#2ecc71' : syncStatus === 'local' ? '#F5C518' : '#ff4757',
            }}
          />
          <span className="text-xs" style={{ color: '#3d5270' }}>
            {syncStatus === 'synced' ? 'Synced' : syncStatus === 'local' ? 'Local only' : 'Offline'}
          </span>
        </div>
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

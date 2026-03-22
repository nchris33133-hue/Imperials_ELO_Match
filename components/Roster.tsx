'use client';

import { useState } from 'react';
import type { Player, Session, Settings } from '@/lib/types';

interface RosterProps {
  players: Player[];
  settings: Settings;
  onUpdatePlayers: (players: Player[]) => void;
  onRenamePlayer: (oldName: string, newName: string) => void;
  nextId: number;
  onUpdateNextId: (id: number) => void;
}

export default function Roster({
  players,
  settings,
  onUpdatePlayers,
  onRenamePlayer,
  nextId,
  onUpdateNextId,
}: RosterProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [vetLevel, setVetLevel] = useState<0 | 1 | 2>(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const eloMap: Record<0 | 1 | 2, number> = {
    0: settings.baseElo,
    1: settings.vetStartElo,
    2: settings.superVetStartElo,
  };

  const vetLabelMap: Record<0 | 1 | 2, string> = {
    0: 'Regular',
    1: 'Veteran',
    2: 'Super Veteran',
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const startElo = eloMap[vetLevel];
    const newPlayer: Player = {
      id: nextId,
      name: trimmed,
      gender,
      elo: startElo,
      games: 0,
      placements: [0, 0, 0, 0, 0],
      veteran: vetLevel,
      lastDelta: null,
      pts: 0,
      lastGain: null,
      lms: 0,
      prevRank: null,
      streak: 0,
    };

    onUpdatePlayers([...players, newPlayer]);
    onUpdateNextId(nextId + 1);
    setName('');
    setGender('M');
    setVetLevel(0);
  };

  const handleDelete = (id: number) => {
    const player = players.find((p) => p.id === id);
    if (!player) return;
    if (!window.confirm(`Delete player "${player.name}"?`)) return;
    onUpdatePlayers(players.filter((p) => p.id !== id));
  };

  const handleRename = (id: number) => {
    const trimmed = editName.trim();
    const player = players.find(p => p.id === id);
    if (!trimmed || !player || trimmed === player.name) {
      setEditingId(null);
      return;
    }
    // Check for duplicate names
    if (players.some(p => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase())) {
      window.alert('A player with that name already exists.');
      return;
    }
    onRenamePlayer(player.name, trimmed);
    setEditingId(null);
  };

  const handleGenderChange = (id: number, newGender: 'M' | 'F') => {
    onUpdatePlayers(
      players.map((p) => (p.id === id ? { ...p, gender: newGender } : p))
    );
  };

  const handleVeteranChange = (id: number, newLevel: 0 | 1 | 2) => {
    onUpdatePlayers(
      players.map((p) => {
        if (p.id !== id) return p;
        const oldLevel = p.veteran;
        const newElo = p.elo + (eloMap[newLevel] - eloMap[oldLevel]);
        return { ...p, veteran: newLevel, elo: newElo };
      })
    );
  };

  const sortedPlayers = [...players].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      {/* Add Player Form */}
      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: '#0c1220', border: '1px solid #1e2e48' }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: '#F5C518' }}
        >
          Add Player
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: '#c8d8ec' }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="Player name"
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                backgroundColor: '#121b2e',
                border: '1px solid #1e2e48',
                color: '#c8d8ec',
              }}
            />
          </div>
          <div className="min-w-[90px]">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: '#c8d8ec' }}
            >
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'M' | 'F')}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                backgroundColor: '#121b2e',
                border: '1px solid #1e2e48',
                color: '#c8d8ec',
              }}
            >
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: '#c8d8ec' }}
            >
              Veteran Level
            </label>
            <select
              value={vetLevel}
              onChange={(e) => setVetLevel(Number(e.target.value) as 0 | 1 | 2)}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                backgroundColor: '#121b2e',
                border: '1px solid #1e2e48',
                color: '#c8d8ec',
              }}
            >
              <option value={0}>Regular</option>
              <option value={1}>Veteran</option>
              <option value={2}>Super Veteran</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="rounded px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#F5C518', color: '#070a13' }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{
          backgroundColor: 'rgba(245, 197, 24, 0.08)',
          border: '1px solid rgba(245, 197, 24, 0.25)',
          color: '#F5C518',
        }}
      >
        Gender was auto-assigned from first names and may need manual correction.
      </div>

      {/* Player Table — Desktop */}
      <div
        className="rounded-lg overflow-hidden hidden sm:block"
        style={{ backgroundColor: '#0c1220', border: '1px solid #1e2e48' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2e48' }}>
                {['Name', 'Gender', 'Veteran Level', 'ELO', 'Games', ''].map(
                  (header) => (
                    <th
                      key={header || 'actions'}
                      className="text-left px-4 py-3 font-semibold"
                      style={{ color: '#3d5270' }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr
                  key={player.id}
                  style={{ borderBottom: '1px solid #1e2e48' }}
                >
                  <td className="px-4 py-3" style={{ color: '#c8d8ec' }}>
                    {editingId === player.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(player.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => handleRename(player.id)}
                        autoFocus
                        className="rounded px-2 py-1 text-sm outline-none focus:ring-1"
                        style={{
                          backgroundColor: '#121b2e',
                          border: '1px solid #F5C518',
                          color: '#c8d8ec',
                          width: '100%',
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingId(player.id);
                          setEditName(player.name);
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Click to edit name"
                      >
                        {player.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={player.gender}
                      onChange={(e) =>
                        handleGenderChange(
                          player.id,
                          e.target.value as 'M' | 'F'
                        )
                      }
                      className="rounded px-2 py-1 text-sm outline-none"
                      style={{
                        backgroundColor: '#121b2e',
                        border: '1px solid #1e2e48',
                        color: '#c8d8ec',
                      }}
                    >
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={player.veteran}
                      onChange={(e) =>
                        handleVeteranChange(
                          player.id,
                          Number(e.target.value) as 0 | 1 | 2
                        )
                      }
                      className="rounded px-2 py-1 text-sm outline-none"
                      style={{
                        backgroundColor: '#121b2e',
                        border: '1px solid #1e2e48',
                        color: '#c8d8ec',
                      }}
                    >
                      <option value={0}>Regular</option>
                      <option value={1}>Veteran</option>
                      <option value={2}>Super Veteran</option>
                    </select>
                  </td>
                  <td
                    className="px-4 py-3 font-mono"
                    style={{ color: '#F5C518' }}
                  >
                    {Math.round(player.elo)}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#c8d8ec' }}>
                    {player.games}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(player.id)}
                      className="rounded px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: 'rgba(255, 71, 87, 0.15)',
                        color: '#ff4757',
                        border: '1px solid rgba(255, 71, 87, 0.3)',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedPlayers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center"
                    style={{ color: '#3d5270' }}
                  >
                    No players added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Cards — Mobile */}
      <div className="sm:hidden flex flex-col gap-2">
        {sortedPlayers.map((player) => (
          <div
            key={player.id}
            className="rounded-lg p-3"
            style={{ backgroundColor: '#0c1220', border: '1px solid #1e2e48' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {editingId === player.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(player.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleRename(player.id)}
                    autoFocus
                    className="rounded px-2 py-1 text-sm outline-none focus:ring-1 flex-1"
                    style={{
                      backgroundColor: '#121b2e',
                      border: '1px solid #F5C518',
                      color: '#c8d8ec',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => {
                      setEditingId(player.id);
                      setEditName(player.name);
                    }}
                    className="text-sm font-medium truncate"
                    style={{ color: '#c8d8ec', cursor: 'pointer' }}
                  >
                    {player.name}
                  </span>
                )}
                <span className="font-mono text-xs" style={{ color: '#F5C518' }}>
                  {Math.round(player.elo)}
                </span>
                <span className="text-xs" style={{ color: '#3d5270' }}>
                  {player.games}GP
                </span>
              </div>
              <button
                onClick={() => handleDelete(player.id)}
                className="rounded px-2 py-1 text-xs font-medium ml-2 shrink-0"
                style={{
                  backgroundColor: 'rgba(255, 71, 87, 0.15)',
                  color: '#ff4757',
                  border: '1px solid rgba(255, 71, 87, 0.3)',
                }}
              >
                Del
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={player.gender}
                onChange={(e) => handleGenderChange(player.id, e.target.value as 'M' | 'F')}
                className="rounded px-2 py-1 text-xs outline-none"
                style={{ backgroundColor: '#121b2e', border: '1px solid #1e2e48', color: '#c8d8ec' }}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
              <select
                value={player.veteran}
                onChange={(e) => handleVeteranChange(player.id, Number(e.target.value) as 0 | 1 | 2)}
                className="rounded px-2 py-1 text-xs outline-none flex-1"
                style={{ backgroundColor: '#121b2e', border: '1px solid #1e2e48', color: '#c8d8ec' }}
              >
                <option value={0}>Regular</option>
                <option value={1}>Veteran</option>
                <option value={2}>Super Veteran</option>
              </select>
            </div>
          </div>
        ))}
        {sortedPlayers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: '#3d5270' }}>
            No players added yet.
          </div>
        )}
      </div>
    </div>
  );
}

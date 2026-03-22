'use client';

import type { Player, Settings } from '@/lib/types';
import { downloadRankingsXLSX } from '@/lib/export';

interface SettingsProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onReset: () => void;
  players: Player[];
}

interface SettingDef {
  key: keyof Settings;
  label: string;
  description: string;
  min: number;
  max: number;
  step?: number;
}

const SECTIONS: { title: string; settings: SettingDef[] }[] = [
  {
    title: 'ELO Calculation',
    settings: [
      {
        key: 'genderWeight',
        label: 'Gender Weight',
        description:
          'Adjustment applied to individual ELO based on gender for team effective ELO calculation.',
        min: 0,
        max: 200,
      },
    ],
  },
  {
    title: 'Team Balancing',
    settings: [
      {
        key: 'genderBalanceWeight',
        label: 'Gender Balance Weight',
        description:
          'How strongly the algorithm penalizes gender imbalance when forming teams.',
        min: 0,
        max: 500,
      },
      {
        key: 'unequalBonus',
        label: 'Unequal Bonus',
        description:
          'Bonus applied when teams have unequal sizes to compensate for the disadvantage.',
        min: 0,
        max: 100,
      },
    ],
  },
  {
    title: 'Provisional Windows',
    settings: [
      {
        key: 'provGames',
        label: 'Provisional Games',
        description:
          'Number of games before a new player leaves provisional status (higher K-factor).',
        min: 1,
        max: 50,
      },
      {
        key: 'vetProvGames',
        label: 'Veteran Provisional Games',
        description:
          'Number of games before a veteran player leaves provisional status.',
        min: 1,
        max: 50,
      },
      {
        key: 'superVetProvGames',
        label: 'Super Veteran Provisional Games',
        description:
          'Number of games before a super veteran player leaves provisional status.',
        min: 1,
        max: 50,
      },
    ],
  },
  {
    title: 'Starting ELO',
    settings: [
      {
        key: 'baseElo',
        label: 'Base ELO',
        description: 'The default starting ELO rating assigned to new players.',
        min: 800,
        max: 1500,
      },
      {
        key: 'vetStartElo',
        label: 'Veteran Start ELO',
        description: 'Starting ELO assigned to players marked as veterans.',
        min: 800,
        max: 1500,
      },
      {
        key: 'superVetStartElo',
        label: 'Super Veteran Start ELO',
        description: 'Starting ELO assigned to players marked as super veterans.',
        min: 800,
        max: 1500,
      },
    ],
  },
];

const inputStyle: React.CSSProperties = {
  width: 72,
  padding: '6px 8px',
  background: '#070a13',
  border: '1px solid #1e2e48',
  borderRadius: 6,
  color: '#c8d8ec',
  fontSize: 13,
  textAlign: 'center',
  outline: 'none',
};

const sliderTrack: React.CSSProperties = {
  width: '100%',
  height: 6,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  background: '#1e2e48',
  borderRadius: 3,
  outline: 'none',
  cursor: 'pointer',
  accentColor: '#F5C518',
};

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onReset,
  players,
}: SettingsProps) {
  const update = (key: keyof Settings, value: number) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to their defaults?')) {
      onReset();
    }
  };

  const handleResetPlayerData = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all player data? This will erase all ELO ratings, match history, and session records. This cannot be undone.'
      )
    ) {
      onReset();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        color: '#c8d8ec',
      }}
    >
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#F5C518',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 14,
              paddingBottom: 8,
              borderBottom: '1px solid #1e2e48',
            }}
          >
            {section.title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {section.settings.map((def) => (
              <div
                key={def.key}
                style={{
                  background: '#0c1220',
                  border: '1px solid #1e2e48',
                  borderRadius: 10,
                  padding: '14px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <label
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#c8d8ec',
                    }}
                  >
                    {def.label}
                  </label>
                  <input
                    type="number"
                    value={settings[def.key]}
                    min={def.min}
                    max={def.max}
                    step={def.step ?? 1}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val)) update(def.key, val);
                    }}
                    style={inputStyle}
                  />
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: '#3d5270',
                    margin: '0 0 10px 0',
                    lineHeight: 1.5,
                  }}
                >
                  {def.description}
                </p>
                <input
                  type="range"
                  min={def.min}
                  max={def.max}
                  step={def.step ?? 1}
                  value={settings[def.key]}
                  onChange={(e) => update(def.key, Number(e.target.value))}
                  style={sliderTrack}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Export Rankings */}
      <div>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#F5C518',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 14,
            paddingBottom: 8,
            borderBottom: '1px solid #1e2e48',
          }}
        >
          Export Rankings
        </h3>
        <p
          style={{
            fontSize: 12,
            color: '#3d5270',
            margin: '0 0 14px 0',
            lineHeight: 1.5,
          }}
        >
          Export player rankings as XLSX for Social League upload.
          Points are placement-based (3/2.5/2/1.5/1), BP tracks Last Man/Woman Standing separately.
        </p>
        <button
          onClick={() => downloadRankingsXLSX(players)}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: '#0c1220',
            border: '1px solid #00b4d8',
            borderRadius: 8,
            color: '#00b4d8',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#121b2e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#0c1220')}
        >
          Export Rankings (.xlsx)
        </button>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: 8,
        }}
      >
        <button
          onClick={handleResetSettings}
          style={{
            flex: 1,
            minWidth: 180,
            padding: '12px 20px',
            background: 'transparent',
            border: '1px solid #1e2e48',
            borderRadius: 8,
            color: '#c8d8ec',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F5C518')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e2e48')}
        >
          Reset All Settings
        </button>
        <button
          onClick={handleResetPlayerData}
          style={{
            flex: 1,
            minWidth: 180,
            padding: '12px 20px',
            background: 'transparent',
            border: '1px solid #ff4757',
            borderRadius: 8,
            color: '#ff4757',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Reset Player Data
        </button>
      </div>

      {/* Methodology Section */}
      <div
        style={{
          background: '#0c1220',
          border: '1px solid #1e2e48',
          borderRadius: 10,
          padding: '18px 20px',
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#F5C518',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 0,
            marginBottom: 14,
            paddingBottom: 8,
            borderBottom: '1px solid #1e2e48',
          }}
        >
          Methodology
        </h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            fontSize: 13,
            lineHeight: 1.65,
            color: '#c8d8ec',
          }}
        >
          <div>
            <strong style={{ color: '#F5C518' }}>K-Factor Schedule</strong>
            <p style={{ margin: '4px 0 0', color: '#9eb4cc' }}>
              The K-factor determines how much a single game affects a player&apos;s rating.
              New players start with K=40 for maximum volatility, then progress through
              K=32 and K=26 as they play more games, eventually settling at K=20 for
              established players. This lets new players reach their true rating quickly
              while keeping veteran ratings stable.
            </p>
          </div>

          <div>
            <strong style={{ color: '#F5C518' }}>Asymmetric Gains</strong>
            <p style={{ margin: '4px 0 0', color: '#9eb4cc' }}>
              Wins are amplified by a 1.15x multiplier and losses are dampened by a 0.85x
              multiplier. This creates a slight inflationary effect that rewards consistent
              participation and prevents ratings from stagnating over time.
            </p>
          </div>

          <div>
            <strong style={{ color: '#F5C518' }}>Multi-Team Pairwise Calculation</strong>
            <p style={{ margin: '4px 0 0', color: '#9eb4cc' }}>
              When more than two teams play in a session, ELO changes are calculated by
              evaluating every possible pair of teams. Each team&apos;s result against every
              other team contributes to the final rating adjustment, ensuring all placements
              are accounted for fairly.
            </p>
          </div>

          <div>
            <strong style={{ color: '#F5C518' }}>Gender Adjustment</strong>
            <p style={{ margin: '4px 0 0', color: '#9eb4cc' }}>
              Each team&apos;s effective ELO is adjusted based on its gender composition using
              the Gender Weight setting. This allows the system to account for physical
              differences in mixed-gender sports, producing more accurate expected outcomes
              and fairer rating updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

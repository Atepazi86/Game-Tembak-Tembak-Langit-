export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROUND_SUMMARY'
  | 'VICTORY'
  | 'GAME_OVER';

export type Difficulty = 'cadet' | 'commander' | 'vanguard';

export type UpgradeId =
  | 'twin_aperture'
  | 'capacitor_thrusters'
  | 'solar_magnet'
  | 'reinforced_bulkhead'
  | 'ricochet_core'
  | 'overdrive_surge'
  | 'high_velocity'
  | 'aegis_pulse';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  category: string;
  effectText: string;
  description: string;
}

export interface WaveSummary {
  waveNumber: number;
  enemiesDefeated: number;
  shotsFired: number;
  shotsHit: number;
  peakCombo: number;
  hullRemaining: number;
  maxHull: number;
}

export interface HudSnapshot {
  gameState: GameState;
  difficulty: Difficulty;
  wave: number;
  maxWaves: number;
  endlessMode: boolean;
  score: number;
  bestScore: number;
  combo: number;
  comboTimerRatio: number;
  hull: number;
  maxHull: number;
  dashCooldownRatio: number;
  overdriveCharge: number; // 0..100
  overdriveActive: boolean;
  overdriveRemainingRatio: number;
  enemiesRemaining: number;
  bossName: string | null;
  bossHpRatio: number;
  muted: boolean;
  acquiredUpgrades: UpgradeId[];
  upgradeChoices: UpgradeDef[];
  waveSummary: WaveSummary | null;
  totalEnemiesDefeated: number;
  peakCombo: number;
}

export interface PlayerMods {
  extraProjectiles: number;
  fireRateMult: number;
  moveSpeedMult: number;
  dashCooldownMult: number;
  magnetRadiusBonus: number;
  overdriveGainMult: number;
  ricochetBounces: number;
  overdriveDurationBonus: number;
  overdriveDamageMult: number;
  projectileSpeedMult: number;
  damageMult: number;
  aegisPulseOnDash: boolean;
}

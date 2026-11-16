import { SoundEngine } from './audio';
import {
  Difficulty,
  GameState,
  HudSnapshot,
  PlayerMods,
  UpgradeDef,
  UpgradeId,
  WaveSummary,
} from './types';
import { pickUpgradeChoices } from './upgrades';

interface Vec2 {
  x: number;
  y: number;
}

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  hull: number;
  maxHull: number;
  radius: number;
  fireCooldown: number;
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirY: number;
  invulnTimer: number;
  flashTimer: number;
  squashX: number;
  squashY: number;
  overdriveCharge: number;
  overdriveActive: boolean;
  overdriveTimer: number;
  trail: { x: number; y: number; alpha: number; angle: number }[];
}

type EnemyKind = 'skirmisher' | 'lancer' | 'goliath' | 'mine' | 'boss';

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  flashTimer: number;
  squash: number;
  stateTimer: number;
  telegraphTimer: number;
  telegraphMax: number;
  telegraphTargetAngle: number;
  telegraphType: 'none' | 'lunge' | 'lance' | 'radial' | 'boss_sweep';
  orbitSign: number;
  armorPhase: number;
  scoreValue: number;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  bouncesLeft: number;
  color: string;
  isLance: boolean;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  drag: number;
  kind: 'spark' | 'shard' | 'smoke';
  angle: number;
  spin: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  value: number;
  heal: number;
  pulse: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  warm: boolean;
}

const STORAGE_KEY = 'helios_sentinel_best_score_v1';
const MAX_WAVES = 5;

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { enemyHpMult: number; enemySpeedMult: number; enemyDamageMult: number; spawnCountMult: number }
> = {
  cadet: { enemyHpMult: 0.85, enemySpeedMult: 0.88, enemyDamageMult: 0.78, spawnCountMult: 0.85 },
  commander: { enemyHpMult: 1.0, enemySpeedMult: 1.0, enemyDamageMult: 1.0, spawnCountMult: 1.0 },
  vanguard: { enemyHpMult: 1.25, enemySpeedMult: 1.14, enemyDamageMult: 1.25, spawnCountMult: 1.2 },
};

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  private width = 1280;
  private height = 720;
  private dpr = 1;

  private readonly sound = new SoundEngine();
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private lastHudEmit = 0;

  // Game state
  private gameState: GameState = 'TITLE_MENU';
  private difficulty: Difficulty = 'commander';
  private wave = 1;
  private endlessMode = false;
  private score = 0;
  private bestScore = 0;
  private combo = 1;
  private comboTimer = 0;
  private readonly comboMaxDuration = 3.6;
  private peakCombo = 1;
  private totalEnemiesDefeated = 0;

  // Wave stats
  private waveEnemiesDefeated = 0;
  private waveShotsFired = 0;
  private waveShotsHit = 0;
  private wavePeakCombo = 1;
  private spawnQueue: { kind: EnemyKind; delay: number }[] = [];
  private spawnTimer = 0;
  private waveClearDelay = 0;

  // Upgrades
  private acquiredUpgrades: UpgradeId[] = [];
  private upgradeChoices: UpgradeDef[] = [];
  private waveSummary: WaveSummary | null = null;

  // Entities & pools
  private player!: PlayerState;
  private mods!: PlayerMods;
  private enemies: Enemy[] = [];
  private nextEnemyId = 1;
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private pickups: Pickup[] = [];
  private floatingTexts: FloatingText[] = [];
  private stars: Star[] = [];

  // Juice
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private ambientRotation = 0;

  // Input state (continuous held vs edge-triggered)
  private heldKeys = new Set<string>();
  private mousePos: Vec2 = { x: 640, y: 360 };
  private mouseDown = false;
  private dashBufferTimer = 0;
  private overdriveQueued = false;
  private touchMove: Vec2 = { x: 0, y: 0 };
  private touchFiring = false;
  private touchAimAngle: number | null = null;
  private usingTouch = false;

  constructor(onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.onHudUpdate = onHudUpdate;
    this.bestScore = this.loadBestScore();
    this.initPools();
    this.resetSimulation('commander');
    this.initStars();
  }

  private loadBestScore(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore(score: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(score));
    } catch {
      // Ignore storage errors
    }
  }

  private initPools(): void {
    this.projectiles = Array.from({ length: 260 }, () => ({
      active: false,
      fromPlayer: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 10,
      life: 0,
      bouncesLeft: 0,
      color: '#F4EFE6',
      isLance: false,
    }));

    this.particles = Array.from({ length: 420 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      life: 0,
      maxLife: 1,
      color: '#E59838',
      drag: 0.95,
      kind: 'spark',
      angle: 0,
      spin: 0,
    }));
  }

  private initStars(): void {
    this.stars = Array.from({ length: 110 }, (_, idx) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: idx % 9 === 0 ? 2.1 : idx % 3 === 0 ? 1.4 : 0.9,
      alpha: 0.16 + Math.random() * 0.55,
      speed: 6 + Math.random() * 18,
      warm: idx % 4 === 0,
    }));
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.updateSize();

    this.resizeObserver = new ResizeObserver(() => this.updateSize());
    this.resizeObserver.observe(canvas);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);

    this.lastTimestamp = performance.now();
    this.emitHud(true);
    this.rafId = requestAnimationFrame(this.loop);
  }

  public destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('mouseup', this.handleMouseUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
  }

  private updateSize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, Math.round(rect.width));
    this.height = Math.max(320, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.initStars();

    if (this.player) {
      this.player.x = Math.min(Math.max(this.player.x, 40), this.width - 40);
      this.player.y = Math.min(Math.max(this.player.y, 40), this.height - 40);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.sound.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (this.gameState === 'PLAYING') e.preventDefault();
    }

    if (e.repeat) return;

    if (e.code === 'Escape') {
      if (this.gameState === 'PLAYING') {
        this.pauseGame();
        return;
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
        return;
      }
    }

    if (this.gameState === 'PLAYING') {
      if (e.code === 'Space') {
        this.dashBufferTimer = 0.14;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
        this.overdriveQueued = true;
      }
    }

    this.heldKeys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleWindowBlur = (): void => {
    this.clearInputs();
    if (this.gameState === 'PLAYING') {
      this.pauseGame();
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearInputs();
      if (this.gameState === 'PLAYING') {
        this.pauseGame();
      }
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.canvas) return;
    this.usingTouch = false;
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = ((e.clientX - rect.left) / rect.width) * this.width;
    this.mousePos.y = ((e.clientY - rect.top) / rect.height) * this.height;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    this.sound.unlock();
    if (e.button === 0) {
      this.mouseDown = true;
    } else if (e.button === 2 && this.gameState === 'PLAYING') {
      this.overdriveQueued = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private clearInputs(): void {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.dashBufferTimer = 0;
    this.overdriveQueued = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchFiring = false;
    this.touchAimAngle = null;
  }

  public setTouchMove(x: number, y: number): void {
    this.sound.unlock();
    this.usingTouch = true;
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  public setTouchFire(firing: boolean, aimAngle: number | null = null): void {
    this.sound.unlock();
    this.usingTouch = true;
    this.touchFiring = firing;
    this.touchAimAngle = aimAngle;
  }

  public triggerDash(): void {
    this.sound.unlock();
    this.usingTouch = true;
    if (this.gameState === 'PLAYING') {
      this.dashBufferTimer = 0.14;
    }
  }

  public triggerOverdrive(): void {
    this.sound.unlock();
    this.usingTouch = true;
    if (this.gameState === 'PLAYING') {
      this.overdriveQueued = true;
    }
  }

  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
    this.emitHud(true);
  }

  public toggleMute(): void {
    this.sound.toggleMute();
    this.emitHud(true);
  }

  public startNewMission(difficulty?: Difficulty): void {
    this.sound.unlock();
    const diff = difficulty ?? this.difficulty;
    this.resetSimulation(diff);
    this.gameState = 'PLAYING';
    this.setupWave(1);
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.gameState !== 'PLAYING') return;
    this.clearInputs();
    this.gameState = 'PAUSED';
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.clearInputs();
    this.lastTimestamp = performance.now();
    this.gameState = 'PLAYING';
    this.emitHud(true);
  }

  public returnToTitle(): void {
    this.clearInputs();
    this.resetSimulation(this.difficulty);
    this.gameState = 'TITLE_MENU';
    this.emitHud(true);
  }

  public applyUpgradeAndContinue(upgradeId: UpgradeId): void {
    this.sound.unlock();
    this.sound.playPickup();
    this.acquiredUpgrades.push(upgradeId);

    switch (upgradeId) {
      case 'twin_aperture':
        this.mods.extraProjectiles += 1;
        this.mods.fireRateMult *= 1.1;
        break;
      case 'capacitor_thrusters':
        this.mods.dashCooldownMult *= 0.72;
        this.mods.moveSpeedMult *= 1.14;
        break;
      case 'solar_magnet':
        this.mods.magnetRadiusBonus += 150;
        this.mods.overdriveGainMult *= 1.25;
        break;
      case 'reinforced_bulkhead':
        this.player.maxHull += 30;
        this.player.hull = Math.min(this.player.maxHull, this.player.hull + 45);
        break;
      case 'ricochet_core':
        this.mods.ricochetBounces += 1;
        break;
      case 'overdrive_surge':
        this.mods.overdriveDurationBonus += 2.5;
        this.mods.overdriveDamageMult *= 2.0;
        break;
      case 'high_velocity':
        this.mods.projectileSpeedMult *= 1.28;
        this.mods.damageMult *= 1.22;
        break;
      case 'aegis_pulse':
        this.mods.aegisPulseOnDash = true;
        break;
    }

    const nextWave = this.wave + 1;
    this.gameState = 'PLAYING';
    this.clearInputs();
    this.setupWave(nextWave);
    this.emitHud(true);
  }

  public enterEndlessSector(): void {
    if (this.gameState !== 'VICTORY') return;
    this.endlessMode = true;
    this.gameState = 'PLAYING';
    this.clearInputs();
    this.setupWave(this.wave + 1);
    this.emitHud(true);
  }

  private resetSimulation(diff: Difficulty): void {
    this.difficulty = diff;
    this.wave = 1;
    this.endlessMode = false;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.peakCombo = 1;
    this.totalEnemiesDefeated = 0;
    this.acquiredUpgrades = [];
    this.upgradeChoices = [];
    this.waveSummary = null;
    this.enemies = [];
    this.shockwaves = [];
    this.pickups = [];
    this.floatingTexts = [];
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;

    for (const p of this.projectiles) p.active = false;
    for (const pt of this.particles) pt.active = false;

    this.mods = {
      extraProjectiles: 0,
      fireRateMult: 1,
      moveSpeedMult: 1,
      dashCooldownMult: 1,
      magnetRadiusBonus: 0,
      overdriveGainMult: 1,
      ricochetBounces: 0,
      overdriveDurationBonus: 0,
      overdriveDamageMult: 1,
      projectileSpeedMult: 1,
      damageMult: 1,
      aegisPulseOnDash: false,
    };

    this.player = {
      x: this.width * 0.5,
      y: this.height * 0.54,
      vx: 0,
      vy: 0,
      aimAngle: -Math.PI / 2,
      hull: 100,
      maxHull: 100,
      radius: 16,
      fireCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      dashDirX: 0,
      dashDirY: -1,
      invulnTimer: 0.6,
      flashTimer: 0,
      squashX: 1,
      squashY: 1,
      overdriveCharge: 35,
      overdriveActive: false,
      overdriveTimer: 0,
      trail: [],
    };
  }

  private setupWave(waveNum: number): void {
    this.wave = waveNum;
    this.waveEnemiesDefeated = 0;
    this.waveShotsFired = 0;
    this.waveShotsHit = 0;
    this.wavePeakCombo = 1;
    this.waveClearDelay = 0.8;
    this.spawnQueue = [];
    this.spawnTimer = 0.4;

    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    const scale = cfg.spawnCountMult;

    if (waveNum % 5 === 0) {
      // Boss Wave!
      this.spawnQueue.push({ kind: 'boss', delay: 0.5 });
      const escortCount = Math.round((4 + waveNum * 0.6) * scale);
      for (let i = 0; i < escortCount; i++) {
        const kind: EnemyKind = i % 3 === 0 ? 'lancer' : i % 4 === 0 ? 'mine' : 'skirmisher';
        this.spawnQueue.push({ kind, delay: 2.2 + i * 1.45 });
      }
    } else {
      const baseSkirmishers = Math.round((6 + waveNum * 3) * scale);
      const lancers = waveNum >= 2 ? Math.round((1 + waveNum * 0.9) * scale) : 0;
      const goliaths = waveNum >= 3 ? Math.round((waveNum - 1) * 0.75 * scale) : 0;
      const mines = Math.round((2 + waveNum * 0.7) * scale);

      const entries: EnemyKind[] = [];
      for (let i = 0; i < baseSkirmishers; i++) entries.push('skirmisher');
      for (let i = 0; i < lancers; i++) entries.push('lancer');
      for (let i = 0; i < goliaths; i++) entries.push('goliath');
      for (let i = 0; i < mines; i++) entries.push('mine');

      // Shuffle wave entries
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }

      entries.forEach((kind, index) => {
        const interval = Math.max(0.42, 0.95 - waveNum * 0.06);
        this.spawnQueue.push({ kind, delay: index === 0 ? 0.35 : interval });
      });
    }

    this.addFloatingText(this.player.x, this.player.y - 46, `GELOMBANG ${String(waveNum).padStart(2, '0')}`, '#E59838');
  }

  private spawnEnemy(kind: EnemyKind, customPos?: Vec2): void {
    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    const waveScale = 1 + (this.wave - 1) * 0.14;
    const margin = 36;
    let x = 0;
    let y = 0;

    if (customPos) {
      x = customPos.x;
      y = customPos.y;
    } else {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) {
        x = margin + Math.random() * (this.width - margin * 2);
        y = -margin;
      } else if (edge === 1) {
        x = this.width + margin;
        y = margin + Math.random() * (this.height - margin * 2);
      } else if (edge === 2) {
        x = margin + Math.random() * (this.width - margin * 2);
        y = this.height + margin;
      } else {
        x = -margin;
        y = margin + Math.random() * (this.height - margin * 2);
      }
    }

    let radius = 14;
    let hp = 26;
    let speed = 155;
    let scoreValue = 100;

    if (kind === 'skirmisher') {
      radius = 13;
      hp = 24 * waveScale * cfg.enemyHpMult;
      speed = 165 * cfg.enemySpeedMult;
      scoreValue = 110;
    } else if (kind === 'lancer') {
      radius = 16;
      hp = 38 * waveScale * cfg.enemyHpMult;
      speed = 115 * cfg.enemySpeedMult;
      scoreValue = 180;
    } else if (kind === 'goliath') {
      radius = 26;
      hp = 135 * waveScale * cfg.enemyHpMult;
      speed = 68 * cfg.enemySpeedMult;
      scoreValue = 360;
    } else if (kind === 'mine') {
      radius = 16;
      hp = 18 * cfg.enemyHpMult;
      speed = 46 * cfg.enemySpeedMult;
      scoreValue = 90;
    } else if (kind === 'boss') {
      radius = 44;
      hp = (780 + (this.wave - 5) * 160) * cfg.enemyHpMult;
      speed = 56 * cfg.enemySpeedMult;
      scoreValue = 1800;
      x = this.width * 0.5;
      y = -60;
    }

    const angleToCenter = Math.atan2(this.height * 0.5 - y, this.width * 0.5 - x);
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      x,
      y,
      vx: Math.cos(angleToCenter) * speed * 0.5,
      vy: Math.sin(angleToCenter) * speed * 0.5,
      angle: angleToCenter,
      radius,
      hp,
      maxHp: hp,
      speed,
      flashTimer: 0,
      squash: 1,
      stateTimer: 0.7 + Math.random() * 0.9,
      telegraphTimer: 0,
      telegraphMax: 0.9,
      telegraphTargetAngle: angleToCenter,
      telegraphType: 'none',
      orbitSign: Math.random() < 0.5 ? 1 : -1,
      armorPhase: Math.random() * Math.PI * 2,
      scoreValue,
    });
  }

  private loop = (timestamp: number): void => {
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.ambientRotation += dt * 0.08;
    this.updateStars(dt);

    if (this.gameState === 'PLAYING') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
        this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 28);
      } else {
        this.stepSimulation(dt);
      }
      this.emitHud(false, timestamp);
    }

    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateStars(dt: number): void {
    const driftScale = this.gameState === 'PLAYING' ? 1 : 0.45;
    for (const s of this.stars) {
      s.y += s.speed * driftScale * dt;
      if (s.y > this.height + 4) {
        s.y = -4;
        s.x = Math.random() * this.width;
      }
    }
  }

  private stepSimulation(dt: number): void {
    // Shake decay
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 36);

    // Combo decay
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }

    this.updatePlayer(dt);
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateShockwaves(dt);
    this.updateFloatingTexts(dt);

    // Check wave completion
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveClearDelay -= dt;
      if (this.waveClearDelay <= 0) {
        this.handleWaveCleared();
      }
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.flashTimer = Math.max(0, p.flashTimer - dt);
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);
    this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);

    // Overdrive active timer
    if (p.overdriveActive) {
      p.overdriveTimer -= dt;
      if (p.overdriveTimer <= 0) {
        p.overdriveActive = false;
        p.overdriveTimer = 0;
      }
    }

    // Trigger queued Overdrive
    if (this.overdriveQueued) {
      this.overdriveQueued = false;
      if (!p.overdriveActive && p.overdriveCharge >= 100) {
        this.activateOverdrive();
      }
    }

    // Movement input vector (keyboard + touch joystick)
    let ix = this.touchMove.x;
    let iy = this.touchMove.y;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) iy -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) iy += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) ix -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) ix += 1;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }

    // Buffered Dash trigger
    if (this.dashBufferTimer > 0 && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      this.dashBufferTimer = 0;
      p.dashTimer = 0.16;
      p.dashCooldown = 1.25 * this.mods.dashCooldownMult;
      p.invulnTimer = Math.max(p.invulnTimer, 0.24);
      if (len > 0) {
        p.dashDirX = ix;
        p.dashDirY = iy;
      } else {
        p.dashDirX = Math.cos(p.aimAngle);
        p.dashDirY = Math.sin(p.aimAngle);
      }
      p.squashX = 1.38;
      p.squashY = 0.72;
      this.sound.playDash();
      this.spawnRing(p.x, p.y, 48, '#E59838', 2.5);

      if (this.mods.aegisPulseOnDash) {
        this.clearEnemyBoltsInRadius(p.x, p.y, 130);
        this.spawnRing(p.x, p.y, 130, '#F4EFE6', 2);
      }
    }

    const baseSpeed = 290 * this.mods.moveSpeedMult * (p.overdriveActive ? 1.18 : 1);
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      const dashSpeed = 790 * this.mods.moveSpeedMult;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
      p.trail.push({ x: p.x, y: p.y, alpha: 0.55, angle: p.aimAngle });
    } else {
      const accel = 1800 * this.mods.moveSpeedMult;
      p.vx += (ix * baseSpeed - p.vx) * Math.min(1, dt * (accel / 150));
      p.vy += (iy * baseSpeed - p.vy) * Math.min(1, dt * (accel / 150));
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Arena containment
    const pad = 26;
    if (p.x < pad) {
      p.x = pad;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > this.width - pad) {
      p.x = this.width - pad;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < pad) {
      p.y = pad;
      p.vy = Math.max(0, p.vy);
    } else if (p.y > this.height - pad) {
      p.y = this.height - pad;
      p.vy = Math.min(0, p.vy);
    }

    // Update dash trail
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].alpha -= dt * 2.8;
      if (p.trail[i].alpha <= 0) p.trail.splice(i, 1);
    }

    // Aim angle (touch auto-aim / manual touch aim / desktop mouse aim)
    if (this.usingTouch) {
      if (this.touchAimAngle !== null) {
        p.aimAngle = this.touchAimAngle;
      } else {
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = e;
          }
        }
        if (nearestEnemy) {
          p.aimAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
        } else if (len > 0.15) {
          p.aimAngle = Math.atan2(iy, ix);
        }
      }
    } else {
      p.aimAngle = Math.atan2(this.mousePos.y - p.y, this.mousePos.x - p.x);
    }

    // Thruster ambient particles
    if ((len > 0 || p.dashTimer > 0) && Math.random() < 0.65) {
      const backAngle = Math.atan2(-p.vy, -p.vx) + (Math.random() - 0.5) * 0.5;
      this.spawnParticle(
        p.x + Math.cos(backAngle) * 14,
        p.y + Math.sin(backAngle) * 14,
        Math.cos(backAngle) * (70 + Math.random() * 60),
        Math.sin(backAngle) * (70 + Math.random() * 60),
        p.overdriveActive ? '#F4EFE6' : '#E59838',
        2.6,
        0.24,
        'spark',
      );
    }

    // Firing
    const wantsFire =
      this.mouseDown || this.touchFiring || this.heldKeys.has('KeyJ') || this.heldKeys.has('KeyK');
    if (wantsFire && p.fireCooldown <= 0) {
      this.firePlayerWeapon();
    }
  }

  private activateOverdrive(): void {
    const p = this.player;
    p.overdriveCharge = 0;
    p.overdriveActive = true;
    p.overdriveTimer = 5.5 + this.mods.overdriveDurationBonus;
    p.invulnTimer = Math.max(p.invulnTimer, 0.8);
    this.sound.playOverdrive();
    this.hitstopTimer = 0.055;
    this.shakeIntensity = 12;
    this.spawnRing(p.x, p.y, 260, '#E59838', 4);
    this.spawnRing(p.x, p.y, 180, '#F4EFE6', 2.5);
    this.clearEnemyBoltsInRadius(p.x, p.y, 260);
    this.addFloatingText(p.x, p.y - 34, 'OVERDRIVE SURYA', '#E59838');

    const blastDamage = 75 * this.mods.overdriveDamageMult;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist <= 260) {
        this.damageEnemy(e, blastDamage, Math.atan2(e.y - p.y, e.x - p.x), true);
      }
    }
  }

  private firePlayerWeapon(): void {
    const p = this.player;
    const odMult = p.overdriveActive ? 1.65 : 1;
    p.fireCooldown = 0.145 / (this.mods.fireRateMult * odMult);
    p.squashX = 0.88;
    p.squashY = 1.12;

    const totalBolts = 1 + this.mods.extraProjectiles + (p.overdriveActive ? 1 : 0);
    const spreadStep = 0.11;
    const baseSpeed = 680 * this.mods.projectileSpeedMult * (p.overdriveActive ? 1.15 : 1);
    const damage = 14 * this.mods.damageMult * (p.overdriveActive ? 1.25 : 1);

    for (let i = 0; i < totalBolts; i++) {
      const offsetIndex = i - (totalBolts - 1) / 2;
      const angle = p.aimAngle + offsetIndex * spreadStep;
      const muzzleX = p.x + Math.cos(p.aimAngle) * 18;
      const muzzleY = p.y + Math.sin(p.aimAngle) * 18;

      this.spawnProjectile({
        fromPlayer: true,
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed,
        radius: p.overdriveActive ? 5 : 4,
        damage,
        life: 1.5,
        bouncesLeft: this.mods.ricochetBounces,
        color: p.overdriveActive ? '#F4EFE6' : '#E59838',
        isLance: false,
      });
      this.waveShotsFired++;
    }

    this.sound.playShoot(p.overdriveActive);
  }

  private updateSpawner(dt: number): void {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    while (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
      const next = this.spawnQueue.shift()!;
      this.spawnEnemy(next.kind);
      this.spawnTimer += this.spawnQueue.length > 0 ? this.spawnQueue[0].delay : 0;
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const cfg = DIFFICULTY_CONFIG[this.difficulty];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.flashTimer = Math.max(0, e.flashTimer - dt);
      e.squash += (1 - e.squash) * Math.min(1, dt * 10);
      e.armorPhase += dt * 1.4;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const angleToPlayer = Math.atan2(dy, dx);

      if (e.kind === 'mine') {
        e.stateTimer += dt;
        e.vx += ((dx / dist) * e.speed - e.vx) * dt * 0.8;
        e.vy += ((dy / dist) * e.speed - e.vy) * dt * 0.8;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle += dt * 0.9;
      } else if (e.kind === 'skirmisher') {
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.angle = e.telegraphTargetAngle;
          if (e.telegraphTimer <= 0) {
            e.telegraphType = 'none';
            const lungeSpeed = e.speed * 2.75;
            e.vx = Math.cos(e.telegraphTargetAngle) * lungeSpeed;
            e.vy = Math.sin(e.telegraphTargetAngle) * lungeSpeed;
            e.stateTimer = 1.4 + Math.random() * 0.8;
            e.squash = 1.25;
          }
        } else {
          e.stateTimer -= dt;
          const tangentAngle = angleToPlayer + e.orbitSign * 0.55;
          const desiredAngle = dist > 220 ? angleToPlayer : tangentAngle;
          e.vx += (Math.cos(desiredAngle) * e.speed - e.vx) * Math.min(1, dt * 4);
          e.vy += (Math.sin(desiredAngle) * e.speed - e.vy) * Math.min(1, dt * 4);
          e.angle = Math.atan2(e.vy, e.vx);

          if (e.stateTimer <= 0 && dist < 340 && dist > 90) {
            e.telegraphType = 'lunge';
            e.telegraphMax = 0.48;
            e.telegraphTimer = 0.48;
            e.telegraphTargetAngle = angleToPlayer;
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      } else if (e.kind === 'lancer') {
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx *= 0.86;
          e.vy *= 0.86;
          // Track player during first 70% of windup, lock on final 30%
          if (e.telegraphTimer > e.telegraphMax * 0.3) {
            e.telegraphTargetAngle = angleToPlayer;
          }
          e.angle = e.telegraphTargetAngle;

          if (e.telegraphTimer <= 0) {
            e.telegraphType = 'none';
            e.stateTimer = 2.1 + Math.random() * 0.7;
            e.squash = 0.8;
            const boltSpeed = 530 * cfg.enemySpeedMult;
            this.spawnProjectile({
              fromPlayer: false,
              x: e.x + Math.cos(e.telegraphTargetAngle) * 18,
              y: e.y + Math.sin(e.telegraphTargetAngle) * 18,
              vx: Math.cos(e.telegraphTargetAngle) * boltSpeed,
              vy: Math.sin(e.telegraphTargetAngle) * boltSpeed,
              radius: 5.5,
              damage: Math.round(18 * cfg.enemyDamageMult),
              life: 2.2,
              bouncesLeft: 0,
              color: '#D94B3D',
              isLance: true,
            });
            this.sound.playHit(false);
          }
        } else {
          e.stateTimer -= dt;
          const idealDist = 310;
          const radialDir = dist > idealDist + 40 ? 1 : dist < idealDist - 50 ? -1 : 0;
          const strafeAngle = angleToPlayer + e.orbitSign * (Math.PI / 2);
          const tx = Math.cos(angleToPlayer) * radialDir + Math.cos(strafeAngle) * 0.65;
          const ty = Math.sin(angleToPlayer) * radialDir + Math.sin(strafeAngle) * 0.65;
          const tLen = Math.max(1, Math.hypot(tx, ty));
          e.vx += ((tx / tLen) * e.speed - e.vx) * Math.min(1, dt * 3.5);
          e.vy += ((ty / tLen) * e.speed - e.vy) * Math.min(1, dt * 3.5);
          e.angle = angleToPlayer;

          if (e.stateTimer <= 0 && this.isInsideArena(e.x, e.y, 16)) {
            e.telegraphType = 'lance';
            e.telegraphMax = 0.92;
            e.telegraphTimer = 0.92;
            e.telegraphTargetAngle = angleToPlayer;
            this.sound.playTelegraph();
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      } else if (e.kind === 'goliath') {
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx *= 0.88;
          e.vy *= 0.88;
          if (e.telegraphTimer <= 0) {
            e.telegraphType = 'none';
            e.stateTimer = 2.6;
            e.squash = 1.2;
            const count = 8;
            const boltSpeed = 240 * cfg.enemySpeedMult;
            for (let k = 0; k < count; k++) {
              const a = e.armorPhase + (k / count) * Math.PI * 2;
              this.spawnProjectile({
                fromPlayer: false,
                x: e.x + Math.cos(a) * e.radius,
                y: e.y + Math.sin(a) * e.radius,
                vx: Math.cos(a) * boltSpeed,
                vy: Math.sin(a) * boltSpeed,
                radius: 5,
                damage: Math.round(14 * cfg.enemyDamageMult),
                life: 3.0,
                bouncesLeft: 0,
                color: '#D94B3D',
                isLance: false,
              });
            }
          }
        } else {
          e.stateTimer -= dt;
          e.vx += ((dx / dist) * e.speed - e.vx) * Math.min(1, dt * 2.2);
          e.vy += ((dy / dist) * e.speed - e.vy) * Math.min(1, dt * 2.2);
          e.angle = angleToPlayer;

          if (e.stateTimer <= 0 && this.isInsideArena(e.x, e.y, 24)) {
            e.telegraphType = 'radial';
            e.telegraphMax = 1.05;
            e.telegraphTimer = 1.05;
            this.sound.playTelegraph();
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      } else if (e.kind === 'boss') {
        // Boss: Eclipse Dreadnought
        const anchorX = this.width * 0.5 + Math.cos(this.ambientRotation * 2.2) * Math.min(220, this.width * 0.22);
        const anchorY = Math.max(125, Math.min(this.height * 0.28, 210));
        const bdx = anchorX - e.x;
        const bdy = anchorY - e.y;
        e.vx += (bdx * 1.4 - e.vx) * Math.min(1, dt * 2.5);
        e.vy += (bdy * 1.4 - e.vy) * Math.min(1, dt * 2.5);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle = angleToPlayer;

        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            if (e.telegraphType === 'boss_sweep') {
              const count = 12;
              const boltSpeed = 275 * cfg.enemySpeedMult;
              for (let k = 0; k < count; k++) {
                const a = e.armorPhase + (k / count) * Math.PI * 2;
                this.spawnProjectile({
                  fromPlayer: false,
                  x: e.x + Math.cos(a) * e.radius,
                  y: e.y + Math.sin(a) * e.radius,
                  vx: Math.cos(a) * boltSpeed,
                  vy: Math.sin(a) * boltSpeed,
                  radius: 5.5,
                  damage: Math.round(16 * cfg.enemyDamageMult),
                  life: 3.4,
                  bouncesLeft: 0,
                  color: '#D94B3D',
                  isLance: false,
                });
              }
              e.stateTimer = 1.9;
            } else if (e.telegraphType === 'lance') {
              // Triple focused lance
              const boltSpeed = 540 * cfg.enemySpeedMult;
              [-0.14, 0, 0.14].forEach((offset) => {
                const a = e.telegraphTargetAngle + offset;
                this.spawnProjectile({
                  fromPlayer: false,
                  x: e.x + Math.cos(a) * e.radius,
                  y: e.y + Math.sin(a) * e.radius,
                  vx: Math.cos(a) * boltSpeed,
                  vy: Math.sin(a) * boltSpeed,
                  radius: 6,
                  damage: Math.round(20 * cfg.enemyDamageMult),
                  life: 2.5,
                  bouncesLeft: 0,
                  color: '#D94B3D',
                  isLance: true,
                });
              });
              e.stateTimer = 1.65;
            }
            e.telegraphType = 'none';
            e.squash = 1.15;
          }
        } else {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            if (Math.random() < 0.52) {
              e.telegraphType = 'boss_sweep';
              e.telegraphMax = 1.05;
              e.telegraphTimer = 1.05;
            } else {
              e.telegraphType = 'lance';
              e.telegraphMax = 0.88;
              e.telegraphTimer = 0.88;
              e.telegraphTargetAngle = angleToPlayer;
            }
            this.sound.playTelegraph();
          }
        }
      }

      // Collision with player
      const collisionDist = e.radius + p.radius - 2;
      if (Math.hypot(e.x - p.x, e.y - p.y) < collisionDist) {
        if (e.kind === 'mine') {
          this.detonateMine(e);
          this.damagePlayer(Math.round(22 * cfg.enemyDamageMult));
        } else if (p.invulnTimer <= 0) {
          this.damagePlayer(Math.round((e.kind === 'boss' ? 24 : 16) * cfg.enemyDamageMult));
          const pushAngle = Math.atan2(e.y - p.y, e.x - p.x);
          e.vx += Math.cos(pushAngle) * 200;
          e.vy += Math.sin(pushAngle) * 200;
        }
      }
    }
  }

  private isInsideArena(x: number, y: number, margin = 0): boolean {
    return x > margin && x < this.width - margin && y > margin && y < this.height - margin;
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.life -= dt;
      if (proj.life <= 0) {
        proj.active = false;
        continue;
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Boundary bounce / despawn
      if (proj.x < 6 || proj.x > this.width - 6) {
        if (proj.bouncesLeft > 0) {
          proj.bouncesLeft--;
          proj.vx *= -1;
          proj.x = Math.max(6, Math.min(this.width - 6, proj.x));
          this.spawnSparks(proj.x, proj.y, proj.color, 3);
        } else {
          proj.active = false;
          continue;
        }
      }
      if (proj.y < 6 || proj.y > this.height - 6) {
        if (proj.bouncesLeft > 0) {
          proj.bouncesLeft--;
          proj.vy *= -1;
          proj.y = Math.max(6, Math.min(this.height - 6, proj.y));
          this.spawnSparks(proj.x, proj.y, proj.color, 3);
        } else {
          proj.active = false;
          continue;
        }
      }

      if (proj.fromPlayer) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const hitDist = e.radius + proj.radius;
          if (Math.hypot(e.x - proj.x, e.y - proj.y) <= hitDist) {
            proj.active = false;
            this.waveShotsHit++;
            this.damageEnemy(e, proj.damage, Math.atan2(proj.vy, proj.vx), false);
            break;
          }
        }
      } else {
        if (p.invulnTimer <= 0 && Math.hypot(p.x - proj.x, p.y - proj.y) <= p.radius + proj.radius - 2) {
          proj.active = false;
          this.damagePlayer(proj.damage);
        }
      }
    }
  }

  private damageEnemy(e: Enemy, amount: number, hitAngle: number, fromOverdrive: boolean): void {
    e.hp -= amount;
    e.flashTimer = 0.09;
    e.squash = 0.85;
    if (e.kind !== 'boss') {
      e.vx += Math.cos(hitAngle) * 35;
      e.vy += Math.sin(hitAngle) * 35;
    }

    this.spawnSparks(e.x, e.y, '#F4EFE6', 4);

    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);

      if (e.kind === 'mine') {
        this.detonateMine(e);
        return;
      }

      // Combo & Score
      this.combo = Math.min(12, this.combo + 1);
      this.comboTimer = this.comboMaxDuration;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.wavePeakCombo = Math.max(this.wavePeakCombo, this.combo);

      const gained = Math.round(e.scoreValue * (1 + (this.combo - 1) * 0.15));
      this.score += gained;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.saveBestScore(this.bestScore);
      }

      this.waveEnemiesDefeated++;
      this.totalEnemiesDefeated++;

      if (!fromOverdrive) {
        const chargeGain = (e.kind === 'goliath' ? 16 : e.kind === 'boss' ? 40 : 6.5) * this.mods.overdriveGainMult;
        this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + chargeGain);
      }

      const scale = e.kind === 'boss' ? 2.6 : e.kind === 'goliath' ? 1.7 : 1;
      this.sound.playExplosion(scale);
      this.spawnSparks(e.x, e.y, '#E59838', e.kind === 'boss' ? 42 : e.kind === 'goliath' ? 22 : 12);
      this.spawnRing(e.x, e.y, e.radius * 2.5, e.kind === 'boss' ? '#F4EFE6' : '#E59838', 2.5);

      if (e.kind === 'goliath' || e.kind === 'boss') {
        this.hitstopTimer = e.kind === 'boss' ? 0.08 : 0.045;
        this.shakeIntensity = Math.max(this.shakeIntensity, e.kind === 'boss' ? 16 : 9);
      } else {
        this.shakeIntensity = Math.max(this.shakeIntensity, 3.5);
      }

      this.addFloatingText(e.x, e.y - 12, `+${gained}`, this.combo >= 5 ? '#E59838' : '#F4EFE6');

      // Drop Solar Shard pickup
      const drops = e.kind === 'boss' ? 8 : e.kind === 'goliath' ? 3 : Math.random() < 0.55 ? 1 : 0;
      for (let d = 0; d < drops; d++) {
        const a = Math.random() * Math.PI * 2;
        this.pickups.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * (60 + Math.random() * 50),
          vy: Math.sin(a) * (60 + Math.random() * 50),
          life: 11,
          value: 45,
          heal: 2,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    } else {
      this.sound.playHit(e.kind === 'goliath' || e.kind === 'boss');
    }
  }

  private detonateMine(mine: Enemy): void {
    const idx = this.enemies.indexOf(mine);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.sound.playExplosion(1.6);
    this.shakeIntensity = Math.max(this.shakeIntensity, 10);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.035);
    this.spawnRing(mine.x, mine.y, 150, '#D94B3D', 3.5);
    this.spawnSparks(mine.x, mine.y, '#D94B3D', 24);
    this.waveEnemiesDefeated++;
    this.totalEnemiesDefeated++;
    this.score += mine.scoreValue;

    // Chain-reaction blast damages nearby enemies!
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const other = this.enemies[i];
      const dist = Math.hypot(other.x - mine.x, other.y - mine.y);
      if (dist <= 155) {
        this.damageEnemy(other, 55, Math.atan2(other.y - mine.y, other.x - mine.x), false);
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    if (p.invulnTimer > 0) return;

    p.hull = Math.max(0, p.hull - amount);
    p.invulnTimer = 0.72;
    p.flashTimer = 0.22;
    p.squashX = 1.32;
    p.squashY = 0.72;
    this.combo = 1;
    this.comboTimer = 0;

    this.sound.playDamage();
    this.hitstopTimer = 0.05;
    this.shakeIntensity = Math.max(this.shakeIntensity, 13);
    this.spawnSparks(p.x, p.y, '#D94B3D', 18);
    this.spawnRing(p.x, p.y, 65, '#D94B3D', 2.5);
    this.addFloatingText(p.x, p.y - 26, `-${amount}`, '#D94B3D');

    if (p.hull <= 0) {
      this.clearInputs();
      this.gameState = 'GAME_OVER';
      this.emitHud(true);
    }
  }

  private clearEnemyBoltsInRadius(cx: number, cy: number, radius: number): void {
    for (const proj of this.projectiles) {
      if (proj.active && !proj.fromPlayer) {
        if (Math.hypot(proj.x - cx, proj.y - cy) <= radius) {
          proj.active = false;
          this.spawnSparks(proj.x, proj.y, '#E59838', 3);
        }
      }
    }
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    const pullRadius = 115 + this.mods.magnetRadiusBonus;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.pulse += dt * 5;
      if (pk.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }

      pk.vx *= 0.94;
      pk.vy *= 0.94;

      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pullRadius && dist > 1) {
        const pullSpeed = 420 * (1 - dist / (pullRadius * 1.25));
        pk.vx += (dx / dist) * pullSpeed * dt * 8;
        pk.vy += (dy / dist) * pullSpeed * dt * 8;
      }

      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;

      if (dist <= p.radius + 14) {
        this.pickups.splice(i, 1);
        this.sound.playPickup();
        p.hull = Math.min(p.maxHull, p.hull + pk.heal);
        p.overdriveCharge = Math.min(100, p.overdriveCharge + 5 * this.mods.overdriveGainMult);
        this.score += pk.value;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          this.saveBestScore(this.bestScore);
        }
        this.spawnSparks(pk.x, pk.y, '#E59838', 5);
      }
    }
  }

  private handleWaveCleared(): void {
    this.clearInputs();
    this.sound.playWaveClear();

    // Clear stray enemy bolts
    for (const proj of this.projectiles) {
      if (!proj.fromPlayer) proj.active = false;
    }

    this.waveSummary = {
      waveNumber: this.wave,
      enemiesDefeated: this.waveEnemiesDefeated,
      shotsFired: this.waveShotsFired,
      shotsHit: this.waveShotsHit,
      peakCombo: this.wavePeakCombo,
      hullRemaining: Math.round(this.player.hull),
      maxHull: Math.round(this.player.maxHull),
    };

    if (!this.endlessMode && this.wave >= MAX_WAVES) {
      this.gameState = 'VICTORY';
      this.emitHud(true);
      return;
    }

    this.upgradeChoices = pickUpgradeChoices(3);
    this.gameState = 'ROUND_SUMMARY';
    this.emitHud(true);
  }

  private spawnProjectile(opts: Omit<Projectile, 'active'>): void {
    for (const proj of this.projectiles) {
      if (!proj.active) {
        Object.assign(proj, opts);
        proj.active = true;
        return;
      }
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number,
    maxLife: number,
    kind: Particle['kind'],
  ): void {
    for (const pt of this.particles) {
      if (!pt.active) {
        pt.active = true;
        pt.x = x;
        pt.y = y;
        pt.vx = vx;
        pt.vy = vy;
        pt.color = color;
        pt.size = size;
        pt.life = maxLife;
        pt.maxLife = maxLife;
        pt.drag = 0.94;
        pt.kind = kind;
        pt.angle = Math.random() * Math.PI * 2;
        pt.spin = (Math.random() - 0.5) * 10;
        return;
      }
    }
  }

  private spawnSparks(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 230;
      this.spawnParticle(
        x,
        y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        color,
        1.8 + Math.random() * 2.5,
        0.24 + Math.random() * 0.28,
        i % 3 === 0 ? 'shard' : 'spark',
      );
    }
  }

  private spawnRing(x: number, y: number, maxRadius: number, color: string, lineWidth = 2): void {
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      life: 0.34,
      maxLife: 0.34,
      color,
      lineWidth,
    });
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -36,
      text,
      color,
      life: 0.85,
      maxLife: 0.85,
    });
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      const damp = Math.pow(pt.drag, dt * 60);
      pt.vx *= damp;
      pt.vy *= damp;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.angle += pt.spin * dt;
    }
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      } else {
        const t = 1 - sw.life / sw.maxLife;
        sw.radius = 8 + (sw.maxRadius - 8) * (1 - Math.pow(1 - t, 3));
      }
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private emitHud(force: boolean, now = performance.now()): void {
    if (!force && now - this.lastHudEmit < 65) return;
    this.lastHudEmit = now;

    const boss = this.enemies.find((e) => e.kind === 'boss') || null;
    const p = this.player;
    const maxDashCd = 1.25 * this.mods.dashCooldownMult;
    const maxOdDur = 5.5 + this.mods.overdriveDurationBonus;

    this.onHudUpdate({
      gameState: this.gameState,
      difficulty: this.difficulty,
      wave: this.wave,
      maxWaves: MAX_WAVES,
      endlessMode: this.endlessMode,
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      comboTimerRatio: this.combo > 1 ? Math.max(0, this.comboTimer / this.comboMaxDuration) : 0,
      hull: Math.round(p.hull),
      maxHull: Math.round(p.maxHull),
      dashCooldownRatio: Math.max(0, Math.min(1, p.dashCooldown / maxDashCd)),
      overdriveCharge: Math.round(p.overdriveCharge),
      overdriveActive: p.overdriveActive,
      overdriveRemainingRatio: p.overdriveActive ? Math.max(0, p.overdriveTimer / maxOdDur) : 0,
      enemiesRemaining: this.enemies.length + this.spawnQueue.length,
      bossName: boss ? 'Kapal Induk Gerhana' : null,
      bossHpRatio: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      muted: this.sound.isMuted(),
      acquiredUpgrades: [...this.acquiredUpgrades],
      upgradeChoices: [...this.upgradeChoices],
      waveSummary: this.waveSummary,
      totalEnemiesDefeated: this.totalEnemiesDefeated,
      peakCombo: this.peakCombo,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake offset
    const sx = this.shakeIntensity > 0.2 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
    const sy = this.shakeIntensity > 0.2 ? (Math.random() - 0.5) * this.shakeIntensity : 0;

    // 1. Deep Obsidian Space Backdrop
    ctx.fillStyle = '#090D14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle warm solar corona radial gradient at top-right edge
    const corona = ctx.createRadialGradient(
      this.width * 0.85,
      this.height * 0.14,
      20,
      this.width * 0.85,
      this.height * 0.14,
      Math.max(this.width, this.height) * 0.65,
    );
    corona.addColorStop(0, 'rgba(229, 152, 56, 0.11)');
    corona.addColorStop(0.45, 'rgba(229, 152, 56, 0.03)');
    corona.addColorStop(1, 'rgba(9, 13, 20, 0)');
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.translate(sx, sy);

    // 2. Celestial Astrolabe Cartography Grid (subtle atmospheric geometry)
    this.renderAstrolabeGrid(ctx);

    // 3. Stars
    for (const s of this.stars) {
      ctx.fillStyle = s.warm ? `rgba(229, 152, 56, ${s.alpha})` : `rgba(244, 239, 230, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.gameState === 'TITLE_MENU') {
      ctx.restore();
      return;
    }

    // 4. Pickups
    for (const pk of this.pickups) {
      const scale = 1 + Math.sin(pk.pulse) * 0.16;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(pk.pulse * 0.4);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#E59838';
      ctx.strokeStyle = '#F4EFE6';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Shockwaves
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Enemy Windup Telegraphs (rendered underneath units for crystal-clear readability)
    for (const e of this.enemies) {
      if (e.telegraphTimer <= 0 || e.telegraphType === 'none') continue;
      const progress = 1 - e.telegraphTimer / e.telegraphMax;

      if (e.telegraphType === 'lance') {
        ctx.save();
        const isLocked = e.telegraphTimer <= e.telegraphMax * 0.3;
        ctx.strokeStyle = isLocked ? 'rgba(217, 75, 61, 0.9)' : 'rgba(229, 152, 56, 0.55)';
        ctx.lineWidth = isLocked ? 2.4 : 1.2;
        if (!isLocked) ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.telegraphTargetAngle) * 1400,
          e.y + Math.sin(e.telegraphTargetAngle) * 1400,
        );
        ctx.stroke();
        ctx.restore();
      } else if (e.telegraphType === 'radial' || e.telegraphType === 'boss_sweep') {
        ctx.save();
        ctx.strokeStyle = `rgba(217, 75, 61, ${0.35 + progress * 0.55})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 10 + (1 - progress) * 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.telegraphType === 'lunge') {
        ctx.save();
        ctx.strokeStyle = 'rgba(229, 152, 56, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.telegraphTargetAngle) * 110,
          e.y + Math.sin(e.telegraphTargetAngle) * 110,
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    // 7. Player dash afterimage trail
    for (const tr of this.player.trail) {
      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.rotate(tr.angle);
      ctx.globalAlpha = tr.alpha * 0.5;
      ctx.strokeStyle = '#E59838';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 8. Enemies
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
    }

    // 9. Player Sentinel Craft
    this.renderPlayer(ctx);

    // 10. Projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const angle = Math.atan2(proj.vy, proj.vx);
      ctx.rotate(angle);
      ctx.fillStyle = proj.color;
      if (proj.fromPlayer) {
        ctx.beginPath();
        ctx.roundRect(-8, -2.4, 16, 4.8, 2.4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(-4, -1.1, 10, 2.2, 1.1);
        ctx.fill();
      } else if (proj.isLance) {
        ctx.beginPath();
        ctx.roundRect(-14, -2.5, 28, 5, 2.5);
        ctx.fill();
        ctx.fillStyle = '#F4EFE6';
        ctx.beginPath();
        ctx.roundRect(-8, -1, 18, 2, 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F4EFE6';
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 11. Pooled Particles
    for (const pt of this.particles) {
      if (!pt.active) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.angle);
      ctx.fillStyle = pt.color;
      if (pt.kind === 'shard') {
        ctx.fillRect(-pt.size, -pt.size * 0.5, pt.size * 2, pt.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 12. Floating Combat Numbers
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 13. Subtle tactical reticle at mouse position during active desktop play
    if (this.gameState === 'PLAYING' && !this.usingTouch) {
      ctx.save();
      ctx.translate(this.mousePos.x, this.mousePos.y);
      ctx.strokeStyle = this.player.overdriveActive ? '#F4EFE6' : 'rgba(229, 152, 56, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-7, 0);
      ctx.moveTo(7, 0);
      ctx.lineTo(15, 0);
      ctx.moveTo(0, -15);
      ctx.lineTo(0, -7);
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 15);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderAstrolabeGrid(ctx: CanvasRenderingContext2D): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const maxR = Math.min(this.width, this.height) * 0.44;

    ctx.save();
    ctx.strokeStyle = 'rgba(244, 239, 230, 0.045)';
    ctx.lineWidth = 1;

    // Concentric astrolabe rings
    [0.35, 0.68, 1.0].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Subtle crosshair ticks
    for (let i = 0; i < 8; i++) {
      const a = this.ambientRotation * 0.4 + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (maxR * 0.25), cy + Math.sin(a) * (maxR * 0.25));
      ctx.lineTo(cx + Math.cos(a) * (maxR * 1.05), cy + Math.sin(a) * (maxR * 1.05));
      ctx.stroke();
    }

    // Perimeter sector border
    ctx.strokeStyle = 'rgba(229, 152, 56, 0.14)';
    ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Invulnerability / Overdrive aura ring
    if (p.overdriveActive) {
      ctx.strokeStyle = 'rgba(229, 152, 56, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.invulnTimer > 0) {
      ctx.strokeStyle = 'rgba(244, 239, 230, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.rotate(p.aimAngle);
    ctx.scale(p.squashX, p.squashY);

    const hullFill = p.flashTimer > 0 ? '#FFFFFF' : '#1E2838';
    const trimStroke = p.flashTimer > 0 ? '#FFFFFF' : p.overdriveActive ? '#F4EFE6' : '#E59838';

    // Wings & main chassis
    ctx.fillStyle = hullFill;
    ctx.strokeStyle = trimStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(19, 0);
    ctx.lineTo(-10, -14);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-10, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brass reactor core
    ctx.fillStyle = p.overdriveActive ? '#F4EFE6' : '#E59838';
    ctx.beginPath();
    ctx.arc(2, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(e.squash, e.squash);

    const flash = e.flashTimer > 0;

    if (e.kind === 'skirmisher') {
      ctx.rotate(e.angle);
      ctx.fillStyle = flash ? '#FFFFFF' : '#251C24';
      ctx.strokeStyle = flash ? '#FFFFFF' : e.telegraphTimer > 0 ? '#E59838' : '#D94B3D';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-11, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === 'lancer') {
      ctx.rotate(e.angle);
      ctx.fillStyle = flash ? '#FFFFFF' : '#1A202C';
      ctx.strokeStyle = flash ? '#FFFFFF' : '#D94B3D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(4, -7);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-14, 12);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Core lens
      ctx.fillStyle = e.telegraphTimer > 0 ? '#F4EFE6' : '#D94B3D';
      ctx.beginPath();
      ctx.arc(4, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'mine') {
      ctx.rotate(e.angle);
      ctx.fillStyle = flash ? '#FFFFFF' : '#2A1D19';
      ctx.strokeStyle = flash ? '#FFFFFF' : '#E59838';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let s = 0; s < 6; s++) {
        const a = (s * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (e.radius - 2), Math.sin(a) * (e.radius - 2));
        ctx.lineTo(Math.cos(a) * (e.radius + 5), Math.sin(a) * (e.radius + 5));
        ctx.stroke();
      }
      ctx.fillStyle = '#D94B3D';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'goliath') {
      ctx.rotate(e.armorPhase * 0.4);
      ctx.fillStyle = flash ? '#FFFFFF' : '#1E2532';
      ctx.strokeStyle = flash ? '#FFFFFF' : '#E59838';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const a = (s * Math.PI) / 3;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner vermilion core
      ctx.fillStyle = '#D94B3D';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'boss') {
      // Rotating outer brass shield arcs
      ctx.save();
      ctx.rotate(e.armorPhase * 0.65);
      ctx.strokeStyle = flash ? '#FFFFFF' : '#E59838';
      ctx.lineWidth = 3;
      for (let arcIdx = 0; arcIdx < 3; arcIdx++) {
        const start = (arcIdx * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 8, start, start + 1.35);
        ctx.stroke();
      }
      ctx.restore();

      // Octagonal Dreadnought Hull
      ctx.rotate(e.angle);
      ctx.fillStyle = flash ? '#FFFFFF' : '#161C26';
      ctx.strokeStyle = flash ? '#FFFFFF' : '#D94B3D';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let s = 0; s < 8; s++) {
        const a = (s * Math.PI) / 4;
        const rad = s % 2 === 0 ? e.radius : e.radius * 0.82;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dreadnought Core
      ctx.fillStyle = '#E59838';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D94B3D';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Subtle HP bar above damaged non-boss multi-hit enemies
    if (e.kind !== 'boss' && e.hp < e.maxHp && e.maxHp > 25) {
      const bw = e.radius * 1.8;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(9, 13, 20, 0.8)';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 11, bw, 4);
      ctx.fillStyle = '#D94B3D';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 11, bw * ratio, 4);
    }
  }
}

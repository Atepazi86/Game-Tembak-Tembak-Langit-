import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { Modals } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { GameEngine } from './game/engine';
import { Difficulty, HudSnapshot, UpgradeId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  difficulty: 'commander',
  wave: 1,
  maxWaves: 5,
  endlessMode: false,
  score: 0,
  bestScore: 0,
  combo: 1,
  comboTimerRatio: 0,
  hull: 100,
  maxHull: 100,
  dashCooldownRatio: 0,
  overdriveCharge: 35,
  overdriveActive: false,
  overdriveRemainingRatio: 0,
  enemiesRemaining: 0,
  bossName: null,
  bossHpRatio: 0,
  muted: false,
  acquiredUpgrades: [],
  upgradeChoices: [],
  waveSummary: null,
  totalEnemiesDefeated: 0,
  peakCombo: 1,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const engine = new GameEngine((snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    if (canvasRef.current) {
      engine.attachCanvas(canvasRef.current);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Enter / Space starts mission from Title Screen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (hud.gameState !== 'TITLE_MENU') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON') return;
        e.preventDefault();
        engineRef.current?.startNewMission();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hud.gameState]);

  const handleSelectDifficulty = (diff: Difficulty) => {
    engineRef.current?.setDifficulty(diff);
  };

  const handleStart = () => {
    engineRef.current?.startNewMission();
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleRestart = () => {
    engineRef.current?.startNewMission(hud.difficulty);
  };

  const handleTitle = () => {
    engineRef.current?.returnToTitle();
  };

  const handleToggleMute = () => {
    engineRef.current?.toggleMute();
  };

  const handlePickUpgrade = (id: UpgradeId) => {
    engineRef.current?.applyUpgradeAndContinue(id);
  };

  const handleContinueEndless = () => {
    engineRef.current?.enterEndlessSector();
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#090D14]">
      {/* Isolated 60fps Canvas Container */}
      <canvas
        ref={canvasRef}
        className={`block h-full w-full touch-none ${hud.gameState === 'PLAYING' ? 'cursor-crosshair' : 'cursor-default'}`}
      />

      {hud.gameState === 'TITLE_MENU' && (
        <TitleScreen
          difficulty={hud.difficulty}
          bestScore={hud.bestScore}
          muted={hud.muted}
          onSelectDifficulty={handleSelectDifficulty}
          onStart={handleStart}
          onToggleMute={handleToggleMute}
        />
      )}

      {hud.gameState !== 'TITLE_MENU' && (
        <GameHud hud={hud} onPause={handlePause} onToggleMute={handleToggleMute} />
      )}

      {hud.gameState === 'PLAYING' && (
        <TouchControls
          hud={hud}
          onMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
          onFire={(firing) => engineRef.current?.setTouchFire(firing)}
          onDash={() => engineRef.current?.triggerDash()}
          onOverdrive={() => engineRef.current?.triggerOverdrive()}
        />
      )}

      <Modals
        hud={hud}
        onResume={handleResume}
        onRestart={handleRestart}
        onTitle={handleTitle}
        onPickUpgrade={handlePickUpgrade}
        onContinueEndless={handleContinueEndless}
      />
    </main>
  );
}

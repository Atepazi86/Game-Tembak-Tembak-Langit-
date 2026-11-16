import { Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onPause: () => void;
  onToggleMute: () => void;
}

export function GameHud({ hud, onPause, onToggleMute }: GameHudProps) {
  const hullPct = Math.max(0, Math.min(100, (hud.hull / Math.max(1, hud.maxHull)) * 100));
  const hullStatus = hullPct > 55 ? 'UTUH' : hullPct > 25 ? 'RUSAK' : 'KRITIS';
  const hullColor = hullPct > 55 ? '#E59838' : hullPct > 25 ? '#F59E0B' : '#D94B3D';
  const dashReady = hud.dashCooldownRatio <= 0.01;
  const overdriveReady = hud.overdriveCharge >= 100;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Status Row */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Hull, Dash & Overdrive Cluster */}
        <div className="flex min-w-0 flex-1 max-w-[172px] flex-col gap-1.5 rounded-lg border border-[#F4EFE6]/14 bg-[#0D131D]/92 px-3 py-2 sm:max-w-[270px] sm:gap-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-medium tracking-wide text-[#B8B0A2] sm:text-[11px]">
              <span className="sm:hidden">Lambung</span>
              <span className="hidden sm:inline">Integritas Lambung</span>
            </span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-[#F4EFE6] sm:text-xs whitespace-nowrap shrink-0">
              {hud.hull}/{hud.maxHull}
              <span className="hidden sm:inline">
                {' '}
                · <span style={{ color: hullColor }}>{hullStatus}</span>
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[#1A2332] sm:h-2">
            <div
              className="h-full origin-left transition-[transform] duration-150"
              style={{
                transform: `scaleX(${hullPct / 100})`,
                backgroundColor: hullColor,
              }}
            />
          </div>

          {/* Sub-meters: Dash & Solar Overdrive */}
          <div className="grid grid-cols-2 gap-2 pt-0.5 sm:gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] sm:text-[11px]">
                <span className="text-[#9C9486]">Dash</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    dashReady ? 'text-[#F4EFE6]' : 'text-[#9C9486]'
                  }`}
                >
                  {dashReady ? 'SIAP' : 'ISI'}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-sm bg-[#1A2332] sm:h-1.5">
                <div
                  className="h-full origin-left bg-[#F4EFE6]"
                  style={{ transform: `scaleX(${1 - hud.dashCooldownRatio})` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] sm:text-[11px]">
                <span className="text-[#9C9486]">Surya</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    hud.overdriveActive || overdriveReady ? 'text-[#E59838]' : 'text-[#CFC7B8]'
                  }`}
                >
                  {hud.overdriveActive
                    ? 'AKTIF'
                    : overdriveReady
                      ? 'SIAP'
                      : `${hud.overdriveCharge}%`}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-sm bg-[#1A2332] sm:h-1.5">
                <div
                  className="h-full origin-left bg-[#E59838]"
                  style={{
                    transform: `scaleX(${
                      hud.overdriveActive
                        ? hud.overdriveRemainingRatio
                        : hud.overdriveCharge / 100
                    })`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: Wave, Score, Combo & Controls */}
        <div className="flex items-start gap-1.5 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#F4EFE6]/14 bg-[#0D131D]/92 px-2.5 py-2 sm:gap-5 sm:px-4 sm:py-2.5">
            <div>
              <div className="text-[10px] text-[#9C9486] sm:text-[11px]">
                <span className="sm:hidden">Gel.</span>
                <span className="hidden sm:inline">Gelombang</span>
              </div>
              <div className="font-mono text-xs font-bold tabular-nums text-[#F4EFE6] sm:text-sm">
                {String(hud.wave).padStart(2, '0')}
                {!hud.endlessMode && (
                  <span className="hidden text-[#9C9486] sm:inline">
                    {' '}
                    / {String(hud.maxWaves).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden h-7 w-px bg-[#F4EFE6]/12 md:block" />

            <div className="hidden md:block">
              <div className="text-[11px] text-[#9C9486]">Musuh</div>
              <div className="font-mono text-sm font-bold tabular-nums text-[#F4EFE6]">
                {hud.enemiesRemaining}
              </div>
            </div>

            <div className="h-6 w-px bg-[#F4EFE6]/12 sm:h-7" />

            <div>
              <div className="text-[10px] text-[#9C9486] sm:text-[11px]">Skor</div>
              <div className="font-mono text-xs font-bold tabular-nums text-[#E59838] sm:text-sm">
                {hud.score.toLocaleString('id-ID')}
              </div>
            </div>

            {hud.combo > 1 && (
              <>
                <div className="hidden h-7 w-px bg-[#F4EFE6]/12 sm:block" />
                <div className="hidden sm:block">
                  <div className="text-[11px] text-[#9C9486]">Kombo</div>
                  <div className="font-mono text-sm font-bold tabular-nums text-[#F4EFE6]">
                    x{hud.combo}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={hud.muted ? 'Nyalakan suara' : 'Matikan suara'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F4EFE6]/14 bg-[#0D131D]/92 text-[#CFC7B8] transition-colors duration-150 hover:border-[#E59838]/50 hover:text-[#F4EFE6] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59838]"
            >
              {hud.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Jeda misi"
              className="flex h-10 w-10 items-center justify-center gap-1.5 rounded-lg border border-[#F4EFE6]/14 bg-[#0D131D]/92 text-xs font-medium text-[#CFC7B8] transition-colors duration-150 hover:border-[#E59838]/50 hover:text-[#F4EFE6] cursor-pointer whitespace-nowrap shrink-0 sm:w-auto sm:px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59838]"
            >
              <Pause className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Jeda</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-Center Boss Health Bar positioned above mobile touch controls */}
      {hud.bossName && (
        <div className="mx-auto mb-32 w-full max-w-md rounded-lg border border-[#D94B3D]/40 bg-[#0D131D]/92 px-4 py-2.5 md:mb-0">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-display font-semibold tracking-wide text-[#F4EFE6]">
              {hud.bossName}
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#D94B3D]">
              {Math.ceil(hud.bossHpRatio * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-sm bg-[#1A2332]">
            <div
              className="h-full origin-left bg-[#D94B3D] transition-[transform] duration-100"
              style={{ transform: `scaleX(${hud.bossHpRatio})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

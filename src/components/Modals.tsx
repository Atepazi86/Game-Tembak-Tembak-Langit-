import { HudSnapshot, UpgradeId } from '../game/types';
import { UPGRADE_CATALOG } from '../game/upgrades';

interface ModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onPickUpgrade: (id: UpgradeId) => void;
  onContinueEndless: () => void;
}

function UpgradeGlyph({ id }: { id: UpgradeId }) {
  switch (id) {
    case 'twin_aperture':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 17L12 4l7 13" />
          <path d="M9 17l3-6 3 6" />
        </svg>
      );
    case 'capacitor_thrusters':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
        </svg>
      );
    case 'solar_magnet':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
        </svg>
      );
    case 'reinforced_bulkhead':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
        </svg>
      );
    case 'ricochet_core':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 17l7-10 9 10" />
          <circle cx="11" cy="7" r="2" fill="currentColor" />
        </svg>
      );
    case 'overdrive_surge':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      );
    case 'high_velocity':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 12h16M14 6l6 6-6 6" />
        </svg>
      );
    case 'aegis_pulse':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E59838]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="12,3 20,8 20,16 12,21 4,16 4,8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export function Modals({
  hud,
  onResume,
  onRestart,
  onTitle,
  onPickUpgrade,
  onContinueEndless,
}: ModalsProps) {
  if (hud.gameState === 'PAUSED') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#090D14]/82 p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="my-auto w-full max-w-sm rounded-xl border border-[#F4EFE6]/16 bg-[#101722] p-5 sm:p-7"
        >
          <div className="mb-1 text-xs font-medium text-[#E59838]">
            Gelombang {String(hud.wave).padStart(2, '0')}
          </div>
          <h2 id="pause-title" className="mb-2 font-display text-2xl font-bold text-[#F4EFE6]">
            Misi Dijeda
          </h2>
          <p className="mb-6 text-sm text-[#B8B0A2]">
            Pertempuran ditangguhkan sementara. Lanjutkan saat siap kembali ke udara.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="h-11 w-full rounded-lg bg-[#E59838] px-4 font-display text-sm font-bold text-[#090D14] transition-colors duration-150 hover:bg-[#EEA74D] cursor-pointer whitespace-nowrap"
            >
              Lanjutkan Misi
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="h-11 w-full rounded-lg border border-[#F4EFE6]/16 bg-[#161F2E] px-4 text-sm font-medium text-[#F4EFE6] transition-colors duration-150 hover:border-[#E59838]/50 cursor-pointer whitespace-nowrap"
            >
              Ulangi Misi
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="h-10 w-full rounded-lg px-4 text-sm font-medium text-[#B8B0A2] transition-colors duration-150 hover:text-[#F4EFE6] cursor-pointer whitespace-nowrap"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.gameState === 'ROUND_SUMMARY' && hud.waveSummary) {
    const ws = hud.waveSummary;
    const accuracy =
      ws.shotsFired > 0 ? Math.min(100, Math.round((ws.shotsHit / ws.shotsFired) * 100)) : 0;

    return (
      <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#090D14]/86 p-4 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="round-title"
          className="my-auto w-full max-w-3xl rounded-xl border border-[#F4EFE6]/16 bg-[#101722] p-5 sm:p-8"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#F4EFE6]/10 pb-4 sm:mb-6 sm:pb-5">
            <div>
              <div className="mb-1 text-xs font-medium text-[#E59838]">
                Gelombang {String(ws.waveNumber).padStart(2, '0')} Tuntas
              </div>
              <h2 id="round-title" className="font-display text-2xl font-bold text-[#F4EFE6]">
                Pilih Peningkatan Reaktor
              </h2>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#B8B0A2]">
              <div>
                <span>Musuh</span>
                <div className="font-mono text-sm font-semibold tabular-nums text-[#F4EFE6]">
                  {ws.enemiesDefeated}
                </div>
              </div>
              <div>
                <span>Akurasi</span>
                <div className="font-mono text-sm font-semibold tabular-nums text-[#F4EFE6]">
                  {accuracy}%
                </div>
              </div>
              <div>
                <span>Kombo Puncak</span>
                <div className="font-mono text-sm font-semibold tabular-nums text-[#E59838]">
                  x{ws.peakCombo}
                </div>
              </div>
              <div>
                <span>Lambung</span>
                <div className="font-mono text-sm font-semibold tabular-nums text-[#F4EFE6]">
                  {ws.hullRemaining}/{ws.maxHull}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {hud.upgradeChoices.map((upg) => (
              <button
                key={upg.id}
                type="button"
                onClick={() => onPickUpgrade(upg.id)}
                className="group flex flex-col justify-between rounded-lg border border-[#F4EFE6]/14 bg-[#151E2D] p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#E59838] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59838] cursor-pointer"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <UpgradeGlyph id={upg.id} />
                    <span className="text-xs font-medium text-[#9C9486]">{upg.category}</span>
                  </div>
                  <h3 className="mb-1.5 font-display text-base font-bold text-[#F4EFE6] group-hover:text-[#E59838]">
                    {upg.name}
                  </h3>
                  <div className="mb-2.5 font-mono text-xs font-semibold text-[#E59838]">
                    {upg.effectText}
                  </div>
                  <p className="text-xs leading-relaxed text-[#B8B0A2]">{upg.description}</p>
                </div>

                <div className="mt-5 border-t border-[#F4EFE6]/10 pt-3 text-xs font-semibold text-[#F4EFE6] group-hover:text-[#E59838]">
                  Pasang Modul &amp; Gelombang {String(hud.wave + 1).padStart(2, '0')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (hud.gameState === 'VICTORY' || hud.gameState === 'GAME_OVER') {
    const isVictory = hud.gameState === 'VICTORY';
    const isNewBest = hud.score > 0 && hud.score >= hud.bestScore;
    const upgradeNames = hud.acquiredUpgrades.map(
      (id) => UPGRADE_CATALOG.find((u) => u.id === id)?.name ?? id,
    );

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#090D14]/88 p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-title"
          className="my-auto w-full max-w-lg rounded-xl border border-[#F4EFE6]/16 bg-[#101722] p-5 sm:p-8"
        >
          <div className="mb-1 flex items-center gap-2 text-xs font-medium">
            <span className={isVictory ? 'text-[#E59838]' : 'text-[#D94B3D]'}>
              {isVictory ? 'Langit Aman' : 'Pesawat Tumbang'}
            </span>
            {isNewBest && (
              <>
                <span aria-hidden="true" className="text-[#9C9486]">·</span>
                <span className="text-[#E59838]">Rekor Baru</span>
              </>
            )}
          </div>

          <h2 id="end-title" className="mb-2 font-display text-2xl font-bold text-[#F4EFE6] sm:text-3xl">
            {isVictory ? 'Kapal Induk Gerhana Tumbang' : 'Lambung Pesawat Hancur'}
          </h2>
          <p className="mb-6 text-sm text-[#B8B0A2]">
            {isVictory
              ? 'Kelima gelombang sektor langit berhasil dibersihkan. Lanjutkan ke mode Tanpa Batas atau mulai misi baru.'
              : `Gugur pada Gelombang ${String(hud.wave).padStart(2, '0')}. Tinjau catatan pertempuran dan terbang kembali.`}
          </p>

          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-[#F4EFE6]/12 bg-[#151E2D] p-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] text-[#9C9486]">Skor Akhir</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#E59838]">
                {hud.score.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#9C9486]">Gelombang</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#F4EFE6]">
                {String(hud.wave).padStart(2, '0')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#9C9486]">Musuh</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#F4EFE6]">
                {hud.totalEnemiesDefeated}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#9C9486]">Kombo Puncak</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#F4EFE6]">
                x{hud.peakCombo}
              </div>
            </div>
          </div>

          {upgradeNames.length > 0 && (
            <div className="mb-6 text-xs text-[#B8B0A2]">
              <span className="font-medium text-[#F4EFE6]">Modul Terpasang: </span>
              <span>{upgradeNames.join(' · ')}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="h-11 flex-1 rounded-lg bg-[#E59838] px-5 font-display text-sm font-bold text-[#090D14] transition-colors duration-150 hover:bg-[#EEA74D] cursor-pointer whitespace-nowrap shrink-0"
            >
              Main Lagi
            </button>
            {isVictory && (
              <button
                type="button"
                onClick={onContinueEndless}
                className="h-11 flex-1 rounded-lg border border-[#E59838]/60 bg-[#151E2D] px-5 font-display text-sm font-semibold text-[#E59838] transition-colors duration-150 hover:bg-[#E59838]/10 cursor-pointer whitespace-nowrap shrink-0"
              >
                Mode Tanpa Batas
              </button>
            )}
            <button
              type="button"
              onClick={onTitle}
              className="h-11 rounded-lg border border-[#F4EFE6]/16 px-4 text-sm font-medium text-[#CFC7B8] transition-colors duration-150 hover:text-[#F4EFE6] cursor-pointer whitespace-nowrap shrink-0"
            >
              Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

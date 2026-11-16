import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Difficulty } from '../game/types';

interface TitleScreenProps {
  difficulty: Difficulty;
  bestScore: number;
  muted: boolean;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStart: () => void;
  onToggleMute: () => void;
}

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; detail: string }[] = [
  { id: 'cadet', label: 'Kadet', detail: 'Lambung lebih kuat & tembakan lebih lambat' },
  { id: 'commander', label: 'Komandan', detail: 'Pertempuran taktis seimbang' },
  { id: 'vanguard', label: 'Garda Depan', detail: 'Gelombang padat & penembak cepat' },
];

export function TitleScreen({
  difficulty,
  bestScore,
  muted,
  onSelectDifficulty,
  onStart,
  onToggleMute,
}: TitleScreenProps) {
  const [imgError, setImgError] = useState(false);

  const selectedDetail = DIFFICULTY_OPTIONS.find((d) => d.id === difficulty)?.detail ?? '';

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-[#090D14]/40">
      {/* Key-art backdrop with measured scrim and resilient fallback */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {!imgError ? (
          <img
            src="/src/assets/images/helios_sentinel_keyart_1794812107748.jpg"
            alt="Pesawat tempur orbit Tembak Tembak Langit di atas planet bercincin emas"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover object-center sm:object-right opacity-85"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_75%_45%,rgba(229,152,56,0.22),rgba(9,13,20,0.96)_62%)]" />
        )}
        {/* Stronger scrim on mobile so text stays crisp over artwork */}
        <div className="absolute inset-0 bg-[#090D14]/65 sm:bg-transparent sm:bg-gradient-to-r sm:from-[#090D14] sm:via-[#090D14]/84 sm:to-[#090D14]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090D14]/95 via-[#090D14]/35 to-[#090D14]/65" />
      </div>

      {/* Top utility row */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 sm:items-center sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium tracking-wide text-[#B8B0A2] sm:text-xs">
          <span>Sektor Pertahanan Langit</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">5 Gelombang</span>
          {bestScore > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#E59838]">
                Rekor {bestScore.toLocaleString('id-ID')}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          className="flex h-10 items-center gap-2 rounded-lg border border-[#F4EFE6]/15 bg-[#111824]/95 px-3 text-xs font-medium text-[#F4EFE6] transition-colors duration-150 hover:border-[#E59838]/50 hover:text-[#E59838] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59838] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-[#E59838]" />}
          <span className="hidden sm:inline">{muted ? 'Suara Mati' : 'Suara Aktif'}</span>
        </button>
      </div>

      {/* Main Left-Aligned Title Lockup */}
      <div className="flex flex-1 items-center px-5 py-4 sm:px-8 md:px-14">
        <div className="w-full max-w-xl">
          {/* Bespoke inline SVG Title Lockup */}
          <svg
            viewBox="0 0 540 168"
            className="mb-4 w-full max-w-[330px] sm:mb-5 sm:max-w-[500px]"
            role="img"
            aria-label="Tembak Tembak Langit"
          >
            <g fill="none" stroke="#E59838" strokeWidth="1.5">
              <circle cx="28" cy="26" r="18" strokeOpacity="0.4" />
              <circle cx="28" cy="26" r="10" />
              <path d="M28 2 V11 M28 41 V50 M4 26 H13 M43 26 H52" />
              <polygon points="28,19 34,26 28,33 22,26" fill="#E59838" stroke="none" />
            </g>
            <text
              x="66"
              y="32"
              fill="#E59838"
              fontFamily="Outfit, sans-serif"
              fontSize="13.5"
              fontWeight="600"
              letterSpacing="3.5"
            >
              SKUADRON PERTAHANAN ORBIT
            </text>
            <text
              x="2"
              y="88"
              fill="#F4EFE6"
              fontFamily="Outfit, sans-serif"
              fontSize="44"
              fontWeight="800"
              letterSpacing="-0.8"
            >
              TEMBAK TEMBAK
            </text>
            <text
              x="2"
              y="138"
              fill="#E59838"
              fontFamily="Outfit, sans-serif"
              fontSize="52"
              fontWeight="800"
              letterSpacing="-0.5"
            >
              LANGIT
            </text>
            <line x1="2" y1="156" x2="496" y2="156" stroke="#F4EFE6" strokeOpacity="0.18" strokeWidth="1" />
            <line x1="2" y1="156" x2="136" y2="156" stroke="#E59838" strokeWidth="2.5" />
          </svg>

          <p className="mb-5 max-w-md text-sm leading-relaxed text-[#CFC7B8] sm:mb-7 sm:text-[15px]">
            Kendalikan pesawat pencegat di orbit tinggi. Baca garis bidik musuh, ledakkan ranjau
            berantai, dan pasang modul reaktor untuk menahan serbuan Kapal Induk Gerhana.
          </p>

          {/* Difficulty Segmented Control */}
          <div className="mb-5 sm:mb-7">
            <div className="mb-2 flex flex-col gap-0.5 sm:max-w-md sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="text-xs font-medium text-[#B8B0A2]">Tingkat Kesulitan</span>
              <span className="text-xs text-[#E59838]">{selectedDetail}</span>
            </div>
            <div
              role="radiogroup"
              aria-label="Tingkat Kesulitan"
              className="grid w-full grid-cols-3 gap-1 rounded-lg border border-[#F4EFE6]/12 bg-[#111824] p-1 sm:inline-flex sm:w-auto"
            >
              {DIFFICULTY_OPTIONS.map((opt) => {
                const active = difficulty === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectDifficulty(opt.id)}
                    className={`rounded-md px-3 py-2.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer sm:px-4 sm:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E59838] ${
                      active
                        ? 'bg-[#E59838] text-[#090D14]'
                        : 'text-[#CFC7B8] hover:text-[#F4EFE6]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Start CTA */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-5">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#E59838] px-8 font-display text-sm font-bold tracking-wide text-[#090D14] transition-transform duration-150 hover:bg-[#EEA74D] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4EFE6] whitespace-nowrap shrink-0 cursor-pointer sm:w-auto"
            >
              Mulai Misi
            </button>
            <span className="hidden text-xs text-[#9C9486] sm:inline">
              Tekan Enter atau Spasi untuk mulai
            </span>
          </div>
        </div>
      </div>

      {/* Single flat control-hint line adapted per device */}
      <div className="px-5 pb-4 sm:px-8 sm:pb-6">
        <p className="hidden font-mono text-xs text-[#9C9486] md:block">
          WASD Gerak · Mouse Bidik &amp; Tembak · Spasi Dash · Shift Overdrive · Esc Jeda
        </p>
        <p className="font-mono text-[11px] text-[#9C9486] md:hidden">
          Joystick Kiri Gerak · Tombol Kanan Tembak, Dash &amp; Surya
        </p>
      </div>
    </div>
  );
}

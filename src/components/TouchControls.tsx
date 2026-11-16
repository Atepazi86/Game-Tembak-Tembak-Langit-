import { useRef, useState } from 'react';
import { HudSnapshot } from '../game/types';

interface TouchControlsProps {
  hud: HudSnapshot;
  onMove: (x: number, y: number) => void;
  onFire: (firing: boolean) => void;
  onDash: () => void;
  onOverdrive: () => void;
}

export function TouchControls({
  hud,
  onMove,
  onFire,
  onDash,
  onOverdrive,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [firingPressed, setFiringPressed] = useState(false);

  const dashReady = hud.dashCooldownRatio <= 0.01;
  const overdriveReady = hud.overdriveCharge >= 100 && !hud.overdriveActive;

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;

    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0 ? Math.sin(angle) * clamped : 0;

    setKnobOffset({ x: kx, y: ky });
    const normX = maxR > 0 ? kx / maxR : 0;
    const normY = maxR > 0 ? ky / maxR : 0;
    onMove(normX, normY);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-5 md:hidden">
      {/* Left Virtual Joystick */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          activePointerId.current = e.pointerId;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activePointerId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={(e) => {
          if (activePointerId.current === e.pointerId) resetStick();
        }}
        aria-label="Kendali gerak"
        className="pointer-events-auto relative flex h-28 w-28 touch-none items-center justify-center rounded-full border border-[#F4EFE6]/20 bg-[#0D131D]/70"
      >
        <div className="h-12 w-12 rounded-full border border-[#E59838]/30" />
        <div
          className="absolute h-11 w-11 rounded-full border border-[#E59838] bg-[#E59838]/30"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Action Cluster: Dash, Overdrive & Fire */}
      <div className="pointer-events-auto flex items-end gap-2.5 touch-none">
        <div className="flex flex-col gap-2">
          {overdriveReady && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onOverdrive();
              }}
              className="flex h-11 min-w-[68px] items-center justify-center rounded-lg border border-[#E59838] bg-[#E59838] px-3 font-mono text-xs font-bold text-[#090D14] active:scale-95"
            >
              SURYA
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onDash();
            }}
            className={`flex h-12 min-w-[68px] items-center justify-center rounded-lg border px-3 font-mono text-xs font-bold active:scale-95 ${
              dashReady
                ? 'border-[#F4EFE6]/45 bg-[#162030]/90 text-[#F4EFE6]'
                : 'border-[#F4EFE6]/15 bg-[#0D131D]/70 text-[#9C9486]'
            }`}
          >
            DASH
          </button>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setFiringPressed(true);
            onFire(true);
          }}
          onPointerUp={() => {
            setFiringPressed(false);
            onFire(false);
          }}
          onPointerCancel={() => {
            setFiringPressed(false);
            onFire(false);
          }}
          className={`flex h-20 w-20 items-center justify-center rounded-full border-2 font-display text-xs font-bold tracking-wide transition-transform active:scale-95 ${
            firingPressed
              ? 'border-[#F4EFE6] bg-[#E59838] text-[#090D14]'
              : 'border-[#E59838] bg-[#E59838]/25 text-[#F4EFE6]'
          }`}
        >
          TEMBAK
        </button>
      </div>
    </div>
  );
}

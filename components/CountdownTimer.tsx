"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function diff(target: number): Parts {
  const ms = Math.max(0, target - Date.now());
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

export function CountdownTimer({ targetISO }: { targetISO: string }) {
  const target = new Date(targetISO).getTime();
  const [parts, setParts] = useState<Parts>(() => diff(target));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setParts(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const ended =
    mounted && parts.days === 0 && parts.hours === 0 && parts.minutes === 0 && parts.seconds === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.4em] text-gold/80">
        {ended ? "AO VIVO AGORA" : "Sorteio em"}
      </span>
      <div
        className="grid grid-cols-4 gap-2 sm:gap-4"
        suppressHydrationWarning
      >
        {[
          { label: "DIAS", value: parts.days },
          { label: "HORAS", value: parts.hours },
          { label: "MIN", value: parts.minutes },
          { label: "SEG", value: parts.seconds },
        ].map((unit) => (
          <div
            key={unit.label}
            className="flex min-w-[68px] flex-col items-center rounded-2xl border border-gold/20 bg-ink-900/70 px-4 py-3 sm:min-w-[96px] sm:px-6 sm:py-5"
          >
            <span
              className="font-display text-3xl font-extrabold tabular-nums text-shine-gold sm:text-5xl"
              suppressHydrationWarning
            >
              {pad(unit.value)}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-400 sm:text-xs">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

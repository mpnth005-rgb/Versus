"use client";

import { useState } from "react";

import { LOADING_TIPS } from "@/lib/loading-tips";

const TIPS_SHOWN = 5;
// Each tip stays 8 s (see .animate-load-tip in globals.css).
const TIP_SECONDS = 8;

/** Five different tips, in random order. */
function drawTips(): string[] {
  return [...LOADING_TIPS].sort(() => Math.random() - 0.5).slice(0, TIPS_SHOWN);
}

/** Full-screen wait during AI work. `progress` (0–1) comes from the route's
 * progress stream (lib/progress-stream.ts); the bar glides between reports.
 * Under it, five tips drawn at random for this loading take turns. */
export function LoadingScreen({ progress }: { progress: number }) {
  const [tips] = useState(drawTips);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[30px] bg-paper">
      <div className="font-serif text-[38px] font-semibold text-ink">V</div>
      <div className="h-[5px] w-80 overflow-hidden rounded-[3px] bg-paper-alt-2">
        <div
          className="h-full rounded-[3px] bg-accent transition-[width] duration-(--motion-slow) ease-out"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>
      {/* Two lines tall: the longest tips wrap. */}
      <div className="relative h-10 w-[360px] text-center text-sm leading-5 text-muted-light">
        {tips.map((tip, i) => (
          <div
            key={tip}
            className="animate-load-tip absolute inset-x-0 top-0"
            style={{ animationDelay: `${i * TIP_SECONDS}s` }}
          >
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { formatShortDate, formatScore } from "@/lib/format";

type Session = {
  id: string;
  title: string;
  textType: keyof typeof TEXT_TYPE_LABELS;
  level: keyof typeof LEVEL_LABELS;
  score: number;
  createdAt: Date;
};

// Rows are 53px (py-4 + 20px line + 1px border). The list shows 5 at a
// time and scrolls, snapping row by row, beyond that; the arrows move it
// one row at a time and grey out at either end.
const ROW_HEIGHT = 53;
const VISIBLE_ROWS = 5;

export function HistoryList({ sessions }: { sessions: Session[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  function updateArrows() {
    const el = listRef.current;
    if (!el) return;
    setCanUp(el.scrollTop > 0);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }

  useEffect(updateArrows, [sessions.length]);

  function scrollRow(dir: 1 | -1) {
    listRef.current?.scrollBy({ top: dir * ROW_HEIGHT, behavior: "smooth" });
  }

  const arrowClass = (enabled: boolean) =>
    "flex h-7 w-7 items-center justify-center rounded-lg border text-[13px] " +
    (enabled
      ? "cursor-pointer border-border-strong text-ink-40"
      : "cursor-default border-border-soft text-muted-ghost");

  return (
    <>
      <div
        ref={listRef}
        onScroll={updateArrows}
        style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS }}
        className="snap-y snap-mandatory overflow-y-auto"
      >
        {sessions.map((s) => (
          <div
            key={s.id}
            className="grid snap-start grid-cols-[2.2fr_1.6fr_1fr_1fr] items-center border-t border-border-soft px-6 py-4 text-sm"
          >
            <div className="truncate pr-4 text-ink-softer" title={s.title}>
              {s.title}
            </div>
            <div className="text-muted-light">
              {TEXT_TYPE_LABELS[s.textType]} · {LEVEL_LABELS[s.level]}
            </div>
            <div className="font-semibold text-accent">{formatScore(s.score)}/20</div>
            <div className="text-muted-light">{formatShortDate(s.createdAt)}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3.5 border-t border-border-soft py-3">
        <button
          type="button"
          disabled={!canUp}
          onClick={() => scrollRow(-1)}
          className={arrowClass(canUp)}
          aria-label="Exercices plus récents"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={!canDown}
          onClick={() => scrollRow(1)}
          className={arrowClass(canDown)}
          aria-label="Exercices plus anciens"
        >
          ↓
        </button>
      </div>
    </>
  );
}

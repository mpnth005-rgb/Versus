"use client";

import { useEffect, useRef, useState } from "react";

import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { formatScore, formatShortDate } from "@/lib/format";
import { scoreY, SCORE_MAX } from "@/lib/charts";

type Point = { id: string; textType: string; level: string; score: number; date: Date };

// Same vertical scale as lib/charts (viewBox 220 tall, 0 at y=199, 20 at
// y=10), so gridlines and labels line up with scoreY().
const VIEW_W = 560;
const VIEW_H = 220;

export const LEVELS = ["A2", "B1", "B2", "C1"];
export const TEXT_TYPES = ["LITERARY", "JOURNALISTIC", "DAILY"];

export function FilterSelect({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  labels: Record<string, string>;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choices: (string | null)[] = [null, ...options];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          "flex cursor-pointer items-center gap-1.5 rounded-lg border bg-white py-1.5 pr-3 pl-3 text-[12.5px] " +
          (open ? "border-ink" : "border-border-strong")
        }
      >
        <span className="text-muted-light">{label}</span>
        <span className="font-semibold text-ink-softer">{value === null ? "Tous" : labels[value]}</span>
        <span className="ml-1.5 text-[9px] text-ink-40">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 min-w-full rounded-xl border border-border bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          {choices.map((choice) => {
            const selected = choice === value;
            return (
              <li key={choice ?? "all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(choice);
                    setOpen(false);
                  }}
                  className={
                    "flex w-full cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-left text-[13px] whitespace-nowrap " +
                    (selected
                      ? "bg-paper-alt-2 font-semibold text-ink"
                      : "text-ink-40 hover:bg-paper-alt")
                  }
                >
                  {choice === null ? "Tous" : labels[choice]}
                  {selected && <span>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * "Évolution du score": every exercise as a dot at its date and score, and
 * the running average up to each date as a line. Hovering a dot shows its
 * date, type, level, score and the average at that point. Positions are in
 * % of the plot so dots stay round however wide the card is.
 */
export function ScoreChart({ exercises }: { exercises: Point[] }) {
  const [level, setLevel] = useState<string | null>(null);
  const [textType, setTextType] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const shown = exercises.filter(
    (e) => (level === null || e.level === level) && (textType === null || e.textType === textType)
  );

  // One point per day: the average of every shown score up to the end of
  // that day, plus how many exercises were done that day (for the tooltip).
  const dayOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = [...new Set(shown.map((e) => dayOf(e.date)))].map((day) => {
    const upTo = shown.filter((e) => dayOf(e.date) <= day).map((e) => e.score);
    return {
      day,
      avg: Math.round((upTo.reduce((a, b) => a + b, 0) / upTo.length) * 10) / 10,
      count: shown.filter((e) => dayOf(e.date) === day).length,
    };
  });

  const t0 = days[0]?.day ?? 0;
  const t1 = days[days.length - 1]?.day ?? 0;
  const xPct = (day: number) => (t1 === t0 ? 50 : ((day - t0) / (t1 - t0)) * 100);
  const yPct = (score: number) => (scoreY(score) / VIEW_H) * 100;

  const avgLine = days.map((d) => `${(xPct(d.day) / 100) * VIEW_W},${scoreY(d.avg)}`).join(" ");
  const xLabels =
    days.length === 0
      ? []
      : t1 === t0
        ? [{ left: 50, date: new Date(t0) }]
        : [0, 50, 100].map((left) => ({ left, date: new Date(t0 + ((t1 - t0) * left) / 100) }));

  const active = days.find((d) => d.day === hovered) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-ink-softer">Évolution du score</div>
        <div className="flex gap-2">
          <FilterSelect label="Niveau" value={level} options={LEVELS} labels={LEVEL_LABELS} onChange={setLevel} />
          <FilterSelect
            label="Type"
            value={textType}
            options={TEXT_TYPES}
            labels={TEXT_TYPE_LABELS}
            onChange={setTextType}
          />
        </div>
      </div>

      {days.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-light">Aucune donnée</div>
      ) : (
        <div>
          <div className="flex gap-2">
            <div className="relative h-[200px] w-[34px] flex-shrink-0 text-[11px] text-muted-light">
              {[SCORE_MAX, SCORE_MAX / 2, 0].map((v) => (
                <span
                  key={v}
                  className="absolute right-1.5 -translate-y-1/2 leading-none"
                  style={{ top: `${yPct(v)}%` }}
                >
                  {v}
                </span>
              ))}
            </div>
            <div className="relative h-[200px] w-full">
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                {[SCORE_MAX, SCORE_MAX / 2].map((v) => (
                  <line
                    key={v}
                    x1="0"
                    y1={scoreY(v)}
                    x2={VIEW_W}
                    y2={scoreY(v)}
                    stroke="var(--color-border-soft)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line
                  x1="0"
                  y1={scoreY(0)}
                  x2={VIEW_W}
                  y2={scoreY(0)}
                  stroke="var(--color-border-strong)"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={avgLine}
                  fill="none"
                  stroke="var(--color-accent-dark)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* A single day has no line to draw: show its average as a dot
                  as thick as the line instead. */}
              {days.length === 1 && (
                <span
                  className="absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-dark"
                  style={{ left: `${xPct(days[0].day)}%`, top: `${yPct(days[0].avg)}%` }}
                />
              )}

              {/* Invisible hover target on each day of the line; the hovered
                  day shows as a ringed dot with its tooltip. */}
              {days.map((d) => (
                <span
                  key={d.day}
                  onMouseEnter={() => setHovered(d.day)}
                  onMouseLeave={() => setHovered((h) => (h === d.day ? null : h))}
                  className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center"
                  style={{ left: `${xPct(d.day)}%`, top: `${yPct(d.avg)}%` }}
                >
                  {d.day === hovered && (
                    <span className="h-3 w-3 rounded-full bg-accent-dark ring-2 ring-white outline-2 outline-accent-dark" />
                  )}
                </span>
              ))}

              {active && (
                <div
                  className={
                    "pointer-events-none absolute z-10 -translate-y-[calc(100%+12px)] rounded-lg bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-white " +
                    (xPct(active.day) < 15
                      ? ""
                      : xPct(active.day) > 85
                        ? "-translate-x-full"
                        : "-translate-x-1/2")
                  }
                  style={{ left: `${xPct(active.day)}%`, top: `${yPct(active.avg)}%` }}
                >
                  <div className="font-semibold">{formatShortDate(new Date(active.day))}</div>
                  <div className="text-white/70">
                    Moyenne à date {formatScore(active.avg)}/20 · {active.count} exercice
                    {active.count === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="relative ml-[42px] mt-3 h-4 text-[11.5px] font-medium text-ink-40">
            {xLabels.map((l) => (
              <span
                key={l.left}
                className={
                  "absolute whitespace-nowrap " +
                  (l.left === 0 ? "" : l.left === 100 ? "-translate-x-full" : "-translate-x-1/2")
                }
                style={{ left: `${l.left}%` }}
              >
                {formatShortDate(l.date)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

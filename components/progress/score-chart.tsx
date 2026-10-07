"use client";

import { useEffect, useRef, useState } from "react";

import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { formatScore, formatShortDate } from "@/lib/format";
import { scoreY, SCORE_MAX } from "@/lib/charts";

type Point = {
  id: string;
  textType: string;
  level: string;
  score: number;
  date: Date;
};

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
          "press-field flex cursor-pointer items-center gap-1.5 rounded-lg border bg-white py-1.5 pr-3 pl-3 text-[12.5px] " +
          (open ? "border-ink" : "border-border-strong")
        }
      >
        <span className="text-muted-light">{label}</span>
        <span className="font-semibold text-ink-softer">
          {value === null ? "Tous" : labels[value]}
        </span>
        <span className="ml-1.5 text-[9px] text-ink-40">
          {open ? "▴" : "▾"}
        </span>
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

// "all" = the whole history (default); "month" / "week" = one period at a
// time, navigated with ‹ ›.
type Granularity = "all" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const dayOf = (d: Date) =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

type XY = [number, number];

const MORPH_MS = 450;
const MORPH_SAMPLES = 120;
const easeInOutCubic = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;

/** The part of a polyline (viewBox units) that lies within 0…VIEW_W,
 * cut exactly at both edges. */
function clipToView(points: XY[]): XY[] {
  if (points.length < 2) return points;
  const out: XY[] = [];
  const at = (p: XY, q: XY, x: number): XY => [x, p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0])];
  for (let i = 0; i < points.length - 1; i++) {
    const [p, q] = [points[i], points[i + 1]];
    if (q[0] < 0 || p[0] > VIEW_W) continue;
    const start = p[0] < 0 ? at(p, q, 0) : p;
    const end = q[0] > VIEW_W ? at(p, q, VIEW_W) : q;
    if (out.length === 0) out.push(start);
    out.push(end);
  }
  return out;
}

/** `count` points evenly spread along the x span of a polyline. */
function resample(points: XY[], count: number): XY[] {
  if (points.length === 1) return Array.from({ length: count }, () => points[0]);
  const x0 = points[0][0];
  const x1 = points[points.length - 1][0];
  let segment = 0;
  return Array.from({ length: count }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / (count - 1);
    while (segment < points.length - 2 && points[segment + 1][0] < x) segment++;
    const [p, q] = [points[segment], points[segment + 1]];
    const t = q[0] === p[0] ? 0 : (x - p[0]) / (q[0] - p[0]);
    return [x, p[1] + (q[1] - p[1]) * t];
  });
}

const toPoints = (line: string): XY[] =>
  line ? line.split(" ").map((pair) => pair.split(",").map(Number) as XY) : [];
const toLine = (points: XY[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * The score line actually drawn: when the criteria change (period, Niveau,
 * Type), it morphs from its current shape into the new one — only the line
 * moves, the axes and labels switch at once. An interrupted morph restarts
 * from wherever it had got to.
 */
function useMorphedLine(line: string): string {
  const [drawn, setDrawn] = useState(line);
  const current = useRef(line);

  useEffect(() => {
    const from = clipToView(toPoints(current.current));
    const to = clipToView(toPoints(line));
    let frame = 0;
    if (from.length === 0 || to.length === 0) {
      frame = requestAnimationFrame(() => {
        current.current = line;
        setDrawn(line);
      });
      return () => cancelAnimationFrame(frame);
    }
    const a = resample(from, MORPH_SAMPLES);
    const b = resample(to, MORPH_SAMPLES);
    const startedAt = performance.now();
    const step = (time: number) => {
      const k = Math.min(1, (time - startedAt) / MORPH_MS);
      const e = easeInOutCubic(k);
      // Ends on the exact new line (not its resampled version).
      const next =
        k === 1
          ? line
          : toLine(a.map(([x, y], i) => [x + (b[i][0] - x) * e, y + (b[i][1] - y) * e]));
      current.current = next;
      setDrawn(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [line]);

  return drawn;
}

/** [start, end) of the week (Monday-based) or month that is `offset`
 * periods before the one containing `now`, as UTC day timestamps. */
function periodBounds(
  now: Date,
  granularity: "week" | "month",
  offset: number,
) {
  if (granularity === "month") {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1);
    const d = new Date(start);
    return { start, end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) };
  }
  const today = dayOf(now);
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
  const start = monday - offset * 7 * DAY_MS;
  return { start, end: start + 7 * DAY_MS };
}

function periodLabel(
  start: number,
  end: number,
  granularity: "week" | "month",
): string {
  const d = new Date(start);
  if (granularity === "month")
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${formatShortDate(d)} – ${formatShortDate(new Date(end - DAY_MS))}`;
}

const average = (scores: number[]) =>
  Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

/**
 * "Évolution du score": the whole history ("Tout", default) or one week or
 * month at a time. The line is the running average of
 * every shown score up to each day (the "moyenne à date"), drawn across the
 * whole period — a period still in progress just stops at its last exercise.
 * The line is one continuous curve across periods: it also runs to the last
 * exercise day before the period and the first one after it, plotted
 * outside the visible range and clipped at the edges, so it enters from the
 * left and leaves to the right exactly as it would on a single long chart.
 * A period without any exercise shows "Aucune donnée". Positions are in % of the plot
 * so markers stay round however wide the card is.
 */
export function ScoreChart({
  exercises,
  now: nowIso,
}: {
  exercises: Point[];
  now: string;
}) {
  const now = new Date(nowIso);
  const [granularity, setGranularity] = useState<Granularity>("all");
  const [offset, setOffset] = useState(0);
  // Last period picked: on "Tout", the period selector keeps showing it
  // while it slides away.
  const [periodKind, setPeriodKind] = useState<"week" | "month">("month");
  const [level, setLevel] = useState<string | null>(null);
  const [textType, setTextType] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const shown = exercises.filter(
    (e) =>
      (level === null || e.level === level) &&
      (textType === null || e.textType === textType),
  );
  const shownDays = [...new Set(shown.map((e) => dayOf(e.date)))];
  // "Tout" spans the first to the last shown exercise day, like the original
  // overview; a week or month spans that whole period.
  const { start, end } =
    granularity === "all"
      ? {
          start: shownDays[0] ?? dayOf(now),
          end: (shownDays[shownDays.length - 1] ?? dayOf(now)) + DAY_MS,
        }
      : periodBounds(now, granularity, offset);
  const firstEver = exercises.length > 0 ? dayOf(exercises[0].date) : start;

  // One point per exercise day: the average of every shown score up to the
  // end of that day, plus that day's count (for the tooltip).
  const pointFor = (day: number) => ({
    day,
    avg: average(shown.filter((e) => dayOf(e.date) <= day).map((e) => e.score)),
    count: shown.filter((e) => dayOf(e.date) === day).length,
  });
  const days = shownDays
    .filter((day) => day >= start && day < end)
    .map(pointFor);

  const lastDay = end - DAY_MS;
  const xPct = (day: number) =>
    lastDay === start ? 50 : ((day - start) / (lastDay - start)) * 100;
  const yPct = (score: number) => (scoreY(score) / VIEW_H) * 100;

  // The curve runs through every exercise day, so it stays continuous
  // across period boundaries; the SVG clips what falls outside the period.
  const linePoints = days.length === 0 ? [] : shownDays.map(pointFor);
  const avgLine = linePoints
    .map((d) => `${(xPct(d.day) / 100) * VIEW_W},${scoreY(d.avg)}`)
    .join(" ");
  const drawnLine = useMorphedLine(avgLine);
  const midDay = start + Math.floor((lastDay - start) / DAY_MS / 2) * DAY_MS;
  const xLabels = (
    lastDay === start
      ? []
      : [
          { left: 0, text: formatShortDate(new Date(start)) },
          { left: xPct(midDay), text: formatShortDate(new Date(midDay)) },
          { left: 100, text: formatShortDate(new Date(lastDay)) },
        ]
  ).concat(
    lastDay === start
      ? [{ left: 50, text: formatShortDate(new Date(start)) }]
      : [],
  );

  const active = days.find((d) => d.day === hovered) ?? null;
  const canGoBack = start > firstEver;
  const canGoForward = offset > 0;

  function changeGranularity(next: Granularity) {
    setGranularity(next);
    setOffset(0);
    if (next !== "all") setPeriodKind(next);
  }
  const isAll = granularity === "all";
  const navBounds = isAll ? periodBounds(now, periodKind, 0) : { start, end };

  const arrow = (
    enabled: boolean,
    onClick: () => void,
    label: string,
    glyph: string,
  ) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      aria-label={label}
      className={
        "press-icon flex h-5 w-5 items-center justify-center rounded-[5px] text-[12px] " +
        (enabled
          ? "cursor-pointer text-ink-40"
          : "cursor-default text-muted-ghost")
      }
    >
      {glyph}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-ink-softer">
          Évolution du score
        </div>
        <div className="flex items-center">
          <div className="flex rounded-lg bg-paper-alt-2 p-0.5">
            {(["all", "month", "week"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => changeGranularity(g)}
                className={
                  "cursor-pointer rounded-md px-3 py-1 text-[12.5px] transition-colors " +
                  (granularity === g
                    ? "bg-white font-semibold text-ink-softer shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "font-medium text-muted-light hover:text-ink")
                }
              >
                {g === "all" ? "Tout" : g === "month" ? "Mois" : "Semaine"}
              </button>
            ))}
          </div>
          {/* "‹ Mois ›" opens out next to the toggle (0fr ↔ 1fr, like the
              sidebar) while fading, so Tout/Mois/Semaine glides aside
              instead of jumping. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: isAll ? "0fr" : "1fr",
              opacity: isAll ? 0 : 1,
              transition: isAll
                ? "grid-template-columns 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease"
                : "grid-template-columns 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease 0.08s",
            }}
            inert={isAll}
          >
            <div className="min-w-0 overflow-hidden">
              <div className="flex w-max items-center gap-1.5 pl-4 text-[12.5px] font-medium text-ink-softer">
                {arrow(
                  !isAll && canGoBack,
                  () => setOffset((o) => o + 1),
                  "Période précédente",
                  "‹",
                )}
                <span className="whitespace-nowrap">
                  {periodLabel(navBounds.start, navBounds.end, isAll ? periodKind : granularity)}
                </span>
                {arrow(
                  !isAll && canGoForward,
                  () => setOffset((o) => o - 1),
                  "Période suivante",
                  "›",
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <FilterSelect
          label="Niveau"
          value={level}
          options={LEVELS}
          labels={LEVEL_LABELS}
          onChange={setLevel}
        />
        <FilterSelect
          label="Type"
          value={textType}
          options={TEXT_TYPES}
          labels={TEXT_TYPE_LABELS}
          onChange={setTextType}
        />
      </div>

      {days.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-light">
          Aucune donnée
        </div>
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
                  points={drawnLine}
                  fill="none"
                  stroke="var(--color-accent-dark)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* A single day with no neighbour on either side: no line to draw, so
                  show that day's average as a dot as thick as the line. */}
              {linePoints.length === 1 && (
                <span
                  className="absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-dark"
                  style={{
                    left: `${xPct(linePoints[0].day)}%`,
                    top: `${yPct(linePoints[0].avg)}%`,
                  }}
                />
              )}

              {/* Cursor: anywhere over the plot snaps to the nearest exercise
                  day, marked by a dashed vertical line, a hollow dot on the
                  line and the tooltip. */}
              <div
                className="absolute inset-0"
                onMouseMove={(e) => {
                  if (days.length === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  const nearest = days.reduce((best, d) =>
                    Math.abs(xPct(d.day) - pct) < Math.abs(xPct(best.day) - pct)
                      ? d
                      : best,
                  );
                  setHovered(nearest.day);
                }}
                onMouseLeave={() => setHovered(null)}
              />
              {active && (
                <>
                  <span
                    className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-[oklch(0.8_0.01_90)]"
                    style={{ left: `${xPct(active.day)}%` }}
                  />
                  <span
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent-dark bg-white"
                    style={{
                      left: `${xPct(active.day)}%`,
                      top: `${yPct(active.avg)}%`,
                    }}
                  />
                </>
              )}

              {active && (
                <div
                  className={
                    "pointer-events-none absolute z-10 -translate-y-[calc(100%+12px)] rounded-lg bg-ink px-3 py-2 text-[12px] leading-[1.45] whitespace-nowrap text-white shadow-[0_6px_16px_rgba(0,0,0,0.18)] " +
                    (xPct(active.day) < 15
                      ? ""
                      : xPct(active.day) > 85
                        ? "-translate-x-full"
                        : "-translate-x-1/2")
                  }
                  style={{
                    left: `${xPct(active.day)}%`,
                    top: `${yPct(active.avg)}%`,
                  }}
                >
                  <div className="font-semibold">
                    {formatShortDate(new Date(active.day))}
                  </div>
                  <div className="text-[oklch(0.85_0.01_90)]">
                    Moyenne à date {formatScore(active.avg)}/20 · {active.count}{" "}
                    exercice
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
                  (l.left === 0
                    ? ""
                    : l.left === 100
                      ? "-translate-x-full"
                      : "-translate-x-1/2")
                }
                style={{ left: `${l.left}%` }}
              >
                {l.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

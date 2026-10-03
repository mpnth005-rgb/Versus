"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { formatScore } from "@/lib/format";
import { buildWeeklyBars } from "@/lib/charts";
import { ScoreChart, FilterSelect, LEVELS, TEXT_TYPES } from "@/components/progress/score-chart";

type Exercise = {
  id: string;
  title: string;
  textType: string;
  level: string;
  score: number;
  createdAt: string;
};

type Dimension = "level" | "textType";

const GROUPS: Record<Dimension, string[]> = { level: LEVELS, textType: TEXT_TYPES };
const GROUP_LABELS: Record<Dimension, Record<string, string>> = {
  level: LEVEL_LABELS,
  textType: TEXT_TYPE_LABELS,
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS_SHOWN = 7;

const yearMonthOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const monthName = (yearMonth: string) => MONTHS[Number(yearMonth.slice(5)) - 1];

function average(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}


/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date): number {
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

function Toggle({ value, onChange }: { value: Dimension; onChange: (v: Dimension) => void }) {
  const option = (v: Dimension, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={
        "cursor-pointer px-3 py-1.5 text-[11.5px] font-semibold " +
        (value === v ? "bg-ink text-white" : "bg-white text-ink-40")
      }
    >
      {label}
    </button>
  );
  return (
    <div className="flex overflow-hidden rounded-lg border border-border-strong">
      {option("level", "Niveau")}
      {option("textType", "Type de texte")}
    </div>
  );
}

function Chevron({
  dir,
  enabled,
  onClick,
  label,
}: {
  dir: "prev" | "next";
  enabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      aria-label={label}
      className={
        "px-1 text-[13px] " + (enabled ? "cursor-pointer text-ink-40" : "cursor-default text-muted-ghost")
      }
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

const card = "rounded-xl border border-border bg-white";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-light";

export function ProgressDashboard({
  exercises: raw,
  now: nowIso,
}: {
  exercises: Exercise[];
  // Taken on the server so renders stay pure (no Date.now() in render).
  now: string;
}) {
  const now = new Date(nowIso);
  const exercises = useMemo(
    () => raw.map((e) => ({ ...e, date: new Date(e.createdAt) })),
    [raw]
  );

  const months = useMemo(
    () => [...new Set(exercises.map((e) => yearMonthOf(e.date)))].sort(),
    [exercises]
  );
  const [month, setMonth] = useState(() => months[months.length - 1] ?? yearMonthOf(now));
  const [groupDim, setGroupDim] = useState<Dimension>("level");

  // --- Headline cards -----------------------------------------------------
  const globalAvg = average(exercises.map((e) => e.score));
  const scoresIn = (ym: string) => exercises.filter((e) => yearMonthOf(e.date) === ym).map((e) => e.score);
  const monthAvg = average(scoresIn(month));
  const monthIndex = months.indexOf(month);

  // --- Per level / text type ----------------------------------------------
  const groups = GROUPS[groupDim].map((key) => {
    const items = exercises.filter((e) => e[groupDim] === key);
    return {
      key,
      count: items.length,
      avg: average(items.map((e) => e.score)),
      best: items.length > 0 ? Math.max(...items.map((e) => e.score)) : null,
    };
  });

  // --- Weekly bars ----------------------------------------------------------
  // Weeks are numbered from the week of the first exercise (S1).
  const firstWeek = exercises.length > 0 ? weekStart(exercises[0].date) : weekStart(now);
  const currentWeekNumber = Math.floor((weekStart(now) - firstWeek) / WEEK_MS) + 1;
  const lastWeekShown = Math.max(WEEKS_SHOWN, currentWeekNumber);
  const [windowEnd, setWindowEnd] = useState(lastWeekShown);
  const [weekLevel, setWeekLevel] = useState<string | null>(null);
  const [weekType, setWeekType] = useState<string | null>(null);
  const windowStart = windowEnd - WEEKS_SHOWN + 1;
  const weekNumbers = Array.from({ length: WEEKS_SHOWN }, (_, i) => windowStart + i);
  // Same Niveau / Type filters as the score chart; week numbering stays
  // anchored on the very first exercise so S1…Sn don't shift with them.
  const weekExercises = exercises.filter(
    (e) => (weekLevel === null || e.level === weekLevel) && (weekType === null || e.textType === weekType)
  );
  const weekCounts = weekNumbers.map((n) => {
    const from = firstWeek + (n - 1) * WEEK_MS;
    return weekExercises.filter((e) => e.date.getTime() >= from && e.date.getTime() < from + WEEK_MS).length;
  });
  const bars = buildWeeklyBars(weekCounts);
  const windowFirstMonth = monthName(yearMonthOf(new Date(firstWeek + (windowStart - 1) * WEEK_MS)));
  const windowLastMonth = monthName(yearMonthOf(new Date(firstWeek + windowEnd * WEEK_MS - DAY_MS)));
  const windowMonths =
    windowFirstMonth === windowLastMonth ? windowFirstMonth : `${windowFirstMonth} – ${windowLastMonth}`;

  const yLabel = (top: number, text: string | number) => (
    <span
      key={top}
      className="absolute right-1.5 -translate-y-1/2 leading-none"
      style={{ top: `${(top / bars.height) * 100}%` }}
    >
      {text}
    </span>
  );

  return (
    <div className="flex flex-col gap-7 py-12 px-16">
      <div className="flex items-center justify-between">
        <div className="font-serif text-[30px] font-semibold text-ink">Suivi de progression</div>
        <Link
          href="/progress/history"
          className="rounded-lg border border-border-strong bg-white px-4.5 py-2.5 text-[13px] font-semibold text-ink-40"
        >
          Historique des exercices →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className={card + " px-6 py-5"}>
          <div className={eyebrow}>Exercices réalisés</div>
          <div className="mt-1.5 font-serif text-[28px] font-semibold text-ink">{exercises.length}</div>
        </div>
        <div className={card + " px-6 py-5"}>
          <div className={eyebrow}>Score moyen global</div>
          <div className="mt-1.5 font-serif text-[28px] font-semibold text-ink">
            {globalAvg !== null ? formatScore(globalAvg) : "—"}
            <span className="text-[15px] text-muted-light">/20</span>
          </div>
        </div>
        <div className={card + " px-6 py-5"}>
          <div className="flex items-center justify-between">
            <div className={eyebrow}>Score du mois</div>
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-40">
              <Chevron
                dir="prev"
                label="Mois précédent"
                enabled={monthIndex > 0}
                onClick={() => setMonth(months[monthIndex - 1])}
              />
              <span className="capitalize">
                {monthName(month)} {month.slice(0, 4)}
              </span>
              <Chevron
                dir="next"
                label="Mois suivant"
                enabled={monthIndex !== -1 && monthIndex < months.length - 1}
                onClick={() => setMonth(months[monthIndex + 1])}
              />
            </div>
          </div>
          <div className="mt-1.5 font-serif text-[28px] font-semibold text-ink">
            {monthAvg !== null ? formatScore(monthAvg) : "—"}
            <span className="text-[15px] text-muted-light">/20</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-softer">
            Score moyen par {groupDim === "level" ? "niveau" : "type de texte"}
          </div>
          <Toggle value={groupDim} onChange={setGroupDim} />
        </div>
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
        >
          {groups.map((g) => (
            <div key={g.key} className={card + " flex flex-col gap-3 px-5 py-4.5"}>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-paper-alt-2 px-2 py-0.5 text-[11.5px] font-semibold text-ink-40">
                  {GROUP_LABELS[groupDim][g.key]}
                </span>
                <span className="text-[11.5px] text-muted-light">
                  {g.count} exercice{g.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="font-serif text-[30px] font-semibold text-ink">
                {g.avg !== null ? formatScore(g.avg) : "—"}
                <span className="text-[15px] text-muted-light">/20</span>
              </div>
              <div className="border-t border-border-soft pt-2.5">
                <div className="text-[10px] font-semibold uppercase text-muted-light">Meilleur</div>
                <div className="text-[13px] font-semibold text-ink-softer">
                  {g.best !== null ? formatScore(g.best) : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-5">
        <div className={card + " min-w-0 flex-[1.4] px-7 py-6"}>
          <ScoreChart exercises={exercises} now={nowIso} />
        </div>

        <div className={card + " flex min-w-0 flex-1 flex-col gap-4 px-7 py-6"}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-ink-softer">Exercices par semaine</div>
            <div className="flex gap-2">
              <FilterSelect
                label="Niveau"
                value={weekLevel}
                options={LEVELS}
                labels={LEVEL_LABELS}
                onChange={setWeekLevel}
              />
              <FilterSelect
                label="Type"
                value={weekType}
                options={TEXT_TYPES}
                labels={TEXT_TYPE_LABELS}
                onChange={setWeekType}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[11.5px] text-muted-light">
              Semaines {windowStart} à {windowEnd} · {windowMonths}
            </div>
            <div className="flex items-center gap-1.5">
              <Chevron
                dir="prev"
                label="Semaines précédentes"
                enabled={windowStart > 1}
                onClick={() => setWindowEnd((w) => Math.max(WEEKS_SHOWN, w - WEEKS_SHOWN))}
              />
              <Chevron
                dir="next"
                label="Semaines suivantes"
                enabled={windowEnd < lastWeekShown}
                onClick={() => setWindowEnd((w) => Math.min(lastWeekShown, w + WEEKS_SHOWN))}
              />
            </div>
          </div>
          <div>
            <div className="flex gap-2">
              <div className="relative h-[200px] w-[34px] flex-shrink-0 text-[11px] text-muted-light">
                {[
                  [10, bars.axisMax],
                  [104.5, bars.axisMax / 2],
                  [199, 0],
                ].map(([top, v]) => yLabel(top, formatScore(v)))}
              </div>
              <svg
                viewBox={`0 0 ${bars.width} ${bars.height}`}
                preserveAspectRatio="none"
                className="h-[200px] w-full"
              >
                {[10, 104.5].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2={bars.width}
                    y2={y}
                    stroke="var(--color-border-soft)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {bars.bars.map((bar, i) => (
                  <rect
                    key={i}
                    x={bar.x}
                    y={bar.y}
                    width="26"
                    height={bar.height}
                    // The current week stands out; past weeks stay light.
                    fill={
                      weekNumbers[i] === currentWeekNumber
                        ? "var(--color-accent)"
                        : "var(--color-accent-light)"
                    }
                  />
                ))}
                <line
                  x1="0"
                  y1="199"
                  x2={bars.width}
                  y2="199"
                  stroke="var(--color-border-strong)"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="relative ml-[42px] mt-2 h-4 text-[11px] text-muted-light">
              {bars.bars.map((bar, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${((bar.x + 13) / bars.width) * 100}%` }}
                >
                  S{weekNumbers[i]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

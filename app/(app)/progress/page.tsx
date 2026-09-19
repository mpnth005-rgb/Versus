import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getProgressOverview, getSessionsHistory } from "@/lib/progress";
import { buildScoreLinePoints, buildWeeklyBars } from "@/lib/charts";
import { formatShortDate } from "@/lib/format";
import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { month, page } = await searchParams;
  const pageNum = Math.max(0, Number(page ?? 0) || 0);

  const [overview, history] = await Promise.all([
    getProgressOverview(session.user.id, month),
    getSessionsHistory(session.user.id, pageNum),
  ]);

  const canGoPrevMonth = overview.availableMonths.some((m) => m < overview.selectedMonth);
  const canGoNextMonth = overview.availableMonths.some((m) => m > overview.selectedMonth);

  const { linePoints, areaPoints, width: lineWidth, height: lineHeight } =
    buildScoreLinePoints(overview.recentScores);
  const { bars, width: barWidth, height: barHeight, axisMax } = buildWeeklyBars(
    overview.weeklyCounts
  );

  return (
    <div className="flex flex-col gap-8 py-12 px-16">
      <div className="font-serif text-[30px] font-semibold text-ink">Suivi de progression</div>

      <div className="flex gap-5">
        <div className="flex-1 rounded-xl border border-border bg-white px-6 py-5">
          <div className="mb-1.5 text-xs font-semibold uppercase text-muted-light">
            Exercices réalisés
          </div>
          <div className="font-serif text-[28px] font-semibold text-ink">
            {overview.exercisesCount}
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-white px-6 py-5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-light">
              Score moyen
            </div>
            <div className="flex items-center gap-2.5 text-[11.5px] font-medium text-accent">
              {canGoPrevMonth ? (
                <Link href={`/progress?month=${shiftMonth(overview.selectedMonth, -1)}`}>
                  ‹
                </Link>
              ) : (
                <span className="text-muted-ghost">‹</span>
              )}
              <span>{monthLabel(overview.selectedMonth)}</span>
              {canGoNextMonth ? (
                <Link href={`/progress?month=${shiftMonth(overview.selectedMonth, 1)}`}>
                  ›
                </Link>
              ) : (
                <span className="text-muted-ghost">›</span>
              )}
            </div>
          </div>
          <div className="font-serif text-[28px] font-semibold text-accent">
            {overview.avgScore !== null ? `${overview.avgScore}/100` : "—"}
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="flex-[1.4] rounded-xl border border-border bg-white px-7 py-6">
          <div className="mb-4 text-sm font-semibold text-ink-softer">Évolution du score</div>
          {overview.recentScores.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted-light">
              Pas encore de données.
            </div>
          ) : (
            <div className="flex gap-2">
              <svg viewBox="0 0 40 200" className="h-[200px] w-[34px] flex-shrink-0">
                <text x="32" y="14" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">100</text>
                <text x="32" y="102" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">50</text>
                <text x="32" y="196" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">0</text>
              </svg>
              <svg viewBox={`0 0 ${lineWidth} ${lineHeight}`} className="h-[220px] w-full">
                <line x1="0" y1="10" x2={lineWidth} y2="10" stroke="var(--color-border-soft)" strokeWidth="1" />
                <line x1="0" y1="102" x2={lineWidth} y2="102" stroke="var(--color-border-soft)" strokeWidth="1" />
                <polygon points={areaPoints} fill="var(--color-accent-light)" opacity="0.5" stroke="none" />
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="0" y1="199" x2={lineWidth} y2="199" stroke="var(--color-border-strong)" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 rounded-xl border border-border bg-white px-7 py-6">
          <div className="mb-4 text-sm font-semibold text-ink-softer">
            Exercices par semaine
          </div>
          <div className="flex gap-2">
            <svg viewBox="0 0 40 200" className="h-[200px] w-[34px] flex-shrink-0">
              <text x="32" y="14" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">{axisMax}</text>
              <text x="32" y="102" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">{Math.round(axisMax / 2)}</text>
              <text x="32" y="196" fontSize="11" fill="var(--color-muted-light)" textAnchor="end">0</text>
            </svg>
            <svg viewBox={`0 0 ${barWidth} ${barHeight}`} className="h-[220px] w-full">
              <line x1="0" y1="10" x2={barWidth} y2="10" stroke="var(--color-border-soft)" strokeWidth="1" />
              <line x1="0" y1="102" x2={barWidth} y2="102" stroke="var(--color-border-soft)" strokeWidth="1" />
              {bars.map((bar, i) => (
                <rect
                  key={i}
                  x={bar.x}
                  y={bar.y}
                  width="26"
                  height={bar.height}
                  fill={i === bars.length - 1 ? "var(--color-accent)" : "var(--color-accent-light)"}
                />
              ))}
              <line x1="0" y1="199" x2={barWidth} y2="199" stroke="var(--color-border-strong)" strokeWidth="1" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[2.2fr_1.6fr_1fr_1fr] bg-paper-alt px-6 py-3.5 text-xs font-semibold uppercase text-muted-light">
          <div>Titre</div>
          <div>Critères</div>
          <div>Score</div>
          <div>Date</div>
        </div>
        {history.sessions.length === 0 ? (
          <div className="px-6 py-8 text-center text-[13.5px] text-muted-light">
            Aucune session terminée pour le moment.
          </div>
        ) : (
          history.sessions.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[2.2fr_1.6fr_1fr_1fr] items-center border-t border-border-soft px-6 py-4 text-sm"
            >
              <div className="text-ink-softer">{s.title}</div>
              <div className="text-muted-light">
                {TEXT_TYPE_LABELS[s.textType]} · {LEVEL_LABELS[s.level]}
              </div>
              <div className="font-semibold text-accent">{s.score}/100</div>
              <div className="text-muted-light">{formatShortDate(s.createdAt)}</div>
            </div>
          ))
        )}
        {history.sessions.length > 0 && (
          <div className="flex items-center justify-center gap-3.5 border-t border-border-soft py-3">
            {history.hasPrev ? (
              <Link
                href={`/progress?page=${pageNum - 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong text-[13px] text-ink-40"
              >
                ↑
              </Link>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-soft text-[13px] text-muted-ghost">
                ↑
              </span>
            )}
            {history.hasNext ? (
              <Link
                href={`/progress?page=${pageNum + 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong text-[13px] text-ink-40"
              >
                ↓
              </Link>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-soft text-[13px] text-muted-ghost">
                ↓
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

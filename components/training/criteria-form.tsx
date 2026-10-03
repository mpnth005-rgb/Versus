"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import { LockIcon } from "@/components/lock-icon";
import { UpsellModal } from "@/components/upsell-modal";
import { NEWS_WARNED_KEY } from "@/components/training/news-warning";
import {
  TEXT_TYPE_LABELS,
  LEVEL_LABELS,
  THEME_OPTIONS,
} from "@/lib/constants";

const TEXT_TYPES = ["LITERARY", "JOURNALISTIC", "DAILY"] as const;
const LEVELS = ["A2", "B1", "B2", "C1"] as const;

export function CriteriaForm({ canStartExercise }: { canStartExercise: boolean }) {
  const router = useRouter();
  const [textType, setTextType] = useState<(typeof TEXT_TYPES)[number] | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number] | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  // "Ancrer dans l'actualité" starts off on every visit. The warning shows
  // the first time it's turned on, then not again until an exercise is
  // finished: the completion page clears the flag (NewsWarningReset), so
  // generating a text and coming back to the criteria doesn't repeat it.
  const [anchoredInNews, setAnchoredInNews] = useState(false);
  const [newsWarningOpen, setNewsWarningOpen] = useState(false);

  function toggleAnchoredInNews() {
    if (anchoredInNews) return setAnchoredInNews(false);
    let warned = false;
    try {
      warned = localStorage.getItem(NEWS_WARNED_KEY) === "1";
    } catch {}
    if (warned) setAnchoredInNews(true);
    else setNewsWarningOpen(true);
  }

  function confirmNewsWarning() {
    setNewsWarningOpen(false);
    setAnchoredInNews(true);
    try {
      localStorage.setItem(NEWS_WARNED_KEY, "1");
    } catch {
      // Not remembered: the warning will simply show again next time.
    }
  }

  if (pending) return <LoadingScreen variant="generate" />;

  const isValid = textType !== null && level !== null && theme !== null;
  const disabled = !isValid || !canStartExercise;
  // The API still takes a list of themes; the form now allows only one.
  const themes = theme ? [theme] : [];

  // One theme at a time: picking another replaces it, clicking the current
  // one clears it. The subtheme is drawn server-side (lib/ai.ts).
  function toggleTheme(next: string) {
    setTheme((current) => (current === next ? null : next));
  }

  async function handleSubmit() {
    if (disabled) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textType,
          level,
          themes,
          anchoredInNews: textType === "JOURNALISTIC" && anchoredInNews,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      router.push(`/training/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-0 py-14 px-16">
      <div className="mb-8">
        <div className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.02em] text-accent">
          Nouvel exercice
        </div>
        <div className="font-serif text-[32px] font-semibold leading-[1.1] text-ink">
          Choisissez les critères de votre texte
        </div>
      </div>

      <div className="flex flex-col gap-3.5 border-b border-border pb-7">
        <div className="text-sm font-semibold text-ink-softer">Type de texte</div>
        <div className="flex gap-2.5">
          {TEXT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTextType(t);
                // The news option only exists for journalistic texts.
                if (t !== "JOURNALISTIC") setAnchoredInNews(false);
              }}
              className={
                "cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium " +
                (textType === t
                  ? "bg-accent text-white"
                  : "border border-border-strong text-ink-40")
              }
            >
              {TEXT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {textType === "JOURNALISTIC" && (
          <div className="mt-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={anchoredInNews}
              onClick={toggleAnchoredInNews}
              className="flex cursor-pointer items-start gap-3.5 text-left"
            >
              <span
                className={
                  "relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors " +
                  (anchoredInNews ? "bg-ink" : "bg-paper-alt-3")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] " +
                    (anchoredInNews ? "left-[22px]" : "left-0.5")
                  }
                />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink-softer">
                  Ancrer dans l&apos;actualité
                </span>
                <span className="mt-0.5 block text-[13px] text-muted-light">
                  Recherche l&apos;actualité sur internet : événements récents, personnalités publiques et
                  dates précises.
                </span>
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5 border-b border-border py-7">
        <div className="text-sm font-semibold text-ink-softer">Niveau de langue</div>
        <div className="flex w-fit overflow-hidden rounded-lg border border-border-strong">
          {LEVELS.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={
                "px-[22px] py-2.5 text-sm cursor-pointer " +
                (i > 0 ? "border-l border-border-strong " : "") +
                (level === l
                  ? "bg-accent font-semibold text-white"
                  : "font-medium text-[oklch(0.45_0.01_90)]")
              }
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 pt-7">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold text-ink-softer">
            Thème
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleTheme(option)}
                className={
                  "cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-medium " +
                  (selected
                    ? "bg-accent-light text-accent-ink"
                    : "border border-border-strong text-[oklch(0.45_0.01_90)]")
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-5">
        {canStartExercise ? (
          <button
            type="button"
            disabled={disabled}
            onClick={handleSubmit}
            className={
              "rounded-lg px-7 py-3.5 text-[15px] font-semibold " +
              (disabled
                ? "cursor-not-allowed bg-paper-alt-3 text-muted-ghost"
                : "cursor-pointer bg-ink text-white")
            }
          >
            Générer le texte
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setUpsellOpen(true)}
            title="Réservé à Versus Upper"
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-paper-alt-3 px-7 py-3.5 text-[15px] font-semibold text-muted-lighter"
          >
            <LockIcon size={13} />
            Générer le texte
          </button>
        )}
        <div className="max-w-[280px] text-[12.5px] text-muted-light">
          Un nouveau texte de 130–170 mots sera généré selon vos critères.
        </div>
      </div>

      {!canStartExercise && (
        <div className="mt-4 text-[12.5px] text-danger-text">
          Limite mensuelle de textes atteinte.
        </div>
      )}
      {error && <div className="mt-4 text-[12.5px] text-danger-text">{error}</div>}
      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
      {newsWarningOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.2_0.01_90/0.45)]"
          onClick={() => setNewsWarningOpen(false)}
        >
          <div
            className="flex w-[440px] max-w-[90vw] flex-col gap-5 rounded-[14px] bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-serif text-[21px] font-semibold text-ink">
              Textes ancrés dans l&apos;actualité
            </div>
            <div className="text-sm leading-[1.6] text-muted-light">
              Le texte s&apos;appuiera sur une recherche internet : il citera des événements
              récents, des personnalités publiques et des dates précises. Les sources sont
              résumées par une IA : certains faits peuvent être mal restitués. Ne les utilisez
              pas comme source sans les vérifier.
            </div>
            <div className="mt-1.5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNewsWarningOpen(false)}
                className="cursor-pointer rounded-lg border border-border-strong px-5 py-2.5 text-[13.5px] font-semibold text-ink-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmNewsWarning}
                className="cursor-pointer rounded-lg bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white"
              >
                J&apos;ai compris, activer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

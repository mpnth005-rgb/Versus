"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import {
  TEXT_TYPE_LABELS,
  LEVEL_LABELS,
  THEME_OPTIONS,
  MAX_THEMES,
  THEME_SUBTOPICS,
} from "@/lib/constants";

const TEXT_TYPES = ["LITERARY", "JOURNALISTIC", "DAILY"] as const;
const LEVELS = ["A2", "B1", "B2", "C1"] as const;

type Subtheme = { theme: string; label: string };

export function CriteriaForm({ canStartExercise }: { canStartExercise: boolean }) {
  const router = useRouter();
  const [textType, setTextType] = useState<(typeof TEXT_TYPES)[number] | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number] | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [subtheme, setSubtheme] = useState<Subtheme | null>(null);
  const [subFocus, setSubFocus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subRowRef = useRef<HTMLDivElement>(null);

  if (pending) return <LoadingScreen variant="generate" />;

  const isValid = textType !== null && level !== null && themes.length > 0;
  const disabled = !isValid || !canStartExercise;
  const focusedTheme = subFocus && themes.includes(subFocus) ? subFocus : (themes[0] ?? null);

  // Mirrors the design prototype's theme-toggle logic exactly: only one
  // subtheme may be chosen at a time across all selected themes (not one
  // per theme). Deselecting the theme that "owns" the current subtheme
  // clears it; selecting a new theme with none focused yet focuses it.
  function toggleTheme(theme: string) {
    const on = themes.includes(theme);
    if (!on && themes.length >= MAX_THEMES) return;

    const nextThemes = on ? themes.filter((t) => t !== theme) : [...themes, theme];
    const nextSubtheme = subtheme && nextThemes.includes(subtheme.theme) ? subtheme : null;
    const wantedFocus = on
      ? subFocus === theme
        ? (nextSubtheme ? nextSubtheme.theme : (nextThemes[0] ?? null))
        : subFocus
      : (subFocus ?? theme);

    setThemes(nextThemes);
    setSubtheme(nextSubtheme);
    setSubFocus(wantedFocus && nextThemes.includes(wantedFocus) ? wantedFocus : (nextThemes[0] ?? null));
  }

  function toggleSubtheme(theme: string, label: string) {
    setSubtheme((prev) => (prev && prev.theme === theme && prev.label === label ? null : { theme, label }));
  }

  function scrollSubRow(dir: 1 | -1) {
    subRowRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (disabled) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textType, level, themes, subtheme }),
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
    <div className="flex flex-col gap-0 py-14 px-16 max-w-[640px]">
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
              onClick={() => setTextType(t)}
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
            Thèmes <span className="font-normal text-muted-light">(jusqu&apos;à {MAX_THEMES})</span>
          </div>
          <div className="text-[12.5px] font-semibold text-accent">
            {themes.length}/{MAX_THEMES} sélectionnés
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {THEME_OPTIONS.map((theme) => {
            const selected = themes.includes(theme);
            return (
              <button
                key={theme}
                type="button"
                onClick={() => toggleTheme(theme)}
                className={
                  "cursor-pointer rounded-full px-4 py-2 text-[13.5px] font-medium " +
                  (selected
                    ? "bg-accent-light text-accent-ink"
                    : "border border-border-strong text-[oklch(0.45_0.01_90)]")
                }
              >
                {theme}
              </button>
            );
          })}
        </div>
      </div>

      {themes.length > 0 && focusedTheme && (
        <div className="mt-7 flex flex-col gap-3.5 border-t border-border pt-7">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-ink-softer">
              Sous-thème <span className="font-normal text-muted-light">(optionnel)</span>
            </div>
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => scrollSubRow(-1)}
                className="cursor-pointer px-1 text-[13px] text-ink-40"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scrollSubRow(1)}
                className="cursor-pointer px-1 text-[13px] text-ink-40"
              >
                ›
              </button>
              {subtheme && (
                <button
                  type="button"
                  title="Aucun sous-thème"
                  onClick={() => setSubtheme(null)}
                  className="cursor-pointer text-[13px] text-muted-light"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {themes.length > 1 && (
            <div className="flex gap-1.5">
              {themes.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setSubFocus(theme)}
                  className={
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] " +
                    (theme === focusedTheme
                      ? "bg-paper-alt-2 font-semibold text-ink-softer"
                      : "font-medium text-muted-light")
                  }
                >
                  {theme}
                  {subtheme?.theme === theme && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div
            ref={subRowRef}
            className="flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {(THEME_SUBTOPICS[focusedTheme] ?? []).map((label) => {
              const selected = subtheme?.theme === focusedTheme && subtheme?.label === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleSubtheme(focusedTheme, label)}
                  className={
                    "flex-shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 py-[7px] text-[13px] font-medium " +
                    (selected
                      ? "bg-accent text-white"
                      : "border border-border-strong bg-white text-ink-40")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          {!subtheme && (
            <div className="text-[12.5px] text-muted-light">
              {themes.length > 1
                ? "Vous pouvez préciser un seul de vos thèmes. Sans sous-thème, le texte restera général."
                : "Sans sous-thème, le texte restera général."}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-5">
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
        <div className="max-w-[280px] text-[12.5px] text-muted-light">
          Un nouveau texte de 130–170 mots sera généré selon vos critères.
        </div>
      </div>

      {!canStartExercise && (
        <div className="mt-4 text-[12.5px] text-danger-text">
          Limite mensuelle d&apos;exercices atteinte. Passez à Versus Upper (voir le
          panneau &laquo;&nbsp;Versus gratuit&nbsp;&raquo; dans la barre latérale) pour
          continuer.
        </div>
      )}
      {error && <div className="mt-4 text-[12.5px] text-danger-text">{error}</div>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import { TEXT_TYPE_LABELS, LEVEL_LABELS, THEME_OPTIONS, MAX_THEMES } from "@/lib/constants";

const TEXT_TYPES = ["LITERARY", "JOURNALISTIC", "DAILY"] as const;
const LEVELS = ["A2", "B1", "B2", "C1"] as const;

export function CriteriaForm({ canStartExercise }: { canStartExercise: boolean }) {
  const router = useRouter();
  const [textType, setTextType] = useState<(typeof TEXT_TYPES)[number] | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number] | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending) return <LoadingScreen variant="generate" />;

  const isValid = textType !== null && level !== null && themes.length > 0;
  const disabled = !isValid || !canStartExercise;

  function toggleTheme(theme: string) {
    setThemes((prev) =>
      prev.includes(theme)
        ? prev.filter((t) => t !== theme)
        : prev.length < MAX_THEMES
          ? [...prev, theme]
          : prev
    );
  }

  async function handleSubmit() {
    if (disabled) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textType, level, themes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      router.push(`/training/${data.id}`);
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

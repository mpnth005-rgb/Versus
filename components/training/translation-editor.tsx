"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import { fetchWithProgress } from "@/lib/progress-stream";
import { LockIcon } from "@/components/lock-icon";
import { UpsellModal } from "@/components/upsell-modal";
import { useTrainingSession } from "@/components/training-session";
import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";

export type EditorExercise = {
  id: string;
  title: string;
  textType: "LITERARY" | "JOURNALISTIC" | "DAILY";
  level: "A2" | "B1" | "B2" | "C1";
  themes: string[];
  subtheme: { theme: string; label: string } | null;
  sourceText: string;
  wordCount: number;
  anchoredInNews: boolean;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function TranslationEditor({
  exercise: initial,
  canRegenerate,
}: {
  exercise: EditorExercise;
  // Regenerating consumes a text from the monthly quota, so it locks
  // (and opens the upgrade modal) once a free user has none left.
  canRegenerate: boolean;
}) {
  const router = useRouter();
  const [exercise, setExercise] = useState(initial);
  // The translation typed so far is kept in the app shell, so it survives
  // a detour through the other sidebar pages.
  const { drafts, setDraft } = useTrainingSession();
  const translation = drafts[initial.id] ?? "";
  const setTranslation = (text: string) => setDraft(initial.id, text);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  if (submitting) return <LoadingScreen progress={progress} />;

  const translationWords = wordCount(translation);
  const canSubmit = translation.trim().length > 0 && translationWords >= exercise.wordCount * 0.5;

  // Themes keep the order they were picked in on the criteria form; the
  // one carrying the chosen subtheme is shown as "Theme (Subtheme)".
  const themesLabel = exercise.themes
    .map((t) => (exercise.subtheme?.theme === t ? `${t} (${exercise.subtheme.label})` : t))
    .join(" · ");

  async function regenerate() {
    setError(null);
    setRegenerating(true);
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      router.refresh();
      const refreshed = await fetch(`/api/exercises/${exercise.id}`).then((r) =>
        r.ok ? r.json() : null
      );
      if (refreshed) {
        setExercise({
          id: exercise.id,
          title: refreshed.title,
          textType: refreshed.textType,
          level: refreshed.level,
          themes: refreshed.themes,
          subtheme: refreshed.subtheme,
          sourceText: refreshed.sourceText,
          wordCount: refreshed.wordCount,
          anchoredInNews: refreshed.anchoredInNews,
        });
        setTranslation("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setRegenerating(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setProgress(0);
    setSubmitting(true);
    try {
      await fetchWithProgress(
        `/api/exercises/${exercise.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translation }),
        },
        setProgress
      );
      router.push(`/training/${exercise.id}/correction`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-7 py-12 px-16">
      <div className="font-serif text-2xl font-semibold text-ink">{exercise.title}</div>

      <div className="-mt-3.5 flex items-center justify-between">
        <div className="flex gap-2.5">
          <span className="rounded-full bg-accent-light px-3.5 py-1.5 text-[12.5px] font-medium text-accent-ink">
            {TEXT_TYPE_LABELS[exercise.textType]}
          </span>
          <span className="rounded-full bg-paper-alt-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-40">
            {LEVEL_LABELS[exercise.level]}
          </span>
          {exercise.themes.length > 0 && (
            <span className="rounded-full bg-paper-alt-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-40">
              {themesLabel}
            </span>
          )}
          {exercise.anchoredInNews && (
            <span className="flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.07_70)] bg-[oklch(0.96_0.04_75)] px-3.5 py-1.5 text-[12.5px] font-medium text-[oklch(0.5_0.12_55)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.68_0.15_60)]" />
              Ancré dans l&apos;actualité
            </span>
          )}
        </div>
        {canRegenerate ? (
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="press-accent-link flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-accent disabled:opacity-60"
          >
            <span
              className={
                "h-4 w-4 rounded-full border-2 border-accent border-t-transparent " +
                (regenerating ? "animate-spin" : "")
              }
            />
            Générer un nouveau texte
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setUpsellOpen(true)}
            title="Réservé à Versus Upper"
            className="press-icon flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-lighter"
          >
            <LockIcon size={13} />
            Générer un nouveau texte
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-8">
        <div className="flex flex-1 flex-col gap-3.5">
          <div className="text-[13px] font-semibold uppercase tracking-[0.02em] text-muted-light">
            Texte source (français)
          </div>
          <div className="flex flex-1 flex-col justify-between gap-5 rounded-xl border border-border bg-white p-7 font-serif text-[17px] leading-[1.75] text-[oklch(0.25_0.01_90)]">
            <div>{exercise.sourceText}</div>
            <div className="text-right text-[12.5px] font-medium text-muted-light font-sans">
              {exercise.wordCount} mots
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3.5">
          <div className="text-[13px] font-semibold uppercase tracking-[0.02em] text-muted-light">
            Votre traduction (anglais)
          </div>
          <textarea
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Tapez votre traduction ici..."
            className="min-h-[220px] flex-1 resize-none rounded-xl border-2 border-accent bg-white p-7 text-base leading-[1.75] text-ink-softer outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/training")}
          className="press-link cursor-pointer text-[13px] font-medium text-ink-40"
        >
          ← Retour aux critères
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          title={canSubmit ? "Soumettre ma traduction" : "Écrivez au moins la moitié des mots attendus"}
          className={
            "flex h-[52px] w-[52px] items-center justify-center rounded-2xl font-serif text-[22px] font-semibold " +
            (canSubmit
              ? "press-teal cursor-pointer bg-[oklch(0.4_0.11_200)] text-white"
              : "cursor-not-allowed border border-border-strong bg-white text-muted-ghost")
          }
        >
          V
        </button>
      </div>

      {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}

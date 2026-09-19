"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/loading-screen";
import { TEXT_TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";

export type EditorExercise = {
  id: string;
  title: string;
  textType: "LITERARY" | "JOURNALISTIC" | "DAILY";
  level: "A2" | "B1" | "B2" | "C1";
  themes: string[];
  sourceText: string;
  wordCount: number;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function TranslationEditor({ exercise: initial }: { exercise: EditorExercise }) {
  const router = useRouter();
  const [exercise, setExercise] = useState(initial);
  const [translation, setTranslation] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submitting) return <LoadingScreen variant="correct" />;

  const translationWords = wordCount(translation);
  const canSubmit = translation.trim().length > 0 && translationWords >= exercise.wordCount * 0.5;

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
          sourceText: refreshed.sourceText,
          wordCount: refreshed.wordCount,
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
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
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
              {exercise.themes.join(" · ")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-accent disabled:opacity-60"
        >
          <span
            className={
              "h-4 w-4 rounded-full border-2 border-accent border-t-transparent " +
              (regenerating ? "animate-spin" : "")
            }
          />
          Régénérer le texte
        </button>
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
          className="cursor-pointer text-[13px] font-medium text-ink-40"
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
              ? "cursor-pointer bg-[oklch(0.4_0.11_200)] text-white"
              : "cursor-not-allowed border border-border-strong bg-white text-muted-ghost")
          }
        >
          V
        </button>
      </div>

      {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
    </div>
  );
}

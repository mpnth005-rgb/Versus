"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ERROR_TYPE_LABELS, type ErrorType } from "@/lib/scoring";
import { formatScore } from "@/lib/format";

export type SentenceError = {
  type: ErrorType;
  explanation: string;
};

export type FlaggedSentence = {
  sentenceNumber: number;
  sourceSentence: string;
  userSentence: string;
  errors: SentenceError[];
};

export type CorrectionData = {
  exerciseId: string;
  exerciseTitle: string;
  level: string;
  overallScore: number;
  adjustedScore: number;
  referenceTranslation: string;
  flaggedSentences: FlaggedSentence[];
  suggestedCardsCount: number;
  completed: boolean;
};

export function CorrectionView({ data }: { data: CorrectionData }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const sentence = data.flaggedSentences[index];
  const hasErrors = data.flaggedSentences.length > 0;

  async function finishSession() {
    setFinishing(true);
    try {
      await fetch(`/api/exercises/${data.exerciseId}/complete`, { method: "POST" });
      router.push(`/training/${data.exerciseId}/complete`);
    } finally {
      setFinishing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-8 py-12 px-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.03em] text-muted-light">
            {data.exerciseTitle}
          </div>
          <div className="font-serif text-[28px] font-semibold text-ink">
            Correction de votre traduction
          </div>
        </div>
        {!data.completed && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-5 py-[11px] text-[13.5px] font-semibold text-ink-40"
          >
            <span className="text-[15px]">✓</span>Terminer la session
          </button>
        )}
      </div>

      <div className="flex gap-5">
        <div className="flex flex-1 flex-col gap-1.5 rounded-xl border border-border bg-white p-7">
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.02em] text-muted-light">
            Score global
          </div>
          <div className="font-serif text-[40px] font-semibold text-ink">
            {formatScore(data.overallScore)}
            <span className="text-xl text-muted-light">/20</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 rounded-xl border border-accent-border bg-accent-light p-7">
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.02em] text-accent-ink">
            Score ajusté (niveau {data.level})
          </div>
          <div className="font-serif text-[40px] font-semibold text-accent-ink">
            {formatScore(data.adjustedScore)}
            <span className="text-xl text-accent-ink-soft">/20</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-softer">
            {hasErrors ? "Phrases à corriger" : "Correction phrase par phrase"}
          </div>
          {hasErrors && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong text-[13px] text-ink-40 disabled:cursor-not-allowed disabled:border-border-soft disabled:text-muted-ghost"
              >
                ‹
              </button>
              <div className="text-[12.5px] font-medium text-muted-light">
                {index + 1} / {data.flaggedSentences.length}
              </div>
              <button
                type="button"
                disabled={index === data.flaggedSentences.length - 1}
                onClick={() =>
                  setIndex((i) => Math.min(data.flaggedSentences.length - 1, i + 1))
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-strong text-[13px] text-ink-40 disabled:cursor-not-allowed disabled:border-border-soft disabled:text-muted-ghost"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {hasErrors && sentence ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-white px-6 py-5">
            <div className="font-serif text-[15px] text-[oklch(0.45_0.01_90)]">
              {sentence.sourceSentence}
            </div>
            <div className="text-[15px] text-ink-softer">{sentence.userSentence}</div>
            <div className="flex flex-col gap-1.5 border-t border-border-soft pt-2.5">
              {sentence.errors.map((error, i) => (
                <div key={i} className="text-[13px] text-danger-text">
                  <span className="font-semibold">{ERROR_TYPE_LABELS[error.type]} — </span>
                  {error.explanation}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-accent-border bg-accent-light px-6 py-5 text-[14px] text-accent-ink">
            <span className="text-lg">✓</span>
            Aucune erreur détectée — traduction fidèle au texte source.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-paper-alt p-8">
        <div className="text-sm font-semibold text-ink-softer">
          Traduction de référence complète
        </div>
        <div className="text-[15.5px] leading-[1.8] text-ink-40">
          {data.referenceTranslation}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-muted-light">
          {data.suggestedCardsCount} phrase{data.suggestedCardsCount === 1 ? "" : "s"}{" "}
          suggérée{data.suggestedCardsCount === 1 ? "" : "s"} pour votre deck de révision
        </div>
        {data.suggestedCardsCount > 0 ? (
          <button
            type="button"
            onClick={() => router.push(`/training/${data.exerciseId}/suggested-cards`)}
            className="cursor-pointer rounded-lg bg-ink px-7 py-3.5 text-[15px] font-semibold text-white"
          >
            Cartes suggérées →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="cursor-pointer rounded-lg bg-ink px-7 py-3.5 text-[15px] font-semibold text-white"
          >
            Terminer la session
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Terminer la session ?"
        description="Êtes-vous sûr de vouloir terminer votre session ? Vous ne pourrez plus revenir à la correction ni aux phrases suggérées."
        confirmLabel="Terminer la session"
        pending={finishing}
        onConfirm={finishSession}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

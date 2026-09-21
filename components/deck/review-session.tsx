"use client";

import { useState } from "react";
import Link from "next/link";

import { ratingPreviews, RATING_LABELS, type Rating, type CardState } from "@/lib/srs";
import { DailyLimitModal } from "@/components/deck/daily-limit-modal";

export type QueueCard = {
  id: string;
  front: string;
  back: string;
  state: CardState;
  currentStep: number;
  intervalDays: number;
  easeFactor: number;
};

const RATINGS: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];

function EmptyState({
  message,
  dailyNewCardLimit,
}: {
  message: string;
  dailyNewCardLimit: number;
}) {
  const [limitOpen, setLimitOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-[28px] text-[oklch(0.4_0.11_200)]">
        ✓
      </div>
      <div className="font-serif text-[28px] font-semibold text-ink">{message}</div>
      <div className="max-w-[420px] text-[15px] leading-[1.6] text-muted-light">
        Vous avez traité toutes les cartes dues, dans la limite de {dailyNewCardLimit}{" "}
        nouvelles cartes par jour. Lancez un nouvel exercice, ajustez votre limite, ou
        revenez demain pour continuer.
      </div>
      <div className="mt-2 flex gap-3.5">
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="cursor-pointer rounded-lg border border-border-strong px-6 py-3 text-[14.5px] font-semibold text-ink-40"
        >
          Modifier la limite quotidienne
        </button>
        <Link
          href="/training"
          className="rounded-lg bg-ink px-6 py-3 text-[14.5px] font-semibold text-white"
        >
          Retour à l&apos;entraînement
        </Link>
      </div>
      <DailyLimitModal
        open={limitOpen}
        initialValue={dailyNewCardLimit}
        onClose={() => setLimitOpen(false)}
      />
    </div>
  );
}

export function ReviewSession({
  initialQueue,
  counts,
  dailyNewCardLimit,
}: {
  initialQueue: QueueCard[];
  counts: { new: number; learning: number; review: number };
  dailyNewCardLimit: number;
}) {
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  if (queue.length === 0) {
    return (
      <EmptyState
        message="Aucune carte à réviser aujourd'hui"
        dailyNewCardLimit={dailyNewCardLimit}
      />
    );
  }

  if (index >= queue.length) {
    return (
      <EmptyState
        message="Session terminée pour aujourd'hui"
        dailyNewCardLimit={dailyNewCardLimit}
      />
    );
  }

  const card = queue[index];
  const previews = ratingPreviews({
    state: card.state,
    currentStep: card.currentStep,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
  });

  async function rate(value: Rating) {
    setRating(true);
    try {
      await fetch("/api/deck/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating: value }),
      });
      setIndex((i) => i + 1);
      setAttempt("");
      setRevealed(false);
    } finally {
      setRating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6.5 py-12 px-16">
      <div className="flex w-full max-w-[640px] items-start justify-between gap-6">
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="font-serif text-[26px] font-semibold text-ink">
              Session de révision
            </div>
            <div className="mt-1 text-[13px] text-muted-light">
              {revealed ? "Corrigez votre réponse" : "Exercez-vous · algorithme type SM-2"}
            </div>
          </div>
          <div className="text-[13px] text-muted-light">
            <span className="font-semibold text-[oklch(0.4_0.12_250)]">{counts.new}</span>{" "}
            nouvelles ·{" "}
            <span className="font-semibold text-[oklch(0.42_0.13_40)]">
              {counts.learning}
            </span>{" "}
            apprentissage ·{" "}
            <span className="font-semibold text-[oklch(0.38_0.12_145)]">
              {counts.review}
            </span>{" "}
            révision
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="flex-shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-border-strong px-4.5 py-2.5 text-[13px] font-semibold text-ink-40"
        >
          Modifier la limite
        </button>
      </div>

      {!revealed ? (
        <div className="flex min-h-[280px] w-full max-w-[640px] flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-white p-12 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
            Traduisez cette phrase
          </div>
          <div className="max-w-[460px] font-serif text-2xl leading-[1.4] text-ink">
            {card.front}
          </div>
          <textarea
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Tapez votre traduction ici..."
            rows={2}
            className="w-full max-w-[460px] resize-none rounded-lg border border-border-strong bg-paper p-3.5 text-left text-[15px] text-ink-40 outline-none"
          />
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-2 cursor-pointer rounded-lg border border-border-strong px-7 py-3 text-sm font-semibold text-ink-40"
          >
            Afficher la réponse
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-[640px] flex-col gap-5.5 rounded-2xl border border-border bg-white p-11 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
              Phrase source
            </div>
            <div className="font-serif text-[19px] leading-[1.4] text-ink-softer">
              {card.front}
            </div>
          </div>
          <div className="h-px bg-border-soft" />
          {attempt.trim() && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
                Votre réponse
              </div>
              <div className="text-base leading-[1.6] text-ink-softer">{attempt}</div>
            </div>
          )}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
              Traduction de référence
            </div>
            <div className="text-base leading-[1.6] font-medium text-[oklch(0.25_0.01_90)]">
              {card.back}
            </div>
          </div>
        </div>
      )}

      {revealed && (
        <div className="flex w-full max-w-[640px] overflow-hidden rounded-[10px] border border-border">
          {RATINGS.map((r, i) => (
            <button
              key={r}
              type="button"
              disabled={rating}
              onClick={() => rate(r)}
              className={
                "flex flex-1 flex-col items-center gap-0.5 border-t-[3px] border-border-strong bg-white py-3.5 px-2 disabled:cursor-wait " +
                (i > 0 ? "border-l border-border-soft" : "")
              }
            >
              <div className="text-sm font-medium text-ink-40">{RATING_LABELS[r]}</div>
              <div className="text-[11.5px] text-muted-light">{previews[r]}</div>
            </button>
          ))}
        </div>
      )}

      <div className="w-full max-w-[640px]">
        <Link
          href="/deck/cards"
          className="text-[13.5px] font-medium text-ink-40"
        >
          Voir toutes les cartes du deck →
        </Link>
      </div>

      <DailyLimitModal
        open={limitOpen}
        initialValue={dailyNewCardLimit}
        onClose={() => setLimitOpen(false)}
      />
    </div>
  );
}

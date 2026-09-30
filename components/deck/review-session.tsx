"use client";

import { useState } from "react";
import Link from "next/link";

import {
  ratingPreviews,
  RATING_LABELS,
  type Rating,
  type CardState,
  type SrsConfig,
} from "@/lib/srs";
import { DailyLimitModal } from "@/components/deck/daily-limit-modal";

export type QueueCard = {
  id: string;
  front: string;
  back: string;
  state: CardState;
  currentStep: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: string;
};

const RATINGS: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];

type SessionState = {
  newCards: QueueCard[];
  learning: QueueCard[];
  review: QueueCard[];
  // Pool sizes at session start, used to spread new cards evenly among
  // reviews (Anki's default "mix with reviews" order).
  newTotal: number;
  reviewTotal: number;
  current: QueueCard | null;
};

/**
 * Anki-style choice of the next card:
 * 1. a learning card whose delay has elapsed (earliest first);
 * 2. otherwise a new or review card, new ones interleaved evenly;
 * 3. otherwise the learning card due soonest, shown ahead of its delay —
 *    so the session never makes you wait.
 */
function pickNext(s: Omit<SessionState, "current">): SessionState["current"] {
  const now = Date.now();
  const learningByDue = [...s.learning].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  const dueLearning = learningByDue[0];
  if (dueLearning && new Date(dueLearning.dueAt).getTime() <= now) {
    return dueLearning;
  }

  if (s.newCards.length > 0 || s.review.length > 0) {
    const newLeft = s.newTotal > 0 ? s.newCards.length / s.newTotal : 0;
    const reviewLeft = s.reviewTotal > 0 ? s.review.length / s.reviewTotal : 0;
    const takeNew = s.review.length === 0 || (s.newCards.length > 0 && newLeft > reviewLeft);
    return takeNew ? s.newCards[0] : s.review[0];
  }

  return dueLearning ?? null;
}

function startSession(
  newCards: QueueCard[],
  learning: QueueCard[],
  review: QueueCard[]
): SessionState {
  const pools = {
    newCards,
    learning,
    review,
    newTotal: newCards.length,
    reviewTotal: review.length,
  };
  return { ...pools, current: pickNext(pools) };
}

/** Moves the rated card out of its bucket; it stays in the session only if
 * it's still on a minute-based step ladder (learning/relearning). */
function applyRating(s: SessionState, updated: QueueCard): SessionState {
  const without = (cards: QueueCard[]) => cards.filter((c) => c.id !== updated.id);
  const stillLearning = updated.state === "LEARNING" || updated.state === "RELEARNING";
  const pools = {
    newCards: without(s.newCards),
    review: without(s.review),
    learning: stillLearning ? [...without(s.learning), updated] : without(s.learning),
    newTotal: s.newTotal,
    reviewTotal: s.reviewTotal,
  };
  return { ...pools, current: pickNext(pools) };
}

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
        <Link
          href="/deck/cards"
          className="rounded-lg border border-border-strong px-6 py-3 text-[14.5px] font-semibold text-ink-40"
        >
          Voir toutes les cartes du deck
        </Link>
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="cursor-pointer rounded-lg bg-ink px-6 py-3 text-[14.5px] font-semibold text-white"
        >
          Modifier la limite quotidienne
        </button>
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
  initialNew,
  initialLearning,
  initialReview,
  dailyNewCardLimit,
  srsConfig,
}: {
  initialNew: QueueCard[];
  initialLearning: QueueCard[];
  initialReview: QueueCard[];
  dailyNewCardLimit: number;
  srsConfig: SrsConfig;
}) {
  const [session, setSession] = useState(() =>
    startSession(initialNew, initialLearning, initialReview)
  );
  const [startedEmpty] = useState(session.current === null);
  const [attempt, setAttempt] = useState("");
  const [revealed, setRevealed] = useState(false);
  // The rating being saved: its button shows as pressed, the others lock.
  const [pressed, setPressed] = useState<Rating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  if (!session.current) {
    return (
      <EmptyState
        message={
          startedEmpty ? "Aucune carte à réviser aujourd'hui" : "Session terminée pour aujourd'hui"
        }
        dailyNewCardLimit={dailyNewCardLimit}
      />
    );
  }

  const card = session.current;
  const counts = {
    new: session.newCards.length,
    learning: session.learning.length,
    review: session.review.length,
  };
  // Same config and fuzz seed as the server, so the interval shown under
  // each button is exactly the one saved when it's clicked.
  const previews = ratingPreviews(
    {
      state: card.state,
      currentStep: card.currentStep,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
    },
    srsConfig,
    { cardId: card.id, dueAt: new Date(card.dueAt) }
  );

  async function rate(value: Rating) {
    setError(null);
    setPressed(value);
    try {
      const res = await fetch("/api/deck/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      setSession((s) => applyRating(s, { ...card, ...data.card }));
      setAttempt("");
      setRevealed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPressed(null);
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
        <div className="grid w-full max-w-[640px] grid-cols-4 gap-2.5">
          {RATINGS.map((r) => {
            const isPressed = pressed === r;
            // Neutral → hover (light teal) → pressed (dark teal). While a
            // rating is saving, the other buttons stay neutral and inert.
            const state = isPressed
              ? "cursor-wait border-accent-dark bg-accent-dark"
              : pressed
                ? "cursor-default border-border-strong bg-white"
                : "cursor-pointer border-border-strong bg-white hover:border-t-accent-dark hover:bg-accent-light";
            const hover = pressed ? "" : " group-hover:font-semibold group-hover:text-accent-ink";
            const label = isPressed ? "font-semibold text-white" : "font-medium text-ink-40" + hover;
            const preview = isPressed ? "font-semibold text-white" : "text-muted-light" + hover;
            return (
              <button
                key={r}
                type="button"
                disabled={pressed !== null}
                onClick={() => rate(r)}
                className={
                  "group flex flex-col items-center gap-0.5 rounded-lg border border-t-2 px-2 py-3.5 " +
                  state
                }
              >
                <div className={"text-sm " + label}>{RATING_LABELS[r]}</div>
                <div className={"text-[11.5px] " + preview}>{previews[r]}</div>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="w-full max-w-[640px] text-[12.5px] text-danger-text">{error}</div>
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

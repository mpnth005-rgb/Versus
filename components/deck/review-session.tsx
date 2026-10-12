"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  ratingPreviews,
  RATING_LABELS,
  type Rating,
  type CardState,
  type SrsConfig,
} from "@/lib/srs";
import { DailyLimitModal } from "@/components/deck/daily-limit-modal";
import { LockIcon } from "@/components/lock-icon";
import { UpsellModal } from "@/components/upsell-modal";
import { MAX_DECK_ANSWER_CHARS } from "@/lib/constants";

export type QueueCard = {
  id: string;
  front: string;
  back: string;
  state: CardState;
  currentStep: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: string;
  // Error type the card came from (null for manual cards).
  category?: string | null;
};

type Verdict = "CORRECT" | "PRESQUE" | "ERREUR";

// "Vérifier ma réponse": tied to the card's turn, so it resets by itself
// when the next card comes.
type AnswerCheck =
  | { turn: number; status: "loading" }
  | { turn: number; status: "error"; message: string }
  | {
      turn: number;
      status: "done";
      verdict: Verdict;
      explanation: string;
    };

const VERDICT_STYLES: Record<Verdict, { label: string; className: string }> = {
  CORRECT: { label: "✓ Correct", className: "bg-[oklch(0.94_0.05_145)] text-[oklch(0.4_0.12_145)]" },
  PRESQUE: { label: "≈ Presque", className: "bg-[oklch(0.95_0.05_80)] text-[oklch(0.45_0.11_65)]" },
  ERREUR: { label: "✕ Erreur", className: "bg-[oklch(0.95_0.03_25)] text-[oklch(0.48_0.15_25)]" },
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
  introducedToday,
  message,
  dailyNewCardLimit,
}: {
  message: string;
  introducedToday: number;
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
          className="press-secondary rounded-lg border border-border-strong bg-white px-5 py-[11px] text-[13.5px] font-semibold text-ink-40"
        >
          Voir toutes les cartes du deck
        </Link>
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="press-primary cursor-pointer rounded-lg border border-ink bg-ink px-5 py-[11px] text-[13.5px] font-semibold text-white"
        >
          Modifier la limite quotidienne
        </button>
      </div>
      <DailyLimitModal
        open={limitOpen}
        initialValue={dailyNewCardLimit}
        introducedToday={introducedToday}
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
  introducedToday: introducedBeforeSession,
  srsConfig,
  checksRemaining: initialChecksRemaining,
}: {
  initialNew: QueueCard[];
  initialLearning: QueueCard[];
  initialReview: QueueCard[];
  dailyNewCardLimit: number;
  // New cards already started today when the page loaded — they count
  // against the daily limit, which the limit modal spells out.
  introducedToday: number;
  srsConfig: SrsConfig;
  // "Vérifier ma réponse" left today; null = unlimited (Versus Upper).
  checksRemaining: number | null;
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
  // Once rated, the answer card flies out: left for "À revoir"/"Difficile",
  // right for "Correcte"/"Facile".
  const [exitDir, setExitDir] = useState<1 | -1 | null>(null);
  // Bumped for every card shown, so a card met again right away (learning
  // steps) still plays its entrance.
  const [turn, setTurn] = useState(0);
  const [checksRemaining, setChecksRemaining] = useState(initialChecksRemaining);
  const [answerCheck, setAnswerCheck] = useState<AnswerCheck | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  // Height of the question block, kept for the answer view (see the stage).
  const [questionHeight, setQuestionHeight] = useState<number>();
  // Once the link has faded out after "Afficher la réponse" (~0.32 s), the
  // stage drops that height so the link comes back just under the rating
  // bar. Stored per card (turn), so each new reveal starts tall again.
  const [compactTurn, setCompactTurn] = useState<number | null>(null);
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setCompactTurn(turn), 350);
    return () => clearTimeout(timer);
  }, [revealed, turn]);
  const measureQuestion = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(() => setQuestionHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Every new card rated in this session has left the "new" pool.
  const introducedToday =
    introducedBeforeSession + (session.newTotal - session.newCards.length);

  if (!session.current) {
    return (
      <EmptyState
        message={
          startedEmpty ? "Aucune carte à réviser aujourd'hui" : "Session terminée pour aujourd'hui"
        }
        dailyNewCardLimit={dailyNewCardLimit}
        introducedToday={introducedToday}
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


  const currentCheck = answerCheck?.turn === turn ? answerCheck : null;

  /** Runs when the answer is revealed: a short verdict from a fast model.
   * Free plan: nothing once the day's checks are used up. */
  async function verifyAnswer() {
    if (checksRemaining === 0) return;
    const checkTurn = turn;
    setAnswerCheck({ turn: checkTurn, status: "loading" });
    try {
      const res = await fetch("/api/deck/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, answer: attempt }),
      });
      const data = await res.json();
      if (typeof data.remaining === "number" || data.remaining === null) {
        setChecksRemaining(data.remaining);
      }
      if (!res.ok) throw new Error(data.error ?? "La correction a échoué.");
      setAnswerCheck({
        turn: checkTurn,
        status: "done",
        verdict: data.verdict,
        explanation: data.explanation,
      });
    } catch (e) {
      setAnswerCheck({
        turn: checkTurn,
        status: "error",
        message: e instanceof Error ? e.message : "La correction a échoué.",
      });
    }
  }

  function revealAnswer() {
    setRevealed(true);
    // The answer is corrected automatically as it's revealed.
    if (attempt.trim()) verifyAnswer();
  }

  async function rate(value: Rating) {
    setError(null);
    setPressed(value);
    setExitDir(value === "AGAIN" || value === "HARD" ? -1 : 1);
    try {
      // The pressed rating shows while the card flies out (1 s, as in the
      // prototype); the next card comes once both that and the save are done.
      const [res] = await Promise.all([
        fetch("/api/deck/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id, rating: value }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      setSession((s) => applyRating(s, { ...card, ...data.card }));
      setAttempt("");
      setRevealed(false);
      setTurn((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPressed(null);
      setExitDir(null);
    }
  }

  const questionCard = (
    <div className="flex min-h-[280px] w-full flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-white p-12 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
        Traduisez cette phrase
      </div>
      <div className="max-w-[460px] font-serif text-2xl leading-[1.4] text-ink">
        {card.front}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center gap-6.5 overflow-x-hidden py-12 px-16">
      <div className="flex w-full max-w-[640px] items-start justify-between gap-6">
        <div className="flex flex-col gap-3.5">
          <div className="font-serif text-[26px] font-semibold text-ink">
            Session de révision
          </div>
          <div className="text-[13px] text-muted-light">
            <span className="font-semibold text-[oklch(0.48_0.14_250)]">{counts.new}</span>{" "}
            nouvelles ·{" "}
            <span className="font-semibold text-[oklch(0.55_0.15_50)]">
              {counts.learning}
            </span>{" "}
            apprentissage ·{" "}
            <span className="font-semibold text-[oklch(0.48_0.13_145)]">
              {counts.review}
            </span>{" "}
            révision
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="press-secondary flex-shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-border-strong bg-white px-[18px] py-[9px] text-[13px] font-semibold text-ink-40"
        >
          Modifier la limite
        </button>
      </div>

      {/* The question and answer blocks share one stage, at least as tall as
          the question block, so what follows ("Voir toutes les cartes du
          deck") stays put when the answer is shown. */}
      <div
        className="flex w-full max-w-[640px] flex-col items-center gap-6.5"
        style={{ minHeight: revealed && compactTurn === turn ? undefined : questionHeight }}
      >
        {!revealed ? (
          <div ref={measureQuestion} key={turn} className="flex w-full max-w-[640px] flex-col items-center gap-6.5">
            <div className="deck-card-in w-full">{questionCard}</div>
            <div className="deck-answer-in flex w-full flex-col items-center gap-4">
              <textarea
                value={attempt}
                maxLength={MAX_DECK_ANSWER_CHARS}
                onChange={(e) => setAttempt(e.target.value)}
                // Entrée (avec ou sans Maj) retourne la carte: no line breaks.
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    revealAnswer();
                  }
                }}
                placeholder="Tapez votre traduction ici..."
                rows={2}
                className="h-[66px] w-full resize-none rounded-lg border border-border-strong bg-white px-[18px] py-3.5 text-left text-[15px] leading-[1.2] text-ink-softer outline-none transition-[border-color,box-shadow] duration-150 focus:border-[oklch(0.45_0.09_200)] focus:shadow-[0_0_0_1px_oklch(0.45_0.09_200)]"
              />
              <button
                type="button"
                onClick={revealAnswer}
                className="press-secondary cursor-pointer rounded-lg border border-border-strong bg-white px-5 py-[11px] text-[13.5px] font-semibold text-ink-40"
              >
                Afficher la réponse
              </button>
            </div>
          </div>
        ) : (
          <>
            <div key={turn} className="relative flex w-full max-w-[640px] flex-col items-center">
              {/* The question card flips away (its field and button fade)
                  before the answer card flips in from its top edge. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex flex-col items-center gap-6.5"
              >
                <div className="deck-flip-out w-full">{questionCard}</div>
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="deck-fade-out h-[66px] w-full overflow-hidden rounded-lg border border-border-strong bg-white px-[18px] py-3.5 text-left text-[15px] leading-[1.2] text-ink-softer">
                    {attempt.trim() ? (
                      attempt
                    ) : (
                      <span className="text-[oklch(0.6_0.01_90)]">Tapez votre traduction ici...</span>
                    )}
                  </div>
                  <div className="deck-fade-out-late rounded-lg border border-[oklch(0.65_0.01_90)] bg-[oklch(0.92_0.005_90)] px-5 py-[11px] text-[13.5px] font-semibold text-ink-40">
                    Afficher la réponse
                  </div>
                </div>
                {/* The question-state link, fading out where it was. */}
                <div className="deck-fade-out-late w-full text-[13.5px] font-medium text-ink-40">
                  Voir toutes les cartes du deck →
                </div>
              </div>
              <div
                className="deck-flip-in motion-fly relative flex w-full flex-col gap-5.5 rounded-2xl border border-border bg-white px-11 py-10 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                style={
                  exitDir
                    ? {
                        transform: `translateX(${exitDir * 160}px) rotate(${exitDir * 6}deg)`,
                        opacity: 0,
                        transition:
                          "transform var(--motion-slow) var(--ease-exit) 0.24s, opacity var(--motion-base) ease-in 0.28s",
                      }
                    : undefined
                }
              >
                {/* Verdict of the automatic correction: top right of the card,
                    level with "Phrase source" (absolute, so nothing shifts
                    when it appears). */}
                {currentCheck?.status === "done" && (
                  <span
                    className={
                      "fade-in absolute top-9 right-11 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold " +
                      VERDICT_STYLES[currentCheck.verdict].className
                    }
                  >
                    {VERDICT_STYLES[currentCheck.verdict].label}
                  </span>
                )}
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
                    Phrase source
                  </div>
                  <div className="font-serif text-[19px] leading-[1.4] text-ink-softer">
                    {card.front}
                  </div>
                </div>
                <div className="h-px bg-border-soft" />
                {/* Always shown, so the card keeps the same size; without an
                    answer, a muted note stands in for it. */}
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
                    Votre réponse
                  </div>
                  {attempt.trim() ? (
                    <>
                      <div className="text-base leading-[1.6] text-ink-softer">{attempt}</div>
                      {currentCheck?.status === "done" ? (
                        <div className="mt-2 text-[13px] leading-[1.5] text-ink-40">
                          {currentCheck.explanation}
                        </div>
                      ) : currentCheck?.status === "loading" ? (
                        <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-light">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          Correction en cours…
                        </div>
                      ) : checksRemaining === 0 && !currentCheck ? (
                        <button
                          type="button"
                          onClick={() => setUpsellOpen(true)}
                          title="Réservé à Versus Upper"
                          className="press-icon -ml-2.5 mt-2 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-lighter"
                        >
                          <LockIcon size={13} />
                          Limite de corrections du jour atteinte
                        </button>
                      ) : null}
                      {currentCheck?.status === "done" && checksRemaining !== null && (
                        <div className="mt-1.5 text-[12px] text-muted-light">
                          {checksRemaining} correction{checksRemaining === 1 ? "" : "s"} restante
                          {checksRemaining === 1 ? "" : "s"} aujourd&apos;hui
                        </div>
                      )}
                      {currentCheck?.status === "error" && (
                        <div className="mt-1 text-[12.5px] text-danger-text">{currentCheck.message}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-base leading-[1.6] italic text-muted-lighter">
                      Aucune réponse saisie
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
                    Traduction de référence
                  </div>
                  <div className="text-base leading-[1.6] font-medium text-[oklch(0.25_0.01_90)]">
                    {card.back}
                  </div>
                </div>
              </div>
            </div>

            {/* One segmented bar. Neutral → hover (light teal, bold) → pressed
                (dark teal); while a rating is saving, the other segments fade
                and the bar slides away with the card. */}
            <div
              key={`rates-${turn}`}
              className="deck-rates-in motion-fly flex w-full max-w-[640px] overflow-hidden rounded-[10px] border border-border"
              style={
                exitDir
                  ? {
                      opacity: 0,
                      transform: "translateY(10px)",
                      transition:
                        "opacity var(--motion-base) ease 0.34s, transform var(--motion-base) var(--ease-exit) 0.34s",
                    }
                  : undefined
              }
            >
              {RATINGS.map((r, i) => {
                const isPressed = pressed === r;
                const state = isPressed
                  ? "cursor-wait border-t-[oklch(0.4_0.11_200)] bg-[oklch(0.4_0.11_200)]"
                  : pressed
                    ? "cursor-default border-t-[oklch(0.85_0.01_90)] bg-white opacity-45"
                    : "cursor-pointer border-t-[oklch(0.85_0.01_90)] bg-white text-ink-40 hover:border-t-[oklch(0.45_0.09_200)] hover:bg-accent-light hover:font-bold hover:text-[oklch(0.32_0.09_200)]";
                const label = isPressed ? "font-semibold text-white" : pressed ? "font-medium text-ink-40" : "";
                const preview = isPressed ? "text-[oklch(0.92_0.03_200)]" : "text-muted-light";
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={pressed !== null}
                    onClick={() => rate(r)}
                    className={
                      "flex flex-1 flex-col items-center gap-0.5 border-t-2 px-2 py-3.5 font-normal " +
                      (i > 0 ? "border-l border-l-[oklch(0.92_0.01_90)] " : "") +
                      state
                    }
                  >
                    <div className={"text-sm " + label}>{RATING_LABELS[r]}</div>
                    <div className={"text-[11.5px] " + preview}>{previews[r]}</div>
                  </button>
                );
              })}
            </div>

            {/* Under the rating bar, the link comes in with it and, once a
                rating is chosen, leaves with it. */}
            <div
              key={`link-${turn}`}
              className="deck-rates-in motion-fly w-full max-w-[640px]"
              style={
                exitDir
                  ? {
                      opacity: 0,
                      transform: "translateY(10px)",
                      transition:
                        "opacity var(--motion-base) ease 0.34s, transform var(--motion-base) var(--ease-exit) 0.34s",
                    }
                  : undefined
              }
            >
              <Link
                href="/deck/cards"
                className="press-link text-[13.5px] font-medium text-ink-40"
              >
                Voir toutes les cartes du deck →
              </Link>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="w-full max-w-[640px] text-[12.5px] text-danger-text">{error}</div>
      )}

      {!revealed && (
        <div
          key={`question-link-${turn}`}
          // After a rating, it comes back with the new card's field.
          className={"w-full max-w-[640px]" + (turn > 0 ? " deck-answer-in" : "")}
        >
          <Link
            href="/deck/cards"
            className="press-link text-[13.5px] font-medium text-ink-40"
          >
            Voir toutes les cartes du deck →
          </Link>
        </div>
      )}

      <DailyLimitModal
        open={limitOpen}
        initialValue={dailyNewCardLimit}
        introducedToday={introducedToday}
        onClose={() => setLimitOpen(false)}
      />
      <UpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}

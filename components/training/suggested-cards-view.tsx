"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SuggestedCard = { front: string; back: string; category: string };

export function SuggestedCardsView({
  exerciseId,
  initialCards,
  maxCards,
}: {
  exerciseId: string;
  initialCards: SuggestedCard[];
  maxCards: number;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [refreshingIndex, setRefreshingIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        if (next.size >= maxCards) return prev;
        next.add(index);
      }
      return next;
    });
  }

  async function refresh(index: number) {
    setError(null);
    setRefreshingIndex(index);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/suggested-cards/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      setCards((prev) => prev.map((c, i) => (i === index ? data.card : c)));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setRefreshingIndex(null);
    }
  }

  async function confirm() {
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/suggested-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      router.push(`/training/${exerciseId}/complete`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setConfirming(false);
    }
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-8 py-14 px-16">
      <div>
        <div className="font-serif text-[30px] font-semibold leading-[1.15] text-ink">
          Cartes suggérées pour votre deck
        </div>
        <div className="mt-2.5 text-[13.5px] text-muted-light">
          Sélectionnez les phrases à ajouter à votre deck de révision. Vous pouvez
          rafraîchir une suggestion si elle ne vous convient pas.
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {cards.map((card, index) => {
          const isSelected = selected.has(index);
          const isRefreshing = refreshingIndex === index;
          return (
            <div
              key={index}
              className={
                "flex flex-col gap-3.5 rounded-xl bg-white p-6 " +
                (isSelected ? "border-2 border-[oklch(0.4_0.11_200)]" : "border border-border")
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-light">
                    Recto
                  </div>
                  <div className="font-serif text-base text-[oklch(0.25_0.01_90)]">
                    {card.front}
                  </div>
                  <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-light">
                    Verso
                  </div>
                  <div className="text-[15px] text-[oklch(0.35_0.01_90)]">{card.back}</div>
                </div>
                <div className="flex-shrink-0 whitespace-nowrap rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">
                  {card.category}
                </div>
              </div>
              <div className="flex items-center gap-2.5 border-t border-border-soft pt-1.5">
                {isSelected ? (
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-[oklch(0.4_0.11_200)] px-4.5 py-2.5 text-[13px] font-semibold text-white"
                  >
                    <span className="text-sm">✓</span>Ajouté au deck
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    disabled={selected.size >= maxCards}
                    className="cursor-pointer rounded-lg bg-ink px-4.5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ajouter au deck
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => refresh(index)}
                  disabled={isRefreshing}
                  className="ml-auto cursor-pointer text-[12.5px] font-medium text-muted-light disabled:opacity-60"
                >
                  {isRefreshing ? "Rafraîchissement…" : "Rafraîchir la phrase ↻"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <div className="text-[12.5px] text-muted-light">
          {selected.size} carte{selected.size === 1 ? "" : "s"} sera
          {selected.size === 1 ? "" : "ont"} ajoutée{selected.size === 1 ? "" : "s"} à votre
          deck (max. {Number.isFinite(maxCards) ? maxCards : "illimité"} par exercice)
        </div>
        <button
          type="button"
          onClick={confirm}
          disabled={confirming}
          className="cursor-pointer rounded-lg bg-ink px-7 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {confirming ? "…" : "Confirmer l'ajout au deck"}
        </button>
      </div>

      {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
    </div>
  );
}

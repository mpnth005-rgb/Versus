"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CardForm({
  mode,
  cardId,
  initialFront = "",
  initialBack = "",
}: {
  mode: "create" | "edit";
  cardId?: string;
  initialFront?: string;
  initialBack?: string;
}) {
  const router = useRouter();
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!front.trim() || !back.trim()) return;
    setError(null);
    setPending(true);
    try {
      const url = mode === "create" ? "/api/deck/cards" : `/api/deck/cards/${cardId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      router.push("/deck/cards");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-7 py-12 px-16">
      <div>
        <button
          type="button"
          onClick={() => router.push("/deck/cards")}
          className="press-link mb-3.5 cursor-pointer text-[13px] font-medium text-ink-40"
        >
          ← Retour au deck
        </button>
        <div className="font-serif text-[28px] font-semibold text-ink">
          {mode === "create" ? "Ajouter une carte manuellement" : "Modifier la carte"}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-ink-softer">
            Recto <span className="font-normal text-muted-light">(texte source)</span>
          </div>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Une phrase en français à mémoriser…"
            rows={2}
            className="min-h-16 font-serif text-[15.5px] text-[oklch(0.25_0.01_90)] resize-y rounded-lg border border-border-strong bg-white px-[18px] py-4 outline-none transition-[border-color,box-shadow] duration-150 focus:border-[oklch(0.45_0.09_200)] focus:shadow-[0_0_0_1px_oklch(0.45_0.09_200)]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-ink-softer">
            Verso <span className="font-normal text-muted-light">(traduction)</span>
          </div>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Its English translation…"
            rows={2}
            className="min-h-16 text-[15px] text-ink-softer resize-y rounded-lg border border-border-strong bg-white px-[18px] py-4 outline-none transition-[border-color,box-shadow] duration-150 focus:border-[oklch(0.45_0.09_200)] focus:shadow-[0_0_0_1px_oklch(0.45_0.09_200)]"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => router.push("/deck/cards")}
          className="press-secondary cursor-pointer rounded-lg border border-border-strong bg-white px-5 py-[11px] text-[13.5px] font-semibold text-ink-40"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !front.trim() || !back.trim()}
          title={!front.trim() || !back.trim() ? "Remplissez le recto et le verso" : undefined}
          className={
            "rounded-lg border px-5 py-[11px] text-[13.5px] font-semibold " +
            (!front.trim() || !back.trim()
              ? "cursor-not-allowed border-paper-alt-3 bg-paper-alt-3 text-[oklch(0.65_0.01_90)]"
              : "press-primary cursor-pointer border-ink bg-ink text-white")
          }
        >
          {mode === "create" ? "Ajouter la carte" : "Enregistrer"}
        </button>
      </div>

      {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DailyLimitModal({
  open,
  initialValue,
  introducedToday,
  onClose,
}: {
  open: boolean;
  initialValue: number;
  // New cards already started today count against the limit (Anki-style
  // daily quota), so the modal shows how many are left at each value.
  introducedToday: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/deck/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyNewCardLimit: value }),
      });
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
      onClick={onClose}
    >
      <div
        className="flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-[21px] font-semibold text-ink">
            Limite quotidienne
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[15px] text-muted-light"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="text-[13.5px] leading-[1.55] text-muted-light">
          Nombre de nouvelles cartes introduites chaque jour, en plus des révisions déjà
          dues.
        </div>
        <div className="flex items-center justify-center gap-5 py-5">
          <button
            type="button"
            onClick={() => setValue((v) => Math.max(0, v - 1))}
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-border-strong text-lg text-ink-40"
          >
            –
          </button>
          <div className="w-14 text-center font-serif text-[30px] font-semibold text-ink">
            {value}
          </div>
          <button
            type="button"
            onClick={() => setValue((v) => Math.min(40, v + 1))}
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-border-strong text-lg text-ink-40"
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[11.5px] text-muted-lighter">
          <span>0</span>
          <span>40</span>
        </div>
        <div className="rounded-lg bg-paper-alt px-4 py-3 text-[12.5px] leading-[1.55] text-muted-light">
          <span className="font-semibold text-ink-softer">{introducedToday}</span> nouvelle
          {introducedToday === 1 ? "" : "s"} carte{introducedToday === 1 ? "" : "s"} déjà
          commencée{introducedToday === 1 ? "" : "s"} aujourd&apos;hui · encore{" "}
          <span className="font-semibold text-ink-softer">
            {Math.max(0, value - introducedToday)}
          </span>{" "}
          possible{Math.max(0, value - introducedToday) === 1 ? "" : "s"} avec cette limite
        </div>
        <div className="mt-2 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-border-strong py-3 text-center text-sm font-semibold text-ink-40"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 cursor-pointer rounded-lg bg-ink py-3 text-center text-sm font-semibold text-white"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MAX_DAILY_NEW_CARDS } from "@/lib/constants";
import { Modal } from "@/components/modal";

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

  // Reopening starts again from the saved limit, as in the prototype.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(initialValue);
  }

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
    <Modal
      open={open}
      onClose={onClose}
      panelClassName="flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[21px] font-semibold text-ink">
          Limite quotidienne
        </div>
        <button
          type="button"
          onClick={onClose}
          className="press-icon flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[7px] text-sm text-muted-light"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
      <div className="text-[13.5px] leading-[1.55] text-muted-light">
        Nombre de nouvelles cartes introduites chaque jour, en plus des
        révisions déjà dues.
      </div>
      <div className="flex items-center justify-center gap-5 py-3">
        <button
          type="button"
          onClick={() => setValue((v) => Math.max(0, v - 1))}
          className="press-arrow flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-border-strong text-lg text-ink-40"
        >
          –
        </button>
        <div className="w-14 text-center font-serif text-[30px] font-semibold text-ink">
          {value}
        </div>
        <button
          type="button"
          onClick={() => setValue((v) => Math.min(MAX_DAILY_NEW_CARDS, v + 1))}
          className="press-arrow flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-border-strong text-lg text-ink-40"
        >
          +
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={MAX_DAILY_NEW_CARDS}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full cursor-pointer accent-[oklch(0.45_0.09_200)]"
        />
        <div className="flex justify-between text-[11.5px] text-muted-lighter">
          <span>0</span>
          <span>{MAX_DAILY_NEW_CARDS}</span>
        </div>
      </div>
      <div className="rounded-lg bg-paper-alt px-3.5 py-3 text-[12.5px] leading-[1.5] text-muted-light">
        <span className="font-semibold text-ink-softer">{introducedToday}</span>{" "}
        nouvelle
        {introducedToday === 1 ? "" : "s"} carte
        {introducedToday === 1 ? "" : "s"} déjà commencée
        {introducedToday === 1 ? "" : "s"} aujourd&apos;hui · encore{" "}
        <span className="font-semibold text-ink-softer">
          {Math.max(0, value - introducedToday)}
        </span>{" "}
        possible{Math.max(0, value - introducedToday) === 1 ? "" : "s"} avec
        cette limite
      </div>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="press-secondary flex-1 cursor-pointer rounded-lg border border-border-strong bg-white px-5 py-[11px] text-center text-[13.5px] font-semibold text-ink-40"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="press-primary flex-1 cursor-pointer rounded-lg border border-ink bg-ink px-5 py-[11px] text-center text-[13.5px] font-semibold text-white"
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

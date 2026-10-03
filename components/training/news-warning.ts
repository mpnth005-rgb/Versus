"use client";

import { useEffect } from "react";

/** Set once the "Ancrer dans l'actualité" warning has been accepted; cleared
 * when an exercise is finished, so the warning shows again for the next one. */
export const NEWS_WARNED_KEY = "versus.newsWarningAccepted";

/** Rendered on the exercise completion page: finishing an exercise means
 * the next activation of the news option shows its warning again. */
export function NewsWarningReset() {
  useEffect(() => {
    try {
      localStorage.removeItem(NEWS_WARNED_KEY);
    } catch {}
  }, []);
  return null;
}

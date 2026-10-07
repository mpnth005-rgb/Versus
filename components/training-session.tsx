"use client";

import { createContext, useContext, useState } from "react";

export type TextType = "LITERARY" | "JOURNALISTIC" | "DAILY";
export type Level = "A2" | "B1" | "B2" | "C1";

type Criteria = {
  textType: TextType | null;
  level: Level | null;
  theme: string | null;
};

type TrainingSession = {
  criteria: Criteria;
  setCriteria: (patch: Partial<Criteria>) => void;
  /** Where the sidebar's "Entraînement" link leads: the exercise in
   * progress, or the criteria form when there is none. */
  trainingHref: string;
  /** Translation typed so far for an exercise, kept while browsing other pages. */
  drafts: Record<string, string>;
  setDraft: (exerciseId: string, text: string) => void;
};

const TrainingSessionContext = createContext<TrainingSession | null>(null);

/** The exercise in progress after visiting `pathname`: any /training/<id>
 * page becomes it; the criteria form or the completion page ends it; any
 * other page leaves it unchanged. */
function exercisePathFrom(
  pathname: string,
  current: string | null,
): string | null {
  if (pathname === "/training" || pathname.endsWith("/complete")) return null;
  if (/^\/training\/[^/]+/.test(pathname)) return pathname;
  return current;
}

/**
 * Keeps the training flow intact while the learner browses the other
 * sidebar pages. It lives in the app shell, which stays mounted across
 * those navigations: the criteria picked stay selected, the translation
 * typed so far is kept, and "Entraînement" leads back to the exercise in
 * progress — until the learner goes back to the criteria ("Retour aux
 * critères", "Nouvel exercice") or finishes the exercise.
 */
export function TrainingSessionProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  const [criteria, setCriteriaState] = useState<Criteria>({
    textType: null,
    level: null,
    theme: null,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [currentExercisePath, setCurrentExercisePath] = useState<string | null>(
    () => exercisePathFrom(pathname, null),
  );
  const [seenPathname, setSeenPathname] = useState(pathname);

  // Track the exercise in progress from the URL, adjusting state during
  // render when the path changes (React's "previous value" pattern).
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setCurrentExercisePath(exercisePathFrom(pathname, currentExercisePath));
  }

  const value: TrainingSession = {
    criteria,
    setCriteria: (patch) => setCriteriaState((c) => ({ ...c, ...patch })),
    trainingHref: currentExercisePath ?? "/training",
    drafts,
    setDraft: (exerciseId, text) =>
      setDrafts((d) => ({ ...d, [exerciseId]: text })),
  };

  return (
    <TrainingSessionContext.Provider value={value}>
      {children}
    </TrainingSessionContext.Provider>
  );
}

export function useTrainingSession(): TrainingSession {
  const session = useContext(TrainingSessionContext);
  if (!session)
    throw new Error(
      "useTrainingSession must be used inside TrainingSessionProvider",
    );
  return session;
}

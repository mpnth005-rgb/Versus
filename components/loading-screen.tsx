const MESSAGES: Record<"generate" | "correct" | "splash", string[]> = {
  generate: ["Analyse de vos critères…", "Rédaction du texte…", "Finalisation…"],
  correct: [
    "Lecture de votre traduction…",
    "Comparaison avec la référence…",
    "Calcul du score…",
  ],
  splash: ["Chargement de votre espace d'entraînement…"],
};

export function LoadingScreen({ variant }: { variant: "generate" | "correct" | "splash" }) {
  const messages = MESSAGES[variant];

  return (
    <div className="flex min-h-[900px] flex-col items-center justify-center gap-[30px] bg-paper">
      <div className="font-serif text-[38px] font-semibold text-ink">V</div>
      <div className="h-[5px] w-80 overflow-hidden rounded-[3px] bg-paper-alt-2">
        <div className="animate-progress-fill h-full rounded-[3px] bg-accent" />
      </div>
      <div className="relative h-5 w-80 text-center">
        {messages.length === 1 ? (
          <div className="text-sm text-muted-light">{messages[0]}</div>
        ) : (
          <>
            <div className="animate-load-a absolute inset-0 text-sm text-muted-light">
              {messages[0]}
            </div>
            <div className="animate-load-b absolute inset-0 text-sm text-muted-light">
              {messages[1]}
            </div>
            <div className="animate-load-c absolute inset-0 text-sm text-muted-light">
              {messages[2]}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

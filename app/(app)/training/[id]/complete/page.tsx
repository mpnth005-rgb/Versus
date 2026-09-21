import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserQuota } from "@/lib/quota";
import { formatScore } from "@/lib/format";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: { correction: true },
  });
  if (!exercise || exercise.userId !== session.user.id) notFound();
  if (exercise.status !== "COMPLETED") redirect(`/training/${id}/correction`);

  const [quota, cardsAdded] = await Promise.all([
    getUserQuota(session.user.id),
    prisma.flashcard.count({ where: { sourceExerciseId: id } }),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[22px] px-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-[28px] text-[oklch(0.4_0.11_200)]">
        ✓
      </div>
      <div className="font-serif text-[28px] font-semibold text-ink">Exercice terminé !</div>
      <div className="max-w-[420px] text-[15px] leading-[1.6] text-muted-light">
        Score :{" "}
        {exercise.correction ? `${formatScore(exercise.correction.overallScore)}/20` : "—"}
        {cardsAdded > 0 && (
          <>
            {" "}
            · {cardsAdded} carte{cardsAdded === 1 ? "" : "s"} a été ajoutée
            {cardsAdded === 1 ? "" : "s"} à votre deck de révision.
          </>
        )}
      </div>
      {!quota.isPremium && (
        <div className="rounded-[10px] bg-paper-alt px-6 py-4 text-[13px] text-muted-light">
          Il vous reste{" "}
          <span className="font-semibold text-ink-softer">
            {quota.exercisesRemaining} exercice{quota.exercisesRemaining === 1 ? "" : "s"}
          </span>{" "}
          ce mois-ci.
        </div>
      )}
      <div className="mt-2.5 flex gap-3.5">
        <Link
          href="/training"
          className={
            "rounded-lg px-6.5 py-3 text-[14.5px] font-semibold " +
            (cardsAdded > 0
              ? "border border-border-strong text-ink-40"
              : "bg-ink text-white")
          }
        >
          Nouvel exercice
        </Link>
        {cardsAdded > 0 && (
          <Link
            href="/deck"
            className="rounded-lg bg-ink px-6.5 py-3 text-[14.5px] font-semibold text-white"
          >
            Voir le deck de révision
          </Link>
        )}
      </div>
    </div>
  );
}

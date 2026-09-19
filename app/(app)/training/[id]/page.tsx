import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TranslationEditor } from "@/components/training/translation-editor";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== session.user.id) notFound();

  if (exercise.status === "COMPLETED") redirect(`/training/${id}/complete`);
  if (exercise.status === "CORRECTED" || exercise.status === "SUBMITTED") {
    redirect(`/training/${id}/correction`);
  }

  return (
    <TranslationEditor
      exercise={{
        id: exercise.id,
        title: exercise.title,
        textType: exercise.textType,
        level: exercise.level,
        themes: Array.isArray(exercise.themes) ? (exercise.themes as string[]) : [],
        sourceText: exercise.sourceText,
        wordCount: exercise.wordCount,
      }}
    />
  );
}

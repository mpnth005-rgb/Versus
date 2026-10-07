import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateExerciseText, AiNotConfiguredError } from "@/lib/ai";
import { getUserQuota, consumeExerciseQuota } from "@/lib/quota";
import { getRecentTitles } from "@/lib/progress";
import { MAX_THEMES, THEME_OPTIONS } from "@/lib/constants";
import { progressResponse, scaledProgress } from "@/lib/progress-stream";

const bodySchema = z.object({
  textType: z.enum(["LITERARY", "JOURNALISTIC", "DAILY"]),
  level: z.enum(["A2", "B1", "B2", "C1"]),
  themes: z.array(z.enum(THEME_OPTIONS)).max(MAX_THEMES),
  anchoredInNews: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const quota = await getUserQuota(session.user.id);
  if (!quota.canStartExercise) {
    return NextResponse.json(
      { error: "Limite mensuelle d'exercices atteinte." },
      { status: 403 }
    );
  }

  // "Ancrer dans l'actualité" (journalistic texts only): generation searches
  // the web (lib/ai.ts).
  const anchoredInNews =
    parsed.data.anchoredInNews === true && parsed.data.textType === "JOURNALISTIC";

  const userId = session.user.id;
  const criteria = parsed.data;

  // From here on, the loading screen's bar follows the generation as it is
  // written (lib/progress-stream.ts).
  return progressResponse(async (report) => {
    report(0.03);
    try {
      // The subtheme is no longer picked by the learner: lib/ai.ts draws one
      // (and an angle within it) for every generation.
      const recentTitles = await getRecentTitles(userId);
      const generated = await generateExerciseText({
        ...criteria,
        anchoredInNews,
        recentTitles,
        onProgress: scaledProgress(report, 0.03, 0.97),
      });
      const exercise = await prisma.exercise.create({
        data: {
          userId,
          title: generated.title,
          textType: criteria.textType,
          level: criteria.level,
          themes: criteria.themes,
          anchoredInNews,
          sourceText: generated.sourceText,
          wordCount: generated.wordCount,
          status: "READY",
        },
      });
      await consumeExerciseQuota(userId);
      return { status: 200, body: { id: exercise.id } };
    } catch (error) {
      if (error instanceof AiNotConfiguredError) {
        return { status: 503, body: { error: error.message } };
      }
      console.error("exercise generation error", error);
      return { status: 500, body: { error: "La génération du texte a échoué. Réessayez." } };
    }
  });
}

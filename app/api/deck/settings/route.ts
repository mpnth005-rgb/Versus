import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  dailyNewCardLimit: z.number().int().min(0).max(200),
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

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: { dailyNewCardLimit: parsed.data.dailyNewCardLimit },
    create: { userId: session.user.id, dailyNewCardLimit: parsed.data.dailyNewCardLimit },
  });

  return NextResponse.json({ ok: true });
}

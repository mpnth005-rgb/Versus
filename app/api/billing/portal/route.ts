import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, StripeNotConfiguredError } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "Aucun abonnement à gérer." }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${req.nextUrl.origin}/account`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("billing portal error", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}

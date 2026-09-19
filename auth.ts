import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { getAppleClientSecret } from "@/lib/apple-client-secret";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const appleClientSecret = await getAppleClientSecret();

  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "database" },
    trustHost: true,
    pages: {
      signIn: "/login",
    },
    providers: [
      Google,
      ...(process.env.AUTH_APPLE_ID && appleClientSecret
        ? [Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: appleClientSecret })]
        : []),
    ],
    callbacks: {
      session({ session, user }) {
        if (session.user) session.user.id = user.id;
        return session;
      },
    },
    events: {
      async createUser({ user }) {
        if (!user.id) return;
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id, plan: "FREE" },
        });
        await prisma.userSettings.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });
      },
    },
  };
});

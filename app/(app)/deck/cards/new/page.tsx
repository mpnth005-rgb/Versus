import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserQuota } from "@/lib/quota";
import { CardForm } from "@/components/deck/card-form";

export default async function NewCardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Adding cards manually is a Versus Upper feature.
  const quota = await getUserQuota(session.user.id);
  if (!quota.isPremium) redirect("/deck/cards");

  return <CardForm mode="create" />;
}

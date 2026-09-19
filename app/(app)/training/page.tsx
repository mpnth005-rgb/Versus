import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserQuota } from "@/lib/quota";
import { CriteriaForm } from "@/components/training/criteria-form";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quota = await getUserQuota(session.user.id);

  return <CriteriaForm canStartExercise={quota.canStartExercise} />;
}

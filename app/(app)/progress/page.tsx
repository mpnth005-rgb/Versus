import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getScoredExercises } from "@/lib/progress";
import { ProgressDashboard } from "@/components/progress/progress-dashboard";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const exercises = await getScoredExercises(session.user.id);

  return (
    <ProgressDashboard
      exercises={exercises.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
      now={new Date().toISOString()}
    />
  );
}

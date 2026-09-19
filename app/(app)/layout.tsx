import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserQuota } from "@/lib/quota";
import { AppShell } from "@/components/app-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quota = await getUserQuota(session.user.id);

  return <AppShell quota={quota}>{children}</AppShell>;
}

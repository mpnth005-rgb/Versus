import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CardForm } from "@/components/deck/card-form";

export default async function NewCardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <CardForm mode="create" />;
}

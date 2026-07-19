import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.role === "ops") redirect("/ops");
  if (!user.onboarded_at) redirect("/onboarding");
  redirect("/copilot");
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCaregiverElderId, getFamilyContacts } from "@/lib/queries";
import { loadElderContext } from "@/lib/copilot";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.role === "ops") redirect("/ops");
  if (user.onboarded_at) redirect("/copilot");

  const elderId = getCaregiverElderId(user.id);
  if (!elderId) redirect("/welcome");
  const elder = loadElderContext(elderId)!;
  const contacts = getFamilyContacts(elderId);

  return (
    <OnboardingWizard
      caregiverName={user.name}
      elder={elder}
      familyContact={contacts[0]?.name ?? "the family"}
    />
  );
}

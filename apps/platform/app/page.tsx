import { redirect } from "next/navigation";
import { isAuthenticated } from "@/auth-server";

export default async function PlatformHomePage() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/schools");
  }

  redirect("/sign-in?callbackUrl=%2Fschools");
}

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/assessments/setup/exam-recording");
}

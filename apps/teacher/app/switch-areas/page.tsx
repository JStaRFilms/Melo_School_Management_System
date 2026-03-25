"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceDefaultHref } from "@school/shared";

/**
 * /switch-areas now redirects to the first real section.
 * Area switching lives inline in the shared navbar.
 */
export default function TeacherSwitchAreasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getWorkspaceDefaultHref("teacher"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfbfc]">
      <div style={{ fontSize: 13, color: "#94a3b8" }}>Redirecting...</div>
    </div>
  );
}

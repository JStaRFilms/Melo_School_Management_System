"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { AssessmentProfileStudioScreen } from "./components/AssessmentProfileStudioScreen";
import type { AssessmentProfileDraft, Profile } from "./types";

export default function AssessmentGenerationProfilesPage() {
  const profiles = useQuery(
    api.functions.academic.lessonKnowledgeAssessmentProfiles.listAssessmentGenerationProfiles,
    { includeInactive: true }
  ) as Profile[] | undefined;

  const saveProfileMutation = useMutation(
    api.functions.academic.lessonKnowledgeAssessmentProfiles.saveAssessmentGenerationProfile
  );

  const handleSaveProfile = async (draft: AssessmentProfileDraft) => {
    return (await saveProfileMutation({ ...draft })) as string;
  };

  if (!profiles) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50">
        <div className="animate-pulse space-y-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-200" />
          <div className="h-4 w-32 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <AssessmentProfileStudioScreen
      profiles={profiles}
      onSaveProfile={handleSaveProfile}
    />
  );
}

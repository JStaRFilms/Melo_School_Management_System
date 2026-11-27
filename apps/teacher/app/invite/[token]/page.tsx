"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { InviteClaimView } from "@school/shared";
import { api } from "@school/convex/_generated/api";
import { useAuth } from "@/lib/AuthProvider";

export default function TeacherInviteClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { signIn, signOut, isLoading } = useAuth();
  const [checkedAt] = useState(() => Date.now());
  const invitation = useQuery(
    api.functions.academic.invitations.inspectInvitation,
    { token, now: checkedAt },
  );
  const acceptAsNew = useAction(
    api.functions.academic.invitations.acceptInvitationAsNewUser,
  );
  const acceptAsSignedIn = useMutation(
    api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
  );

  return (
    <InviteClaimView
      workspaceLabel="Teacher"
      invitation={invitation}
      isAuthLoading={isLoading}
      onSignIn={signIn}
      onSignOut={signOut}
      onAcceptAsNewUser={async (password) => {
        const res = await acceptAsNew({ token, password });
        return { email: res.email };
      }}
      onAcceptAsSignedInUser={async () => {
        await acceptAsSignedIn({ token });
      }}
      onComplete={() => router.replace("/")}
    />
  );
}

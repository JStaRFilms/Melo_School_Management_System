import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { BranchSwitcher, InviteClaimView } from "@school/shared";
import { TeacherCreationForm } from "../app/academic/teachers/components/TeacherCreationForm";

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ session: undefined, workspaceAccess: undefined }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useConvexConnectionState: () => ({ isWebSocketConnected: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeacherCreationForm invite and same-school parent promotion", () => {
  it("defaults to invite-link mode when onInvite is provided and renders the copyable invite URL", async () => {
    const onInvite = vi.fn().mockResolvedValue({
      invitationId: "inv_1",
      targetUserId: "user_1",
      email: "ada@example.test",
      invitePath: "/invite/token-123",
      inviteUrl: "https://teacher.melo.test/invite/token-123",
      expiresAt: Date.now() + 86_400_000,
      deliveryState: "pending",
    });
    const onProvision = vi.fn();

    render(
      <DepartureGuardProvider>
        <TeacherCreationForm
          onInvite={onInvite}
          onProvision={onProvision}
          isSubmitting={false}
        />
      </DepartureGuardProvider>,
    );

    expect(screen.getByRole("button", { name: "Invite link" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter a temporary password")).toBeNull();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Okafor" } });
    fireEvent.change(screen.getByPlaceholderText("teacher@school.edu"), {
      target: { value: "ada@example.test" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Teacher Invite" }));

    await screen.findByText("Invitation Pending");
    expect(onInvite).toHaveBeenCalledWith("Ada Okafor", "ada@example.test", {
      firstName: "Ada",
      middleName: undefined,
      lastName: "Okafor",
    });
    expect(onProvision).not.toHaveBeenCalled();
    expect(screen.getByText("https://teacher.melo.test/invite/token-123")).toBeInTheDocument();
  });

  it("offers inline teacher promotion when the entered email matches a same-school parent", async () => {
    const onPromoteParent = vi.fn().mockResolvedValue(undefined);
    render(
      <DepartureGuardProvider>
        <TeacherCreationForm
          onInvite={vi.fn()}
          onProvision={vi.fn()}
          onPromoteParent={onPromoteParent}
          promotableParents={[
            {
              userId: "parent_1" as never,
              name: "Chinedu Eze",
              email: "chinedu@example.test",
              hasActiveLogin: true,
            },
          ]}
          isSubmitting={false}
        />
      </DepartureGuardProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("teacher@school.edu"), {
      target: { value: "CHINEDU@example.test" },
    });

    expect(
      screen.getByText("Chinedu Eze is already a parent at this school."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grant teacher access" }));

    await waitFor(() => expect(onPromoteParent).toHaveBeenCalledWith("parent_1"));
  });
});

describe("InviteClaimView", () => {
  it("switches to existing-account sign-in when a new-user attempt hits an existing Melo account", async () => {
    const onAcceptAsNewUser = vi
      .fn()
      .mockRejectedValue(new Error("An account with this email already exists on Melo. Sign in to accept this invitation."));
    const onSignIn = vi.fn().mockResolvedValue({ success: true, error: null });
    const onAcceptAsSignedInUser = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <InviteClaimView
        workspaceLabel="Teacher"
        isAuthLoading={false}
        invitation={{
          state: "pending",
          schoolName: "Greenfield College",
          intendedRole: "teacher",
          maskedEmail: "a***a@example.test",
          expiresAt: Date.now() + 86_400_000,
          viewerSignedIn: false,
          viewerEmailMatches: false,
          viewerMaskedEmail: null,
        }}
        onSignIn={onSignIn}
        onSignOut={vi.fn()}
        onAcceptAsNewUser={onAcceptAsNewUser}
        onAcceptAsSignedInUser={onAcceptAsSignedInUser}
        onComplete={onComplete}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account & accept" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Existing Melo password")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Melo email"), {
      target: { value: "ada@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Existing Melo password"), {
      target: { value: "ExistingPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in & join Greenfield College" }));

    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledWith("ada@example.test", "ExistingPass123!");
      expect(onAcceptAsSignedInUser).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  it("blocks acceptance with a sign-out prompt when signed in as a different account", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <InviteClaimView
        workspaceLabel="Family Portal"
        isAuthLoading={false}
        invitation={{
          state: "pending",
          schoolName: "Bluebell Academy",
          intendedRole: "parent",
          maskedEmail: "a***a@example.test",
          expiresAt: Date.now() + 86_400_000,
          viewerSignedIn: true,
          viewerEmailMatches: false,
          viewerMaskedEmail: "o***r@example.test",
        }}
        onSignIn={vi.fn()}
        onSignOut={onSignOut}
        onAcceptAsNewUser={vi.fn()}
        onAcceptAsSignedInUser={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText(/o\*\*\*r@example\.test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out and switch account" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

describe("BranchSwitcher multi-school label", () => {
  it("uses Active school when memberships span independent schools", () => {
    const schoolA = {
      schoolId: "school_a",
      name: "Alpha School",
      slug: "alpha-school",
      isHeadquarters: false,
      status: "active" as const,
      groupName: null,
      groupSlug: null,
    };
    const schoolB = {
      schoolId: "school_b",
      name: "Beta College",
      slug: "beta-college",
      isHeadquarters: false,
      status: "active" as const,
      groupName: null,
      groupSlug: null,
    };
    render(
      <BranchSwitcher
        currentBranch={schoolA}
        availableBranches={[schoolA, schoolB]}
        onSelectBranch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Active school")).toBeInTheDocument();
  });
});

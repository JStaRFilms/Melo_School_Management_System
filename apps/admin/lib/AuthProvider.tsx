"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";
import type { BranchSummary } from "@school/shared";
import type { Id } from "@school/convex/_generated/dataModel";

import type { AuthSession } from "@school/auth";
import { authClient } from "@/auth-client";
import { isConvexConfigured } from "@/convex-runtime";
import {
  AUTH_ERROR_MESSAGES,
  getSignInErrorMessage,
  isValidEmailAddress,
} from "@school/auth";

const viewerAccessQuery = makeFunctionReference<"query", { schoolId?: Id<"schools"> }, WorkspaceAccessSummary>("functions/auth:getViewerAccess");
const userBranchesQuery = makeFunctionReference<"query", Record<string, never>, BranchSummary[]>("functions/academic/groups:listUserBranches");
const selectedSchoolKey = (accountId: string) => `melo:selected-school:${accountId}`;

export interface SignInResult {
  success: boolean;
  error: string | null;
}

type RawSession = {
  user?: {
    id: string;
    email: string;
    name: string;
    role?: string;
    schoolId?: string;
    image?: string | null;
  } | null;
  session?: {
    id: string;
    userId?: string | null;
    expiresAt: Date | string;
  } | null;
} | null | undefined;

type ViewerContext = {
  role?: string;
  schoolId?: string;
} | null | undefined;

function mapSession(
  session: RawSession,
  viewerContext: ViewerContext
): AuthSession | null {
  if (!session?.user || !session?.session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: isConvexConfigured() ? viewerContext?.role : session.user.role,
      schoolId: isConvexConfigured() ? viewerContext?.schoolId : session.user.schoolId,
      image: session.user.image,
    },
    session: {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
    },
  };
}

interface AuthContextValue {
  session: AuthSession | null;
  workspaceAccess: WorkspaceAccessSummary | undefined;
  availableBranches: BranchSummary[] | undefined;
  selectedSchoolId: string | null;
  selectSchool: (schoolId: string) => void;
  clearSelectedSchool: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectionAccountId, setSelectionAccountId] = useState<string | null>(null);
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const accountId = session?.user?.id ?? null;

  useEffect(() => {
    if (!accountId) {
      setSelectedSchoolId(null);
      setSelectionAccountId(null);
      return;
    }
    const key = selectedSchoolKey(accountId);
    const load = () => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(key);
      } catch {
        // Storage is optional; server validation remains authoritative.
      }
      setSelectedSchoolId(stored);
      setSelectionAccountId(accountId);
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === key) setSelectedSchoolId(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [accountId]);

  const selectionReady = Boolean(accountId && selectionAccountId === accountId);
  const resolvedWorkspaceAccess = useQuery(
    viewerAccessQuery,
    isConvexConfigured() && session?.user && selectionReady
      ? selectedSchoolId ? { schoolId: selectedSchoolId as Id<"schools"> } : {}
      : "skip",
  );
  const availableBranches = useQuery(
    userBranchesQuery,
    isConvexConfigured() && session?.user && selectionReady ? {} : "skip",
  );
  const selectedIsValidated = !selectedSchoolId || availableBranches === undefined ||
    availableBranches.some((branch) => branch.schoolId === selectedSchoolId);
  const resolvedMatchesSelection = !selectedSchoolId || resolvedWorkspaceAccess?.state !== "ready" ||
    resolvedWorkspaceAccess.branch.schoolId === selectedSchoolId;
  const workspaceAccess = useMemo<WorkspaceAccessSummary | undefined>(() => !selectedIsValidated
    ? { state: "reconciliation_required", message: "The saved branch is no longer an active membership. No branch data was opened. Return to your default branch or ask an administrator to review access." }
    : resolvedMatchesSelection ? resolvedWorkspaceAccess : undefined,
  [resolvedMatchesSelection, resolvedWorkspaceAccess, selectedIsValidated]);

  useEffect(() => {
    if (!accountId || !selectedSchoolId || availableBranches === undefined || selectedIsValidated) return;
    try {
      window.localStorage.removeItem(selectedSchoolKey(accountId));
    } catch {
      // The invalid selection stays fail-closed for this session even if cleanup is unavailable.
    }
  }, [accountId, availableBranches, selectedIsValidated, selectedSchoolId]);

  const selectSchool = useCallback((schoolId: string) => {
    if (!accountId || !availableBranches?.some((branch) => branch.schoolId === schoolId)) {
      throw new Error("Target branch is not in the server-validated branch directory.");
    }
    const defaultSchoolId = resolvedWorkspaceAccess?.state === "ready"
      ? resolvedWorkspaceAccess.compatibility.legacyDefaultSchoolId
      : null;
    const persisted = schoolId === defaultSchoolId ? null : schoolId;
    if (persisted) window.localStorage.setItem(selectedSchoolKey(accountId), persisted);
    else window.localStorage.removeItem(selectedSchoolKey(accountId));
    setSelectedSchoolId(persisted);
  }, [accountId, availableBranches, resolvedWorkspaceAccess]);

  const clearSelectedSchool = useCallback(() => {
    if (accountId) {
      try {
        window.localStorage.removeItem(selectedSchoolKey(accountId));
      } catch {
        // In-memory reset still safely returns to server-resolved default access.
      }
    }
    setSelectedSchoolId(null);
  }, [accountId]);
  const mappedSession = useMemo(
    () => mapSession(session, workspaceAccess?.state === "ready" &&
      workspaceAccess.compatibility.legacyDefaultSchoolId === workspaceAccess.branch.schoolId ? {
      role: workspaceAccess.compatibility.legacyRole ?? undefined,
      schoolId: workspaceAccess.branch.schoolId,
    } : null),
    [session, workspaceAccess]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      setAuthError(null);

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        const message = AUTH_ERROR_MESSAGES.missingCredentials;
        setAuthError(message);
        return { success: false, error: message };
      }

      if (!isValidEmailAddress(normalizedEmail)) {
        const message = AUTH_ERROR_MESSAGES.invalidEmail;
        setAuthError(message);
        return { success: false, error: message };
      }

      try {
        const result = await authClient.signIn.email({
          email: normalizedEmail,
          password,
        });

        if ((result as { error?: unknown } | undefined)?.error) {
          const message = getSignInErrorMessage(
            (result as { error?: unknown }).error
          );
          setAuthError(message);
          return { success: false, error: message };
        }

        if (result?.data) {
          return { success: true, error: null };
        }

        const message = AUTH_ERROR_MESSAGES.invalidCredentials;
        setAuthError(message);
        return { success: false, error: message };
      } catch (err) {
        const message = getSignInErrorMessage(err);
        setAuthError(message);
        return { success: false, error: message };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      setAuthError(null);
      await authClient.signOut();
    } catch {}
  }, []);

  const isLoading =
    isPending ||
    (isConvexConfigured() && Boolean(session?.user) &&
      (!selectionReady || workspaceAccess === undefined || (Boolean(selectedSchoolId) && availableBranches === undefined)));

  const value: AuthContextValue = {
    session: mappedSession,
    workspaceAccess,
    availableBranches,
    selectedSchoolId,
    selectSchool,
    clearSelectedSchool,
    isLoading,
    isAuthenticated: Boolean(mappedSession),
    signIn,
    signOut,
    error: authError ?? sessionError?.message ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

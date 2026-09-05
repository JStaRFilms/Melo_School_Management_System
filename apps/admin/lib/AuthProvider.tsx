"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

import type { AuthSession } from "@school/auth";
import { authClient } from "@/auth-client";
import { isConvexConfigured } from "@/convex-runtime";
import {
  AUTH_ERROR_MESSAGES,
  getSignInErrorMessage,
  isValidEmailAddress,
} from "@school/auth";

const viewerAccessQuery = makeFunctionReference<"query", Record<string, never>, WorkspaceAccessSummary>("functions/auth:getViewerAccess");

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
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const { data: session, isPending, error: sessionError } = authClient.useSession();

  // Default only: U1b must scope actual route callers before enabling switching.
  const workspaceAccess = useQuery(
    viewerAccessQuery,
    isConvexConfigured() && session?.user ? {} : "skip"
  );
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
    (isConvexConfigured() && Boolean(session?.user) && workspaceAccess === undefined);

  const value: AuthContextValue = {
    session: mappedSession,
    workspaceAccess,
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

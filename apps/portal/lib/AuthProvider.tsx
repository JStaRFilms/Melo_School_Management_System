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
import type { AuthSession } from "@school/auth";
import { authClient } from "@/auth-client";
import { isConvexConfigured } from "@/convex-runtime";
import {
  AUTH_ERROR_MESSAGES,
  getSignInErrorMessage,
  isValidEmailAddress,
} from "@school/auth";

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

function mapSession(session: RawSession, viewerContext: ViewerContext): AuthSession | null {
  if (!session?.user || !session?.session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: viewerContext?.role ?? session.user.role,
      schoolId: viewerContext?.schoolId ?? session.user.schoolId,
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
          const message = getSignInErrorMessage((result as { error?: unknown }).error);
          setAuthError(message);
          return { success: false, error: message };
        }

        if (result?.data) {
          return { success: true, error: null };
        }

        const message = AUTH_ERROR_MESSAGES.retry;
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

  const mappedSessionWithoutViewer = useMemo(() => mapSession(session, null), [session]);

  if (!isConvexConfigured()) {
    const value: AuthContextValue = {
      session: mappedSessionWithoutViewer,
      isLoading: isPending,
      isAuthenticated: Boolean(mappedSessionWithoutViewer),
      signIn,
      signOut,
      error: authError ?? sessionError?.message ?? null,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return (
    <AuthProviderWithConvex
      session={session}
      isPending={isPending}
      sessionError={sessionError}
      signIn={signIn}
      signOut={signOut}
      authError={authError}
    >
      {children}
    </AuthProviderWithConvex>
  );
}

function AuthProviderWithConvex({
  children,
  session,
  isPending,
  sessionError,
  signIn,
  signOut,
  authError,
}: {
  children: ReactNode;
  session: RawSession;
  isPending: boolean;
  sessionError: { message?: string } | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  authError: string | null;
}) {
  const viewerContext = useQuery(
    "functions/auth:getViewerContext" as never,
    session?.user ? ({} as never) : ("skip" as never)
  ) as { role?: string; schoolId?: string } | null | undefined;

  const mappedSession = useMemo(
    () => mapSession(session, viewerContext),
    [session, viewerContext]
  );
  const sessionRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  const hasResolvedMembership = useMemo(() => {
    if (!session?.user) {
      return true;
    }

    return Boolean(viewerContext?.role ?? sessionRole);
  }, [session, sessionRole, viewerContext]);

  const value: AuthContextValue = {
    session: mappedSession,
    isLoading: isPending || (Boolean(session?.user) && !hasResolvedMembership),
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

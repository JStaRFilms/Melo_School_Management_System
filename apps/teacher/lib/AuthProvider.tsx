"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import type { AuthSession } from "@school/auth";
import { authClient } from "@/lib/auth-client";
import { isConvexConfigured } from "@/lib/convex-runtime";

function mapSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewerContext: any
): AuthSession | null {
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
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error: sessionError } = authClient.useSession();

  // Fetch enriched viewer context from Convex when authenticated
  const viewerContext = useQuery(
    "functions/auth:getViewerContext" as never,
    isConvexConfigured() && session?.user ? ({} as never) : ("skip" as never)
  ) as { role?: string; schoolId?: string } | null | undefined;

  const mappedSession = useMemo(
    () => mapSession(session, viewerContext),
    [session, viewerContext]
  );
  const sessionRole =
    (session?.user as { role?: string } | undefined)?.role ?? null;

  const hasResolvedMembership = useMemo(() => {
    if (!isConvexConfigured()) {
      return true;
    }

    if (!session?.user) {
      return true;
    }

    return Boolean(viewerContext?.role ?? sessionRole);
  }, [session, sessionRole, viewerContext]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        return Boolean(result?.data);
      } catch (err) {
        return false;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {}
  }, []);

  const isLoading =
    isPending ||
    (isConvexConfigured() && Boolean(session?.user) && !hasResolvedMembership);

  const value: AuthContextValue = {
    session: mappedSession,
    isLoading,
    isAuthenticated: Boolean(mappedSession),
    signIn,
    signOut,
    error: sessionError?.message ?? null,
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

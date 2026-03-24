"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import type { AuthSession } from "@school/auth";
import { authClient } from "@/auth-client";

function mapSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any
): AuthSession | null {
  if (!session?.user || !session?.session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      schoolId: session.user.schoolId,
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
  const mappedSession = mapSession(session);

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

  const value: AuthContextValue = {
    session: mappedSession,
    isLoading: isPending,
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

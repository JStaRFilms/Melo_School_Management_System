"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/AuthProvider";
import { AUTH_ERROR_MESSAGES } from "@school/auth";
import { appToast } from "@school/shared/toast";

const DEFAULT_SUCCESS_REDIRECT = "/schools";

function getSafeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return DEFAULT_SUCCESS_REDIRECT;
  }

  return callbackUrl;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isLoading, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const errorParam = searchParams.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError(AUTH_ERROR_MESSAGES.missingCredentials);
      return;
    }

    const result = await signIn(email, password);
    if (result.success) {
      router.push(callbackUrl);
      return;
    }

    setLocalError(result.error ?? AUTH_ERROR_MESSAGES.retry);
  };

  const displayError =
    localError ??
    error ??
    (errorParam === "unauthorized"
      ? "Super admin access required. This account is not a platform administrator."
      : null);

  useEffect(() => {
    if (!displayError) {
      return;
    }

    appToast.error("Unable to sign in", {
      id: "platform-sign-in-error",
      description: displayError,
    });
  }, [displayError]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
              SA
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Super Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to manage schools and platform access
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@platform.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">
              Super Admin
            </h1>
            <p className="mt-2 text-sm text-slate-500">Loading sign-in form...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}

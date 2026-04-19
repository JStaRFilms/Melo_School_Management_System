"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_ERROR_MESSAGES } from "@school/auth";
import { useAuth } from "@/AuthProvider";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isLoading, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
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
    (errorParam === "unauthorized" ? AUTH_ERROR_MESSAGES.unauthorizedArea : null);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-7">
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm mx-auto mb-3 shadow-lg shadow-blue-600/20">
              P
            </div>
            <h1 className="text-xl font-bold text-slate-900">Portal Sign In</h1>
            <p className="text-sm text-slate-500 mt-1">
              Access your child&apos;s academic dashboard
            </p>
          </div>

          {displayError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@school.com"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">Portal Sign In</h1>
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

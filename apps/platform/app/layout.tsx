import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { getToken } from "@/auth-server";

export const metadata = {
  title: "SchoolOS Platform Admin",
  description: "Internal super-admin workspace for SchoolOS.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ConvexClientProvider initialToken={initialToken}>
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

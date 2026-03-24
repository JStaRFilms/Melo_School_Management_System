import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { getToken } from "@/auth-server";

export const metadata = {
  title: "OS/SCHOOL Admin",
  description: "School Management System - Admin Portal",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen">
        <ConvexClientProvider initialToken={initialToken}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import { ConvexClientProvider } from "@/lib/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { getToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Teacher Portal - Exam Recording",
  description: "Teacher-side exam score entry for school management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en">
      <body className="pb-32 antialiased">
        <AuthProvider>
          <ConvexClientProvider initialToken={initialToken}>
            {children}
          </ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

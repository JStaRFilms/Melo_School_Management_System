import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
import { getToken } from "@/auth-server";

export const metadata: Metadata = {
  title: "Melo Admin",
  description: "Melo - School Admin Portal",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/melo-favicon.png", type: "image/png" }],
    shortcut: ["/melo-favicon.png"],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 min-h-screen" suppressHydrationWarning>
        <ConvexClientProvider initialToken={initialToken}>
          <AuthProvider>
            <AppToaster />
            {children}
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
import { ApplyProvider } from "@/lib/ApplyProvider";
import { getToken } from "@/lib/auth-server";
import "./globals.css";

export const metadata: Metadata = { title: "School applications", description: "Secure school application service", robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) { const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null; return <html lang="en"><body><ApplyProvider initialToken={initialToken}><AppToaster />{children}</ApplyProvider></body></html>; }

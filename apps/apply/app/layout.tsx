import type { Metadata } from "next";
import "./globals.css";
import { ApplyClientProvider } from "../lib/client";

export const metadata: Metadata = { title: "Apply", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ApplyClientProvider>{children}</ApplyClientProvider></body></html>;
}

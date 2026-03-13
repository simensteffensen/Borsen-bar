import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaxMate — Crypto Tax Platform for Norway",
  description:
    "Professional crypto tax calculation and portfolio accounting for Norwegian investors. Import, reconcile, and report with confidence.",
  keywords: ["crypto tax", "Norway", "Skatteetaten", "bitcoin tax", "crypto accounting"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="nb" suppressHydrationWarning>
        <body className={`${inter.className} antialiased`}>
          {children}
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}

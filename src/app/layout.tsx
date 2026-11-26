import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { themeScript } from "@/features/shell/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ParimShift",
  description: "An event shift board for staffing a race day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the head script sets data-theme before React hydrates.
    <html lang="en" className={`${inter.variable} ${interTight.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-14 text-ink">
        {children}
      </body>
    </html>
  );
}

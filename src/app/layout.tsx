import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/nav";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { authEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mise FI",
  description: "Meal planner and shopping list for S-market and Lidl in Turku",
  appleWebApp: { capable: true, title: "Mise FI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121513" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const open = !authEnabled();
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {open ? (
          <div className="bg-warn-soft px-4 py-1.5 text-center text-xs text-warn">No APP_PASSCODE set: anyone with the URL can use this app.</div>
        ) : null}
        <main className="mx-auto max-w-xl px-4 pb-28 pt-5">{children}</main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

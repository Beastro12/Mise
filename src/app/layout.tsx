import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { BottomNav } from "@/components/nav";
import { TopBar } from "@/components/top-bar";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { authEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Aitta",
  description: "Meal planner and shopping list for S-market and Lidl in Turku",
  appleWebApp: { capable: true, title: "Aitta", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f3b2e" },
    { media: "(prefers-color-scheme: dark)", color: "#101913" },
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
        <TopBar />
        <main className="mx-auto max-w-xl px-5 pb-28 pt-4">{children}</main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { AuthGate } from "@/components/AuthGate";
import { themeBootstrapScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "CheckMyPaper — see why you lose marks",
  description:
    "Scan your mock test, talk through your mistakes, and watch your weak patterns become clear — paper after paper.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CheckMyPaper" },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load the UI font in the browser (non-blocking) rather than via
            next/font, so the dev server / build never stall on a font fetch.
            Offline, --font-sans falls back to the system stack in globals.css. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Apply saved/system theme before paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <div className="app-shell">
          <AuthGate>{children}</AuthGate>
        </div>
        <RegisterSW />
      </body>
    </html>
  );
}

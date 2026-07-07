import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

// One clean geometric face for body + display — the refined, minimal feel of
// the "liftoff" design language. Display weight/tracking is set in globals.css.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
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
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
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

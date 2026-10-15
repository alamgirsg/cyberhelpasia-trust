import type { Metadata } from "next";
// Self-hosted variable fonts (no third-party runtime dependency).
// Archivo ships a width axis (62–125%) — the engraved, expanded display voice.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CyberHELP Asia Trust Platform", template: "%s · CyberHELP Asia Trust" },
  description: "Get ready for Singapore's Cyber Essentials and Cyber Trust marks, and govern your AI with confidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

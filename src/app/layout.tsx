import type { Metadata } from "next";
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

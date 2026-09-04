import type { Metadata } from "next";
import Link from "next/link";
import { Braces } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillHydra AI — Portable skills, isolated agents",
  description: "Clean-room skill-to-agent platform with policy-governed tools and isolated execution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link href="/" className="brand">
              <span className="brand-mark"><Braces size={18} strokeWidth={2.5} /></span>
              SkillHydra
            </Link>
            <div className="nav-links">
              <Link href="/talk-to-skill" className="nav-link">Talk to Skill</Link>
              <Link href="/dashboard" className="nav-link hide-mobile">Control Plane</Link>
              <Link href="/architecture" className="nav-link hide-mobile">Architecture</Link>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}

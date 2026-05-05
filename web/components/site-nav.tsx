"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FileText, Menu, X } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ThemeToggle } from "./theme-toggle";

type NavLink = {
  href: string;
  label: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

const links: NavLink[] = [
  { href: "/", label: "Champion" },
  { href: "/groups", label: "Group Stage" },
  { href: "/bracket", label: "Bracket" },
  { href: "/bracket/interactive", label: "My Picks" },
  { href: "/matchup", label: "Matchup" },
  { href: "/teams", label: "Teams" },
  { href: "/golden-boot", label: "Golden Boot" },
  { href: "/alternate", label: "Alternate" },
  { href: "/eda", label: "EDA" },
  { href: "/docs", label: "How it works" },
  { href: "/report.pdf", label: "Report", Icon: FileText },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="font-semibold tracking-tight text-sm sm:text-base shrink-0 flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            width={28}
            height={28}
            className="w-7 h-7 rounded-md"
          />
          WC 2026 Forecaster
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`hover:text-foreground transition-colors inline-flex items-center gap-1 ${
                pathname === l.href ? "text-foreground font-medium" : ""
              }`}
            >
              {l.Icon && <l.Icon className="w-3.5 h-3.5" />}
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster: theme toggle + (mobile) menu button */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="lg:hidden border-t border-border/60 bg-background">
          <ul className="mx-auto max-w-6xl px-2 py-2 flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors ${
                    pathname === l.href
                      ? "text-foreground font-medium bg-muted/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.Icon && <l.Icon className="w-3.5 h-3.5" />}
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

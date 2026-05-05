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
  { href: "/schedule", label: "Schedule" },
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
    <header className="sticky top-0 z-20">
      {/* Top bar — dark charcoal, edge-to-edge */}
      <div className="bg-header text-header-foreground border-b border-black/30">
        <div className="mx-auto max-w-6xl px-4 h-12 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="font-bold tracking-tight text-sm sm:text-base shrink-0 flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              width={24}
              height={24}
              className="w-6 h-6 rounded-sm"
            />
            <span>
              WC<span className="text-brand">2026</span>
            </span>
            <span className="hidden sm:inline text-header-muted font-normal">
              Forecaster
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-sm text-header-foreground hover:bg-white/10 transition-colors"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Secondary nav — light strip with yellow underline on active */}
      <div className="hidden lg:block bg-card border-b border-border">
        <nav className="mx-auto max-w-6xl px-4 flex gap-0 text-sm overflow-x-auto">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative inline-flex items-center gap-1 px-3 h-10 whitespace-nowrap transition-colors ${
                  active
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.Icon && <l.Icon className="w-3.5 h-3.5" />}
                {l.label}
                {active && (
                  <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="lg:hidden bg-card border-b border-border">
          <ul className="mx-auto max-w-6xl px-2 py-2 flex flex-col">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l-[3px] transition-colors ${
                      active
                        ? "text-foreground font-semibold border-brand bg-muted/40"
                        : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/40"
                    }`}
                  >
                    {l.Icon && <l.Icon className="w-3.5 h-3.5" />}
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

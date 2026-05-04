"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function DocsScrollTracker() {
  useEffect(() => {
    let fired50 = false;
    let fired90 = false;
    function onScroll() {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const pct = scrolled / doc.scrollHeight;
      if (!fired50 && pct >= 0.5) {
        fired50 = true;
        trackEvent("docs-scrolled-50pct");
      }
      if (!fired90 && pct >= 0.9) {
        fired90 = true;
        trackEvent("docs-scrolled-90pct");
      }
      if (fired50 && fired90) window.removeEventListener("scroll", onScroll);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}

export function CitationBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      trackEvent("citation-copy");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked; user can still select-and-copy from the visible block
    }
  }
  return (
    <div className="relative">
      <pre className="bg-muted/50 border border-border/50 rounded-md p-3 pr-20 text-[12px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-background/80 hover:bg-muted transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

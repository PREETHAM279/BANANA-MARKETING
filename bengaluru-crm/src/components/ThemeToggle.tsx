"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/format";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    let saved: Mode = "system";
    try {
      saved = (localStorage.getItem("theme") as Mode) || "system";
    } catch {
      /* ignore */
    }
    setMode(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: Mode = "system";
      try {
        current = (localStorage.getItem("theme") as Mode) || "system";
      } catch {
        /* ignore */
      }
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem("theme", m);
    } catch {
      /* ignore */
    }
    apply(m);
  };

  const opts: { id: Mode; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={mode === o.id}
            onClick={() => choose(o.id)}
            className={cn("flex h-7 items-center justify-center gap-1 rounded-md text-[11.5px] font-medium", mode === o.id ? "bg-surface text-ink shadow-[var(--shadow)]" : "text-muted hover:text-ink")}
            title={o.label}
          >
            <Icon size={13} />
            <span className="sr-only sm:not-sr-only">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

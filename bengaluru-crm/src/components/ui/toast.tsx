"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/format";

type Toast = { id: number; kind: "ok" | "error" | "info"; text: string };
const Ctx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("card pointer-events-auto flex items-start gap-2 px-3 py-2.5 text-[13px] shadow-[var(--shadow-lg)]")}>
            {t.kind === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" /> : t.kind === "error" ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" /> : <Info size={16} className="mt-0.5 shrink-0 text-accent" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

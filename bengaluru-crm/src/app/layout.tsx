import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { prisma } from "@/lib/db";
import { CLOSED_STATUSES, NOT_CONTACTED_STATUSES } from "@/lib/constants";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = {
  title: { default: "Bengaluru Sales CRM", template: "%s · Bengaluru Sales CRM" },
  description: "Local prospecting CRM for 100 researched Bengaluru businesses.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

async function sidebarCounts() {
  try {
    const [total, contacted, followupsDue] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { OR: [{ lastContactedAt: { not: null } }, { status: { notIn: NOT_CONTACTED_STATUSES } }] } }),
      prisma.business.count({ where: { followUpDate: { lte: todayISO() }, status: { notIn: CLOSED_STATUSES } } }),
    ]);
    return { total, contacted, followupsDue };
  } catch {
    return { total: 0, contacted: 0, followupsDue: 0 };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const counts = await sidebarCounts();
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>
          <Sidebar counts={counts} />
          <main className="min-h-screen lg:pl-[236px]">
            <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7">{children}</div>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}

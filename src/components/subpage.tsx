import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { AppNav } from "@/components/nav";
import { useI18n } from "@/lib/i18n";

export function Subpage({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a href="#main" className="absolute top-2 left-4 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-primary-fg focus:translate-y-0">
        {t("skip")}
      </a>
      <header className="sticky top-0 z-10 border-b border-border bg-bg">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <Link to="/" aria-label={t("back")} className="grid size-11 place-items-center rounded-md border border-border">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="font-display text-2xl tracking-tight">{title}</h1>
        </div>
      </header>
      <main id="main" className={`mx-auto w-full px-4 py-4 pb-24 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <AppNav className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

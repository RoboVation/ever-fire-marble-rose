import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Map, Ticket, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "map" as const, icon: Map, match: (path: string) => path === "/" || path === "/ride" },
  { to: "/tickets", label: "tickets" as const, icon: Ticket, match: (path: string) => path.startsWith("/tickets") },
  { to: "/discover", label: "discover" as const, icon: Compass, match: (path: string) => path.startsWith("/discover") },
  { to: "/you", label: "you" as const, icon: UserRound, match: (path: string) => path.startsWith("/you") },
];

export function AppNav({ className }: { className?: string }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className={cn("border-t border-border bg-bg", className)} aria-label={t("map")}>
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "font-medium text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

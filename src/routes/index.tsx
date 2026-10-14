import { createFileRoute } from "@tanstack/react-router";
import { MapExperience } from "@/components/map-experience";

type Search = { from?: string; to?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    from: typeof search.from === "string" ? search.from.slice(0, 80) : undefined,
    to: typeof search.to === "string" ? search.to.slice(0, 80) : undefined,
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  return <MapExperience fromKey={search.from} toKey={search.to} />;
}

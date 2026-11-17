import { createFileRoute } from "@tanstack/react-router";
import { RiverJourney } from "@/components/river/RiverJourney";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Enaloël Perriollat — Masseuse fascialiste" },
      {
        name: "description",
        content:
          "Descendez la rivière : madérothérapie et Kobido avec Enaloël Perriollat, masseuse fascialiste.",
      },
      { property: "og:title", content: "Enaloël Perriollat — Masseuse fascialiste" },
      {
        property: "og:description",
        content: "Madérothérapie et Kobido — un voyage apaisant le long de la rivière.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <main>
      <h1 className="sr-only">
        Enaloël Perriollat — masseuse fascialiste, madérothérapie et Kobido
      </h1>
      <RiverJourney />
    </main>
  ),
});

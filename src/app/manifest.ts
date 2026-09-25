import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aitta: meal planner",
    short_name: "Aitta",
    description: "Meal planner and shopping list for S-market and Lidl in Turku",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee6",
    theme_color: "#1f3b2e",
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

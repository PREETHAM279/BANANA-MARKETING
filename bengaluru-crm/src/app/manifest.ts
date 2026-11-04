import type { MetadataRoute } from "next";

// Lets you add the CRM to your phone's Home Screen (it opens like an app, without browser bars).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bengaluru Sales CRM",
    short_name: "Sales CRM",
    description: "Your private prospecting CRM, running on your Mac.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tomorrow's Outreach", url: "/outreach" },
      { name: "Follow-ups", url: "/followups" },
      { name: "Directory", url: "/leads" },
    ],
  };
}

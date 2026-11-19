import type { MetadataRoute } from "next";

/** Brand dark surface (`--color-bg`, dark) — the PWA launch screen + maskable icon ground. */
const BRAND_BG = "#0b0c0f";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZibbyOS",
    short_name: "ZibbyOS",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_BG,
    theme_color: BRAND_BG,
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";
import { siteOrigin } from "@/config/site";

/** Pages that must never be crawled: account, admin, sign-in flows, cart, search, API. */
const PRIVATE_PATHS = [
  "/admin",
  "/mon-compte",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/verification-email",
  "/panier",
  "/recherche",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  // Vercel preview builds are never indexed.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

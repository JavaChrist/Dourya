import type { NextConfig } from "next";

/** Unique id per build, used to detect a new deployment (see UpdateNotifier). */
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  /** Lot 1 URLs stay valid: permanent (308) redirects to the Lot 2 routes. */
  async redirects() {
    return [
      { source: "/categorie/:slug", destination: "/categories/:slug", permanent: true },
      { source: "/produit/:slug", destination: "/produits/:slug", permanent: true },
      { source: "/categorie", destination: "/boutique", permanent: true },
      { source: "/produit", destination: "/boutique", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

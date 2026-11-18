import type { NextConfig } from "next";

/** Unique id per build, used to detect a new deployment (see UpdateNotifier). */
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // firebase-admin is bundled instead of loaded as an external module, so that jwks-rsa's
  // require("jose") (jose 6 is ESM only) is resolved at build time: Vercel functions run
  // with require(esm) disabled (vercel/vercel#17770, firebase/firebase-admin-node#3181).
  // Remove once firebase-admin ships a CommonJS-compatible chain.
  transpilePackages: ["firebase-admin"],
  // Dev only: Server Function calls are logged with their arguments (ID tokens,
  // addresses, unsubscribe tokens). Never print them, even locally.
  // The same goes for the request lines of the e-mail links (one-time codes, tokens in the query).
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/^\/auth\/action/, /^\/desinscription/, /^\/api\/email\//] },
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    // Set only when running on the Firebase emulators (npm run dev:emulators); empty otherwise.
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "",
  },
  /** E-mail links carry one-time codes or tokens: never leak them through the Referer header. */
  async headers() {
    const noReferrer = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/auth/action", headers: noReferrer },
      { source: "/desinscription", headers: noReferrer },
      { source: "/api/email/:path*", headers: noReferrer },
    ];
  },
  /** Lot 1 URLs stay valid: permanent (308) redirects to the Lot 2 routes. */
  async redirects() {
    return [
      { source: "/categorie/:slug", destination: "/categories/:slug", permanent: true },
      { source: "/produit/:slug", destination: "/produits/:slug", permanent: true },
      { source: "/categorie", destination: "/boutique", permanent: true },
      { source: "/produit", destination: "/boutique", permanent: true },
      { source: "/compte", destination: "/mon-compte", permanent: true },
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

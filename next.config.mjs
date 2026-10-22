/*
 * Sandbox-only: the Base44 preview serves this app from a proxy origin
 * (https://3000-<BASE44_PUBLIC_HOST_SUFFIX>), and Next.js blocks cross-origin
 * requests to dev-only assets and HMR by default. BASE44_PREVIEW_MODE is set to
 * "1" by the platform; with it unset or anything else, no origin is added and
 * behaviour is unchanged.
 */
const previewHost =
  process.env.BASE44_PREVIEW_MODE === "1" &&
  process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? `3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`
    : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  ...(previewHost ? { allowedDevOrigins: [previewHost] } : {}),
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

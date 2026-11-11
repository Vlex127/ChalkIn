/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  // Compression + trailing slash consistency help avoid duplicate-content
  // issues with crawlers.
  compress: true,
  trailingSlash: false,

  // Pins the workspace root to this project — avoids Next.js guessing wrong
  // when a lockfile also exists somewhere above this folder (e.g. $HOME).
  outputFileTracingRoot: path.join(__dirname),

  images: {
    formats: ["image/avif", "image/webp"],
    // Add remote domains you actually serve images from, e.g.:
    // remotePatterns: [{ protocol: "https", hostname: "images.example.com" }],
  },

  // Keep canonical hosts clean — add 301s here instead of client-side
  // redirects so crawlers see them immediately.
  async redirects() {
    return [];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

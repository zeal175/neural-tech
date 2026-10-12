/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // the stylesheet ships inside the HTML: no render-blocking CSS request before the first paint
    // (and the fonts it declares are discovered with the page instead of after it)
    inlineCss: true,
  },
  // payment screenshots up to ~5 MB
  serverExternalPackages: [],
  async headers() {
    return [
      {
        // asset URLs carry ?v= (lib/assets.js), so they can be cached forever
        source: "/(models|textures)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
  webpack(config, { dev }) {
    if (dev) {
      // Blender renders / bakes and browser-automation logs live in the repo; don't let them
      // trigger Fast Refresh loops.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/blender/**", "**/.playwright-mcp/**"],
      };
    }
    return config;
  },
};

export default nextConfig;

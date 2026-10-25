const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  transpilePackages: ["motion"],
  // The archive lightbox serves photos above the default quality of 75; Next 16
  // requires every quality value in use to be declared here.
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [55, 60, 75, 82, 88],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 256, 384, 480],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/enclave/(models|textures)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/enclave/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/gallery/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;

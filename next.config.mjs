const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  transpilePackages: ["motion"],
  // The archive lightbox serves photos above the default quality of 75; Next 16
  // requires every quality value in use to be declared here.
  images: {
    qualities: [60, 75, 88],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/about", destination: "/features", permanent: true },
      { source: "/academics", destination: "/features", permanent: true },
      { source: "/admissions", destination: "/pricing", permanent: true },
      { source: "/fees", destination: "/pricing", permanent: true },
      { source: "/visit", destination: "/contact", permanent: true },
    ];
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }];
  },
};

module.exports = nextConfig;

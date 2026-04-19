/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@convex-dev/better-auth",
    "@school/auth",
    "@school/convex",
    "@school/shared",
    "better-auth",
  ],
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  env: {
    BACKEND_API: process.env.BACKEND_API
  },
  output: "standalone"
};

export default nextConfig;
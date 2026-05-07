// In Docker the BE runs on the "backend" service hostname, not localhost.
// BE_INTERNAL_URL is injected by docker-compose; falls back to localhost for local dev.
const BE_INTERNAL_URL = process.env.BE_INTERNAL_URL || 'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the minimal Docker image (copies only necessary files).
  output: 'standalone',

  /**
   * Reverse Proxy via Next.js Rewrites.
   *
   * Any request from the browser to /api/be/<anything> is silently forwarded
   * to the internal Spring Boot server.
   *
   * In local dev:  → http://localhost:8080/<anything>
   * In Docker:     → http://backend:8080/<anything>  (Docker service name)
   *
   * This means:
   *  - The BE is never exposed on the public internet.
   *  - The browser always talks to localhost:3000, so session cookies work
   *    on the FE domain without any cross-origin issues.
   *  - Set-Cookie headers (JSESSIONID) from the BE are forwarded through
   *    this proxy and stored by the browser for localhost:3000.
   */
  async rewrites() {
    return [
      {
        source: '/api/be/:path*',
        destination: `${BE_INTERNAL_URL}/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

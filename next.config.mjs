/** @type {import('next').NextConfig} */

/**
 * Security headers (A.14). Applied to every route.
 * - HSTS: force HTTPS in browsers (effective only over HTTPS; harmless on localhost).
 * - CSP: restrict sources. We allow 'unsafe-inline' for styles (Tailwind/inline)
 *   and data: images (QR codes, avatars). connect-src 'self' for our APIs/SSE.
 * - Frame/MIME/referrer hardening.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // Next.js needs inline + eval in dev; tighten script in prod.
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://sandbox.safaricom.co.ke https://api.safaricom.co.ke",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Native/heavy modules kept external so webpack doesn't bundle them.
  experimental: {
    serverComponentsExternalPackages: [
      "@node-rs/argon2",
      "sharp",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "@react-pdf/renderer",
      "exceljs",
      "pino",
      // Bundi Intelligent (N.1) — tesseract.js spawns a real Node worker
      // thread that loads its own script file relative to its own package
      // directory at runtime; letting webpack bundle it breaks that lookup
      // (the worker script ends up missing from .next/worker-script). Kept
      // external so Node resolves it normally, exactly like sharp above.
      "tesseract.js",
    ],
  },
};

export default nextConfig;

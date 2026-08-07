import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Generates a `Route` union from the files in `app/`, so every `href` in the
   * navigation registry and every `<Link>` is checked at compile time. As
   * modules are added this is what stops the sidebar pointing at a route that
   * no longer exists.
   */
  typedRoutes: true,

  typescript: {
    // Type errors must fail the build. Never set this to true.
    ignoreBuildErrors: false,
  },

  // Nothing good comes of announcing the framework version to a scanner.
  poweredByHeader: false,

  /**
   * Baseline response headers.
   *
   * Applied here rather than in `proxy.ts` so they cover route handlers and
   * static assets too, neither of which the proxy matcher runs on. There is
   * deliberately no `Content-Security-Policy` yet: a correct one for an app
   * this size needs per-request nonces threaded through the RSC payload, and a
   * wrong one fails open while breaking the board. It is tracked in the README
   * as the next hardening step.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app is never framed. Without this, a page that proxies clicks
          // through an invisible iframe can drive a signed-in session.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Vercel terminates TLS, so this is safe to assert unconditionally in
          // production. Omitted in development, where the app is served on
          // http://localhost and a cached HSTS entry would break it.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;

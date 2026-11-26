// Response headers for every route, pages and API alike. Read by next.config.ts.
//
// Why 'unsafe-inline' for scripts: the app uses Cache Components, so pages are
// prerendered once with a static shell. Next's guide says nonces need every
// page rendered per request and don't work with a prerendered shell, and the
// shell itself contains Next's inline bootstrap scripts. A hash would switch
// 'unsafe-inline' off and break those. So inline scripts are allowed, while
// everything else is locked to this origin: no third-party script can load,
// nothing can be framed, and forms and <base> can't point elsewhere.
// 'unsafe-eval' is development only (React uses eval for server error stacks).

const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // React style={} props and Radix positioning write inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // next/font self-hosts Inter at build time, so fonts come from 'self' too.
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Two years. Browsers ignore it over plain http, so local runs are unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

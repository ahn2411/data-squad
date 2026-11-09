type RuntimeEnvironment = Record<string, string | undefined>;

function parseOrigin(value: string | undefined, production: boolean): string | null {
  if (!value?.trim()) return null;

  const candidate = value.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    const isLoopback = hostname === "localhost"
      || hostname.startsWith("127.")
      || hostname === "::1"
      || hostname === "0.0.0.0"
      || hostname.endsWith(".localhost");

    if (
      !["http:", "https:"].includes(url.protocol)
      || url.username
      || url.password
      || (url.pathname !== "" && url.pathname !== "/")
      || url.search
      || url.hash
      || (production && (url.protocol !== "https:" || isLoopback))
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Return a canonical origin for auth emails. In production, never silently
 * generate a localhost URL; Vercel's production domain is the safe fallback
 * when NEXT_PUBLIC_SITE_URL is missing or accidentally set to localhost.
 */
export function getAuthSiteOrigin(environment: RuntimeEnvironment = process.env): string | null {
  const production = environment.NODE_ENV === "production";
  if (!production) {
    return parseOrigin(environment.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", false);
  }

  const configured = parseOrigin(environment.NEXT_PUBLIC_SITE_URL, true);
  if (configured) return configured;

  return parseOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL, true);
}

export function getAuthCallbackUrl(
  nextPath: "/pending-approval" | "/reset-password",
  environment: RuntimeEnvironment = process.env,
): string | null {
  const origin = getAuthSiteOrigin(environment);
  if (!origin) return null;

  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}

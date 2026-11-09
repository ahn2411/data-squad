/**
 * Returns an HTTP status for configuration or authorization failures.
 * A null result means the supplied bearer token is valid.
 */
export function cronAuthorizationFailure(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
): 401 | 503 | null {
  if (!expectedSecret) return 503;
  if (authorizationHeader !== `Bearer ${expectedSecret}`) return 401;
  return null;
}

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: Parameters<typeof updateSession>[0]) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match app paths except static assets, Next internals, and the cron route
     * which authenticates itself with CRON_SECRET instead of a user session.
     */
    "/((?!api/cron/reminders|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

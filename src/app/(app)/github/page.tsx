import Link from "next/link";
import { ExternalLink, GitBranch, Github } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireActiveMember } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function GitHubPage() {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("profiles(full_name, username, github_username, github_profile_url, capstone_repository_url, avatar_url)")
    .eq("membership_status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load the GitHub directory.");

  const profiles = (data ?? [])
    .map((row) => row.profiles)
    .flatMap((profile) => (Array.isArray(profile) ? profile : profile ? [profile] : []))
    .filter((profile) => profile.github_profile_url || profile.github_username || profile.capstone_repository_url);
  const avatarPaths = profiles.flatMap((profile) => profile.avatar_url ? [profile.avatar_url] : []);
  const { data: signedAvatars } = avatarPaths.length
    ? await supabase.storage.from("squad-avatars").createSignedUrls(avatarPaths, 60 * 60)
    : { data: [] };
  const avatarUrls = new Map((signedAvatars ?? []).map((item) => [item.path, item.signedUrl]));

  return (
    <>
      <PageHeader
        title="GitHub squad"
        description="Explore team profiles and the repositories members have chosen to share. Add or update your GitHub profile in Profile."
      />
      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Github className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No GitHub profiles yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Add your GitHub profile URL on your <Link className="underline underline-offset-4" href="/profile">profile page</Link> to share it with the squad.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile, index) => {
            const profileHref = safeGitHubUrl(profile.github_profile_url) ??
              (profile.github_username && /^[A-Za-z0-9-]+$/.test(profile.github_username)
                ? `https://github.com/${profile.github_username}`
                : null);
            const capstoneHref = safeGitHubUrl(profile.capstone_repository_url);
            return (
              <Card key={`${profile.username ?? profile.github_username ?? profile.full_name}-${index}`}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Avatar>
                    {profile.avatar_url && avatarUrls.get(profile.avatar_url) ? (
                      <AvatarImage src={avatarUrls.get(profile.avatar_url)!} alt="" />
                    ) : null}
                    <AvatarFallback>{(profile.full_name ?? profile.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Github className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="truncate text-base">
                    {profile.full_name || profile.username || profile.github_username}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-start gap-2">
                    {profileHref ? (
                      <a
                        href={profileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                      >
                        <span className="truncate">@{profile.github_username ?? "GitHub profile"}</span>
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="sr-only">opens in a new tab</span>
                      </a>
                    ) : null}
                    {capstoneHref ? (
                      <a
                        href={capstoneHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        <GitBranch className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">Capstone repository</span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="sr-only">opens in a new tab</span>
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function safeGitHubUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

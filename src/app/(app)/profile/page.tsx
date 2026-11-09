import { requireActiveMember } from "@/features/auth/session";
import { getProfileLearningSummary } from "@/features/profile/queries";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RoleBadge, MembershipBadge } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, BookOpenCheck, ClipboardCheck, FileText, TriangleAlert } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const session = await requireActiveMember();
  const profile = session.profile;
  const membership = session.membership;
  let learningSummary: Awaited<ReturnType<typeof getProfileLearningSummary>> | null = null;
  try {
    learningSummary = await getProfileLearningSummary();
  } catch {
    // Keep profile editing available while making summary read failures explicit.
  }
  let avatarPreviewUrl: string | null = null;
  let timezone = "Asia/Karachi";
  const profileClient = await createSupabaseServerClient();
  const { data: ownTimezone, error: timezoneError } = await profileClient.rpc("get_my_profile_timezone");
  if (timezoneError) {
    throw new Error("Could not load your profile preferences.");
  }
  timezone = ownTimezone ?? timezone;
  if (profile?.avatar_url) {
    const { data } = await profileClient.storage
      .from("squad-avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarPreviewUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal details and GitHub links visible to the squad."
      />

      {/* Read-only context */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </p>
            <p className="mt-1.5 truncate text-[13px] font-medium">
              {session.email}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Role
            </p>
            <div className="mt-1.5">
              <RoleBadge role={membership.role} />
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <div className="mt-1.5">
              <MembershipBadge status={membership.membership_status} />
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Joined
            </p>
            <p className="mt-1.5 nums text-[13px] font-medium">
              {formatDate(membership.joined_at ?? membership.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      {learningSummary ? (
        <Card className="mb-6">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">Learning profile</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {learningSummary.currentPhase
                    ? `Current phase: ${learningSummary.currentPhase.phaseNumber} · ${learningSummary.currentPhase.title}`
                    : "Your current phase will appear when a learning week is selected."}
                </p>
              </div>
              <Award className="size-5 shrink-0 text-primary" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><BookOpenCheck className="size-4" />Roadmap progress</div>
                <p className="mt-2 nums text-[17px] font-semibold text-foreground">
                  {learningSummary.completedTopics} / {learningSummary.totalTopics} topics
                </p>
                <Progress value={learningSummary.totalTopics ? learningSummary.completedTopics / learningSummary.totalTopics * 100 : 0} className="mt-2 h-1.5" />
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><ClipboardCheck className="size-4" />Approved assignments</div>
                <p className="mt-2 nums text-[17px] font-semibold text-foreground">{learningSummary.approvedAssignments}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><FileText className="size-4" />Weekly reports</div>
                <p className="mt-2 nums text-[17px] font-semibold text-foreground">{learningSummary.submittedReports}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Achievements</h3>
              <div className="flex flex-wrap gap-2">
                {learningSummary.achievements.filter((achievement) => achievement.earned).length > 0 ? (
                  learningSummary.achievements.filter((achievement) => achievement.earned).map((achievement) => (
                    <span key={achievement.id} title={achievement.detail} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      <Award className="size-3.5 text-primary" />{achievement.title}
                    </span>
                  ))
                ) : (
                  <p className="text-[12px] text-muted-foreground">Complete a topic, receive assignment approval, or submit a weekly report to earn your first achievement.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert className="size-4" />
          <AlertTitle>Learning summary unavailable</AlertTitle>
          <AlertDescription>Your profile details are still available. Refresh to try loading your learning progress again.</AlertDescription>
        </Alert>
      )}

      <ProfileForm
        defaults={{
          fullName: profile?.full_name ?? "",
          username: profile?.username ?? "",
          bio: profile?.bio ?? "",
          githubUsername: profile?.github_username ?? "",
          githubProfileUrl: profile?.github_profile_url ?? "",
          capstoneRepositoryUrl: profile?.capstone_repository_url ?? "",
          avatarPath: profile?.avatar_url ?? "",
          timezone,
        }}
        teamId={membership.team_id}
        userId={session.userId}
        avatarPreviewUrl={avatarPreviewUrl}
      />
    </>
  );
}

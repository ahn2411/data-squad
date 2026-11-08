import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { RoleBadge, MembershipBadge } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { formatDate } from "@/lib/format";

export default async function ProfilePage() {
  const session = await requireActiveMember();
  const profile = session.profile;
  const membership = session.membership;

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

      <ProfileForm
        defaults={{
          fullName: profile?.full_name ?? "",
          username: profile?.username ?? "",
          bio: profile?.bio ?? "",
          githubUsername: profile?.github_username ?? "",
          githubProfileUrl: profile?.github_profile_url ?? "",
          timezone: profile?.timezone ?? "Asia/Karachi",
        }}
      />
    </>
  );
}

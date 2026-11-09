import { requireActiveMember, requireRole } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getPhases,
  getWeeks,
  getTopics,
  getResourcesForTopic,
} from "@/features/roadmap/queries";
import { RoadmapManager } from "./roadmap-manager";
import type { LearningResource, Phase, Topic, Week } from "@/types/database";

export const metadata = { title: "Roadmap manager" };

/**
 * Admin/leader roadmap manager.
 *
 * This view provides CRUD + publish/unpublish for phases, weeks, topics, and
 * topic learning resources. team_settings.current_week remains outside this
 * curriculum editor.
 */
export default async function AdminRoadmapPage() {
  const session = await requireActiveMember();
  requireRole(session, ["admin", "leader"]);
  // requireRole redirects non-leaders; execution beyond this point is
  // leader/admin only.

  let phases: Phase[] = [];
  let weeks: Week[] = [];
  let topics: Topic[] = [];
  let resources: LearningResource[] = [];
  let fetchError: string | null = null;

  try {
    [phases, weeks, topics] = await Promise.all([
      getPhases(),
      getWeeks(),
      getTopics(),
    ]);
    // Resources: fetch all for the team by collecting from each topic.
    // (RLS permits leaders/admins to read all team resources.)
    const resourceResults = await Promise.all(
      topics.map((t) => getResourcesForTopic(t.id)),
    );
    resources = resourceResults.flat();
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Could not load the roadmap.";
  }

  if (fetchError) {
    return (
      <>
        <PageHeader
          title="Roadmap manager"
          description="Create and publish phases, weeks, and topics."
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load the roadmap</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Roadmap manager"
        description="Create and publish phases, weeks, and topics. Members see only published rows."
      />
      <RoadmapManager
        phases={phases}
        weeks={weeks}
        topics={topics}
        resources={resources}
      />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireActiveMember } from "@/features/auth/session";
import {
  getTopicDetail,
  getTopicProgressForUser,
  type TopicDetail,
} from "@/features/roadmap/queries";
import { TopicFullCard } from "@/features/roadmap/topic-content";
import type { TopicProgress } from "@/types/database";

export const metadata = { title: "Topic" };

interface PageProps {
  params: Promise<{ topicId: string }>;
}

export default async function TopicDetailPage({ params }: PageProps) {
  const { topicId } = await params;
  const session = await requireActiveMember();

  let topic: TopicDetail | null = null;
  let progress: TopicProgress[] = [];
  let fetchError: string | null = null;
  try {
    [topic, progress] = await Promise.all([
      getTopicDetail(topicId),
      getTopicProgressForUser(session.userId),
    ]);
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Could not load this topic.";
  }

  if (fetchError) {
    return (
      <>
        <BackLink />
        <Alert variant="destructive">
          <AlertTitle>Could not load this topic</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (!topic) {
    notFound();
  }

  const tp = progress.find((p) => p.topic_id === topic.id) ?? null;
  const week = topic.weeks;
  const phase = week?.phases ?? null;

  return (
    <>
      {/* Breadcrumb-style back links */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Roadmap
        </Link>
        {week ? (
          <>
            <ChevronRight className="size-3" />
            <Link href={`/roadmap/${week.id}`} className="hover:text-foreground">
              {week.title}
            </Link>
          </>
        ) : null}
      </div>

      <PageHeader
        title={topic.title}
        description={
          week
            ? `Week ${week.week_number}${phase ? ` · Phase ${phase.phase_number}: ${phase.title}` : ""}`
            : "Standalone topic"
        }
      />

      <TopicFullCard topic={topic} progress={tp} />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/roadmap"
      className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to roadmap
    </Link>
  );
}

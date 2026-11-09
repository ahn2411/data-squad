import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle, Pin, Lock } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getThreadDetail } from "@/features/discussions/queries";
import { ThreadView } from "./thread-view";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Discussion" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ThreadPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireActiveMember();

  const isLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  let thread = null;
  let loadError: string | null = null;
  try {
    thread = await getThreadDetail(id);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Could not load this discussion.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Discussion" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <BackLink />
      </>
    );
  }

  if (!thread) {
    notFound();
  }

  const authorName =
    thread.author?.full_name ?? "Member";
  const isPinned = Boolean(thread.pinned_at);
  const isLocked = Boolean(thread.locked_at);
  const isAuthor = thread.created_by === session.userId;
  const canModerate = isLeader || isAuthor;

  return (
    <>
      <PageHeader
        title={thread.title}
        description={`Started by ${authorName} · ${formatDate(thread.created_at)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              {thread.category}
            </Badge>
            {isPinned ? (
              <Badge variant="outline" className="text-[11px] font-normal text-primary">
                <Pin className="size-3" />
                Pinned
              </Badge>
            ) : null}
            {isLocked ? (
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                <Lock className="size-3" />
                Locked
              </Badge>
            ) : null}
          </div>
        }
      />
      <BackLink />

      <ThreadView
        thread={thread}
        currentUserId={session.userId}
        canModerate={canModerate}
        isLeader={isLeader}
        isLocked={isLocked}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/discussions"
      className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to discussions
    </Link>
  );
}

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type ActiveMember = { team_id: string; user_id: string };
type AssignmentReminder = {
  id: string;
  team_id: string;
  title: string;
  deadline: string;
  assignment_recipients: { user_id: string }[];
  submissions: { user_id: string; submitted_at: string | null }[];
};
type TeamSetting = {
  team_id: string;
  current_week_id: string | null;
  weekly_report_deadline_day: number;
  timezone: string;
};

function weekdayInTimezone(date: Date, timezone: string): number | null {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone }).format(date);
    return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Reminder job is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    // The job runs twice daily. A 36-hour lookahead catches deadlines between
    // runs, while a unique key makes repeated invocations safe.
    const horizonIso = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

    const [membersResult, assignmentsResult, settingsResult] = await Promise.all([
      supabase.from("team_members").select("team_id,user_id").eq("membership_status", "active"),
      supabase.from("assignments")
        .select("id,team_id,title,deadline,assignment_recipients(user_id),submissions(user_id,submitted_at)")
        .eq("publication_status", "published")
        .gt("deadline", nowIso)
        .lte("deadline", horizonIso),
      supabase.from("team_settings")
        .select("team_id,current_week_id,weekly_report_deadline_day,timezone"),
    ]);
    if (membersResult.error || assignmentsResult.error || settingsResult.error) {
      throw new Error("Could not load reminder recipients or schedules.");
    }

    const members = (membersResult.data ?? []) as ActiveMember[];
    const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentReminder[];
    const settings = (settingsResult.data ?? []) as TeamSetting[];
    const membersByTeam = new Map<string, Set<string>>();
    for (const member of members) {
      const teamMembers = membersByTeam.get(member.team_id) ?? new Set<string>();
      teamMembers.add(member.user_id);
      membersByTeam.set(member.team_id, teamMembers);
    }

    const reminders: Array<Record<string, string>> = [];
    for (const assignment of assignments) {
      const active = membersByTeam.get(assignment.team_id) ?? new Set<string>();
      const recipientRows = assignment.assignment_recipients ?? [];
      const recipients = recipientRows.length > 0
        ? recipientRows.map((row) => row.user_id).filter((id) => active.has(id))
        : [...active];
      const submitted = new Set(
        (assignment.submissions ?? [])
          .filter((row) => row.submitted_at !== null)
          .map((row) => row.user_id),
      );
      const dueDate = new Intl.DateTimeFormat("en", {
        dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
      }).format(new Date(assignment.deadline));
      for (const userId of recipients) {
        if (submitted.has(userId)) continue;
        reminders.push({
          user_id: userId,
          team_id: assignment.team_id,
          type: "deadline_approaching",
          title: "Assignment deadline approaching",
          body: `${assignment.title} is due ${dueDate} UTC.`,
          entity_type: "assignment",
          entity_id: assignment.id,
          link: `/assignments/${assignment.id}`,
          dedupe_key: `assignment-deadline:${assignment.id}:${assignment.deadline}:${userId}`,
        });
      }
    }

    const settingsWithCurrentWeek = settings.filter((row) => row.current_week_id !== null);
    const deadlineTeams = settingsWithCurrentWeek.filter((row) =>
      weekdayInTimezone(now, row.timezone) === row.weekly_report_deadline_day,
    );
    const weekIds = [...new Set(deadlineTeams.map((row) => row.current_week_id as string))];
    const weekById = new Map<string, { title: string; week_number: number }>();
    const reportsByWeek = new Map<string, Set<string>>();
    if (weekIds.length > 0) {
      const [weeksResult, reportsResult] = await Promise.all([
        supabase.from("weeks").select("id,title,week_number").in("id", weekIds).eq("status", "published"),
        supabase.from("weekly_reports").select("week_id,user_id").in("week_id", weekIds),
      ]);
      if (weeksResult.error || reportsResult.error) throw new Error("Could not load weekly report reminder data.");
      for (const week of weeksResult.data ?? []) weekById.set(week.id, week);
      for (const report of reportsResult.data ?? []) {
        const submittedUsers = reportsByWeek.get(report.week_id) ?? new Set<string>();
        submittedUsers.add(report.user_id);
        reportsByWeek.set(report.week_id, submittedUsers);
      }
    }

    for (const setting of deadlineTeams) {
      const weekId = setting.current_week_id;
      if (!weekId) continue;
      const week = weekById.get(weekId);
      if (!week) continue;
      const submittedUsers = reportsByWeek.get(weekId) ?? new Set<string>();
      for (const userId of membersByTeam.get(setting.team_id) ?? []) {
        if (submittedUsers.has(userId)) continue;
        reminders.push({
          user_id: userId,
          team_id: setting.team_id,
          type: "weekly_report_due",
          title: "Weekly learning report due",
          body: `Submit your report for Week ${week.week_number}: ${week.title}.`,
          entity_type: "week",
          entity_id: weekId,
          link: `/weekly-reports/${weekId}`,
          dedupe_key: `weekly-report-due:${weekId}:${userId}`,
        });
      }
    }

    if (reminders.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }
    const { data, error } = await supabase.from("notifications")
      .upsert(reminders, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error("Could not save reminder notifications.");
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  } catch (error) {
    console.error("Reminder cron failed", error);
    return NextResponse.json({ error: "Reminder job failed." }, { status: 500 });
  }
}

/**
 * Supabase database types — full schema (migrations 0001–0004).
 *
 * Hand-written to match the migrations. Regenerate the authoritative version
 * after applying migrations:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Note: jsonb columns that hold string arrays (objectives, deliverables,
 * completion_criteria, prerequisites, supporting_resources, topics_completed,
 * exercises_completed, assignments_completed, github_links) are typed as
 * `string[]` for ergonomics. The generated output types them as `Json`; if you
 * regenerate, cast where needed or keep this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      // ────────────────────────────── Phase 1+2 (0001) ──────────────────────
      teams: {
        Row: {
          id: string; name: string; slug: string; description: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; name: string; slug: string; description?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; name?: string; slug?: string; description?: string | null;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string; email: string; full_name: string | null; username: string | null;
          avatar_url: string | null; bio: string | null; github_username: string | null;
          github_profile_url: string | null; timezone: string;
          created_at: string; updated_at: string;
        };
        Insert: {
          id: string; email: string; full_name?: string | null; username?: string | null;
          avatar_url?: string | null; bio?: string | null; github_username?: string | null;
          github_profile_url?: string | null; timezone?: string;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; email?: string; full_name?: string | null; username?: string | null;
          avatar_url?: string | null; bio?: string | null; github_username?: string | null;
          github_profile_url?: string | null; timezone?: string; updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string; team_id: string; user_id: string; role: TeamRole;
          membership_status: MembershipStatus; joined_at: string | null;
          suspended_at: string | null; removed_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; user_id: string; role?: TeamRole;
          membership_status?: MembershipStatus; joined_at?: string | null;
          suspended_at?: string | null; removed_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; user_id?: string; role?: TeamRole;
          membership_status?: MembershipStatus; joined_at?: string | null;
          suspended_at?: string | null; removed_at?: string | null; updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string; team_id: string; email: string; role: TeamRole; invited_by: string;
          status: InvitationStatus; expires_at: string | null; accepted_at: string | null;
          revoked_at: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; email: string; role?: TeamRole; invited_by: string;
          status?: InvitationStatus; expires_at?: string | null; accepted_at?: string | null;
          revoked_at?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; email?: string; role?: TeamRole; invited_by?: string;
          status?: InvitationStatus; expires_at?: string | null; accepted_at?: string | null;
          revoked_at?: string | null; updated_at?: string;
        };
      };

      // ────────────────────────────── Roadmap (0002) ──────────────────────
      team_settings: {
        Row: {
          id: string; team_id: string; current_week_id: string | null;
          sequential_progression: boolean; weekly_report_deadline_day: number;
          timezone: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; current_week_id?: string | null;
          sequential_progression?: boolean; weekly_report_deadline_day?: number;
          timezone?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; current_week_id?: string | null;
          sequential_progression?: boolean; weekly_report_deadline_day?: number;
          timezone?: string; updated_at?: string;
        };
      };
      phases: {
        Row: {
          id: string; team_id: string; title: string; slug: string; description: string | null;
          phase_number: number; start_week: number; end_week: number; status: PhaseStatus;
          display_order: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; title: string; slug: string; description?: string | null;
          phase_number: number; start_week: number; end_week: number; status?: PhaseStatus;
          display_order?: number; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; title?: string; slug?: string; description?: string | null;
          phase_number?: number; start_week?: number; end_week?: number; status?: PhaseStatus;
          display_order?: number; updated_at?: string;
        };
      };
      weeks: {
        Row: {
          id: string; team_id: string; phase_id: string; week_number: number; title: string;
          slug: string; overview: string | null; objectives: string[]; deliverables: string[];
          completion_criteria: string[]; start_date: string | null; end_date: string | null;
          status: WeekStatus; display_order: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; phase_id: string; week_number: number; title: string;
          slug: string; overview?: string | null; objectives?: string[]; deliverables?: string[];
          completion_criteria?: string[]; start_date?: string | null; end_date?: string | null;
          status?: WeekStatus; display_order?: number; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; phase_id?: string; week_number?: number; title?: string;
          slug?: string; overview?: string | null; objectives?: string[]; deliverables?: string[];
          completion_criteria?: string[]; start_date?: string | null; end_date?: string | null;
          status?: WeekStatus; display_order?: number; updated_at?: string;
        };
      };
      topics: {
        Row: {
          id: string; team_id: string; week_id: string; title: string; slug: string;
          description: string | null; learning_objectives: string[]; estimated_minutes: number | null;
          difficulty: TopicDifficulty; prerequisites: string[]; practical_exercise: string | null;
          completion_criteria: string[]; display_order: number; publication_status: PublicationStatus;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; week_id: string; title: string; slug: string;
          description?: string | null; learning_objectives?: string[]; estimated_minutes?: number | null;
          difficulty?: TopicDifficulty; prerequisites?: string[]; practical_exercise?: string | null;
          completion_criteria?: string[]; display_order?: number; publication_status?: PublicationStatus;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; week_id?: string; title?: string; slug?: string;
          description?: string | null; learning_objectives?: string[]; estimated_minutes?: number | null;
          difficulty?: TopicDifficulty; prerequisites?: string[]; practical_exercise?: string | null;
          completion_criteria?: string[]; display_order?: number; publication_status?: PublicationStatus;
          updated_at?: string;
        };
      };
      learning_resources: {
        Row: {
          id: string; team_id: string; topic_id: string | null; title: string; url: string;
          resource_type: ResourceType; description: string | null; difficulty: TopicDifficulty | null;
          is_free: boolean; display_order: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; topic_id?: string | null; title: string; url: string;
          resource_type?: ResourceType; description?: string | null; difficulty?: TopicDifficulty | null;
          is_free?: boolean; display_order?: number; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; topic_id?: string | null; title?: string; url?: string;
          resource_type?: ResourceType; description?: string | null; difficulty?: TopicDifficulty | null;
          is_free?: boolean; display_order?: number; updated_at?: string;
        };
      };
      topic_progress: {
        Row: {
          id: string; topic_id: string; user_id: string; status: TopicStatus;
          started_at: string | null; completed_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; topic_id: string; user_id: string; status?: TopicStatus;
          started_at?: string | null; completed_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; topic_id?: string; user_id?: string; status?: TopicStatus;
          started_at?: string | null; completed_at?: string | null; updated_at?: string;
        };
      };

      // ────────────────────────────── Assignments (0003) ──────────────────────
      assignments: {
        Row: {
          id: string; team_id: string; title: string; description: string | null;
          instructions: string | null; phase_id: string | null; week_id: string | null;
          topic_id: string | null; assignment_type: AssignmentType; difficulty: AssignmentDifficulty;
          max_score: number | null; required_submission_type: SubmissionType | null;
          supporting_resources: string[]; deliverables: string[]; evaluation_criteria: string[];
          publication_status: PublicationStatus; published_at: string | null;
          deadline: string | null; created_by: string; display_order: number;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; title: string; description?: string | null;
          instructions?: string | null; phase_id?: string | null; week_id?: string | null;
          topic_id?: string | null; assignment_type?: AssignmentType; difficulty?: AssignmentDifficulty;
          max_score?: number | null; required_submission_type?: SubmissionType | null;
          supporting_resources?: string[]; deliverables?: string[]; evaluation_criteria?: string[];
          publication_status?: PublicationStatus; published_at?: string | null;
          deadline?: string | null; created_by: string; display_order?: number;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; team_id?: string; title?: string; description?: string | null;
          instructions?: string | null; phase_id?: string | null; week_id?: string | null;
          topic_id?: string | null; assignment_type?: AssignmentType; difficulty?: AssignmentDifficulty;
          max_score?: number | null; required_submission_type?: SubmissionType | null;
          supporting_resources?: string[]; deliverables?: string[]; evaluation_criteria?: string[];
          publication_status?: PublicationStatus; published_at?: string | null;
          deadline?: string | null; display_order?: number; updated_at?: string;
        };
      };
      assignment_recipients: {
        Row: { id: string; assignment_id: string; user_id: string; created_at: string };
        Insert: { id?: string; assignment_id: string; user_id: string; created_at?: string };
        Update: { id?: string; assignment_id?: string; user_id?: string };
      };
      submissions: {
        Row: {
          id: string; assignment_id: string; user_id: string; team_id: string;
          status: SubmissionStatus; submission_text: string | null; submission_url: string | null;
          is_late: boolean; submitted_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; assignment_id: string; user_id: string; team_id: string;
          status?: SubmissionStatus; submission_text?: string | null; submission_url?: string | null;
          is_late?: boolean; submitted_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; assignment_id?: string; user_id?: string; team_id?: string;
          status?: SubmissionStatus; submission_text?: string | null; submission_url?: string | null;
          is_late?: boolean; submitted_at?: string | null; updated_at?: string;
        };
      };
      submission_revisions: {
        Row: {
          id: string; submission_id: string; revision_number: number;
          submission_text: string | null; submission_url: string | null; submitted_by: string;
          submitted_at: string; is_late: boolean;
        };
        Insert: {
          id?: string; submission_id: string; revision_number: number;
          submission_text?: string | null; submission_url?: string | null; submitted_by: string;
          submitted_at?: string; is_late?: boolean;
        };
        Update: { [k: string]: never };
      };
      submission_files: {
        Row: {
          id: string; submission_id: string; storage_path: string; file_name: string;
          content_type: string | null; file_size: number | null; uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string; submission_id: string; storage_path: string; file_name: string;
          content_type?: string | null; file_size?: number | null; uploaded_by: string;
          created_at?: string;
        };
        Update: { id?: string; content_type?: string | null; file_size?: number | null };
      };
      reviews: {
        Row: {
          id: string; submission_id: string; reviewer_id: string; revision_id: string | null;
          review_status: ReviewStatus; score: number | null; feedback: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; submission_id: string; reviewer_id: string; revision_id?: string | null;
          review_status?: ReviewStatus; score?: number | null; feedback?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; review_status?: ReviewStatus; score?: number | null; feedback?: string | null;
          updated_at?: string;
        };
      };

      // ────────────────────────────── Collaboration (0004) ──────────────────────
      weekly_reports: {
        Row: {
          id: string; team_id: string; user_id: string; week_id: string; learned: string | null;
          topics_completed: string[]; exercises_completed: string[]; assignments_completed: string[];
          hours_spent: number; biggest_achievement: string | null; main_difficulty: string | null;
          current_blockers: string | null; questions: string | null; next_week_goals: string | null;
          github_links: string[]; leader_feedback: string | null; submitted_at: string;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; user_id: string; week_id: string; learned?: string | null;
          topics_completed?: string[]; exercises_completed?: string[]; assignments_completed?: string[];
          hours_spent?: number; biggest_achievement?: string | null; main_difficulty?: string | null;
          current_blockers?: string | null; questions?: string | null; next_week_goals?: string | null;
          github_links?: string[]; leader_feedback?: string | null; submitted_at?: string;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; learned?: string | null; topics_completed?: string[];
          exercises_completed?: string[]; assignments_completed?: string[]; hours_spent?: number;
          biggest_achievement?: string | null; main_difficulty?: string | null;
          current_blockers?: string | null; questions?: string | null; next_week_goals?: string | null;
          github_links?: string[]; leader_feedback?: string | null; updated_at?: string;
        };
      };
      discussion_threads: {
        Row: {
          id: string; team_id: string; title: string; category: string; created_by: string;
          pinned_at: string | null; locked_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; title: string; category?: string; created_by: string;
          pinned_at?: string | null; locked_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; title?: string; category?: string; pinned_at?: string | null;
          locked_at?: string | null; updated_at?: string;
        };
      };
      discussion_posts: {
        Row: {
          id: string; thread_id: string; author_id: string; parent_post_id: string | null;
          body: string; is_answer: boolean; deleted_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; thread_id: string; author_id: string; parent_post_id?: string | null;
          body: string; is_answer?: boolean; deleted_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; body?: string; is_answer?: boolean; deleted_at?: string | null;
          updated_at?: string;
        };
      };
      blockers: {
        Row: {
          id: string; team_id: string; user_id: string; title: string; description: string | null;
          topic_id: string | null; assignment_id: string | null; error_messages: string | null;
          code_url: string | null; priority: BlockerPriority; status: BlockerStatus;
          assigned_helper: string | null; resolution_notes: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; user_id: string; title: string; description?: string | null;
          topic_id?: string | null; assignment_id?: string | null; error_messages?: string | null;
          code_url?: string | null; priority?: BlockerPriority; status?: BlockerStatus;
          assigned_helper?: string | null; resolution_notes?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; title?: string; description?: string | null; topic_id?: string | null;
          assignment_id?: string | null; error_messages?: string | null; code_url?: string | null;
          priority?: BlockerPriority; status?: BlockerStatus; assigned_helper?: string | null;
          resolution_notes?: string | null; updated_at?: string;
        };
      };
      blocker_comments: {
        Row: {
          id: string; blocker_id: string; author_id: string; body: string;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; blocker_id: string; author_id: string; body: string;
          created_at?: string; updated_at?: string;
        };
        Update: { id?: string; body?: string; updated_at?: string };
      };
      announcements: {
        Row: {
          id: string; team_id: string; title: string; content: string | null; author_id: string;
          pinned: boolean; status: PublicationStatus; published_at: string | null;
          archived_at: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; team_id: string; title: string; content?: string | null; author_id: string;
          pinned?: boolean; status?: PublicationStatus; published_at?: string | null;
          archived_at?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; title?: string; content?: string | null; pinned?: boolean;
          status?: PublicationStatus; published_at?: string | null; archived_at?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string; user_id: string; team_id: string; type: NotificationType; title: string;
          body: string | null; entity_type: string | null; entity_id: string | null;
          link: string | null; read_at: string | null; created_at: string;
        };
        Insert: {
          id?: string; user_id: string; team_id: string; type: NotificationType; title: string;
          body?: string | null; entity_type?: string | null; entity_id?: string | null;
          link?: string | null; read_at?: string | null; created_at?: string;
        };
        Update: { id?: string; read_at?: string | null };
      };
      activity_logs: {
        Row: {
          id: string; team_id: string; user_id: string | null; action: string;
          entity_type: string | null; entity_id: string | null; metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string; team_id: string; user_id?: string | null; action: string;
          entity_type?: string | null; entity_id?: string | null; metadata?: Json;
          created_at?: string;
        };
        Update: { [k: string]: never };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      team_role: TeamRole;
      membership_status: MembershipStatus;
      invitation_status: InvitationStatus;
      phase_status: PhaseStatus;
      week_status: WeekStatus;
      topic_status: TopicStatus;
      topic_difficulty: TopicDifficulty;
      resource_type: ResourceType;
      assignment_type: AssignmentType;
      assignment_difficulty: AssignmentDifficulty;
      submission_type: SubmissionType;
      submission_status: SubmissionStatus;
      review_status: ReviewStatus;
      blocker_priority: BlockerPriority;
      blocker_status: BlockerStatus;
      publication_status: PublicationStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ────────────────────────────── Enums ──────────────────────────────
export type TeamRole = "admin" | "leader" | "member";
export type MembershipStatus =
  | "pending_invite" | "pending_approval" | "active" | "suspended" | "removed";
export type InvitationStatus = "sent" | "accepted" | "expired" | "revoked";
export type PhaseStatus = "draft" | "published" | "archived";
export type WeekStatus = "draft" | "published" | "archived";
export type TopicStatus = "locked" | "available" | "in_progress" | "completed";
export type TopicDifficulty = "beginner" | "intermediate" | "advanced";
export type ResourceType =
  | "article" | "video" | "book" | "documentation" | "course" | "tool" | "other";
export type AssignmentType =
  | "programming_exercise" | "written_explanation" | "research_activity"
  | "data_analysis" | "quiz" | "mini_project" | "group_project";
export type AssignmentDifficulty = "beginner" | "intermediate" | "advanced";
export type SubmissionType =
  | "github_repo" | "github_pr" | "github_commit" | "external_url"
  | "written" | "document" | "image" | "file";
export type SubmissionStatus =
  | "not_started" | "in_progress" | "submitted" | "under_review"
  | "revision_requested" | "approved" | "rejected";
export type ReviewStatus = "pending" | "approved" | "revision_requested" | "rejected";
export type BlockerPriority = "low" | "medium" | "high" | "critical";
export type BlockerStatus = "open" | "being_addressed" | "resolved";
export type PublicationStatus = "draft" | "published" | "archived";
export type NotificationType =
  | "new_assignment" | "deadline_approaching" | "submission_reviewed"
  | "revision_requested" | "new_announcement" | "weekly_report_due" | "blocker_updated"
  | "pending_member_review";

// ────────────────────────────── Row aliases ──────────────────────────────
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export type Phase = Database["public"]["Tables"]["phases"]["Row"];
export type Week = Database["public"]["Tables"]["weeks"]["Row"];
export type Topic = Database["public"]["Tables"]["topics"]["Row"];
export type LearningResource = Database["public"]["Tables"]["learning_resources"]["Row"];
export type TopicProgress = Database["public"]["Tables"]["topic_progress"]["Row"];
export type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
export type Submission = Database["public"]["Tables"]["submissions"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type WeeklyReport = Database["public"]["Tables"]["weekly_reports"]["Row"];
export type DiscussionThread = Database["public"]["Tables"]["discussion_threads"]["Row"];
export type DiscussionPost = Database["public"]["Tables"]["discussion_posts"]["Row"];
export type Blocker = Database["public"]["Tables"]["blockers"]["Row"];
export type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// ────────────────────────────── Joined shapes ──────────────────────────────
export type MemberWithProfile = TeamMember & {
  profiles: Pick<
    Profile, "id" | "email" | "full_name" | "username" | "avatar_url" | "github_username" | "created_at"
  >;
};

export type TopicWithProgress = Topic & {
  topic_progress?: Pick<TopicProgress, "status" | "completed_at" | "started_at"> | null;
};

export type AssignmentWithMeta = Assignment & {
  phases?: Pick<Phase, "id" | "title" | "phase_number"> | null;
  weeks?: Pick<Week, "id" | "title" | "week_number"> | null;
  assignment_recipients?: Array<Pick<AssignmentRecipientRow, "user_id">>;
};

export type AssignmentRecipientRow = Database["public"]["Tables"]["assignment_recipients"]["Row"];

export type SubmissionWithAssignment = Submission & {
  assignments: Pick<Assignment, "id" | "title" | "deadline" | "assignment_type" | "difficulty">;
};

export type NotificationRow = Notification;

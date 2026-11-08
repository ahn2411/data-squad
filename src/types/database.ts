/**
 * Supabase database types — Phase 1+2 subset (auth & membership).
 *
 * This file is a hand-written placeholder that matches
 * `supabase/migrations/0001_initial_schema.sql`. Once you apply the
 * migration to your Supabase project, regenerate the authoritative types:
 *
 *   supabase gen types typescript --project-id <your-project-ref> \
 *     > src/types/database.ts
 *
 * The generated output is structurally compatible with what the code below
 * expects (Database["public"]["Tables"]["<name>"]["Row"]).
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
      teams: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          github_username: string | null;
          github_profile_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          github_username?: string | null;
          github_profile_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          github_username?: string | null;
          github_profile_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
          membership_status: MembershipStatus;
          joined_at: string | null;
          suspended_at: string | null;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: TeamRole;
          membership_status?: MembershipStatus;
          joined_at?: string | null;
          suspended_at?: string | null;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: TeamRole;
          membership_status?: MembershipStatus;
          joined_at?: string | null;
          suspended_at?: string | null;
          removed_at?: string | null;
          updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          team_id: string;
          email: string;
          role: TeamRole;
          invited_by: string;
          status: InvitationStatus;
          expires_at: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          email: string;
          role?: TeamRole;
          invited_by: string;
          status?: InvitationStatus;
          expires_at?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          email?: string;
          role?: TeamRole;
          invited_by?: string;
          status?: InvitationStatus;
          expires_at?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      team_role: TeamRole;
      membership_status: MembershipStatus;
      invitation_status: InvitationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type TeamRole = "admin" | "leader" | "member";
export type MembershipStatus =
  | "pending_invite"
  | "pending_approval"
  | "active"
  | "suspended"
  | "removed";
export type InvitationStatus = "sent" | "accepted" | "expired" | "revoked";

/** Convenience row types used across feature modules. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];

/** Membership row joined with profile — the shape returned by the members query. */
export type MemberWithProfile = TeamMember & {
  profiles: Pick<
    Profile,
    | "id"
    | "email"
    | "full_name"
    | "username"
    | "avatar_url"
    | "github_username"
    | "created_at"
  >;
};

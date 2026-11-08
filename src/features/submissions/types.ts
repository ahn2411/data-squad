import type { Database } from "@/types/database";

/**
 * Local type aliases for tables that the shared database.ts doesn't export
 * as standalone Row aliases. We do not modify database.ts (shared file); we
 * derive the types directly from the Database shape.
 */
export type SubmissionRevisionRow =
  Database["public"]["Tables"]["submission_revisions"]["Row"];
export type SubmissionRevisionInsert =
  Database["public"]["Tables"]["submission_revisions"]["Insert"];

export type SubmissionFileRow =
  Database["public"]["Tables"]["submission_files"]["Row"];

export type AssignmentInsert =
  Database["public"]["Tables"]["assignments"]["Insert"];
export type AssignmentUpdate =
  Database["public"]["Tables"]["assignments"]["Update"];

export type SubmissionInsert =
  Database["public"]["Tables"]["submissions"]["Insert"];
export type SubmissionUpdate =
  Database["public"]["Tables"]["submissions"]["Update"];

export type ReviewInsert = Database["public"]["Tables"]["reviews"]["Insert"];

// Re-export commonly used aliases from database.ts for caller convenience.
export type {
  Submission,
  Review,
  Assignment,
  Profile,
} from "@/types/database";

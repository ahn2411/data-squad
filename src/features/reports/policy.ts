export const WEEKLY_REPORT_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function getWeeklyReportEditDeadline(submittedAt: string): Date {
  return new Date(Date.parse(submittedAt) + WEEKLY_REPORT_EDIT_WINDOW_MS);
}

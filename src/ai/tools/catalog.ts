/**
 * Catalogue of the server's permission-aware tools, mapped to UI copy.
 *
 * The tools themselves live server-side
 * (`supabase/functions/_shared/ai/tools/`): they validate inputs, run as the
 * signed-in user, and can never issue arbitrary SQL. The browser only ever
 * sees these labels as a status line ("Checked your weak chapters").
 */
export const TOOL_LABELS: Record<string, { label: string; detail: string }> = {
  search_resources: { label: 'Searched your library', detail: 'Notes, revision sheets and diagrams' },
  search_pyqs: { label: 'Checked the PYQ archive', detail: 'Real past-year questions' },
  get_chapter: { label: 'Loaded the chapter', detail: 'Syllabus topics and prerequisites' },
  get_formula: { label: 'Looked up formulas / reactions', detail: 'Formula sheet + Reaction Lab' },
  get_user_progress: { label: 'Read your progress', detail: 'Accuracy and weak chapters' },
  get_user_mistakes: { label: 'Read your MistakeBook', detail: 'Your recent wrong answers' },
  get_upcoming_exams: { label: 'Checked upcoming exams', detail: 'Deadlines that change the advice' },
  get_bookmarks: { label: 'Checked your bookmarks', detail: 'What you flagged to revisit' },
}

export function toolLabel(name: string): string {
  return TOOL_LABELS[name]?.label ?? name.replace(/_/g, ' ')
}

export function toolDetail(name: string): string | undefined {
  return TOOL_LABELS[name]?.detail
}

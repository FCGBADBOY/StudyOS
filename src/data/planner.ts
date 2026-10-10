import type { StudySession, WeeklyPlanDay } from '@/types'

function s(
  id: string,
  subjectId: StudySession['subjectId'],
  subjectName: string,
  topic: string,
  duration: number,
  priority: StudySession['priority'],
  completed: boolean,
  time: string,
  notes?: string,
): StudySession {
  return { id, subjectId, subjectName, topic, duration, priority, completed, time, notes }
}

/** Today's plan — two sessions done, three ahead. */
export const TODAY_SESSIONS: StudySession[] = [
  s('ts-1', 'chemistry', 'Chemistry', 'Electrochemistry — Nernst Equation', 35, 'High', true, '07:10',
    'Numericals from NCERT exemplar'),
  s('ts-2', 'physics', 'Physics', 'Current Electricity — Kirchhoff’s Laws', 30, 'High', true, '16:20',
    'Revisit the mock paper question'),
  s('ts-3', 'mathematics', 'Mathematics', 'Integrals — By Parts', 45, 'High', false, '18:00',
    '10 solved PYQs, target 80% accuracy'),
  s('ts-4', 'chemistry', 'Chemistry', 'Alcohols, Phenols and Ethers — Revision', 25, 'Medium', false, '20:15',
    'Reaction map + named reactions'),
  s('ts-5', 'computer-science', 'Computer Science', 'SQL Queries — Practice Set 3', 20, 'Low', false, '21:00',
    'Optional — move to tomorrow if tired'),
]

/** Monday-anchored plan for the current week. */
export const WEEK_PLAN: WeeklyPlanDay[] = [
  {
    id: 'day-1',
    day: 'Mon',
    date: '2026-10-05',
    sessions: [
      s('w1-1', 'physics', 'Physics', 'Electrostatics — Numericals', 45, 'High', true, '18:00'),
      s('w1-2', 'chemistry', 'Chemistry', 'Solutions — Colligative Properties', 40, 'Medium', true, '19:30'),
      s('w1-3', 'english', 'English', 'Lost Spring — Long answers', 30, 'Low', true, '21:00'),
    ],
    plannedMinutes: 115,
    doneMinutes: 115,
  },
  {
    id: 'day-2',
    day: 'Tue',
    date: '2026-10-06',
    sessions: [
      s('w2-1', 'mathematics', 'Mathematics', 'Determinants — Properties', 50, 'High', true, '18:00'),
      s('w2-2', 'physics', 'Physics', 'Current Electricity — Kirchhoff', 30, 'High', false, '19:30'),
      s('w2-3', 'computer-science', 'Computer Science', 'Stack & Queue', 25, 'Medium', false, '21:00'),
    ],
    plannedMinutes: 105,
    doneMinutes: 50,
  },
  {
    id: 'day-3',
    day: 'Wed',
    date: '2026-10-07',
    sessions: [
      s('w3-1', 'chemistry', 'Chemistry', 'Reimer–Tiemann & named reactions', 40, 'High', false, '18:00'),
      s('w3-2', 'mathematics', 'Mathematics', 'Integration by parts', 45, 'High', false, '19:30'),
    ],
    plannedMinutes: 85,
    doneMinutes: 0,
  },
  {
    id: 'day-4',
    day: 'Thu',
    date: '2026-10-08',
    sessions: [
      s('w4-1', 'physics', 'Physics', 'Electromagnetic Induction', 45, 'High', false, '18:00'),
      s('w4-2', 'english', 'English', 'The Last Lesson — Extract practice', 30, 'Low', false, '20:00'),
      s('w4-3', 'chemistry', 'Chemistry', 'Coordination Compounds', 35, 'Medium', false, '21:00'),
    ],
    plannedMinutes: 110,
    doneMinutes: 0,
  },
  {
    id: 'day-5',
    day: 'Fri',
    date: '2026-10-09',
    sessions: [
      s('w5-1', 'mathematics', 'Mathematics', 'Differential Equations', 50, 'High', false, '18:00'),
      s('w5-2', 'computer-science', 'Computer Science', 'SQL practice', 30, 'Medium', false, '20:00'),
    ],
    plannedMinutes: 80,
    doneMinutes: 0,
  },
  {
    id: 'day-6',
    day: 'Sat',
    date: '2026-10-10',
    sessions: [
      s('w6-1', 'physics', 'Physics', 'Full-length PYQ mock — 2025 Set 1', 90, 'High', false, '10:00'),
      s('w6-2', 'chemistry', 'Chemistry', 'MistakeBook revision', 40, 'High', false, '17:00'),
      s('w6-3', 'mathematics', 'Mathematics', 'Probability — Bayes theorem', 45, 'Medium', false, '19:00'),
    ],
    plannedMinutes: 175,
    doneMinutes: 0,
  },
  {
    id: 'day-7',
    day: 'Sun',
    date: '2026-10-11',
    sessions: [
      s('w7-1', 'physics', 'Physics', 'Weak chapters sweep', 60, 'Medium', false, '11:00'),
      s('w7-2', 'english', 'English', 'Essay & letter writing', 40, 'Low', false, '17:00'),
    ],
    plannedMinutes: 100,
    doneMinutes: 0,
  },
]

/** Plan-level roll-ups used by the planner header. */
export function planSummary() {
  const all = WEEK_PLAN.flatMap((day) => day.sessions)
  return {
    sessions: all.length,
    completed: all.filter((session) => session.completed).length,
    plannedMinutes: WEEK_PLAN.reduce((sum, day) => sum + day.plannedMinutes, 0),
    doneMinutes: WEEK_PLAN.reduce((sum, day) => sum + day.doneMinutes, 0),
    todayTotal: TODAY_SESSIONS.length,
    todayDone: TODAY_SESSIONS.filter((session) => session.completed).length,
  }
}

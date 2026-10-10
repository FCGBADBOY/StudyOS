import type { NotificationItem } from '@/types'

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Unit Test III in 15 days',
    body: 'Physics and Chemistry syllabus is 68% covered. Start revision this week.',
    time: '2h ago',
    read: false,
    kind: 'exam',
  },
  {
    id: 'notif-2',
    title: '12-day streak unlocked',
    body: 'Longest streak this month. Keep the evening sessions going.',
    time: '5h ago',
    read: false,
    kind: 'streak',
  },
  {
    id: 'notif-3',
    title: 'New PYQ set uploaded',
    body: 'CBSE 2025 Chemistry Set 1 with detailed solutions is now available.',
    time: 'Yesterday',
    read: true,
    kind: 'system',
  },
  {
    id: 'notif-4',
    title: 'Accuracy up by 6%',
    body: 'Your Chemistry accuracy improved after the Electrochemistry sprint.',
    time: '2 days ago',
    read: true,
    kind: 'progress',
  },
]

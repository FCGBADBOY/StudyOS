/**
 * Tiny class-name helper (no external dependency).
 * Usage: cn('p-4', isActive && 'bg-brand')
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
